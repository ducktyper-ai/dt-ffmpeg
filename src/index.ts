import { readFileSync } from "node:fs";

export { compile, getArgs, type ArgsOptions, type CompileOptions } from "./compile.js";
export {
  BinaryNotFoundError,
  FFmpegAbortError,
  FFmpegError,
  FFmpegTimeoutError,
  GraphError,
  type FFmpegFailure,
} from "./errors.js";
export { escapeChars, escapeFilterToken } from "./escape.js";
export { concat, filterStreams, input, mergeOutputs, output, Stream, type FilterOptions } from "./fluent.js";
export * from "./ir.js";
export { formatValue, type Scalar } from "./value.js";

/**
 * The package version, read from package.json only. The same relative path works from
 * `src/` (tests) and from `dist/` (the built package), so no second copy of the number exists.
 */
export function readVersion(): string {
  const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    typeof parsed.version !== "string"
  ) {
    throw new Error("package.json has no string version");
  }
  return parsed.version;
}

export const version: string = readVersion();
