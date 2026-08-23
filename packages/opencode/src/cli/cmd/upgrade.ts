import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { Installation } from "../../installation"
import { InstallationVersion } from "@opencode-ai/core/installation/version"

export const UpgradeCommand = {
  command: "upgrade [target]",
  describe: "nâng cấp opencode lên phiên bản mới nhất hoặc một phiên bản cụ thể",
  builder: (yargs: Argv) => {
    return yargs
      .positional("target", {
        describe: "phiên bản cần nâng cấp, ví dụ '0.1.48' hoặc 'v0.1.48'",
        type: "string",
      })
      .option("method", {
        alias: "m",
        describe: "phương pháp cài đặt sẽ dùng",
        type: "string",
        choices: ["curl", "npm", "pnpm", "bun", "brew", "choco", "scoop"],
      })
  },
  handler: async (args: { target?: string; method?: string }) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro("Nâng cấp")
    const detectedMethod = await Installation.method()
    const method = (args.method as Installation.Method) ?? detectedMethod
    if (method === "unknown") {
      prompts.log.error(`opencode được cài tại ${process.execPath} và có thể đang được quản lý bởi một trình quản lý gói`)
      const install = await prompts.select({
        message: "Vẫn cài đặt?",
        options: [
          { label: "Có", value: true },
          { label: "Không", value: false },
        ],
        initialValue: false,
      })
      if (!install) {
        prompts.outro("Hoàn tất")
        return
      }
    }
    prompts.log.info("Dùng phương pháp: " + method)
    const target = args.target ? args.target.replace(/^v/, "") : await Installation.latest()

    if (InstallationVersion === target) {
      prompts.log.warn(`bỏ qua nâng cấp opencode: ${target} đã được cài đặt`)
      prompts.outro("Hoàn tất")
      return
    }

    prompts.log.info(`Từ ${InstallationVersion} → ${target}`)
    const spinner = prompts.spinner()
    spinner.start("Đang nâng cấp...")
    const err = await Installation.upgrade(method, target).catch((err) => err)
    if (err) {
      spinner.stop("Nâng cấp thất bại", 1)
      if (err instanceof Installation.UpgradeFailedError) {
        // necessary because choco only allows install/upgrade in elevated terminals
        if (method === "choco" && err.stderr.includes("not running from an elevated command shell")) {
          prompts.log.error("Vui lòng chạy terminal với quyền Administrator và thử lại")
        } else {
          prompts.log.error(err.stderr)
        }
      } else if (err instanceof Error) prompts.log.error(err.message)
      prompts.outro("Hoàn tất")
      return
    }
    spinner.stop("Nâng cấp hoàn tất")
    prompts.outro("Hoàn tất")
  },
}
