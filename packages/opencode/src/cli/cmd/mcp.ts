import { cmd } from "./cmd"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { effectCmd } from "../effect-cmd"
import { Cause } from "effect"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js"
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { MCP } from "../../mcp"
import { McpAuth } from "../../mcp/auth"
import { McpOAuthProvider } from "../../mcp/oauth-provider"
import { Config } from "@/config/config"
import { ConfigMCPV1 } from "@opencode-ai/core/v1/config/mcp"
import { InstanceRef } from "@/effect/instance-ref"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import path from "path"
import { Global } from "@opencode-ai/core/global"
import { modify, applyEdits } from "jsonc-parser"
import { Filesystem } from "@/util/filesystem"
import { Effect } from "effect"

function getAuthStatusIcon(status: MCP.AuthStatus): string {
  switch (status) {
    case "authenticated":
      return "✓"
    case "expired":
      return "⚠"
    case "not_authenticated":
      return "✗"
  }
}

function getAuthStatusText(status: MCP.AuthStatus): string {
  switch (status) {
    case "authenticated":
      return "đã xác thực"
    case "expired":
      return "hết hạn"
    case "not_authenticated":
      return "chưa xác thực"
  }
}

type McpEntry = NonNullable<ConfigV1.Info["mcp"]>[string]

type McpConfigured = ConfigMCPV1.Info
function isMcpConfigured(config: McpEntry): config is McpConfigured {
  return typeof config === "object" && config !== null && "type" in config
}

type McpRemote = Extract<McpConfigured, { type: "remote" }>
function isMcpRemote(config: McpEntry): config is McpRemote {
  return isMcpConfigured(config) && config.type === "remote"
}

function configuredServers(config: ConfigV1.Info) {
  return Object.entries(config.mcp ?? {}).filter((entry): entry is [string, McpConfigured] => isMcpConfigured(entry[1]))
}

function oauthServers(config: ConfigV1.Info) {
  return configuredServers(config).filter(
    (entry): entry is [string, McpRemote] => isMcpRemote(entry[1]) && entry[1].oauth !== false,
  )
}

function listState() {
  return Effect.gen(function* () {
    const cfg = yield* Config.Service
    const mcp = yield* MCP.Service
    const config = yield* cfg.get()
    const statuses = yield* mcp.status()
    const stored = yield* Effect.all(
      Object.fromEntries(configuredServers(config).map(([name]) => [name, mcp.hasStoredTokens(name)])),
      { concurrency: "unbounded" },
    )
    return { config, statuses, stored }
  })
}

function authState() {
  return Effect.gen(function* () {
    const cfg = yield* Config.Service
    const mcp = yield* MCP.Service
    const config = yield* cfg.get()
    const auth = yield* Effect.all(
      Object.fromEntries(oauthServers(config).map(([name]) => [name, mcp.getAuthStatus(name)])),
      { concurrency: "unbounded" },
    )
    return { config, auth }
  })
}

export const McpCommand = cmd({
  command: "mcp",
  describe: "quản lý máy chủ MCP (Model Context Protocol)",
  builder: (yargs) =>
    yargs
      .command(McpAddCommand)
      .command(McpListCommand)
      .command(McpAuthCommand)
      .command(McpLogoutCommand)
      .command(McpDebugCommand)
      .demandCommand(),
  async handler() {},
})

