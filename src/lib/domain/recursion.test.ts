import { describe, expect, it } from "vitest";
import { RecursionError, traceRecursion } from "./recursion";

describe("traceRecursion: factorial", () => {
  const trace = traceRecursion("factorial", 4);

  it("calls down to the base case, then returns back up", () => {
    expect(trace.calls).toEqual([4, 3, 2, 1]);
    expect(trace.returns).toEqual([1, 2, 6, 24]);
    expect(trace.result).toBe(24);
    expect(trace.maxDepth).toBe(4);
  });

  it("orders snapshots: calls, base case, returns, done", () => {
    expect(trace.snapshots.map((s) => s.kind)).toEqual([
      "call",
      "call",
      "call",
      "call",
      "base",
      "return",
      "return",
      "return",
      "done",
    ]);
  });

  it("pushes frames on top while callers wait", () => {
    const deepest = trace.snapshots[3];
    expect(deepest.frames.map((f) => [f.n, f.status])).toEqual([
      [4, "waiting"],
      [3, "waiting"],
      [2, "waiting"],
      [1, "running"],
    ]);
  });

  it("only ever has one active frame, at the top", () => {
    for (const snapshot of trace.snapshots) {
      const below = snapshot.frames.slice(0, -1);
      expect(below.every((f) => f.status === "waiting")).toBe(true);
    }
  });

  it("keeps frame ids stable from call to return", () => {
    const idOf = (n: number) =>
      trace.snapshots.flatMap((s) => s.frames).filter((f) => f.n === n).map((f) => f.id);
    expect(new Set(idOf(3))).toEqual(new Set(["f1"]));
    expect(new Set(idOf(1))).toEqual(new Set(["f3"]));
  });

  it("returns from the base case directly", () => {
    const base = trace.snapshots[4];
    expect(base.frames.at(-1)).toMatchObject({ n: 1, status: "base", returnValue: 1 });
    expect(base.value).toBe(1);
  });

  it("unwinds in LIFO order, each frame combining what it received", () => {
    const returning = trace.snapshots
      .filter((s) => s.kind === "return")
      .map((s) => s.frames.at(-1));
    expect(returning.map((f) => [f?.n, f?.received, f?.returnValue])).toEqual([
      [2, 1, 2],
      [3, 2, 6],
      [4, 6, 24],
    ]);
  });

  it("removes each frame once it has returned", () => {
    expect(trace.snapshots.map((s) => s.frames.length)).toEqual([1, 2, 3, 4, 4, 3, 2, 1, 0]);
  });

  it("is deterministic", () => {
    expect(traceRecursion("factorial", 4)).toEqual(trace);
  });

  it("treats factorial(1) as the base case immediately", () => {
    const one = traceRecursion("factorial", 1);
    expect(one.snapshots.map((s) => s.kind)).toEqual(["call", "base", "done"]);
    expect(one.result).toBe(1);
  });
});

describe("traceRecursion: other methods", () => {
  it("sums 1..n with sumTo, down to a base case at 0", () => {
    const trace = traceRecursion("sumTo", 3);
    expect(trace.calls).toEqual([3, 2, 1, 0]);
    expect(trace.returns).toEqual([0, 1, 3, 6]);
    expect(trace.result).toBe(6);
  });

  it("prints on the way down when the print comes before the call", () => {
    const trace = traceRecursion("countdown", 3);
    expect(trace.output).toEqual([3, 2, 1]);
    expect(trace.result).toBeNull();
    expect(trace.returns).toEqual([]);
    // Everything is printed before the base case is reached.
    const base = trace.snapshots.find((s) => s.kind === "base");
    expect(base?.output).toEqual([3, 2, 1]);
  });

  it("prints on the way up when the print comes after the call", () => {
    const trace = traceRecursion("countUp", 3);
    expect(trace.output).toEqual([1, 2, 3]);
    const base = trace.snapshots.find((s) => s.kind === "base");
    expect(base?.output).toEqual([]);
  });
});

describe("traceRecursion: limits", () => {
  it.each([
    ["factorial", 7],
    ["factorial", 0],
    ["sumTo", -1],
    ["countdown", 6],
    ["sumTo", 2.5],
  ] as const)("rejects %s(%s)", (fn, input) => {
    expect(() => traceRecursion(fn, input)).toThrow(RecursionError);
  });

  it("rejects an unsupported method", () => {
    expect(() => traceRecursion("fibonacci" as never, 3)).toThrow(RecursionError);
  });
});
