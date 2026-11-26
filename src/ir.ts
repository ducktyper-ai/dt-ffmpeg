import { z } from "zod";

/** The graph IR: plain JSON-serializable data, the same node kinds and field names as the Python reference. */

const scalar = z.union([z.string(), z.number(), z.boolean()]);
/** An input or output option: `null` is a bare flag, an array repeats the flag. */
const optionValue = z.union([scalar, z.null(), z.array(z.union([scalar, z.null()]))]);
const options = z.record(z.string(), optionValue).default({});

export const StreamRefSchema = z.object({
  node_id: z.string(),
  pad: z.union([z.int(), z.string()]).nullable().default(null),
  selector: z.string().nullable().default(null),
});

export const InputNodeSchema = z.object({
  id: z.string(),
  filename: z.string(),
  kwargs: options,
});

export const FilterNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  inputs: z.array(StreamRefSchema),
  args: z.array(scalar).default([]),
  kwargs: z.record(z.string(), scalar).default({}),
});

export const OutputNodeSchema = z.object({
  id: z.string(),
  filename: z.string(),
  inputs: z.array(StreamRefSchema),
  kwargs: options,
});

function uniqueIds<T extends z.ZodType<{ id: string }>>(node: T) {
  return z
    .array(node)
    .superRefine((nodes, ctx) => {
      const seen = new Set<string>();
      for (const item of nodes as { id: string }[]) {
        if (seen.has(item.id)) {
          ctx.addIssue({ code: "custom", message: `duplicate node id: ${item.id}` });
        }
        seen.add(item.id);
      }
    })
    .default([]);
}

export const GraphSchema = z.object({
  inputs: uniqueIds(InputNodeSchema),
  filters: uniqueIds(FilterNodeSchema),
  outputs: uniqueIds(OutputNodeSchema),
  global_args: z.array(z.string()).default([]),
  overwrite: z.enum(["always", "never"]).nullable().default(null),
});

export type StreamRef = z.output<typeof StreamRefSchema>;
export type InputNode = z.output<typeof InputNodeSchema>;
export type FilterNode = z.output<typeof FilterNodeSchema>;
export type OutputNode = z.output<typeof OutputNodeSchema>;
export type Graph = z.output<typeof GraphSchema>;
export type OptionValue = z.output<typeof optionValue>;
export type Options = Record<string, OptionValue>;
export type OverwritePolicy = NonNullable<Graph["overwrite"]>;

/**
 * `JSON.parse` for documents Python wrote. Python spells a whole float as `1.0` and prints it that way
 * into argv; `JSON.parse` would turn it into `1`. Such numbers are returned as the string `"1.0"`, so the
 * compiled argv is the same bytes. Everything else parses as usual.
 */
export function parsePythonJson(text: string): unknown {
  JSON.parse(text); // reject invalid documents before rewriting any token
  const token = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g;
  return JSON.parse(text.replace(token, (match) => (/^-?\d+\.0+$/.test(match) ? `"${match}"` : match)));
}

/** Validate a graph document (a JSON string, or already-parsed data). Throws `ZodError` when invalid. */
export function parseGraph(document: unknown): Graph {
  return GraphSchema.parse(typeof document === "string" ? parsePythonJson(document) : document);
}
