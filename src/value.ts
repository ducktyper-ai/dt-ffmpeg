import { GraphError } from "./errors.js";

export type Scalar = string | number | boolean;

/**
 * Text of a value exactly as the Python reference's `str()` wrote it into argv.
 * One limit is inherent to JavaScript: a number has no int/float distinction, so `1.0` prints as `1`
 * (`parsePythonJson` keeps the Python spelling for JSON documents).
 */
export function formatValue(value: Scalar): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "True" : "False";
  if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
    throw new GraphError(`number cannot be written exactly into argv: ${value}; pass it as a string`);
  }
  if (value !== 0 && Math.abs(value) < 1e-4) {
    // Python switches to exponent form below 1e-4 and pads the exponent to two digits.
    return value.toExponential().replace(/e-(\d)$/, "e-0$1");
  }
  return String(value);
}

/** Code-point order, which is what Python's `sorted()` uses for strings. */
export function compareCodePoints(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const diff = (left[i]?.codePointAt(0) ?? 0) - (right[i]?.codePointAt(0) ?? 0);
    if (diff !== 0) return diff;
  }
  return left.length - right.length;
}