export const McpListCommand = effectCmd({
  command: "list",
  aliases: ["ls"],
  describe: "liệt kê máy chủ MCP và trạng thái của chúng",
  handler: Effect.fn("Cli.mcp.list")(function* () {
    UI.empty()
    prompts.intro("Máy chủ MCP")

    const { config, statuses, stored } = yield* listState()
    const servers = configuredServers(config)

    if (servers.length === 0) {
      prompts.log.warn("Chưa cấu hình máy chủ MCP nào")
      prompts.outro("Thêm máy chủ bằng: opencode mcp add")
      return
    }

    for (const [name, serverConfig] of servers) {
      const status = statuses[name]
      const hasOAuth = isMcpRemote(serverConfig) && !!serverConfig.oauth
      const hasStoredTokens = stored[name]

      let statusIcon: string
      let statusText: string
      let hint = ""

      if (!status) {
        statusIcon = "○"
        statusText = "chưa khởi tạo"
      } else if (status.status === "connected") {
        statusIcon = "✓"
        statusText = "đã kết nối"
        if (hasOAuth && hasStoredTokens) {
          hint = " (OAuth)"
        }
      } else if (status.status === "disabled") {
        statusIcon = "○"
        statusText = "bị tắt"
      } else if (status.status === "needs_auth") {
        statusIcon = "⚠"
        statusText = "cần xác thực"
      } else if (status.status === "needs_client_registration") {
        statusIcon = "✗"
        statusText = "cần đăng ký client"
        hint = "\n    " + status.error
      } else {
        statusIcon = "✗"
        statusText = "thất bại"
        hint = "\n    " + status.error
      }

      const typeHint = serverConfig.type === "remote" ? serverConfig.url : serverConfig.command.join(" ")
      prompts.log.info(
        `${statusIcon} ${name} ${UI.Style.TEXT_DIM}${statusText}${hint}\n    ${UI.Style.TEXT_DIM}${typeHint}`,
      )
    }

    prompts.outro(`${servers.length} máy chủ`)
  }),
})

export const McpAuthCommand = effectCmd({
  command: "auth [name]",
  describe: "xác thực với một máy chủ MCP hỗ trợ OAuth",
  builder: (yargs) =>
    yargs
      .positional("name", {
        describe: "tên của máy chủ MCP",
        type: "string",
      })
      .command(McpAuthListCommand),
  handler: Effect.fn("Cli.mcp.auth")(function* (args) {
    UI.empty()
    prompts.intro("Xác thực OAuth MCP")

    const { config, auth } = yield* authState()
    const mcpServers = config.mcp ?? {}
    const servers = oauthServers(config)

    if (servers.length === 0) {
      prompts.log.warn("Chưa cấu hình máy chủ MCP nào hỗ trợ OAuth")
      prompts.log.info("Máy chủ MCP remote mặc định hỗ trợ OAuth. Thêm một máy chủ remote trong opencode.json:")
      prompts.log.info(`
  "mcp": {
    "my-server": {
      "type": "remote",
      "url": "https://example.com/mcp"
    }
  }`)
      prompts.outro("Hoàn tất")
      return
    }

    let serverName = args.name
    if (!serverName) {
      // Build options with auth status
      const options = servers.map(([name, cfg]) => {
        const authStatus = auth[name]
        const icon = getAuthStatusIcon(authStatus)
        const statusText = getAuthStatusText(authStatus)
        const url = cfg.url
        return {
          label: `${icon} ${name} (${statusText})`,
          value: name,
          hint: url,
        }
      })

      const selected = yield* Effect.promise(() =>
        prompts.select({
          message: "Chọn máy chủ MCP cần xác thực",
          options,
        }),
      )
      if (prompts.isCancel(selected)) throw new UI.CancelledError()
      serverName = selected
    }

    const serverConfig = mcpServers[serverName]
    if (!serverConfig) {
      prompts.log.error(`Không tìm thấy máy chủ MCP: ${serverName}`)
      prompts.outro("Hoàn tất")
      return
    }

    if (!isMcpRemote(serverConfig) || serverConfig.oauth === false) {
      prompts.log.error(`Máy chủ MCP ${serverName} không phải là máy chủ remote hỗ trợ OAuth`)
      prompts.outro("Hoàn tất")
      return
    }

    // Check if already authenticated
    const authStatus = auth[serverName] ?? (yield* MCP.Service.use((mcp) => mcp.getAuthStatus(serverName)))
    if (authStatus === "authenticated") {
      const confirm = yield* Effect.promise(() =>
        prompts.confirm({
          message: `${serverName} đã có thông tin xác thực hợp lệ. Xác thực lại?`,
        }),
      )
      if (prompts.isCancel(confirm) || !confirm) {
        prompts.outro("Đã hủy")
        return
      }
    } else if (authStatus === "expired") {
      prompts.log.warn(`Thông tin xác thực của ${serverName} đã hết hạn. Đang xác thực lại...`)
    }

    const spinner = prompts.spinner()
    spinner.start("Đang bắt đầu luồng OAuth...")

    yield* MCP.Service.use((mcp) =>
      mcp.authenticate(serverName, (url) => {
        spinner.stop("Ủy quyền trong trình duyệt của bạn:")
        prompts.log.info(url)
        spinner.start("Đang chờ ủy quyền...")
      }),
    ).pipe(
      Effect.tap((status) =>
        Effect.sync(() => {
          if (status.status === "connected") {
            spinner.stop("Xác thực thành công!")
          } else if (status.status === "needs_client_registration") {
            spinner.stop("Xác thực thất bại", 1)
            prompts.log.error(status.error)
            prompts.log.info("Thêm clientId vào cấu hình máy chủ MCP của bạn:")
            prompts.log.info(`
  "mcp": {
    "${serverName}": {
      "type": "remote",
      "url": "${serverConfig.url}",
      "oauth": {
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret"
      }
    }
  }`)
          } else if (status.status === "failed") {
            spinner.stop("Xác thực thất bại", 1)
            prompts.log.error(status.error)
          } else {
            spinner.stop("Trạng thái không mong đợi: " + status.status, 1)
          }
        }),
      ),
      Effect.catchCause((cause) =>
        Effect.sync(() => {
          spinner.stop("Xác thực thất bại", 1)
          const error = Cause.squash(cause)
          prompts.log.error(error instanceof Error ? error.message : String(error))
        }),
      ),
    )

    prompts.outro("Hoàn tất")
  }),
})

