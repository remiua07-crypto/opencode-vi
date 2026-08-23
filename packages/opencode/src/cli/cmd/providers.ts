import type { Argv } from "yargs"
import { Auth } from "../../auth"
import { cmd } from "./cmd"
import { CliError, effectCmd, fail } from "../effect-cmd"
import { UI } from "../ui"
import * as Prompt from "../effect/prompt"
import { ModelsDev } from "@opencode-ai/core/models-dev"

import { map, pipe, sortBy, values } from "remeda"
import path from "path"
import os from "os"
import { Config } from "@/config/config"
import { Global } from "@opencode-ai/core/global"
import { Plugin } from "../../plugin"
import type { Hooks } from "@opencode-ai/plugin"
import { Process } from "@/util/process"
import { errorMessage } from "@/util/error"
import { text } from "node:stream/consumers"
import { Effect, Option } from "effect"

type PluginAuth = NonNullable<Hooks["auth"]>

const promptValue = <Value>(value: Option.Option<Value>) => {
  if (Option.isNone(value)) return Effect.die(new UI.CancelledError())
  return Effect.succeed(value.value)
}

const put = Effect.fn("Cli.providers.put")(function* (key: string, info: Auth.Info) {
  const auth = yield* Auth.Service
  yield* Effect.orDie(auth.set(key, info))
})

const cliTry = <Value>(message: string, fn: () => PromiseLike<Value>) =>
  Effect.tryPromise({
    try: fn,
    catch: (error) => new CliError({ message: message + errorMessage(error) }),
  })

const handlePluginAuth = Effect.fn("Cli.providers.pluginAuth")(function* (
  plugin: { auth: PluginAuth },
  provider: string,
  methodName?: string,
) {
  const index = yield* Effect.gen(function* () {
    if (!methodName) {
      if (plugin.auth.methods.length <= 1) return 0
      return yield* promptValue(
        yield* Prompt.select({
          message: "Phương thức đăng nhập",
          options: plugin.auth.methods.map((x, index) => ({
            label: x.label,
            value: index,
          })),
        }),
      )
    }
    const match = plugin.auth.methods.findIndex((x) => x.label.toLowerCase() === methodName.toLowerCase())
    if (match === -1) {
      return yield* fail(
        `Không rõ phương thức "${methodName}" cho ${provider}. Khả dụng: ${plugin.auth.methods.map((x) => x.label).join(", ")}`,
      )
    }
    return match
  })
  const method = plugin.auth.methods[index]

  yield* Effect.sleep("10 millis")
  const inputs: Record<string, string> = {}
  if (method.prompts) {
    for (const prompt of method.prompts) {
      if (prompt.when) {
        const value = inputs[prompt.when.key]
        if (value === undefined) continue
        const matches = prompt.when.op === "eq" ? value === prompt.when.value : value !== prompt.when.value
        if (!matches) continue
      }
      if (prompt.condition && !prompt.condition(inputs)) continue
      if (prompt.type === "select") {
        const value = yield* Prompt.select({
          message: prompt.message,
          options: prompt.options,
        })
        inputs[prompt.key] = yield* promptValue(value)
        continue
      }
      const value = yield* Prompt.text({
        message: prompt.message,
        placeholder: prompt.placeholder,
        validate: prompt.validate ? (v) => prompt.validate!(v ?? "") : undefined,
      })
      inputs[prompt.key] = yield* promptValue(value)
    }
  }

  if (method.type === "oauth") {
    const authorize = yield* cliTry("Ủy quyền thất bại: ", () => method.authorize(inputs))

    if (authorize.url) {
      yield* Prompt.log.info("Truy cập: " + authorize.url)
    }

    if (authorize.method === "auto") {
      if (authorize.instructions) {
        yield* Prompt.log.info(authorize.instructions)
      }
      const spinner = Prompt.spinner()
      yield* spinner.start("Đang chờ ủy quyền...")
      const result = yield* cliTry("Ủy quyền thất bại: ", () => authorize.callback())
      if (result.type === "failed") {
        yield* spinner.stop("Ủy quyền thất bại", 1)
      }
      if (result.type === "success") {
        const saveProvider = result.provider ?? provider
        if ("refresh" in result) {
          const { type: _, provider: __, refresh, access, expires, ...extraFields } = result
          yield* put(saveProvider, {
            type: "oauth",
            refresh,
            access,
            expires,
            ...extraFields,
          })
        }
        if ("key" in result) {
          yield* put(saveProvider, {
            type: "api",
            key: result.key,
            ...(result.metadata ? { metadata: result.metadata } : {}),
          })
        }
        yield* spinner.stop("Đăng nhập thành công")
      }
    }

    if (authorize.method === "code") {
      const code = yield* Prompt.text({
        message: "Dán mã ủy quyền vào đây: ",
        validate: (x) => (x && x.length > 0 ? undefined : "Bắt buộc"),
      })
      const authorizationCode = yield* promptValue(code)
      const result = yield* cliTry("Ủy quyền thất bại: ", () => authorize.callback(authorizationCode))
      if (result.type === "failed") {
        yield* Prompt.log.error("Ủy quyền thất bại")
      }
      if (result.type === "success") {
        const saveProvider = result.provider ?? provider
        if ("refresh" in result) {
          const { type: _, provider: __, refresh, access, expires, ...extraFields } = result
          yield* put(saveProvider, {
            type: "oauth",
            refresh,
            access,
            expires,
            ...extraFields,
          })
        }
        if ("key" in result) {
          yield* put(saveProvider, {
            type: "api",
            key: result.key,
            ...(result.metadata ? { metadata: result.metadata } : {}),
          })
        }
        yield* Prompt.log.success("Đăng nhập thành công")
      }
    }

    yield* Prompt.outro("Hoàn tất")
    return true
  }

  if (method.type === "api") {
    const key = yield* Prompt.password({
      message: "Nhập API key của bạn",
      validate: (x) => (x && x.length > 0 ? undefined : "Bắt buộc"),
    })
    const apiKey = yield* promptValue(key)

    const metadata = Object.keys(inputs).length ? { metadata: inputs } : {}
    const authorizeApi = method.authorize
    if (!authorizeApi) {
      yield* put(provider, {
        type: "api",
        key: apiKey,
        ...metadata,
      })
      yield* Prompt.outro("Hoàn tất")
      return true
    }

    const result = yield* cliTry("Ủy quyền thất bại: ", () => authorizeApi(inputs))
    if (result.type === "failed") {
      yield* Prompt.log.error("Ủy quyền thất bại")
    }
    if (result.type === "success") {
      const saveProvider = result.provider ?? provider
      const merged = { ...(metadata.metadata ?? {}), ...(result.metadata ?? {}) }
      yield* put(saveProvider, {
        type: "api",
        key: result.key ?? apiKey,
        ...(Object.keys(merged).length ? { metadata: merged } : {}),
      })
      yield* Prompt.log.success("Đăng nhập thành công")
    }
    yield* Prompt.outro("Hoàn tất")
    return true
  }

  return false
})

