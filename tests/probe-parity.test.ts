import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ProbeResultSchema, summarize } from "../src/probe.js";

// Recorded with ffprobe 8.1.2 by scripts/record_probe_fixtures.py; summaries.json is the Python reference's reading.
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/probe/${name}.json`, import.meta.url), "utf8"));
}

describe("probe parity with the Python reference", () => {
  const expected = fixture("summaries") as Record<string, Record<string, unknown>>;

  it("covers every recorded input", () => {
    expect(Object.keys(expected).sort()).toEqual(["audio", "image", "video"]);
  });

  it.each(["audio", "image", "video"])("%s", (name) => {
    const raw = fixture(name);
    const result = ProbeResultSchema.parse(raw);
    expect(result).toMatchObject(raw as object); // nothing ffprobe reported is lost or changed
    // Python's summary has no stream objects.
    const values = Object.entries(summarize(result)).filter(([key]) => key !== "video" && key !== "audio");
    expect(Object.fromEntries(values)).toEqual(expected[name]);
  });
});