export const McpAuthListCommand = effectCmd({
  command: "list",
  aliases: ["ls"],
  describe: "liệt kê các máy chủ MCP hỗ trợ OAuth và trạng thái xác thực",
  handler: Effect.fn("Cli.mcp.auth.list")(function* () {
    UI.empty()
    prompts.intro("Trạng thái OAuth MCP")

    const { config, auth } = yield* authState()
    const servers = oauthServers(config)

    if (servers.length === 0) {
      prompts.log.warn("Chưa cấu hình máy chủ MCP nào hỗ trợ OAuth")
      prompts.outro("Hoàn tất")
      return
    }

    for (const [name, serverConfig] of servers) {
      const authStatus = auth[name]
      const icon = getAuthStatusIcon(authStatus)
      const statusText = getAuthStatusText(authStatus)
      const url = serverConfig.url

      prompts.log.info(`${icon} ${name} ${UI.Style.TEXT_DIM}${statusText}\n    ${UI.Style.TEXT_DIM}${url}`)
    }

    prompts.outro(`${servers.length} máy chủ hỗ trợ OAuth`)
  }),
})

export const McpLogoutCommand = effectCmd({
  command: "logout [name]",
  describe: "xóa thông tin xác thực OAuth của một máy chủ MCP",
  builder: (yargs) =>
    yargs.positional("name", {
      describe: "tên của máy chủ MCP",
      type: "string",
    }),
  handler: Effect.fn("Cli.mcp.logout")(function* (args) {
    UI.empty()
    prompts.intro("Đăng xuất OAuth MCP")

    const credentials = yield* McpAuth.Service.use((auth) => auth.all())
    const serverNames = Object.keys(credentials)

    if (serverNames.length === 0) {
      prompts.log.warn("Không có thông tin xác thực OAuth MCP nào được lưu")
      prompts.outro("Hoàn tất")
      return
    }

    let serverName = args.name
    if (!serverName) {
      const selected = yield* Effect.promise(() =>
        prompts.select({
          message: "Chọn máy chủ MCP để đăng xuất",
          options: serverNames.map((name) => {
            const entry = credentials[name]
            const hasTokens = !!entry.tokens
            const hasClient = !!entry.clientInfo
            let hint = ""
            if (hasTokens && hasClient) hint = "tokens + client"
            else if (hasTokens) hint = "tokens"
            else if (hasClient) hint = "đăng ký client"
            return {
              label: name,
              value: name,
              hint,
            }
          }),
        }),
      )
      if (prompts.isCancel(selected)) throw new UI.CancelledError()
      serverName = selected
    }

    if (!credentials[serverName]) {
      prompts.log.error(`Không tìm thấy thông tin xác thực cho: ${serverName}`)
      prompts.outro("Hoàn tất")
      return
    }

    yield* MCP.Service.use((mcp) => mcp.removeAuth(serverName))
    prompts.log.success(`Đã xóa thông tin xác thực OAuth của ${serverName}`)
    prompts.outro("Hoàn tất")
  }),
})

