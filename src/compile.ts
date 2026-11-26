import { GraphError } from "./errors.js";
import { escapeChars, escapeFilterToken } from "./escape.js";
import type { FilterNode, Graph, InputNode, OptionValue, Options, OutputNode, StreamRef } from "./ir.js";
import { compareCodePoints, formatValue, type Scalar } from "./value.js";

type Pad = StreamRef["pad"];
type StreamNames = Map<string, string>;

const padKey = (nodeId: string, pad: Pad): string => JSON.stringify([nodeId, pad]);

/** @internal Options as argv, keys sorted. */
export function optionsToArgs(kwargs: Options): string[] {
  const args: string[] = [];
  for (const key of Object.keys(kwargs).sort(compareCodePoints)) {
    const value = kwargs[key] as OptionValue;
    for (const item of Array.isArray(value) ? value : [value]) {
      args.push(`-${key}`);
      if (item !== null) args.push(formatValue(item));
    }
  }
  return args;
}

function single(key: string, value: OptionValue): string {
  if (value === null || Array.isArray(value)) {
    throw new GraphError(`option ${key} needs a single value`);
  }
  return formatValue(value);
}

function videoSize(value: OptionValue): string {
  if (!Array.isArray(value)) return single("video_size", value);
  const [width, height, ...rest] = value;
  if (width === undefined || height === undefined || width === null || height === null || rest.length) {
    throw new GraphError("video_size needs [width, height] or a string");
  }
  return `${formatValue(width)}x${formatValue(height)}`;
}

function inputArgs(node: InputNode): string[] {
  const { format = null, video_size = null, ...rest } = node.kwargs;
  const args: string[] = [];
  if (format !== null) args.push("-f", single("format", format));
  if (video_size !== null) args.push("-video_size", videoSize(video_size));
  args.push(...optionsToArgs(rest), "-i", node.filename);
  return args;
}

function formatStream(names: StreamNames, ref: StreamRef, inputIds: Set<string>, isFinal = false): string {
  const prefix = names.get(padKey(ref.node_id, ref.pad));
  if (prefix === undefined) {
    throw new GraphError(`unknown stream: node ${ref.node_id}, pad ${JSON.stringify(ref.pad)}`);
  }
  const label = ref.selector ? `${prefix}:${ref.selector}` : prefix;
  return isFinal && inputIds.has(ref.node_id) ? label : `[${label}]`;
}

const OUTPUT_FLAGS = [
  ["format", "-f"],
  ["video_bitrate", "-b:v"],
  ["audio_bitrate", "-b:a"],
] as const;

function outputArgs(node: OutputNode, names: StreamNames, inputIds: Set<string>): string[] {
  if (node.inputs.length === 0) {
    throw new GraphError(`Output node ${node.id} has no mapped streams`);
  }
  const args: string[] = [];
  for (const ref of node.inputs) {
    const name = formatStream(names, ref, inputIds, true);
    if (name !== "0" || node.inputs.length > 1) args.push("-map", name);
  }
  const kwargs: Options = { ...node.kwargs };
  for (const [key, flag] of OUTPUT_FLAGS) {
    const value = kwargs[key];
    if (value !== undefined) args.push(flag, single(key, value));
    delete kwargs[key];
  }
  const size = kwargs["video_size"];
  if (size !== undefined) args.push("-video_size", videoSize(size));
  delete kwargs["video_size"];
  args.push(...optionsToArgs(kwargs), node.filename);
  return args;
}

/** Filters in dependency order: those the outputs reach first, then any others. */
function sortFilters(graph: Graph): FilterNode[] {
  const byId = new Map(graph.filters.map((node) => [node.id, node]));
  const ordered: FilterNode[] = [];
  const done = new Set<string>();
  const open = new Set<string>();
  const visit = (id: string): void => {
    const node = byId.get(id);
    if (!node || done.has(id)) return;
    if (open.has(id)) throw new GraphError(`filter graph has a cycle at node ${id}`);
    open.add(id);
    for (const ref of node.inputs) visit(ref.node_id);
    done.add(id);
    ordered.push(node);
  };
  for (const out of graph.outputs) for (const ref of out.inputs) visit(ref.node_id);
  for (const node of graph.filters) visit(node.id);
  return ordered;
}

/** No pad first, then numbered pads, then named pads. */
function comparePads(a: Pad, b: Pad): number {
  const rank = (pad: Pad): number => (pad === null ? 0 : typeof pad === "number" ? 1 : 2);
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return compareCodePoints(a, b);
  return rank(a) - rank(b);
}

function outgoingPads(graph: Graph): Map<string, Pad[]> {
  const used = new Map<string, Set<Pad>>();
  for (const node of [...graph.filters, ...graph.outputs]) {
    for (const ref of node.inputs) {
      const pads = used.get(ref.node_id) ?? new Set<Pad>();
      used.set(ref.node_id, pads.add(ref.pad));
    }
  }
  return new Map([...used].map(([id, pads]) => [id, [...pads].sort(comparePads)]));
}

