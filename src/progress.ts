/** One `-progress` report from ffmpeg. Values ffmpeg does not know (`N/A`) are `null`. */
export interface Progress {
  frame: number | null;
  fps: number | null;
  outTimeUs: number | null;
  totalSize: number | null;
  speed: string | null;
  /** `true` on the last report. */
  end: boolean;
  raw: Record<string, string>;
}

function integer(text: string | undefined, pattern = /^\d+$/): number | null {
  return text !== undefined && pattern.test(text) ? Number(text) : null;
}

function toProgress(raw: Record<string, string>): Progress {
  const fps = Number(raw["fps"] || Number.NaN);
  return {
    frame: integer(raw["frame"]),
    fps: Number.isFinite(fps) ? fps : null,
    outTimeUs: integer(raw["out_time_us"], /^-?\d+$/),
    totalSize: integer(raw["total_size"]),
    speed: raw["speed"] ?? null,
    end: raw["progress"] === "end",
    raw,
  };
}

/** Feed it text as it arrives; it reports each block, which ffmpeg ends with a `progress=` line. */
export function progressParser(onProgress: (progress: Progress) => void): (text: string) => void {
  let pending = "";
  let raw: Record<string, string> = {};
  return (text) => {
    const lines = (pending + text).split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      const at = line.indexOf("=");
      if (at < 0) continue;
      const key = line.slice(0, at).trim();
      raw[key] = line.slice(at + 1).trim();
      if (key === "progress") {
        const block = raw;
        raw = {};
        onProgress(toProgress(block));
      }
    }
  };
}
