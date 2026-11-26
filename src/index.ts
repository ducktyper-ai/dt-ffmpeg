import { readFileSync } from "node:fs";

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
