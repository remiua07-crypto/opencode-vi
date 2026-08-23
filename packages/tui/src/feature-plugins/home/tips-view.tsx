import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createMemo, For, type Accessor } from "solid-js"
import { DEFAULT_THEMES, useTheme } from "../../context/theme"
import { useCommandShortcut } from "../../keymap"

const themeCount = Object.keys(DEFAULT_THEMES).length

type TipPart = { text: string; highlight: boolean }
type TipShortcut = Accessor<string>
type Shortcuts = {
  agentCycle: TipShortcut
  childFirst: TipShortcut
  childNext: TipShortcut
  childPrevious: TipShortcut
  commandList: TipShortcut
  editorOpen: TipShortcut
  helpShow: TipShortcut
  inputClear: TipShortcut
  inputNewline: TipShortcut
  inputPaste: TipShortcut
  inputUndo: TipShortcut
  leader: TipShortcut
  messagesCopy: TipShortcut
  messagesFirst: TipShortcut
  messagesLast: TipShortcut
  messagesPageDown: TipShortcut
  messagesPageUp: TipShortcut
  messagesToggleConceal: TipShortcut
  modelCycleRecent: TipShortcut
  modelList: TipShortcut
  sessionExport: TipShortcut
  sessionInterrupt: TipShortcut
  sessionList: TipShortcut
  sessionNew: TipShortcut
  sessionParent: TipShortcut
  sessionPinToggle: TipShortcut
  sessionQuickSwitch1: TipShortcut
  sessionQuickSwitch9: TipShortcut
  sessionSidebarToggle: TipShortcut
  sessionTimeline: TipShortcut
  statusView: TipShortcut
  terminalSuspend: TipShortcut
  themeList: TipShortcut
}
type Tip = string | ((shortcuts: Shortcuts) => string | undefined)

function parse(tip: string): TipPart[] {
  const parts: TipPart[] = []
  const regex = /\{highlight\}(.*?)\{\/highlight\}/g
  const found = Array.from(tip.matchAll(regex))
  const state = found.reduce(
    (acc, match) => {
      const start = match.index ?? 0
      if (start > acc.index) {
        acc.parts.push({ text: tip.slice(acc.index, start), highlight: false })
      }
      acc.parts.push({ text: match[1], highlight: true })
      acc.index = start + match[0].length
      return acc
    },
    { parts, index: 0 },
  )

  if (state.index < tip.length) {
    parts.push({ text: tip.slice(state.index), highlight: false })
  }

  return parts
}

const NO_MODELS_TIP = "Chạy {highlight}/connect{/highlight} để thêm AI provider và bắt đầu làm việc"
const NO_MODELS_PARTS = parse(NO_MODELS_TIP)

function shortcutText(value: string) {
  return `{highlight}${value}{/highlight}`
}

function commandText(command: string, shortcut: string) {
  if (!shortcut) return shortcutText(command)
  return `${shortcutText(command)} hoặc ${shortcutText(shortcut)}`
}

function press(shortcut: string, text: string) {
  if (!shortcut) return undefined
  return `Nhấn ${shortcutText(shortcut)} ${text}`
}

function configShortcut(api: TuiPluginApi, command: string): TipShortcut {
  return () =>
    api.tuiConfig.keybinds
      .get(command)
      .map((binding) => api.keys.formatSequence(Array.from(api.keymap.parseKeySequence(binding.key))))
      .filter(Boolean)
      .join(", ")
}