export function resolvePluginProviders(input: {
  hooks: Hooks[]
  existingProviders: Record<string, unknown>
  disabled: Set<string>
  enabled?: Set<string>
  providerNames: Record<string, string | undefined>
}): Array<{ id: string; name: string }> {
  const seen = new Set<string>()
  const result: Array<{ id: string; name: string }> = []

  for (const hook of input.hooks) {
    if (!hook.auth) continue
    const id = hook.auth.provider
    if (seen.has(id)) continue
    seen.add(id)
    if (Object.hasOwn(input.existingProviders, id)) continue
    if (input.disabled.has(id)) continue
    if (input.enabled && !input.enabled.has(id)) continue
    result.push({
      id,
      name: input.providerNames[id] ?? id,
    })
  }

  return result
}

export const ProvidersCommand = cmd({
  command: "providers",
  aliases: ["auth"],
  describe: "quản lý provider AI và thông tin xác thực",
  builder: (yargs) =>
    yargs.command(ProvidersListCommand).command(ProvidersLoginCommand).command(ProvidersLogoutCommand).demandCommand(),
  async handler() {},
})

export const ProvidersListCommand = effectCmd({
  command: "list",
  aliases: ["ls"],
  describe: "liệt kê provider và thông tin xác thực",
  // Lists global credentials + provider env vars; no project instance needed.
  instance: false,
  handler: Effect.fn("Cli.providers.list")(function* (_args) {
    const authSvc = yield* Auth.Service
    const modelsDev = yield* ModelsDev.Service

    UI.empty()
    const authPath = path.join(Global.Path.data, "auth.json")
    const homedir = os.homedir()
    const displayPath = authPath.startsWith(homedir) ? authPath.replace(homedir, "~") : authPath
    yield* Prompt.intro(`Thông tin xác thực ${UI.Style.TEXT_DIM}${displayPath}`)
    const results = Object.entries(yield* Effect.orDie(authSvc.all()))
    const database = yield* modelsDev.get()

    for (const [providerID, result] of results) {
      const name = database[providerID]?.name || providerID
      yield* Prompt.log.info(`${name} ${UI.Style.TEXT_DIM}${result.type}`)
    }

    yield* Prompt.outro(`${results.length} thông tin xác thực`)

    const activeEnvVars: Array<{ provider: string; envVar: string }> = []

    for (const [providerID, provider] of Object.entries(database)) {
      for (const envVar of provider.env) {
        if (process.env[envVar]) {
          activeEnvVars.push({
            provider: provider.name || providerID,
            envVar,
          })
        }
      }
    }

    if (activeEnvVars.length > 0) {
      UI.empty()
      yield* Prompt.intro("Môi trường")

      for (const { provider, envVar } of activeEnvVars) {
        yield* Prompt.log.info(`${provider} ${UI.Style.TEXT_DIM}${envVar}`)
      }

      yield* Prompt.outro(`${activeEnvVars.length} biến môi trường`)
    }
  }),
})

