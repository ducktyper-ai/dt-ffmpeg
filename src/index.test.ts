import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readVersion, version } from "./index.js";

describe("version", () => {
  it("is a semver string", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  });

  it("equals the version in package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version: string;
    };
    expect(readVersion()).toBe(pkg.version);
  });
});
