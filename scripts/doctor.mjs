// Preflight: Node version and ffmpeg/ffprobe resolution. Prints one JSON object; exit 0 only when usable.
// Resolution order (design SOW 3.4): FFMPEG_BINARY / FFPROBE_BINARY, then PATH. Nothing is downloaded.
import { execFileSync } from "node:child_process";

const MIN_NODE = [24, 12];

function nodeOk() {
  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
  return major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
}

function tool(name, envVar) {
  const command = process.env[envVar] || name;
  try {
    const out = execFileSync(command, ["-version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const first = out.split("\n")[0] ?? "";
    const match = /version\s+(\S+)/.exec(first);
    return { command, ok: true, version: match ? match[1] : null };
  } catch {
    return { command, ok: false, version: null };
  }
}

const ffmpeg = tool("ffmpeg", "FFMPEG_BINARY");
const ffprobe = tool("ffprobe", "FFPROBE_BINARY");
const node = { version: process.versions.node, minimum: MIN_NODE.join("."), ok: nodeOk() };
const ok = node.ok && ffmpeg.ok && ffprobe.ok;
console.log(JSON.stringify({ ok, node, ffmpeg, ffprobe }, null, 2));
process.exit(ok ? 0 : 1);
