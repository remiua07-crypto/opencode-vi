export * as TuiKeybind from "./keybind"

import type { KeyEvent, Renderable } from "@opentui/core"
import type { Binding } from "@opentui/keymap"
import type { BindingCommandMap, BindingConfig, BindingDefaults } from "@opentui/keymap/extras"
import { Schema } from "effect"

const KeyStroke = Schema.Struct({
  name: Schema.String,
  ctrl: Schema.optional(Schema.Boolean),
  shift: Schema.optional(Schema.Boolean),
  meta: Schema.optional(Schema.Boolean),
  super: Schema.optional(Schema.Boolean),
  hyper: Schema.optional(Schema.Boolean),
})

const BindingObject = Schema.StructWithRest(
  Schema.Struct({
    key: Schema.Union([Schema.String, KeyStroke]),
    event: Schema.optional(Schema.Literals(["press", "release"])),
    preventDefault: Schema.optional(Schema.Boolean),
    fallthrough: Schema.optional(Schema.Boolean),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
)

const BindingItem = Schema.Union([Schema.String, KeyStroke, BindingObject])
export const BindingValueSchema = Schema.Union([
  Schema.Literal(false),
  Schema.Literal("none"),
  BindingItem,
  Schema.Array(BindingItem),
])
export type BindingValueSchema = Schema.Schema.Type<typeof BindingValueSchema>

type Definition = {
  default: BindingValueSchema
  description: string
}

export const LeaderDefault = "ctrl+x"

const keybind = (value: Definition["default"], description: string): Definition => ({ default: value, description })

export const Definitions = {
  leader: keybind(LeaderDefault, "Phím leader cho tổ hợp phím tắt"),

  app_exit: keybind("ctrl+c,ctrl+d,<leader>q", "Thoát ứng dụng"),
  app_debug: keybind("none", "Bật/tắt bảng gỡ lỗi"),
  app_console: keybind("none", "Bật/tắt console"),
  app_heap_snapshot: keybind("none", "Ghi heap snapshot"),
  app_toggle_animations: keybind("none", "Bật/tắt hiệu ứng động"),
  app_toggle_file_context: keybind("none", "Bật/tắt ngữ cảnh file"),
  app_toggle_diffwrap: keybind("none", "Bật/tắt ngắt dòng Diff"),
  app_toggle_paste_summary: keybind("none", "Bật/tắt tóm tắt dán"),
  app_toggle_session_directory_filter: keybind("none", "Bật/tắt lọc thư mục session"),
  command_list: keybind("ctrl+p", "Liệt kê các lệnh khả dụng"),
  help_show: keybind("none", "Mở hộp thoại trợ giúp"),
  docs_open: keybind("none", "Mở tài liệu"),
  diff_open: keybind("none", "Mở trình xem Diff"),
  diff_close: keybind("escape,q", "Đóng trình xem Diff"),
  diff_toggle: keybind("enter,space", "Bật/tắt mục trong trình xem Diff"),
  diff_expand: keybind("right", "Mở rộng mục trong trình xem Diff"),
  diff_expand_all: keybind("E", "Mở rộng tất cả thư mục trong trình xem Diff"),
  diff_collapse: keybind("left", "Thu gọn mục trong trình xem Diff"),
  diff_switch_focus: keybind("tab", "Chuyển tiêu điểm trình xem Diff"),
  diff_next_hunk: keybind("]", "Nhảy đến hunk Diff kế tiếp"),
  diff_previous_hunk: keybind("[", "Nhảy đến hunk Diff trước"),
  diff_next_file: keybind("n", "Nhảy đến file Diff kế tiếp"),
  diff_previous_file: keybind("p", "Nhảy đến file Diff trước"),
  diff_toggle_file_tree: keybind("b", "Bật/tắt cây file trong trình xem Diff"),
  diff_single_patch: keybind("s", "Bật/tắt chế độ xem patch đơn"),
  diff_switch_source: keybind("d", "Chuyển nguồn của trình xem Diff"),
  diff_toggle_view: keybind("v", "Bật/tắt chế độ xem chia đôi hoặc hợp nhất của trình xem Diff"),
  diff_help: keybind("?", "Hiện thêm phím tắt của trình xem Diff"),

  editor_open: keybind("<leader>e", "Mở trình soạn thảo ngoài"),
  theme_list: keybind("<leader>t", "Liệt kê các theme khả dụng"),
  theme_switch_mode: keybind("none", "Chuyển giữa chế độ theme sáng và tối"),
  theme_mode_lock: keybind("none", "Khóa hoặc mở khóa chế độ theme"),
  sidebar_toggle: keybind("<leader>b", "Bật/tắt thanh bên"),
  scrollbar_toggle: keybind("none", "Bật/tắt thanh cuộn session"),
  status_view: keybind("<leader>s", "Xem trạng thái"),
  debug_view: keybind("none", "Xem thông tin gỡ lỗi"),

  session_export: keybind("<leader>x", "Xuất session ra trình soạn thảo"),
  session_copy: keybind("none", "Sao chép transcript của session"),
  session_move: keybind("none", "Di chuyển session"),
  session_new: keybind("<leader>n", "Tạo session mới"),
  session_list: keybind("<leader>l", "Liệt kê tất cả session"),
  session_timeline: keybind("<leader>g", "Hiện dòng thời gian của session"),
  session_fork: keybind("none", "Fork session từ tin nhắn"),
  session_rename: keybind("ctrl+r", "Đổi tên session"),
  session_delete: keybind("ctrl+d", "Xóa session"),
  session_share: keybind("none", "Chia sẻ session hiện tại"),
  session_unshare: keybind("none", "Ngừng chia sẻ session hiện tại"),
  session_interrupt: keybind("escape", "Ngắt session hiện tại"),
  session_background: keybind("ctrl+b", "Đưa subagent đồng bộ vào chạy nền"),
  session_compact: keybind("<leader>c", "Nén gọn session"),
  session_toggle_timestamps: keybind("none", "Bật/tắt dấu thời gian của tin nhắn"),
  session_toggle_generic_tool_output: keybind("none", "Bật/tắt đầu ra tool chung"),
  session_queued_prompts: keybind("<leader>q", "Quản lý prompt trong hàng đợi"),
  session_child_first: keybind("<leader>down", "Đến session con đầu tiên"),
  session_child_cycle: keybind("right", "Đến session con kế tiếp"),
  session_child_cycle_reverse: keybind("left", "Đến session con trước đó"),
  session_parent: keybind("up", "Đến session cha"),
  session_pin_toggle: keybind("ctrl+f", "Ghim hoặc bỏ ghim session trong danh sách session"),
  session_quick_switch_1: keybind("<leader>1", "Chuyển đến session trong ô nhanh 1"),
  session_quick_switch_2: keybind("<leader>2", "Chuyển đến session trong ô nhanh 2"),
  session_quick_switch_3: keybind("<leader>3", "Chuyển đến session trong ô nhanh 3"),
  session_quick_switch_4: keybind("<leader>4", "Chuyển đến session trong ô nhanh 4"),
  session_quick_switch_5: keybind("<leader>5", "Chuyển đến session trong ô nhanh 5"),
  session_quick_switch_6: keybind("<leader>6", "Chuyển đến session trong ô nhanh 6"),
  session_quick_switch_7: keybind("<leader>7", "Chuyển đến session trong ô nhanh 7"),
  session_quick_switch_8: keybind("<leader>8", "Chuyển đến session trong ô nhanh 8"),
  session_quick_switch_9: keybind("<leader>9", "Chuyển đến session trong ô nhanh 9"),

  stash_delete: keybind("ctrl+d", "Xóa mục stash"),
  model_provider_list: keybind("ctrl+a", "Mở danh sách provider từ hộp thoại model"),
  model_favorite_toggle: keybind("ctrl+f", "Bật/tắt đánh dấu yêu thích model"),
  model_list: keybind("<leader>m", "Liệt kê các model khả dụng"),
  model_cycle_recent: keybind("f2", "Model vừa dùng kế tiếp"),
  model_cycle_recent_reverse: keybind("shift+f2", "Model vừa dùng trước đó"),
  model_cycle_favorite: keybind("none", "Model yêu thích kế tiếp"),
  model_cycle_favorite_reverse: keybind("none", "Model yêu thích trước đó"),
  mcp_list: keybind("none", "Liệt kê máy chủ MCP"),
  provider_connect: keybind("none", "Kết nối provider"),
  console_org_switch: keybind("none", "Chuyển tổ chức trên console"),
  agent_list: keybind("<leader>a", "Liệt kê agent"),
  agent_cycle: keybind("tab", "Agent kế tiếp"),
  agent_cycle_reverse: keybind("shift+tab", "Agent trước đó"),
  variant_cycle: keybind("ctrl+t", "Xoay vòng variant của model"),
  variant_list: keybind("none", "Liệt kê variant của model"),

  messages_page_up: keybind("pageup,ctrl+alt+b", "Cuộn tin nhắn lên một trang"),
  messages_page_down: keybind("pagedown,ctrl+alt+f", "Cuộn tin nhắn xuống một trang"),
  messages_line_up: keybind("ctrl+alt+y", "Cuộn tin nhắn lên một dòng"),
  messages_line_down: keybind("ctrl+alt+e", "Cuộn tin nhắn xuống một dòng"),
  messages_half_page_up: keybind("ctrl+alt+u", "Cuộn tin nhắn lên nửa trang"),
  messages_half_page_down: keybind("ctrl+alt+d", "Cuộn tin nhắn xuống nửa trang"),
  messages_first: keybind("ctrl+g,home", "Đến tin nhắn đầu tiên"),
  messages_last: keybind("ctrl+alt+g,end", "Đến tin nhắn cuối cùng"),
  messages_next: keybind("none", "Đến tin nhắn kế tiếp"),
  messages_previous: keybind("none", "Đến tin nhắn trước đó"),
  messages_last_user: keybind("none", "Đến tin nhắn người dùng cuối cùng"),
  messages_copy: keybind("<leader>y", "Sao chép tin nhắn"),
  messages_undo: keybind("<leader>u", "Hoàn tác tin nhắn"),
  messages_redo: keybind("<leader>r", "Làm lại tin nhắn"),
  messages_toggle_conceal: keybind("<leader>h", "Bật/tắt ẩn khối mã trong tin nhắn"),
  tool_details: keybind("none", "Bật/tắt hiển thị chi tiết tool"),
  display_thinking: keybind("none", "Bật/tắt hiển thị khối suy luận"),

  prompt_submit: keybind("none", "Gửi prompt"),
  prompt_editor_context_clear: keybind("none", "Xóa ngữ cảnh trình soạn thảo"),
  prompt_skills: keybind("none", "Mở bộ chọn kỹ năng"),
  prompt_stash: keybind("none", "Stash prompt"),
  prompt_stash_pop: keybind("none", "Lấy lại prompt đã stash"),
  prompt_stash_list: keybind("none", "Liệt kê prompt đã stash"),
  workspace_set: keybind("none", "Đặt workspace"),

  input_clear: keybind("ctrl+c", "Xóa trường nhập"),
  input_paste: keybind({ key: "ctrl+v", preventDefault: false }, "Dán từ bộ nhớ tạm"),
  input_submit: keybind("return", "Gửi nội dung nhập"),
  input_newline: keybind("shift+return,ctrl+return,alt+return,ctrl+j", "Chèn xuống dòng trong ô nhập"),
  input_move_left: keybind("left,ctrl+b", "Di chuyển con trỏ sang trái trong ô nhập"),
  input_move_right: keybind("right,ctrl+f", "Di chuyển con trỏ sang phải trong ô nhập"),
  input_move_up: keybind("up", "Di chuyển con trỏ lên trên trong ô nhập"),
  input_move_down: keybind("down", "Di chuyển con trỏ xuống dưới trong ô nhập"),
  input_select_left: keybind("shift+left", "Chọn sang trái trong ô nhập"),
  input_select_right: keybind("shift+right", "Chọn sang phải trong ô nhập"),
  input_select_up: keybind("shift+up", "Chọn lên trên trong ô nhập"),
  input_select_down: keybind("shift+down", "Chọn xuống dưới trong ô nhập"),
  input_line_home: keybind("ctrl+a", "Về đầu dòng trong ô nhập"),
  input_line_end: keybind("ctrl+e", "Về cuối dòng trong ô nhập"),
  input_select_line_home: keybind("ctrl+shift+a", "Chọn đến đầu dòng trong ô nhập"),
  input_select_line_end: keybind("ctrl+shift+e", "Chọn đến cuối dòng trong ô nhập"),
  input_visual_line_home: keybind("alt+a", "Về đầu dòng hiển thị trong ô nhập"),
  input_visual_line_end: keybind("alt+e", "Về cuối dòng hiển thị trong ô nhập"),
  input_select_visual_line_home: keybind("alt+shift+a", "Chọn đến đầu dòng hiển thị trong ô nhập"),
  input_select_visual_line_end: keybind("alt+shift+e", "Chọn đến cuối dòng hiển thị trong ô nhập"),
  input_buffer_home: keybind("home", "Về đầu vùng soạn trong ô nhập"),
  input_buffer_end: keybind("end", "Về cuối vùng soạn trong ô nhập"),
  input_select_buffer_home: keybind("shift+home", "Chọn đến đầu vùng soạn trong ô nhập"),
  input_select_buffer_end: keybind("shift+end", "Chọn đến cuối vùng soạn trong ô nhập"),
  input_delete_line: keybind("ctrl+shift+d", "Xóa dòng trong ô nhập"),
  input_delete_to_line_end: keybind("ctrl+k", "Xóa đến cuối dòng trong ô nhập"),
  input_delete_to_line_start: keybind("ctrl+u", "Xóa đến đầu dòng trong ô nhập"),
  input_backspace: keybind("backspace,shift+backspace", "Backspace trong ô nhập"),
  input_delete: keybind("ctrl+d,delete,shift+delete", "Xóa ký tự trong ô nhập"),
  input_undo: keybind("ctrl+-,super+z", "Hoàn tác trong ô nhập"),
  input_redo: keybind("ctrl+.,super+shift+z", "Làm lại trong ô nhập"),
  input_word_forward: keybind("alt+f,alt+right,ctrl+right", "Nhảy tới một từ trong ô nhập"),
  input_word_backward: keybind("alt+b,alt+left,ctrl+left", "Lùi lại một từ trong ô nhập"),
  input_select_word_forward: keybind("alt+shift+f,alt+shift+right", "Chọn tới một từ trong ô nhập"),
  input_select_word_backward: keybind("alt+shift+b,alt+shift+left", "Chọn lùi một từ trong ô nhập"),
  input_delete_word_forward: keybind("alt+d,alt+delete,ctrl+delete", "Xóa một từ phía sau trong ô nhập"),
  input_delete_word_backward: keybind("ctrl+w,ctrl+backspace,alt+backspace", "Xóa một từ phía trước trong ô nhập"),
  input_select_all: keybind("super+a", "Chọn tất cả trong ô nhập"),
  history_previous: keybind("up", "Mục lịch sử trước đó"),
  history_next: keybind("down", "Mục lịch sử kế tiếp"),

  "dialog.select.prev": keybind("up,ctrl+p", "Chuyển đến mục hộp thoại trước đó"),
  "dialog.select.next": keybind("down,ctrl+n", "Chuyển đến mục hộp thoại kế tiếp"),
  "dialog.select.page_up": keybind("pageup", "Lên một trang trong hộp thoại"),
  "dialog.select.page_down": keybind("pagedown", "Xuống một trang trong hộp thoại"),
  "dialog.select.home": keybind("home", "Đến mục đầu tiên trong hộp thoại"),
  "dialog.select.end": keybind("end", "Đến mục cuối cùng trong hộp thoại"),
  "dialog.select.submit": keybind("return", "Xác nhận mục đang chọn trong hộp thoại"),
  "dialog.prompt.submit": keybind("return", "Gửi prompt trong hộp thoại"),
  "dialog.mcp.toggle": keybind("space", "Bật/tắt MCP trong hộp thoại MCP"),
  "dialog.move_session.new": keybind("ctrl+m", "Tạo bản sao dự án mới"),
  "dialog.move_session.delete": keybind("ctrl+d", "Xóa bản sao dự án"),
  "dialog.move_session.refresh": keybind("ctrl+r", "Làm mới các bản sao dự án"),
  "prompt.autocomplete.prev": keybind("up,ctrl+p", "Chuyển đến mục gợi ý trước đó"),
  "prompt.autocomplete.next": keybind("down,ctrl+n", "Chuyển đến mục gợi ý kế tiếp"),
  "prompt.autocomplete.hide": keybind("escape", "Ẩn gợi ý"),
  "prompt.autocomplete.select": keybind("return", "Chọn mục gợi ý"),
  "prompt.autocomplete.complete": keybind("tab", "Hoàn tất mục gợi ý"),
  "permission.prompt.fullscreen": keybind("ctrl+f", "Bật/tắt toàn màn hình cho hộp thoại quyền"),
  "plugins.toggle": keybind("space", "Bật/tắt plugin"),
  "dialog.plugins.install": keybind("shift+i", "Cài đặt plugin từ hộp thoại plugin"),

  terminal_suspend: keybind("ctrl+z", "Tạm dừng terminal"),
  terminal_title_toggle: keybind("none", "Bật/tắt tiêu đề terminal"),
  tips_toggle: keybind("<leader>h", "Bật/tắt mẹo trên màn hình chính"),
  plugin_manager: keybind("none", "Mở hộp thoại quản lý plugin"),
  plugin_install: keybind("none", "Cài đặt plugin"),

  which_key_toggle: keybind("ctrl+alt+k", "Bật/tắt bảng which-key"),
  which_key_layout_toggle: keybind("ctrl+alt+shift+k", "Đổi bố cục which-key"),
  which_key_pending_toggle: keybind("ctrl+alt+shift+p", "Bật/tắt xem trước chuỗi phím đang chờ của which-key"),
  which_key_group_previous: keybind("ctrl+alt+left,ctrl+alt+[", "Nhóm which-key trước đó"),
  which_key_group_next: keybind("ctrl+alt+right,ctrl+alt+]", "Nhóm which-key kế tiếp"),
  which_key_scroll_up: keybind("ctrl+alt+up,ctrl+alt+p", "Cuộn which-key lên"),
  which_key_scroll_down: keybind("ctrl+alt+down,ctrl+alt+n", "Cuộn which-key xuống"),
  which_key_page_up: keybind("ctrl+alt+pageup", "Lên trang which-key"),
  which_key_page_down: keybind("ctrl+alt+pagedown", "Xuống trang which-key"),
  which_key_home: keybind("ctrl+alt+home", "Nhảy đến phím tắt which-key đầu tiên"),
  which_key_end: keybind("ctrl+alt+end", "Nhảy đến phím tắt which-key cuối cùng"),
} satisfies Record<string, Definition>

type KeybindName = keyof typeof Definitions
const KeybindNames = new Set<string>(Object.keys(Definitions))

export const KeybindOverrides = Schema.Struct(
  Object.fromEntries(
    Object.entries(Definitions).map(([name, item]) => [
      name,
      Schema.optional(BindingValueSchema).annotate({ description: item.description }),
    ]),
  ),
).annotate({ description: "Ghi đè phím tắt TUI" })
export const Descriptions = Object.fromEntries(
  Object.entries(Definitions).map(([name, item]) => [name, item.description]),
) as Record<KeybindName, string>
export const CommandMap = {
  app_exit: "app.exit",
  app_debug: "app.debug",
  app_console: "app.console",
  app_heap_snapshot: "app.heap_snapshot",
  app_toggle_animations: "app.toggle.animations",
  app_toggle_file_context: "app.toggle.file_context",
  app_toggle_diffwrap: "app.toggle.diffwrap",
  app_toggle_paste_summary: "app.toggle.paste_summary",
  app_toggle_session_directory_filter: "app.toggle.session_directory_filter",
  command_list: "command.palette.show",
  help_show: "help.show",
  docs_open: "docs.open",
  diff_open: "diff.open",
  diff_close: "diff.close",
  diff_toggle: "diff.toggle",
  diff_expand: "diff.expand",
  diff_expand_all: "diff.expand_all",
  diff_collapse: "diff.collapse",
  diff_switch_focus: "diff.switch_focus",
  diff_next_hunk: "diff.next_hunk",
  diff_previous_hunk: "diff.previous_hunk",
  diff_next_file: "diff.next_file",
  diff_previous_file: "diff.previous_file",
  diff_toggle_file_tree: "diff.toggle_file_tree",
  diff_single_patch: "diff.single_patch",
  diff_switch_source: "diff.switch_source",
  diff_toggle_view: "diff.toggle_view",
  diff_help: "diff.help",
  editor_open: "prompt.editor",
  theme_list: "theme.switch",
  theme_switch_mode: "theme.switch_mode",
  theme_mode_lock: "theme.mode.lock",
  sidebar_toggle: "session.sidebar.toggle",
  scrollbar_toggle: "session.toggle.scrollbar",
  status_view: "opencode.status",
  debug_view: "opencode.debug",
  session_export: "session.export",
  session_copy: "session.copy",
  session_move: "session.move",
  session_new: "session.new",
  session_list: "session.list",
  session_timeline: "session.timeline",
  session_fork: "session.fork",
  session_rename: "session.rename",
  session_delete: "session.delete",
  session_share: "session.share",
  session_unshare: "session.unshare",
  session_interrupt: "session.interrupt",
  session_background: "session.background",
  session_compact: "session.compact",
  session_toggle_timestamps: "session.toggle.timestamps",
  session_toggle_generic_tool_output: "session.toggle.generic_tool_output",
  session_queued_prompts: "session.queued_prompts",
  session_child_first: "session.child.first",
  session_child_cycle: "session.child.next",
  session_child_cycle_reverse: "session.child.previous",
  session_parent: "session.parent",
  session_pin_toggle: "session.pin.toggle",
  session_quick_switch_1: "session.quick_switch.1",
  session_quick_switch_2: "session.quick_switch.2",
  session_quick_switch_3: "session.quick_switch.3",
  session_quick_switch_4: "session.quick_switch.4",
  session_quick_switch_5: "session.quick_switch.5",
  session_quick_switch_6: "session.quick_switch.6",
  session_quick_switch_7: "session.quick_switch.7",
  session_quick_switch_8: "session.quick_switch.8",
  session_quick_switch_9: "session.quick_switch.9",
  stash_delete: "stash.delete",
  model_provider_list: "model.dialog.provider",
  model_favorite_toggle: "model.dialog.favorite",
  model_list: "model.list",
  model_cycle_recent: "model.cycle_recent",
  model_cycle_recent_reverse: "model.cycle_recent_reverse",
  model_cycle_favorite: "model.cycle_favorite",
  model_cycle_favorite_reverse: "model.cycle_favorite_reverse",
  mcp_list: "mcp.list",
  provider_connect: "provider.connect",
  console_org_switch: "console.org.switch",
  agent_list: "agent.list",
  agent_cycle: "agent.cycle",
  agent_cycle_reverse: "agent.cycle.reverse",
  variant_cycle: "variant.cycle",
  variant_list: "variant.list",
  messages_page_up: "session.page.up",
  messages_page_down: "session.page.down",
  messages_line_up: "session.line.up",
  messages_line_down: "session.line.down",
  messages_half_page_up: "session.half.page.up",
  messages_half_page_down: "session.half.page.down",
  messages_first: "session.first",
  messages_last: "session.last",
  messages_next: "session.message.next",
  messages_previous: "session.message.previous",
  messages_last_user: "session.messages_last_user",
  messages_copy: "messages.copy",
  messages_undo: "session.undo",
  messages_redo: "session.redo",
  messages_toggle_conceal: "session.toggle.conceal",
  tool_details: "session.toggle.actions",
  display_thinking: "session.toggle.thinking",
  prompt_submit: "prompt.submit",
  prompt_editor_context_clear: "prompt.editor_context.clear",
  prompt_skills: "prompt.skills",
  prompt_stash: "prompt.stash",
  prompt_stash_pop: "prompt.stash.pop",
  prompt_stash_list: "prompt.stash.list",
  workspace_set: "workspace.set",
  input_clear: "prompt.clear",
  input_paste: "prompt.paste",
  input_submit: "input.submit",
  input_newline: "input.newline",
  input_move_left: "input.move.left",
  input_move_right: "input.move.right",
  input_move_up: "input.move.up",
  input_move_down: "input.move.down",
  input_select_left: "input.select.left",
  input_select_right: "input.select.right",
  input_select_up: "input.select.up",
  input_select_down: "input.select.down",
  input_line_home: "input.line.home",
  input_line_end: "input.line.end",
  input_select_line_home: "input.select.line.home",
  input_select_line_end: "input.select.line.end",
  input_visual_line_home: "input.visual.line.home",
  input_visual_line_end: "input.visual.line.end",
  input_select_visual_line_home: "input.select.visual.line.home",
  input_select_visual_line_end: "input.select.visual.line.end",
  input_buffer_home: "input.buffer.home",
  input_buffer_end: "input.buffer.end",
  input_select_buffer_home: "input.select.buffer.home",
  input_select_buffer_end: "input.select.buffer.end",
  input_delete_line: "input.delete.line",
  input_delete_to_line_end: "input.delete.to.line.end",
  input_delete_to_line_start: "input.delete.to.line.start",
  input_backspace: "input.backspace",
  input_delete: "input.delete",
  input_undo: "input.undo",
  input_redo: "input.redo",
  input_word_forward: "input.word.forward",
  input_word_backward: "input.word.backward",
  input_select_word_forward: "input.select.word.forward",
  input_select_word_backward: "input.select.word.backward",
  input_delete_word_forward: "input.delete.word.forward",
  input_delete_word_backward: "input.delete.word.backward",
  input_select_all: "input.select.all",
  history_previous: "prompt.history.previous",
  history_next: "prompt.history.next",
  terminal_suspend: "terminal.suspend",
  terminal_title_toggle: "terminal.title.toggle",
  tips_toggle: "tips.toggle",
  plugin_manager: "plugins.list",
  plugin_install: "plugins.install",
  which_key_toggle: "which-key.toggle",
  which_key_layout_toggle: "which-key.layout.toggle",
  which_key_pending_toggle: "which-key.pending.toggle",
  which_key_group_previous: "which-key.group.previous",
  which_key_group_next: "which-key.group.next",
  which_key_scroll_up: "which-key.scroll.up",
  which_key_scroll_down: "which-key.scroll.down",
  which_key_page_up: "which-key.page.up",
  which_key_page_down: "which-key.page.down",
  which_key_home: "which-key.home",
  which_key_end: "which-key.end",
} satisfies BindingCommandMap
const CommandDescriptions = Object.fromEntries(
  Object.entries(Definitions).map(([name, item]) => [
    CommandMap[name as keyof typeof CommandMap] ?? name,
    item.description,
  ]),
) as Record<string, string>

export type Keybinds = { [K in KeybindName]: BindingValueSchema }
export type KeybindOverrides = Partial<Keybinds>
export type BindingLookupView = {
  readonly bindings: readonly Binding<Renderable, KeyEvent>[]
  get(command: string): readonly Binding<Renderable, KeyEvent>[]
  has(command: string): boolean
  gather(name: string, commands: readonly string[]): readonly Binding<Renderable, KeyEvent>[]
  pick(name: string, commands: readonly string[]): Binding<Renderable, KeyEvent>[]
  omit(name: string, commands: readonly string[]): Binding<Renderable, KeyEvent>[]
}

export function toBindingConfig(keybinds: Keybinds): BindingConfig<Renderable, KeyEvent> {
  return Object.fromEntries(Object.entries(keybinds)) as BindingConfig<Renderable, KeyEvent>
}

const decodeBindingValue = Schema.decodeUnknownSync(BindingValueSchema)

export function defaultValue(name: KeybindName) {
  return Definitions[name].default
}

export function parse(keybinds: KeybindOverrides): Keybinds {
  const invalid = unknownKeys(keybinds)
  if (invalid.length) throw new Error(`Phím tắt không hợp lệ: ${invalid.join(", ")}`)
  return Object.fromEntries(
    Object.entries(Definitions).map(([name, item]) => [
      name,
      decodeBindingValue(keybinds[name as KeybindName] ?? item.default),
    ]),
  ) as Keybinds
}

export const Keybinds = { parse }

export function unknownKeys(input: object) {
  return Object.keys(input).filter((key) => !KeybindNames.has(key))
}

export function bindingDefaults(): BindingDefaults<Renderable, KeyEvent> {
  return ({ command, binding }) => {
    if (binding.desc !== undefined) return
    return { desc: CommandDescriptions[command] }
  }
}
