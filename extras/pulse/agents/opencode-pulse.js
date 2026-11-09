// Omarchy Pulse 1.6: OpenCode's sessions as a drone on your wallpaper. (c) 2026 Marco Porro (x.com/MarcoPorro), MIT.
// Install: omarchy-pulse hook install opencode   (copies this file to ~/.config/opencode/plugins/)
// It sends only the state, the tool's name and the project folder to Pulse on your PC: never the prompt or the code.
import { spawn } from "node:child_process";

export const OmarchyPulse = async ({ directory }) => {
  const send = (state, tool) => {
    try {
      const p = spawn("omarchy-pulse", ["hook", "opencode", state], { stdio: ["pipe", "ignore", "ignore"], detached: true });
      p.on("error", () => {});
      p.stdin.end(JSON.stringify({ cwd: directory || process.cwd(), tool_name: tool || "" }));
      p.unref();
    } catch (e) {}   // Pulse not installed or not running: OpenCode goes on
  };
  return {
    event: async ({ event }) => {
      const t = event && event.type;
      if (t === "session.idle") send("done");
      else if (t === "session.error") send("failed");
      else if (t === "permission.updated" || t === "permission.asked") send("waiting");
      else if (t === "session.status" && event.properties && event.properties.status && event.properties.status.type === "busy") send("working");
      else if (t === "session.deleted") send("gone");
    },
    "tool.execute.before": async (input) => { send("working", input && input.tool); },
  };
};
