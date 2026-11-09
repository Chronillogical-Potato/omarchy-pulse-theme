// Omarchy Pulse 1.6: the Pi coding agent as a drone on your wallpaper. (c) 2026 Marco Porro (x.com/MarcoPorro), MIT.
// Install: omarchy-pulse hook install pi   (copies this file to ~/.pi/agent/extensions/)
// It sends only the state, the tool's name and the project folder to Pulse on your PC: never the prompt or the code.
import { spawn } from "node:child_process";

export default function (pi: any) {
  const send = (state: string, cwd?: string, tool?: string) => {
    try {
      const p = spawn("omarchy-pulse", ["hook", "pi", state], { stdio: ["pipe", "ignore", "ignore"], detached: true });
      p.on("error", () => {});
      p.stdin.end(JSON.stringify({ cwd: cwd || process.cwd(), tool_name: tool || "" }));
      p.unref();
    } catch (e) {}   // Pulse not installed or not running: Pi goes on
  };
  pi.on("session_start", async (_e: any, ctx: any) => send("idle", ctx && ctx.cwd));
  pi.on("agent_start", async (_e: any, ctx: any) => send("working", ctx && ctx.cwd));
  pi.on("tool_call", async (e: any, ctx: any) => send("working", ctx && ctx.cwd, e && (e.toolName || e.name)));
  pi.on("agent_end", async (_e: any, ctx: any) => send("done", ctx && ctx.cwd));
  pi.on("session_shutdown", async (_e: any, ctx: any) => send("gone", ctx && ctx.cwd));
}
