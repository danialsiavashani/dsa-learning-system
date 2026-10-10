/**
 * Deterministic execution traces for single-call recursive methods.
 *
 * A trace is a list of call-stack snapshots: one per call (calling down), one
 * for the base case, one per return (unwinding), and a final one back in the
 * caller. Visualizers, answer keys and exercise validation all derive from
 * these snapshots; nothing about execution is decided elsewhere.
 */

export const RECURSIVE_FUNCTIONS = ["factorial", "sumTo", "countdown", "countUp"] as const;
export type RecursiveFunctionId = (typeof RECURSIVE_FUNCTIONS)[number];

export type RecursiveFunctionSpec = {
  id: RecursiveFunctionId;
  /** Whether the method returns an int (false: void). */
  returnsValue: boolean;
  /** When a printing method prints n: before or after its recursive call. */
  prints: "before" | "after" | null;
  isBase: (n: number) => boolean;
  /** What the base case returns (null for void). */
  baseValue: number | null;
  /** Combines a frame's own n with its child's result (null for void). */
  combine: (n: number, child: number | null) => number | null;
  /** Inputs the trace engine accepts. */
  inputRange: [number, number];
};

export const recursiveFunctions: Record<RecursiveFunctionId, RecursiveFunctionSpec> = {
  factorial: {
    id: "factorial",
    returnsValue: true,
    prints: null,
    isBase: (n) => n <= 1,
    baseValue: 1,
    combine: (n, child) => n * (child ?? 0),
    inputRange: [1, 6],
  },
  sumTo: {
    id: "sumTo",
    returnsValue: true,
    prints: null,
    isBase: (n) => n === 0,
    baseValue: 0,
    combine: (n, child) => n + (child ?? 0),
    inputRange: [0, 5],
  },
  countdown: {
    id: "countdown",
    returnsValue: false,
    prints: "before",
    isBase: (n) => n === 0,
    baseValue: null,
    combine: () => null,
    inputRange: [0, 5],
  },
  countUp: {
    id: "countUp",
    returnsValue: false,
    prints: "after",
    isBase: (n) => n === 0,
    baseValue: null,
    combine: () => null,
    inputRange: [0, 5],
  },
};

export type FrameStatus = "running" | "waiting" | "base" | "returning";

export type CallFrame = {
  /** Stable across snapshots: `f0` is the first call, `f1` the next, ... */
  id: string;
  n: number;
  status: FrameStatus;
  /** The value this frame got back from its child, once it has resumed. */
  received?: number | null;
  /** What this frame returns, once known. */
  returnValue?: number | null;
};

export type SnapshotKind = "call" | "base" | "return" | "done";

export type TraceSnapshot = {
  kind: SnapshotKind;
  /** Recursive frames, bottom → top (the caller is not included). */
  frames: CallFrame[];
  /** Values printed so far. */
  output: number[];
  /** For "base"/"return": the value now travelling back; for "done": the result. */
  value?: number | null;
};

export type RecursionTrace = {
  fn: RecursiveFunctionId;
  input: number;
  snapshots: TraceSnapshot[];
  /** Arguments in call order, e.g. [4, 3, 2, 1]. */
  calls: number[];
  /** Values returned, in return order (base case first). Empty for void methods. */
  returns: number[];
  result: number | null;
  output: number[];
  /** Most frames on the stack at once. */
  maxDepth: number;
};

export class RecursionError extends Error {}

export const frameId = (depth: number) => `f${depth}`;

export function traceRecursion(fn: RecursiveFunctionId, input: number): RecursionTrace {
  const spec = recursiveFunctions[fn];
  if (!spec) throw new RecursionError(`Unsupported recursive function "${fn}".`);
  const [min, max] = spec.inputRange;
  if (!Number.isInteger(input) || input < min || input > max) {
    throw new RecursionError(`${fn} accepts inputs ${min}..${max}, not ${input}.`);
  }

  const snapshots: TraceSnapshot[] = [];
  const output: number[] = [];
  const calls: number[] = [];
  const returns: number[] = [];
  let frames: CallFrame[] = [];

  const snap = (kind: SnapshotKind, value?: number | null) =>
    snapshots.push({ kind, frames: frames.map((f) => ({ ...f })), output: [...output], value });

  // Calling down: each call pushes a frame; its caller waits.
  for (let n = input, depth = 0; ; n--, depth++) {
    frames = [
      ...frames.map((f) => ({ ...f, status: "waiting" as const })),
      { id: frameId(depth), n, status: "running" },
    ];
    calls.push(n);
    snap("call");
    if (spec.isBase(n)) break;
    // Work before the recursive call happens on the way down.
    if (spec.prints === "before") output.push(n);
  }

  // The base case answers directly.
  let value = spec.baseValue;
  const base = frames[frames.length - 1];
  frames = [...frames.slice(0, -1), { ...base, status: "base", returnValue: value }];
  snap("base", value);
  if (value !== null) returns.push(value);

  // Unwinding: the newest waiting frame resumes, finishes its work, returns.
  frames = frames.slice(0, -1);
  while (frames.length > 0) {
    const top = frames[frames.length - 1];
    const received = value;
    value = spec.combine(top.n, received);
    if (spec.prints === "after") output.push(top.n);
    frames = [
      ...frames.slice(0, -1),
      { ...top, status: "returning", received, returnValue: value },
    ];
    snap("return", value);
    if (value !== null) returns.push(value);
    frames = frames.slice(0, -1);
  }

  snap("done", value);
  return {
    fn,
    input,
    snapshots,
    calls,
    returns,
    result: value,
    output,
    maxDepth: calls.length,
  };
}
