import { intro, log, outro, spinner } from "@clack/prompts"
import { Effect } from "effect"

import { ConfigPaths } from "@/config/paths"
import { Global } from "@opencode-ai/core/global"
import { installPlugin, patchPluginConfig, readPluginManifest } from "../../plugin/install"
import { resolvePluginTarget } from "../../plugin/shared"
import { errorMessage } from "../../util/error"
import { Filesystem } from "@/util/filesystem"
import { Process } from "@/util/process"
import { UI } from "../ui"
import { effectCmd } from "../effect-cmd"
import { InstanceRef } from "@/effect/instance-ref"

type Spin = {
  start: (msg: string) => void
  stop: (msg: string, code?: number) => void
}

export type PlugDeps = {
  spinner: () => Spin
  log: {
    error: (msg: string) => void
    info: (msg: string) => void
    success: (msg: string) => void
  }
  resolve: (spec: string) => Promise<string>
  readText: (file: string) => Promise<string>
  write: (file: string, text: string) => Promise<void>
  exists: (file: string) => Promise<boolean>
  files: (dir: string, name: "opencode" | "tui") => string[]
  global: string
}

export type PlugInput = {
  mod: string
  global?: boolean
  force?: boolean
}

export type PlugCtx = {
  vcs?: string
  worktree: string
  directory: string
}

const defaultPlugDeps: PlugDeps = {
  spinner: () => spinner(),
  log: {
    error: (msg) => log.error(msg),
    info: (msg) => log.info(msg),
    success: (msg) => log.success(msg),
  },
  resolve: (spec) => resolvePluginTarget(spec),
  readText: (file) => Filesystem.readText(file),
  write: async (file, text) => {
    await Filesystem.write(file, text)
  },
  exists: (file) => Filesystem.exists(file),
  files: (dir, name) => ConfigPaths.fileInDirectory(dir, name),
  global: Global.Path.config,
}

function cause(err: unknown) {
  if (!err || typeof err !== "object") return
  if (!("cause" in err)) return
  return (err as { cause?: unknown }).cause
}

export function createPlugTask(input: PlugInput, dep: PlugDeps = defaultPlugDeps) {
  const mod = input.mod
  const force = Boolean(input.force)
  const global = Boolean(input.global)

  return async (ctx: PlugCtx) => {
    const install = dep.spinner()
    install.start("Đang cài đặt gói plugin...")
    const target = await installPlugin(mod, dep)
    if (!target.ok) {
      install.stop("Cài đặt thất bại", 1)
      dep.log.error(`Không thể cài đặt "${mod}"`)
      const hit = cause(target.error) ?? target.error
      if (hit instanceof Process.RunFailedError) {
        const lines = hit.stderr
          .toString()
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
        const errs = lines.filter((line) => line.startsWith("error:")).map((line) => line.replace(/^error:\s*/, ""))
        const detail = errs[0] ?? lines.at(-1)
        if (detail) dep.log.error(detail)
        if (lines.some((line) => line.includes("No version matching"))) {
          dep.log.info("Gói này phụ thuộc vào một phiên bản không có sẵn trong npm registry của bạn.")
          dep.log.info("Hãy kiểm tra cấu hình registry/xác thực npm và thử lại.")
        }
      }
      if (!(hit instanceof Process.RunFailedError)) {
        dep.log.error(errorMessage(hit))
      }
      return false
    }
    install.stop("Gói plugin đã sẵn sàng")

    const inspect = dep.spinner()
    inspect.start("Đang đọc manifest plugin...")
    const manifest = await readPluginManifest(target.target)
    if (!manifest.ok) {
      if (manifest.code === "manifest_read_failed") {
        inspect.stop("Đọc manifest thất bại", 1)
        dep.log.error(`Đã cài "${mod}" nhưng không đọc được ${manifest.file}`)
        dep.log.error(errorMessage(cause(manifest.error) ?? manifest.error))
        return false
      }

      if (manifest.code === "manifest_no_targets") {
        inspect.stop("Không tìm thấy target plugin nào", 1)
        dep.log.error(`"${mod}" không khai báo entrypoint plugin trong package.json`)
        dep.log.info(
          'Mong muốn một trong: exports["./tui"], exports["./server"], package.json main cho server, hoặc package.json["oc-themes"] cho theme tui.',
        )
        return false
      }

      inspect.stop("Manifest read failed", 1)
      return false
    }

    inspect.stop(
      `Phát hiện ${manifest.targets.map((item) => item.kind).join(" + ")} target`,
    )

    const patch = dep.spinner()
    patch.start("Đang cập nhật cấu hình plugin...")
    const out = await patchPluginConfig(
      {
        spec: mod,
        targets: manifest.targets,
        force,
        global,
        vcs: ctx.vcs,
        worktree: ctx.worktree,
        directory: ctx.directory,
        config: dep.global,
      },
      dep,
    )
    if (!out.ok) {
      if (out.code === "invalid_json") {
        patch.stop(`Cập nhật cấu hình ${out.kind} thất bại`, 1)
        dep.log.error(`JSON không hợp lệ trong ${out.file} (${out.parse} tại dòng ${out.line}, cột ${out.col})`)
        dep.log.info("Hãy sửa file cấu hình và chạy lại lệnh.")
        return false
      }

      patch.stop("Cập nhật cấu hình plugin thất bại", 1)
      dep.log.error(errorMessage(out.error))
      return false
    }
    patch.stop("Đã cập nhật cấu hình plugin")
    for (const item of out.items) {
      if (item.mode === "noop") {
        dep.log.info(`Đã được cấu hình sẵn trong ${item.file}`)
        continue
      }
      if (item.mode === "replace") {
        dep.log.info(`Đã thay thế trong ${item.file}`)
        continue
      }
      dep.log.info(`Đã thêm vào ${item.file}`)
    }

    dep.log.success(`Đã cài đặt ${mod}`)
    dep.log.info(global ? `Phạm vi: toàn cục (${out.dir})` : `Phạm vi: cục bộ (${out.dir})`)
    return true
  }
}

export const PluginCommand = effectCmd({
  command: "plugin <module>",
  aliases: ["plug"],
  describe: "cài đặt plugin và cập nhật cấu hình",
  builder: (yargs) =>
    yargs
      .positional("module", {
        type: "string",
        describe: "tên module npm",
      })
      .option("global", {
        alias: ["g"],
        type: "boolean",
        default: false,
        describe: "cài vào cấu hình toàn cục",
      })
      .option("force", {
        alias: ["f"],
        type: "boolean",
        default: false,
        describe: "thay thế phiên bản plugin hiện có",
      }),
  handler: Effect.fn("Cli.plug")(function* (args) {
    const mod = String(args.module ?? "").trim()
    if (!mod) {
      UI.error("cần chỉ định module")
      process.exitCode = 1
      return
    }

    UI.empty()
    intro(`Cài đặt plugin ${mod}`)

    const run = createPlugTask({
      mod,
      global: Boolean(args.global),
      force: Boolean(args.force),
    })

    const ctx = yield* InstanceRef
    if (!ctx) return
    const ok = yield* Effect.promise(() =>
      run({
        vcs: ctx.project.vcs,
        worktree: ctx.worktree,
        directory: ctx.directory,
      }),
    )

    outro("Hoàn tất")
    if (!ok) process.exitCode = 1
  }),
})
