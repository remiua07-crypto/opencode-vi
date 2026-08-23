import { cmd } from "./cmd"
import { UI } from "@/cli/ui"
import { errorMessage } from "@opencode-ai/tui/util/error"
import { validateSession } from "../tui/validate-session"
import { ServerAuth } from "@/server/auth"

export const AttachCommand = cmd({
  command: "attach <url>",
  describe: "gắn vào một máy chủ opencode đang chạy",
  builder: (yargs) =>
    yargs
      .positional("url", {
        type: "string",
        describe: "http://localhost:4096",
        demandOption: true,
      })
      .option("dir", {
        type: "string",
        description: "thư mục để chạy",
      })
      .option("continue", {
        alias: ["c"],
        describe: "tiếp tục session gần nhất",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        type: "string",
        describe: "id session cần tiếp tục",
      })
      .option("fork", {
        type: "boolean",
        describe: "nhánh session khi tiếp tục (dùng với --continue hoặc --session)",
      })
      .option("password", {
        alias: ["p"],
        type: "string",
        describe: "mật khẩu basic auth (mặc định là OPENCODE_SERVER_PASSWORD)",
      })
      .option("username", {
        alias: ["u"],
        type: "string",
        describe: "tên đăng nhập basic auth (mặc định là OPENCODE_SERVER_USERNAME hoặc 'opencode')",
      })
      .option("mini", {
        type: "boolean",
        describe: "khởi chạy giao diện tương tác tối giản",
        default: false,
      })
      .option("replay", {
        type: "boolean",
        hidden: true,
      })
      .option("no-replay", {
        type: "boolean",
        describe: "tắt phát lại lịch sử mini khi tiếp tục và sau khi thay đổi kích thước",
      })
      .option("replay-limit", {
        type: "number",
        describe: "giới hạn phát lại mini hiển thị ở N tin nhắn mới nhất",
      }),
  handler: async (args) => {
    if (args.replay === true) {
      UI.error("--replay không được hỗ trợ; replay được bật theo mặc định")
      process.exitCode = 1
      return
    }
    const noReplay = args.replay === false || args.noReplay === true

    const directory = (() => {
      if (!args.dir) return undefined
      try {
        process.chdir(args.dir)
        return process.cwd()
      } catch {
        // If the directory doesn't exist locally (remote attach), pass it through.
        return args.dir
      }
    })()

    if (args.mini) {
      const { runMini } = await import("./run")
      await runMini({
        attach: args.url,
        directory,
        password: args.password,
        username: args.username,
        continue: args.continue,
        session: args.session,
        fork: args.fork,
        replay: noReplay ? false : undefined,
        replayLimit: args.replayLimit,
      })
      return
    }

    const unsupported = [
      ["--no-replay", noReplay],
      ["--replay-limit", args.replayLimit !== undefined],
    ].find((entry) => entry[1])?.[0]
    if (unsupported) {
      UI.error(`${unsupported} requires --mini`)
      process.exitCode = 1
      return
    }

    const { TuiConfig } = await import("@/config/tui")
    if (args.fork && !args.continue && !args.session) {
      UI.error("--fork yêu cầu --continue hoặc --session")
      process.exitCode = 1
      return
    }

    const headers = ServerAuth.headers({ password: args.password, username: args.username })
    const config = await TuiConfig.get()

    try {
      await validateSession({
        url: args.url,
        sessionID: args.session,
        directory,
        headers,
      })
    } catch (error) {
      UI.error(errorMessage(error))
      process.exitCode = 1
      return
    }

    const { Effect } = await import("effect")
    const { run } = await import("../tui/layer")
    const { createLegacyTuiPluginHost } = await import("@/plugin/tui/runtime")
    await Effect.runPromise(
      run({
        url: args.url,
        config,
        pluginHost: createLegacyTuiPluginHost(),
        args: {
          continue: args.continue,
          sessionID: args.session,
          fork: args.fork,
        },
        directory,
        headers,
      }),
    )
  },
})
