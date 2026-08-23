import { EOL } from "os"
import { cmd } from "../cmd"

export const StartupCommand = cmd({
  command: "startup",
  describe: "in ra thời gian khởi động",
  builder: (yargs) => yargs,
  handler() {
    process.stdout.write(performance.now().toString() + EOL)
  },
})