const isSplit = (name: string): boolean => name === "split" || name === "asplit";

function filterSpec(node: FilterNode, outgoing: Pad[], names: StreamNames, inputIds: Set<string>): string {
  const args: Scalar[] = isSplit(node.name) ? [outgoing.length] : node.args;
  const params = [
    ...args.map(escapeFilterToken),
    ...Object.keys(node.kwargs)
      .sort(compareCodePoints)
      .map((key) => `${escapeFilterToken(key)}=${escapeFilterToken(node.kwargs[key] ?? "")}`),
  ];
  let text = escapeFilterToken(node.name);
  if (params.length) text += `=${params.join(":")}`;
  text = escapeChars(text, "\\'[],;");

  const inputs = node.inputs.map((ref) => formatStream(names, ref, inputIds)).join("");
  const outputs = outgoing.map((pad) => `[${names.get(padKey(node.id, pad))}]`).join("");
  return `${inputs}${text}${outputs}`;
}

/** Insert split/asplit where one filter pad feeds more than one consumer. */
function autoSplit(graph: Graph): Graph {
  const filterById = new Map(graph.filters.map((node) => [node.id, node]));
  const filters = graph.filters.map((node) => ({ ...node, inputs: [...node.inputs] }));
  const outputs = graph.outputs.map((node) => ({ ...node, inputs: [...node.inputs] }));

  type Use = { ref: StreamRef; inputs: StreamRef[]; index: number };
  const uses = new Map<string, Use[]>();
  for (const node of [...filters.filter((f) => !isSplit(f.name)), ...outputs]) {
    node.inputs.forEach((ref, index) => {
      const key = JSON.stringify([ref.node_id, ref.pad, ref.selector]);
      const list = uses.get(key) ?? [];
      list.push({ ref, inputs: node.inputs, index });
      uses.set(key, list);
    });
  }

  const taken = new Set([...graph.inputs, ...graph.filters, ...graph.outputs].map((node) => node.id));
  const splits: FilterNode[] = [];
  let counter = 0;
  for (const consumers of uses.values()) {
    const first = consumers[0];
    if (consumers.length <= 1 || !first) continue;
    const source = filterById.get(first.ref.node_id);
    if (!source) continue; // inputs can be mapped any number of times
    let id = `autosplit${counter++}`;
    while (taken.has(id)) id = `autosplit${counter++}`;
    taken.add(id);
    splits.push({
      id,
      name: source.name.startsWith("a") ? "asplit" : "split",
      inputs: [first.ref],
      args: [],
      kwargs: {},
    });
    consumers.forEach((use, pad) => {
      use.inputs[use.index] = { node_id: id, pad, selector: null };
    });
  }
  return splits.length ? { ...graph, filters: [...filters, ...splits], outputs } : graph;
}

export interface ArgsOptions {
  /** `true` forces `-y`. Otherwise the graph's overwrite policy applies. */
  overwrite?: boolean;
}

/** The ffmpeg arguments for a graph, without the command. Deterministic: same input, same bytes. */
export function getArgs(source: Graph, options: ArgsOptions = {}): string[] {
  const graph = autoSplit(source);
  const ordered = sortFilters(graph);
  const outgoing = outgoingPads(graph);
  const inputIds = new Set(graph.inputs.map((node) => node.id));

  const names: StreamNames = new Map();
  graph.inputs.forEach((node, i) => names.set(padKey(node.id, null), String(i)));
  let count = 0;
  for (const node of ordered) {
    for (const pad of outgoing.get(node.id) ?? []) names.set(padKey(node.id, pad), `s${count++}`);
  }

  const args = graph.inputs.flatMap(inputArgs);
  const specs = ordered.flatMap((node) => {
    const pads = outgoing.get(node.id);
    return pads ? [filterSpec(node, pads, names, inputIds)] : [];
  });
  if (specs.length) args.push("-filter_complex", specs.join(";"));
  for (const node of graph.outputs) args.push(...outputArgs(node, names, inputIds));
  args.push(...graph.global_args);

  if (options.overwrite ?? graph.overwrite === "always") args.push("-y");
  else if (graph.overwrite === "never") args.push("-n");
  return args;
}

export interface CompileOptions extends ArgsOptions {
  /** The command, or a command prefix. Default `ffmpeg`. */
  cmd?: string | string[];
}

/** Full argv: the command followed by `getArgs`. */
export function compile(graph: Graph, options: CompileOptions = {}): string[] {
  const { cmd = "ffmpeg", ...rest } = options;
  return [...(typeof cmd === "string" ? [cmd] : cmd), ...getArgs(graph, rest)];
}