export const ProvidersLoginCommand = effectCmd({
  command: "login [url]",
  describe: "đăng nhập vào một provider",
  // URL login skips instance bootstrap, which would load remote config with the stale token and crash before re-auth.
  instance: (args) => !args.url,
  builder: (yargs: Argv) =>
    yargs
      .positional("url", {
        describe: "provider xác thực opencode",
        type: "string",
      })
      .option("provider", {
        alias: ["p"],
        describe: "id hoặc tên provider cần đăng nhập (bỏ qua bước chọn provider)",
        type: "string",
      })
      .option("method", {
        alias: ["m"],
        describe: "nhãn phương thức đăng nhập (bỏ qua bước chọn phương thức)",
        type: "string",
      }),
  handler: Effect.fn("Cli.providers.login")(function* (args) {
    const authSvc = yield* Auth.Service

    UI.empty()
    yield* Prompt.intro("Thêm thông tin xác thực")
    if (args.url) {
      const url = args.url.replace(/\/+$/, "")
      const wellknown = (yield* cliTry(`Không thể tải metadata auth provider từ ${url}: `, () =>
        fetch(`${url}/.well-known/opencode`).then((x) => x.json()),
      )) as {
        auth: { command: string[]; env: string }
      }
      yield* Prompt.log.info(`Đang chạy \`${wellknown.auth.command.join(" ")}\``)
      const abort = new AbortController()
      const proc = Process.spawn(wellknown.auth.command, { stdout: "pipe", stderr: "inherit", abort: abort.signal })
      if (!proc.stdout) {
        yield* Prompt.log.error("Thất bại")
        yield* Prompt.outro("Hoàn tất")
        return
      }
      const [exit, token] = yield* cliTry("Không thể chạy lệnh auth provider: ", () =>
        Promise.all([proc.exited, text(proc.stdout!)]),
      ).pipe(Effect.ensuring(Effect.sync(() => abort.abort())))
      if (exit !== 0) {
        yield* Prompt.log.error("Thất bại")
        yield* Prompt.outro("Hoàn tất")
        return
      }
      yield* Effect.orDie(authSvc.set(url, { type: "wellknown", key: wellknown.auth.env, token: token.trim() }))
      yield* Prompt.log.success("Đã đăng nhập vào " + url)
      yield* Prompt.outro("Hoàn tất")
      return
    }

    const cfgSvc = yield* Config.Service
    const pluginSvc = yield* Plugin.Service
    const modelsDev = yield* ModelsDev.Service
    yield* Effect.ignore(modelsDev.refresh(true))

    const config = yield* cfgSvc.get()

    const disabled = new Set(config.disabled_providers ?? [])
    const enabled = config.enabled_providers ? new Set(config.enabled_providers) : undefined

    const allProviders = yield* modelsDev.get()
    const providers: Record<string, (typeof allProviders)[string]> = {}
    for (const [key, value] of Object.entries(allProviders)) {
      if ((enabled ? enabled.has(key) : true) && !disabled.has(key)) providers[key] = value
    }
    const hooks = yield* pluginSvc.list()

    const priority: Record<string, number> = {
      opencode: 0,
      openai: 1,
      "github-copilot": 2,
      google: 3,
      anthropic: 4,
      openrouter: 5,
      vercel: 6,
    }
    const pluginProviders = resolvePluginProviders({
      hooks,
      existingProviders: providers,
      disabled,
      enabled,
      providerNames: Object.fromEntries(Object.entries(config.provider ?? {}).map(([id, p]) => [id, p.name])),
    })
    const options = [
      ...pipe(
        providers,
        values(),
        sortBy(
          (x) => priority[x.id] ?? 99,
          (x) => x.name ?? x.id,
        ),
        map((x) => ({
          label: x.name,
          value: x.id,
          hint: {
            opencode: "được khuyến nghị",
            openai: "ChatGPT Plus/Pro hoặc API key",
          }[x.id],
        })),
      ),
      ...pluginProviders.map((x) => ({
        label: x.name,
        value: x.id,
        hint: "plugin",
      })),
    ]

    let provider: string
    if (args.provider) {
      const input = args.provider
      const byID = options.find((x) => x.value === input)
      const byName = options.find((x) => x.label.toLowerCase() === input.toLowerCase())
      const match = byID ?? byName
      if (!match) {
        return yield* fail(`Provider không rõ "${input}"`)
      }
      provider = match.value
    } else {
      provider = yield* promptValue(
        yield* Prompt.autocomplete({
          message: "Chọn provider",
          maxItems: 8,
          options: [...options, { value: "other", label: "Khác" }],
        }),
      )
    }

    const plugin = hooks.findLast((x) => x.auth?.provider === provider)
    if (plugin && plugin.auth) {
      const handled = yield* handlePluginAuth({ auth: plugin.auth! }, provider, args.method)
      if (handled) return
    }

    if (provider === "other") {
      provider = (yield* promptValue(
        yield* Prompt.text({
          message: "Nhập provider id",
          validate: (x) => (x && x.match(/^[0-9a-z-]+$/) ? undefined : "chỉ a-z, 0-9 và dấu gạch ngang"),
        }),
      )).replace(/^@ai-sdk\//, "")

      const customPlugin = hooks.findLast((x) => x.auth?.provider === provider)
      if (customPlugin && customPlugin.auth) {
        const handled = yield* handlePluginAuth({ auth: customPlugin.auth! }, provider, args.method)
        if (handled) return
      }

      yield* Prompt.log.warn(
        `Thao tác này chỉ lưu thông tin xác thực cho ${provider} - bạn cần cấu hình thêm trong opencode.json, xem tài liệu để có ví dụ.`,
      )
    }

    if (provider === "amazon-bedrock") {
      yield* Prompt.log.info(
        "Thứ tự ưu tiên xác thực Amazon Bedrock:\n" +
          "  1. Bearer token (AWS_BEARER_TOKEN_BEDROCK hoặc /connect)\n" +
          "  2. Chuỗi thông tin xác thực AWS (profile, access key, IAM role, EKS IRSA)\n\n" +
          "Cấu hình qua các tùy chọn opencode.json (profile, region, endpoint) hoặc\n" +
          "các biến môi trường AWS (AWS_PROFILE, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_WEB_IDENTITY_TOKEN_FILE).",
      )
    }

    if (provider === "opencode") {
      yield* Prompt.log.info("Tạo api key tại https://opencode.ai/auth")
    }

    if (provider === "vercel") {
      yield* Prompt.log.info("Bạn có thể tạo api key tại https://vercel.link/ai-gateway-token")
    }

    if (["cloudflare", "cloudflare-ai-gateway"].includes(provider)) {
      yield* Prompt.log.info(
        "Cloudflare AI Gateway có thể được cấu hình bằng các biến môi trường CLOUDFLARE_GATEWAY_ID, CLOUDFLARE_ACCOUNT_ID và CLOUDFLARE_API_TOKEN. Đọc thêm: https://opencode.ai/docs/providers/#cloudflare-ai-gateway",
      )
    }

    const key = yield* Prompt.password({
      message: "Nhập API key của bạn",
      validate: (x) => (x && x.length > 0 ? undefined : "Bắt buộc"),
    })
    const apiKey = yield* promptValue(key)
    yield* Effect.orDie(authSvc.set(provider, { type: "api", key: apiKey }))

    yield* Prompt.outro("Hoàn tất")
  }),
})

export const ProvidersLogoutCommand = effectCmd({
  command: "logout [provider]",
  describe: "đăng xuất khỏi một provider đã cấu hình",
  builder: (yargs) =>
    yargs.positional("provider", {
      describe: "id hoặc tên provider cần đăng xuất",
      type: "string",
    }),
  // Removes a global auth credential; no project instance needed.
  instance: false,
  handler: Effect.fn("Cli.providers.logout")(function* (args) {
    const authSvc = yield* Auth.Service
    const modelsDev = yield* ModelsDev.Service

    UI.empty()
    const credentials: Array<[string, Auth.Info]> = Object.entries(yield* Effect.orDie(authSvc.all()))
    yield* Prompt.intro("Xóa thông tin xác thực")
    if (credentials.length === 0) {
      yield* Prompt.log.error("Không tìm thấy thông tin xác thực nào")
      return
    }
    const database = yield* modelsDev.get()
    const options = credentials.map(([key, value]) => ({
      label: (database[key]?.name || key) + UI.Style.TEXT_DIM + " (" + value.type + ")",
      value: key,
    }))
    const provider = args.provider
      ? options.find(
          (option) =>
            option.value === args.provider ||
            database[option.value]?.name?.toLowerCase() === args.provider?.toLowerCase(),
        )?.value
      : yield* promptValue(
          yield* Prompt.autocomplete({
            message: "Chọn provider",
            maxItems: 8,
            options,
          }),
        )
    if (!provider) return yield* fail(`Provider đã cấu hình không rõ "${args.provider}"`)
    yield* Effect.orDie(authSvc.remove(provider))
    yield* Prompt.outro("Đăng xuất thành công")
  }),
})