async function resolveConfigPath(baseDir: string, global = false) {
  // Check for existing config files (prefer .jsonc over .json, check .opencode/ subdirectory too)
  const candidates = [path.join(baseDir, "opencode.json"), path.join(baseDir, "opencode.jsonc")]

  if (!global) {
    candidates.push(path.join(baseDir, ".opencode", "opencode.json"), path.join(baseDir, ".opencode", "opencode.jsonc"))
  }

  for (const candidate of candidates) {
    if (await Filesystem.exists(candidate)) {
      return candidate
    }
  }

  // Default to opencode.json if none exist
  return candidates[0]
}

async function addMcpToConfig(name: string, mcpConfig: ConfigMCPV1.Info, configPath: string) {
  let text = "{}"
  if (await Filesystem.exists(configPath)) {
    text = await Filesystem.readText(configPath)
  }

  // Use jsonc-parser to modify while preserving comments
  const edits = modify(text, ["mcp", name], mcpConfig, {
    formattingOptions: { tabSize: 2, insertSpaces: true },
  })
  const result = applyEdits(text, edits)

  await Filesystem.write(configPath, result)

  return configPath
}

export const McpAddCommand = effectCmd({
  command: "add [name]",
  describe: "thêm một máy chủ MCP",
  builder: (yargs) =>
    yargs
      .positional("name", {
        describe: "tên của máy chủ MCP",
        type: "string",
      })
      .option("url", {
        describe: "URL của máy chủ MCP remote",
        type: "string",
      })
      .option("env", {
        describe: "biến môi trường cho máy chủ MCP cục bộ (KEY=VALUE)",
        type: "string",
        array: true,
      })
      .option("header", {
        describe: "HTTP header cho máy chủ MCP remote (KEY=VALUE)",
        type: "string",
        array: true,
      }),
  handler: Effect.fn("Cli.mcp.add")(function* (args) {
    const maybeCtx = yield* InstanceRef
    if (!maybeCtx) return yield* Effect.die("InstanceRef not provided")
    const ctx = maybeCtx
    yield* Effect.promise(async () => {
      const command = args["--"] ?? []
      if (!args.name && (args.url || args.env?.length || args.header?.length || command.length)) {
        throw new Error("Cần tên máy chủ khi cấu hình MCP ở chế độ không tương tác")
      }
      if (args.name) {
        if (!!args.url === !!command.length) {
          throw new Error("Cung cấp --url <url> hoặc một lệnh sau --")
        }
        if (args.url && !URL.canParse(args.url)) {
          throw new Error(`URL không hợp lệ: ${args.url}`)
        }
        if (args.url && args.env?.length) {
          throw new Error("--env chỉ hợp lệ với máy chủ MCP cục bộ")
        }
        if (command.length && args.header?.length) {
          throw new Error("--header chỉ hợp lệ với máy chủ MCP remote")
        }

        const entries = (values: string[], kind: string) =>
          Object.fromEntries(
            values.map((entry) => {
              const index = entry.indexOf("=")
              if (index < 1) throw new Error(`${kind} không hợp lệ: ${entry}. Mong muốn KEY=VALUE`)
              return [entry.slice(0, index), entry.slice(index + 1)]
            }),
          )
        const environment = entries(args.env ?? [], "Biến môi trường")
        const headers = entries(args.header ?? [], "HTTP header")
        const mcpConfig: ConfigMCPV1.Info = args.url
          ? {
              type: "remote",
              url: args.url,
              ...(Object.keys(headers).length ? { headers } : {}),
            }
          : {
              type: "local",
              command,
              ...(Object.keys(environment).length ? { environment } : {}),
            }

        const configPath = await resolveConfigPath(Global.Path.config, true)
        await addMcpToConfig(args.name, mcpConfig, configPath)
        prompts.log.success(`Đã thêm máy chủ MCP "${args.name}" vào ${configPath}`)
        return
      }

      UI.empty()
      prompts.intro("Thêm máy chủ MCP")

      const project = ctx.project

      // Resolve config paths eagerly for hints
      const [projectConfigPath, globalConfigPath] = await Promise.all([
        resolveConfigPath(ctx.worktree),
        resolveConfigPath(Global.Path.config, true),
      ])

      // Determine scope
      let configPath = globalConfigPath
      if (project.vcs === "git") {
        const scopeResult = await prompts.select({
          message: "Vị trí",
          options: [
            {
              label: "Project hiện tại",
              value: projectConfigPath,
              hint: projectConfigPath,
            },
            {
              label: "Toàn cục",
              value: globalConfigPath,
              hint: globalConfigPath,
            },
          ],
        })
        if (prompts.isCancel(scopeResult)) throw new UI.CancelledError()
        configPath = scopeResult
      }

      const name = await prompts.text({
        message: "Nhập tên máy chủ MCP",
        validate: (x) => (x && x.length > 0 ? undefined : "Bắt buộc"),
      })
      if (prompts.isCancel(name)) throw new UI.CancelledError()

      const type = await prompts.select({
        message: "Chọn loại máy chủ MCP",
        options: [
          {
            label: "Local",
            value: "local",
            hint: "Chạy một lệnh cục bộ",
          },
          {
            label: "Remote",
            value: "remote",
            hint: "Kết nối đến một URL từ xa",
          },
        ],
      })
      if (prompts.isCancel(type)) throw new UI.CancelledError()

      if (type === "local") {
        const command = await prompts.text({
          message: "Nhập lệnh cần chạy",
          placeholder: "e.g., opencode x @modelcontextprotocol/server-filesystem",
          validate: (x) => (x && x.length > 0 ? undefined : "Bắt buộc"),
        })
        if (prompts.isCancel(command)) throw new UI.CancelledError()

        const mcpConfig: ConfigMCPV1.Info = {
          type: "local",
          command: command.split(" "),
        }

        await addMcpToConfig(name, mcpConfig, configPath)
        prompts.log.success(`Đã thêm máy chủ MCP "${name}" vào ${configPath}`)
        prompts.outro("Đã thêm máy chủ MCP thành công")
        return
      }

      if (type === "remote") {
        const url = await prompts.text({
          message: "Nhập URL của máy chủ MCP",
          placeholder: "e.g., https://example.com/mcp",
          validate: (x) => {
            if (!x) return "Bắt buộc"
            if (x.length === 0) return "Bắt buộc"
            const isValid = URL.canParse(x)
            return isValid ? undefined : "URL không hợp lệ"
          },
        })
        if (prompts.isCancel(url)) throw new UI.CancelledError()

        const useOAuth = await prompts.confirm({
          message: "Máy chủ này có yêu cầu xác thực OAuth không?",
          initialValue: false,
        })
        if (prompts.isCancel(useOAuth)) throw new UI.CancelledError()

        let mcpConfig: ConfigMCPV1.Info

        if (useOAuth) {
          const hasClientId = await prompts.confirm({
            message: "Bạn đã có client ID đăng ký sẵn chưa?",
            initialValue: false,
          })
          if (prompts.isCancel(hasClientId)) throw new UI.CancelledError()

          if (hasClientId) {
            const clientId = await prompts.text({
              message: "Nhập client ID",
              validate: (x) => (x && x.length > 0 ? undefined : "Bắt buộc"),
            })
            if (prompts.isCancel(clientId)) throw new UI.CancelledError()

            const hasSecret = await prompts.confirm({
              message: "Bạn có client secret không?",
              initialValue: false,
            })
            if (prompts.isCancel(hasSecret)) throw new UI.CancelledError()

            let clientSecret: string | undefined
            if (hasSecret) {
              const secret = await prompts.password({
                message: "Nhập client secret",
              })
              if (prompts.isCancel(secret)) throw new UI.CancelledError()
              clientSecret = secret
            }

            mcpConfig = {
              type: "remote",
              url,
              oauth: {
                clientId,
                ...(clientSecret && { clientSecret }),
              },
            }
          } else {
            mcpConfig = {
              type: "remote",
              url,
              oauth: {},
            }
          }
        } else {
          mcpConfig = {
            type: "remote",
            url,
          }
        }

        await addMcpToConfig(name, mcpConfig, configPath)
        prompts.log.success(`Đã thêm máy chủ MCP "${name}" vào ${configPath}`)
      }

      prompts.outro("Đã thêm máy chủ MCP thành công")
    })
  }),
})

