import { Effect } from "effect"
import { UI } from "../ui"
import { effectCmd, fail } from "../effect-cmd"
import { Git } from "@/git"
import { InstanceRef } from "@/effect/instance-ref"
import { Process } from "@/util/process"

export const PrCommand = effectCmd({
  command: "pr <number>",
  describe: "tải về và checkout một branch GitHub PR, sau đó chạy opencode",
  builder: (yargs) =>
    yargs.positional("number", {
      type: "number",
      describe: "Số PR cần checkout",
      demandOption: true,
    }),
  handler: Effect.fn("Cli.pr")(function* (args) {
    const ctx = yield* InstanceRef
    if (!ctx) return yield* fail("Không thể tải ngữ cảnh instance")
    if (ctx.project.vcs !== "git") {
      return yield* fail("Không tìm thấy repository git. Vui lòng chạy lệnh này từ trong một repository git.")
    }

    const git = yield* Git.Service
    const worktree = ctx.worktree

    const prNumber = args.number
    const localBranchName = `pr/${prNumber}`
    UI.println(`Đang tải và checkout PR #${prNumber}...`)

    const checkout = yield* Effect.promise(() =>
      Process.run(["gh", "pr", "checkout", `${prNumber}`, "--branch", localBranchName, "--force"], { nothrow: true }),
    )
    if (checkout.code !== 0) {
      return yield* fail(`Không thể checkout PR #${prNumber}. Hãy đảm bảo bạn đã cài đặt và đăng nhập gh CLI.`)
    }

    const prInfoResult = yield* Effect.promise(() =>
      Process.text(
        [
          "gh",
          "pr",
          "view",
          `${prNumber}`,
          "--json",
          "headRepository,headRepositoryOwner,isCrossRepository,headRefName,body",
        ],
        { nothrow: true },
      ),
    )

    let sessionId: string | undefined

    if (prInfoResult.code === 0 && prInfoResult.text.trim()) {
      const prInfo = JSON.parse(prInfoResult.text)

      if (prInfo?.isCrossRepository && prInfo.headRepository && prInfo.headRepositoryOwner) {
        const forkOwner = prInfo.headRepositoryOwner.login
        const forkName = prInfo.headRepository.name
        const remoteName = forkOwner

        const remotes = (yield* git.run(["remote"], { cwd: worktree })).text().trim()
        if (!remotes.split("\n").includes(remoteName)) {
          yield* git.run(["remote", "add", remoteName, `https://github.com/${forkOwner}/${forkName}.git`], {
            cwd: worktree,
          })
          UI.println(`Đã thêm remote fork: ${remoteName}`)
        }

        yield* git.run(["branch", `--set-upstream-to=${remoteName}/${prInfo.headRefName}`, localBranchName], {
          cwd: worktree,
        })
      }

      if (prInfo?.body) {
        const sessionMatch = prInfo.body.match(/https:\/\/opncd\.ai\/s\/([a-zA-Z0-9_-]+)/)
        if (sessionMatch) {
          const sessionUrl = sessionMatch[0]
          UI.println(`Tìm thấy session opencode: ${sessionUrl}`)
          UI.println(`Đang import session...`)

          const importResult = yield* Effect.promise(() =>
            Process.text(["opencode", "import", sessionUrl], { nothrow: true }),
          )
          if (importResult.code === 0) {
            const sessionIdMatch = importResult.text.trim().match(/Imported session: ([a-zA-Z0-9_-]+)/)
            if (sessionIdMatch) {
              sessionId = sessionIdMatch[1]
              UI.println(`Đã import session: ${sessionId}`)
            }
          }
        }
      }
    }

    UI.println(`Đã checkout thành công PR #${prNumber} thành branch '${localBranchName}'`)
    UI.println()
    UI.println("Đang khởi động opencode...")
    UI.println()

    const opencodeArgs = sessionId ? ["-s", sessionId] : []
    const code = yield* Effect.promise(
      () =>
        Process.spawn(["opencode", ...opencodeArgs], {
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
          cwd: process.cwd(),
        }).exited,
    )
    // Match legacy throw semantics — propagate as a defect so the top-level
    // index.ts catch handles it identically (exit 1, "Unexpected error" banner).
    if (code !== 0) return yield* Effect.die(new Error(`opencode thoát với mã ${code}`))
  }),
})