export function Tips(props: { api: TuiPluginApi; connected?: boolean }) {
  const theme = useTheme().theme
  const tipOffset = Math.random()
  const shortcuts: Shortcuts = {
    agentCycle: useCommandShortcut("agent.cycle"),
    childFirst: configShortcut(props.api, "session.child.first"),
    childNext: configShortcut(props.api, "session.child.next"),
    childPrevious: configShortcut(props.api, "session.child.previous"),
    commandList: useCommandShortcut("command.palette.show"),
    editorOpen: useCommandShortcut("prompt.editor"),
    helpShow: useCommandShortcut("help.show"),
    inputClear: useCommandShortcut("prompt.clear"),
    inputNewline: useCommandShortcut("input.newline"),
    inputPaste: useCommandShortcut("prompt.paste"),
    inputUndo: useCommandShortcut("input.undo"),
    leader: configShortcut(props.api, "leader"),
    messagesCopy: configShortcut(props.api, "messages.copy"),
    messagesFirst: configShortcut(props.api, "session.first"),
    messagesLast: configShortcut(props.api, "session.last"),
    messagesPageDown: configShortcut(props.api, "session.page.down"),
    messagesPageUp: configShortcut(props.api, "session.page.up"),
    messagesToggleConceal: configShortcut(props.api, "session.toggle.conceal"),
    modelCycleRecent: useCommandShortcut("model.cycle_recent"),
    modelList: useCommandShortcut("model.list"),
    sessionExport: configShortcut(props.api, "session.export"),
    sessionInterrupt: configShortcut(props.api, "session.interrupt"),
    sessionList: useCommandShortcut("session.list"),
    sessionNew: useCommandShortcut("session.new"),
    sessionParent: configShortcut(props.api, "session.parent"),
    sessionPinToggle: configShortcut(props.api, "session.pin.toggle"),
    sessionQuickSwitch1: useCommandShortcut("session.quick_switch.1"),
    sessionQuickSwitch9: useCommandShortcut("session.quick_switch.9"),
    sessionSidebarToggle: configShortcut(props.api, "session.sidebar.toggle"),
    sessionTimeline: configShortcut(props.api, "session.timeline"),
    statusView: useCommandShortcut("opencode.status"),
    terminalSuspend: useCommandShortcut("terminal.suspend"),
    themeList: useCommandShortcut("theme.switch"),
  }
  const tip = createMemo(() => {
    if (props.connected === false) return NO_MODELS_TIP
    const tips = [...TIPS, process.platform !== "win32" ? TERMINAL_SUSPEND_TIP : INPUT_UNDO_TIP].flatMap((item) => {
      const value = typeof item === "string" ? item : item(shortcuts)
      return value ? [value] : []
    })
    return tips[Math.floor(tipOffset * tips.length)] ?? NO_MODELS_TIP
  }, NO_MODELS_TIP)
  // Solid can expose a memo's initial value while a pure computation is pending.
  const parts = createMemo(() => {
    const value = tip()
    if (typeof value === "string") return parse(value)
    return NO_MODELS_PARTS
  }, NO_MODELS_PARTS)

  return (
    <box flexDirection="row" maxWidth="100%">
      <text flexShrink={0} style={{ fg: theme.warning }}>
        ● Mẹo{" "}
      </text>
      <text flexShrink={1} wrapMode="word">
        <For each={parts()}>
          {(part) => <span style={{ fg: part.highlight ? theme.text : theme.textMuted }}>{part.text}</span>}
        </For>
      </text>
    </box>
  )
}

