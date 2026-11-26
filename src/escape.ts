import { formatValue, type Scalar } from "./value.js";

/** Escape each character of `chars` with a backslash. Backslash is handled first, matching ffmpeg-python. */
export function escapeChars(text: Scalar, chars: string): string {
  const unique = [...new Set(chars)];
  const ordered = unique.includes("\\") ? ["\\", ...unique.filter((c) => c !== "\\")] : unique;
  return ordered.reduce((result, c) => result.replaceAll(c, () => `\\${c}`), formatValue(text));
}

export function escapeFilterToken(value: Scalar): string {
  return escapeChars(value, "\\'=:");
}
