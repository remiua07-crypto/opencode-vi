import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { createStore } from "solid-js/store"
import { For } from "solid-js"
import { useBindings } from "../keymap"

export function DialogSessionDeleteFailed(props: {
  session: string
  workspace: string
  onDelete?: () => boolean | void | Promise<boolean | void>
  onRestore?: () => boolean | void | Promise<boolean | void>
  onDone?: () => void
}) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const [store, setStore] = createStore({
    active: "delete" as "delete" | "restore",
  })

  const options = [
    {
      id: "delete" as const,
      title: "Xóa workspace",
      description: "Xóa workspace cùng tất cả session đang gắn với nó.",
      run: props.onDelete,
    },
    {
      id: "restore" as const,
      title: "Khôi phục sang workspace mới",
      description: "Cố gắng khôi phục session này vào một workspace mới.",
      run: props.onRestore,
    },
  ]

  async function confirm() {
    const result = await options.find((item) => item.id === store.active)?.run?.()
    if (result === false) return
    props.onDone?.()
    if (!props.onDone) dialog.clear()
  }

  useBindings(() => ({
    bindings: [
      { key: "return", desc: "Xác nhận tùy chọn khôi phục", group: "Dialog", cmd: () => void confirm() },
      { key: "left", desc: "Xóa session bị lỗi", group: "Dialog", cmd: () => setStore("active", "delete") },
      { key: "up", desc: "Xóa session bị lỗi", group: "Dialog", cmd: () => setStore("active", "delete") },
      { key: "right", desc: "Khôi phục session bị lỗi", group: "Dialog", cmd: () => setStore("active", "restore") },
      { key: "down", desc: "Khôi phục session bị lỗi", group: "Dialog", cmd: () => setStore("active", "restore") },
    ],
  }))

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          Xóa Session Thất Bại
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <text fg={theme.textMuted} wrapMode="word">
        {`Session "${props.session}" không thể xóa vì workspace "${props.workspace}" hiện không khả dụng.`}
      </text>
      <text fg={theme.textMuted} wrapMode="word">
        Chọn cách bạn muốn khôi phục session workspace bị lỗi này.
      </text>
      <box flexDirection="column" paddingBottom={1} gap={1}>
        <For each={options}>
          {(item) => (
            <box
              flexDirection="column"
              paddingLeft={1}
              paddingRight={1}
              paddingTop={1}
              paddingBottom={1}
              backgroundColor={item.id === store.active ? theme.primary : undefined}
              onMouseUp={() => {
                setStore("active", item.id)
                void confirm()
              }}
            >
              <text
                attributes={TextAttributes.BOLD}
                fg={item.id === store.active ? theme.selectedListItemText : theme.text}
              >
                {item.title}
              </text>
              <text fg={item.id === store.active ? theme.selectedListItemText : theme.textMuted} wrapMode="word">
                {item.description}
              </text>
            </box>
          )}
        </For>
      </box>
    </box>
  )
}