export const McpDebugCommand = effectCmd({
  command: "debug <name>",
  describe: "gỡ lỗi kết nối OAuth cho một máy chủ MCP",
  builder: (yargs) =>
    yargs.positional("name", {
      describe: "tên của máy chủ MCP",
      type: "string",
      demandOption: true,
    }),
  handler: Effect.fn("Cli.mcp.debug")(function* (args) {
    const config = yield* Config.Service.use((cfg) => cfg.get())
    const mcp = yield* MCP.Service
    const auth = yield* McpAuth.Service
    const serverConfig = config.mcp?.[args.name]
    const authInfo =
      serverConfig && isMcpRemote(serverConfig) && serverConfig.oauth !== false
        ? yield* Effect.all({
            authStatus: mcp.getAuthStatus(args.name),
            entry: auth.get(args.name),
          })
        : undefined
    yield* Effect.promise(async () => {
      UI.empty()
      prompts.intro("Gỡ lỗi OAuth MCP")

      const serverName = args.name

      if (!serverConfig) {
        prompts.log.error(`Không tìm thấy máy chủ MCP: ${serverName}`)
        prompts.outro("Hoàn tất")
        return
      }

      if (!isMcpRemote(serverConfig)) {
        prompts.log.error(`Máy chủ MCP ${serverName} không phải là máy chủ remote`)
        prompts.outro("Hoàn tất")
        return
      }

      if (serverConfig.oauth === false) {
        prompts.log.warn(`Máy chủ MCP ${serverName} đã tắt OAuth một cách rõ ràng`)
        prompts.outro("Hoàn tất")
        return
      }

      prompts.log.info(`Máy chủ: ${serverName}`)
      prompts.log.info(`URL: ${serverConfig.url}`)

      const { authStatus, entry } = authInfo!
      prompts.log.info(`Trạng thái xác thực: ${getAuthStatusIcon(authStatus)} ${getAuthStatusText(authStatus)}`)

      if (entry?.tokens) {
        prompts.log.info(
          `  Access token: ${entry.tokens.accessToken.length > 8 ? `${entry.tokens.accessToken.slice(0, 4)}***${entry.tokens.accessToken.slice(-4)}` : "***"}`,
        )
        if (entry.tokens.expiresAt) {
          const expiresDate = new Date(entry.tokens.expiresAt * 1000)
          const isExpired = entry.tokens.expiresAt < Date.now() / 1000
          prompts.log.info(`  Hết hạn: ${expiresDate.toISOString()} ${isExpired ? "(HẾT HẠN)" : ""}`)
        }
        if (entry.tokens.refreshToken) {
          prompts.log.info(`  Refresh token: có`)
        }
      }
      if (entry?.clientInfo) {
        prompts.log.info(`  Client ID: ${entry.clientInfo.clientId}`)
        if (entry.clientInfo.clientSecretExpiresAt) {
          const expiresDate = new Date(entry.clientInfo.clientSecretExpiresAt * 1000)
          prompts.log.info(`  Client secret hết hạn: ${expiresDate.toISOString()}`)
        }
      }

      const spinner = prompts.spinner()
      spinner.start("Đang thử kết nối...")

      // Test basic HTTP connectivity first
      try {
        const response = await fetch(serverConfig.url, {
          method: "POST",
          headers: {
            ...serverConfig.headers,
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "initialize",
            params: {
              protocolVersion: LATEST_PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: "opencode-debug", version: InstallationVersion },
            },
            id: 1,
          }),
        })

        spinner.stop(`Phản hồi HTTP: ${response.status} ${response.statusText}`)

        // Check for WWW-Authenticate header
        const wwwAuth = response.headers.get("www-authenticate")
        if (wwwAuth) {
          prompts.log.info(`WWW-Authenticate: ${wwwAuth}`)
        }

        if (response.status === 401) {
          prompts.log.info("Kiểm tra ban đầu chưa xác thực trả về 401, nên máy chủ này yêu cầu OAuth")

          // Try to discover OAuth metadata
          const oauthConfig = typeof serverConfig.oauth === "object" ? serverConfig.oauth : undefined
          const authProvider = new McpOAuthProvider(
            serverName,
            serverConfig.url,
            {
              clientId: oauthConfig?.clientId,
              clientSecret: oauthConfig?.clientSecret,
              scope: oauthConfig?.scope,
              redirectUri: oauthConfig?.redirectUri,
            },
            {
              onRedirect: async () => {},
            },
            auth,
          )

          prompts.log.info("Đang thử luồng OAuth (không hoàn tất ủy quyền)...")

          // Try creating transport with auth provider to trigger discovery
          const transport = new StreamableHTTPClientTransport(new URL(serverConfig.url), {
            authProvider,
            requestInit: serverConfig.headers ? { headers: serverConfig.headers } : undefined,
          })

          try {
            const client = new Client({
              name: "opencode-debug",
              version: InstallationVersion,
            })
            await client.connect(transport)
            prompts.log.success("Kết nối thành công (đã xác thực từ trước)")
            await client.close()
          } catch (error) {
            if (error instanceof UnauthorizedError) {
              prompts.log.info(`Luồng OAuth đã được kích hoạt: ${error.message}`)

              // Check if dynamic registration would be attempted
              const clientInfo = await authProvider.clientInformation()
              if (clientInfo) {
                prompts.log.info(`Client ID khả dụng: ${clientInfo.client_id}`)
              } else {
                prompts.log.info("Không có client ID - sẽ thử đăng ký động")
              }
            } else {
              prompts.log.error(`Lỗi kết nối: ${error instanceof Error ? error.message : String(error)}`)
            }
          }
        } else if (response.status >= 200 && response.status < 300) {
          prompts.log.success("Máy chủ phản hồi thành công (không cần xác thực hoặc đã xác thực)")
          const body = await response.text()
          try {
            const json = JSON.parse(body)
            if (json.result?.serverInfo) {
              prompts.log.info(`Thông tin máy chủ: ${JSON.stringify(json.result.serverInfo)}`)
            }
          } catch {
            // Not JSON, ignore
          }
        } else {
          prompts.log.warn(`Trạng thái không mong đợi: ${response.status}`)
          const body = await response.text().catch(() => "")
          if (body) {
            prompts.log.info(`Nội dung phản hồi: ${body.substring(0, 500)}`)
          }
        }
      } catch (error) {
        spinner.stop("Kết nối thất bại", 1)
        prompts.log.error(`Lỗi: ${error instanceof Error ? error.message : String(error)}`)
      }

      prompts.outro("Gỡ lỗi hoàn tất")
    })
  }),
})