const TIPS: Tip[] = [
  "Gõ {highlight}@{/highlight} kèm tên file để tìm mờ và đính kèm file",
  "Bắt đầu tin nhắn bằng {highlight}!{/highlight} để chạy lệnh shell (ví dụ: {highlight}!ls -la{/highlight})",
  (shortcuts) => press(shortcuts.agentCycle(), "để chuyển giữa agent Build và Plan"),
  "Dùng {highlight}/undo{/highlight} để hoàn tác tin nhắn và thay đổi file gần nhất",
  "Dùng {highlight}/redo{/highlight} để khôi phục các tin nhắn và thay đổi file vừa hoàn tác",
  "Chạy {highlight}/share{/highlight} để tạo liên kết công khai trên opencode.ai",
  "Kéo thả ảnh hoặc PDF vào terminal làm ngữ cảnh",
  (shortcuts) => press(shortcuts.inputPaste(), "để dán ảnh từ bộ nhớ tạm vào prompt"),
  (shortcuts) => `Dùng ${commandText("/editor", shortcuts.editorOpen())} để soạn tin nhắn trong trình soạn thảo ngoài`,
  "Chạy {highlight}/init{/highlight} để tự tạo quy tắc dự án dựa trên codebase của bạn",
  (shortcuts) => `Dùng ${commandText("/models", shortcuts.modelList())} để chuyển giữa các AI model khả dụng`,
  (shortcuts) => `Dùng ${commandText("/themes", shortcuts.themeList())} để chuyển giữa ${themeCount} theme tích hợp sẵn`,
  (shortcuts) => `Dùng ${commandText("/new", shortcuts.sessionNew())} để bắt đầu một session trò chuyện mới`,
  (shortcuts) => `Dùng ${commandText("/sessions", shortcuts.sessionList())} để xem, ghim và tiếp tục các session`,
  (shortcuts) => press(shortcuts.sessionPinToggle(), "trong danh sách session để ghim một session lên đầu"),
  (shortcuts) =>
    shortcuts.sessionQuickSwitch1() && shortcuts.sessionQuickSwitch9()
      ? `Dùng ${shortcutText(shortcuts.sessionQuickSwitch1())} đến ${shortcutText(shortcuts.sessionQuickSwitch9())} để chuyển giữa các session đã ghim`
      : undefined,
  "Chạy {highlight}/compact{/highlight} để tóm tắt session dài khi gần chạm giới hạn context",
  (shortcuts) => `Dùng ${commandText("/export", shortcuts.sessionExport())} để lưu cuộc trò chuyện thành Markdown`,
  (shortcuts) => press(shortcuts.messagesCopy(), "để sao chép tin nhắn cuối cùng của trợ lý vào bộ nhớ tạm"),
  (shortcuts) => press(shortcuts.commandList(), "để xem tất cả hành động và lệnh khả dụng"),
  "Chạy {highlight}/connect{/highlight} để thêm API key cho hơn 75 LLM provider được hỗ trợ",
  (shortcuts) => `Phím leader là ${shortcutText(shortcuts.leader())}; kết hợp với phím khác cho thao tác nhanh`,
  (shortcuts) => press(shortcuts.modelCycleRecent(), "để chuyển nhanh giữa các model vừa dùng"),
  (shortcuts) => press(shortcuts.sessionSidebarToggle(), "trong session để hiện hoặc ẩn bảng thanh bên"),
  (shortcuts) =>
    shortcuts.messagesPageUp() && shortcuts.messagesPageDown()
      ? `Dùng ${shortcutText(shortcuts.messagesPageUp())}/${shortcutText(shortcuts.messagesPageDown())} để di chuyển qua lịch sử trò chuyện`
      : undefined,
  (shortcuts) => press(shortcuts.messagesFirst(), "để nhảy đến đầu cuộc trò chuyện"),
  (shortcuts) => press(shortcuts.messagesLast(), "để nhảy đến tin nhắn mới nhất"),
  (shortcuts) => press(shortcuts.inputNewline(), "để xuống dòng trong ô nhập"),
  (shortcuts) => press(shortcuts.inputClear(), "khi đang gõ để xóa sạch trường nhập"),
  (shortcuts) => press(shortcuts.sessionInterrupt(), "để dừng AI giữa chừng khi đang trả lời"),
  "Chuyển sang agent {highlight}Plan{/highlight} để nhận gợi ý mà không thay đổi gì",
  "Dùng {highlight}@agent-name{/highlight} trong prompt để gọi subagent chuyên biệt",
  (shortcuts) => {
    const items = [
      shortcuts.sessionParent(),
      shortcuts.childFirst(),
      shortcuts.childPrevious(),
      shortcuts.childNext(),
    ].filter(Boolean)
    if (!items.length) return undefined
    return `Dùng ${items.map(shortcutText).join(" / ")} cho session cha/con`
  },
  "Tạo {highlight}opencode.json{/highlight} cho cài đặt server, và {highlight}tui.json{/highlight} cho TUI",
  "Đặt cài đặt TUI trong {highlight}~/.config/opencode/tui.json{/highlight} để dùng chung mọi nơi",
  "Thêm {highlight}$schema{/highlight} vào cấu hình để có gợi ý trong editor",
  "Cấu hình {highlight}model{/highlight} trong file cấu hình để đặt model mặc định",
  "Ghi đè phím tắt bất kỳ trong {highlight}tui.json{/highlight} qua mục {highlight}keybinds{/highlight}",
  "Đặt phím tắt thành {highlight}none{/highlight} để tắt hẳn nó",
  "Cấu hình MCP server cục bộ hoặc từ xa trong mục {highlight}mcp{/highlight} của file cấu hình",
  "Thêm file {highlight}.md{/highlight} vào {highlight}.opencode/commands/{/highlight} để có prompt dùng lại được",
  "Dùng {highlight}$ARGUMENTS{/highlight}, {highlight}$1{/highlight}, {highlight}$2{/highlight} trong lệnh tùy chỉnh cho đầu vào động",
  "Dùng backticks để chèn kết quả lệnh shell (ví dụ: {highlight}`git status`{/highlight})",
  "Thêm file {highlight}.md{/highlight} vào {highlight}.opencode/agents/{/highlight} để tạo nhân vật AI chuyên biệt",
  "Cấu hình quyền theo agent cho các tool {highlight}edit{/highlight}, {highlight}bash{/highlight}, và {highlight}webfetch{/highlight}",
  'Dùng mẫu như {highlight}"git *": "allow"{/highlight} cho quyền bash chi tiết',
  'Đặt {highlight}"rm -rf *": "deny"{/highlight} để chặn các lệnh phá hoại',
  'Cấu hình {highlight}"git push": "ask"{/highlight} để bắt buộc duyệt trước khi push',
  'Đặt {highlight}"formatter": true{/highlight} để bật formatter tích hợp sẵn',
  'Đặt {highlight}"formatter": false{/highlight} để tắt formatter kế thừa',
  "Định nghĩa lệnh formatter tùy chỉnh kèm đuôi file trong cấu hình",
  'Đặt {highlight}"lsp": true{/highlight} để bật phân tích mã LSP tích hợp sẵn',
  "Tạo file {highlight}.ts{/highlight} trong {highlight}.opencode/tools/{/highlight} để định nghĩa tool LLM mới",
  "Định nghĩa tool có thể gọi script viết bằng Python, Go, v.v.",
  "Thêm file {highlight}.ts{/highlight} vào {highlight}.opencode/plugins/{/highlight} để móc sự kiện",
  "Dùng plugin để gửi thông báo hệ điều hành khi session hoàn tất",
  "Tạo plugin để chặn OpenCode đọc file nhạy cảm",
  "Dùng {highlight}opencode run{/highlight} để chạy script không tương tác",
  "Dùng {highlight}opencode --continue{/highlight} để tiếp tục session gần nhất",
  "Dùng {highlight}opencode run -f file.ts{/highlight} để đính kèm file qua CLI",
  "Dùng {highlight}--format json{/highlight} để có đầu ra máy đọc được trong script",
  "Chạy {highlight}opencode serve{/highlight} để truy cập API headless của OpenCode",
  "Dùng {highlight}opencode run --attach{/highlight} để kết nối tới server đang chạy",
  "Chạy {highlight}opencode upgrade{/highlight} để cập nhật lên phiên bản mới nhất",
  "Chạy {highlight}opencode auth list{/highlight} để xem tất cả provider đã cấu hình",
  "Chạy {highlight}opencode agent create{/highlight} để được hướng dẫn tạo agent từng bước",
  "Dùng {highlight}/opencode{/highlight} trong issue/PR GitHub để kích hoạt hành động AI",
  "Chạy {highlight}opencode github install{/highlight} để thiết lập GitHub workflow",
  "Bình luận {highlight}/opencode fix this{/highlight} trên issue để tự tạo PR",
  "Bình luận {highlight}/oc{/highlight} trên dòng code của PR để review từng phần",
  'Dùng {highlight}"theme": "system"{/highlight} để theo màu của terminal',
  "Tạo file theme JSON trong thư mục {highlight}.opencode/themes/{/highlight}",
  "Theme hỗ trợ biến thể dark/light cho cả hai chế độ",
  "Dùng mã màu xterm số 0-255 trong JSON theme tùy chỉnh",
  "Dùng {highlight}{env:VAR_NAME}{/highlight} cho biến môi trường trong cấu hình",
  "Dùng {highlight}{file:path}{/highlight} để nhúng nội dung file vào giá trị cấu hình",
  "Dùng {highlight}instructions{/highlight} trong cấu hình để nạp thêm file quy tắc",
  "Đặt {highlight}temperature{/highlight} của agent từ 0.0 (tập trung) đến 1.0 (sáng tạo)",
  "Cấu hình {highlight}steps{/highlight} để giới hạn số vòng lặp agent mỗi yêu cầu",
  'Đặt {highlight}"tools": {"bash": false}{/highlight} để tắt tool cụ thể',
  'Đặt {highlight}"mcp_*": false{/highlight} để tắt mọi tool từ một MCP server',
  "Ghi đè cài đặt tool toàn cục theo từng agent",
  'Đặt {highlight}"share": "auto"{/highlight} để tự động chia sẻ mọi session',
  'Đặt {highlight}"share": "disabled"{/highlight} để ngăn chia sẻ session',
  "Chạy {highlight}/unshare{/highlight} để ngừng chia sẻ công khai một session",
  "Quyền {highlight}doom_loop{/highlight} chặn vòng lặp gọi tool vô hạn",
  "Quyền {highlight}external_directory{/highlight} bảo vệ file ngoài dự án",
  "Chạy {highlight}opencode debug config{/highlight} để xử lý sự cố cấu hình",
  "Dùng cờ {highlight}--print-logs{/highlight} để xem log chi tiết trên stderr",
  (shortcuts) => `Dùng ${commandText("/timeline", shortcuts.sessionTimeline())} để nhảy đến tin nhắn cụ thể`,
  (shortcuts) => press(shortcuts.messagesToggleConceal(), "để bật/tắt ẩn khối mã trong tin nhắn"),
  (shortcuts) => `Dùng ${commandText("/status", shortcuts.statusView())} để xem thông tin trạng thái hệ thống`,
  "Bật {highlight}scroll_acceleration{/highlight} trong {highlight}tui.json{/highlight} để cuộn mượt hơn",
  (shortcuts) =>
    shortcuts.commandList()
      ? `Bật/tắt hiện tên người dùng trong chat qua bảng lệnh (${shortcutText(shortcuts.commandList())})`
      : "Bật/tắt hiện tên người dùng trong chat qua bảng lệnh",
  "Chạy {highlight}docker run -it --rm ghcr.io/anomalyco/opencode{/highlight} trong một container",
  "Dùng {highlight}/connect{/highlight} với OpenCode Zen để có các model được tuyển chọn, đã kiểm thử",
  "Commit file {highlight}AGENTS.md{/highlight} của dự án lên Git để cả team cùng dùng",
  "Dùng {highlight}/review{/highlight} để xem lại thay đổi chưa commit, branch, hoặc PR",
  (shortcuts) => `Dùng ${commandText("/help", shortcuts.helpShow())} để mở hộp thoại trợ giúp`,
  "Dùng {highlight}/rename{/highlight} để đổi tên session hiện tại",
]

const INPUT_UNDO_TIP: Tip = (shortcuts) => press(shortcuts.inputUndo(), "để hoàn tác thay đổi trong prompt")
const TERMINAL_SUSPEND_TIP: Tip = (shortcuts) =>
  press(shortcuts.terminalSuspend(), "để tạm dừng terminal và quay lại shell")
