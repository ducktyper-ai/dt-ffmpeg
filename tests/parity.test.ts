import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { escapeChars, getArgs, GraphSchema, parsePythonJson, type Scalar } from "../src/index.js";

function golden<T>(name: string): T {
  return parsePythonJson(readFileSync(new URL(`./golden/${name}.json`, import.meta.url), "utf8")) as T;
}

interface Case {
  graph: unknown;
  argv: string[];
  overwrite?: boolean | null;
  source?: string;
  recipe?: string;
}

const meta = golden<{ compile_cases: number; recipe_cases: number; escape_cases: number }>("meta");

describe("argv parity with the Python reference", () => {
  const compileCases = golden<Case[]>("compile");
  const recipeCases = golden<Case[]>("recipes");

  it("loads every exported case", () => {
    expect(compileCases).toHaveLength(meta.compile_cases);
    expect(recipeCases).toHaveLength(meta.recipe_cases);
  });

  it.each([...compileCases, ...recipeCases].map((c, i) => [`${i} ${c.source ?? c.recipe}`, c] as const))(
    "%s",
    (_label, testCase) => {
      const overwrite = testCase.overwrite ?? undefined;
      const graph = GraphSchema.parse(testCase.graph);
      expect(getArgs(graph, overwrite === undefined ? {} : { overwrite })).toEqual(testCase.argv);
    },
  );
});

describe("escape parity", () => {
  const cases = golden<{ value: Scalar; chars: string; escaped: string }[]>("escape");

  it("matches every exported case", () => {
    expect(cases).toHaveLength(meta.escape_cases);
    for (const c of cases) expect(escapeChars(c.value, c.chars)).toBe(c.escaped);
  });
});
