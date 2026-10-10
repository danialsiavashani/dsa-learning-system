import { describe, expect, it } from "vitest";
import {
  peek,
  pop,
  push,
  runOperations,
  StackOperationError,
  stackFromValues,
  stackValues,
} from "./stack";

const stack = stackFromValues([4, 8]);

describe("push", () => {
  it("adds the value on top", () => {
    const step = push(stack, 2, "new");
    expect(stackValues(step.after)).toEqual([4, 8, 2]);
    expect(step.outcome).toEqual({ type: "push", item: { id: "new", value: 2 } });
  });

  it("keeps existing items (same objects) and does not mutate the input", () => {
    const step = push(stack, 2, "new");
    expect(step.after[0]).toBe(stack[0]);
    expect(stackValues(stack)).toEqual([4, 8]);
  });

  it("rejects a duplicate id", () => {
    expect(() => push(stack, 2, "s0")).toThrow(StackOperationError);
  });
});

describe("pop", () => {
  it("removes and returns the top value", () => {
    const step = pop(stackFromValues([4, 8, 2]));
    expect(step.outcome).toMatchObject({ type: "pop", item: { value: 2 } });
    expect(stackValues(step.after)).toEqual([4, 8]);
  });

  it("reports an empty stack instead of returning a value", () => {
    const step = pop([]);
    expect(step.outcome).toEqual({ type: "pop-empty" });
    expect(step.after).toEqual([]);
  });
});

describe("peek", () => {
  it("returns the top value and leaves the stack unchanged", () => {
    const items = stackFromValues([4, 8, 2]);
    const step = peek(items);
    expect(step.outcome).toMatchObject({ type: "peek", item: { value: 2 } });
    expect(step.after).toBe(items);
  });

  it("reports an empty stack (Java returns null)", () => {
    expect(peek([]).outcome).toEqual({ type: "peek-empty" });
  });
});

describe("runOperations", () => {
  it("traces a sequence and collects returned values", () => {
    const run = runOperations(stackFromValues([3, 7]), [
      { type: "push", value: 1 },
      { type: "pop" },
      { type: "push", value: 9 },
      { type: "peek" },
      { type: "push", value: 4 },
      { type: "pop" },
    ]);
    expect(stackValues(run.final)).toEqual([3, 7, 9]);
    expect(run.popped).toEqual([1, 4]);
    expect(run.peeked).toEqual([9]);
    expect(run.steps).toHaveLength(6);
    expect(run.threwAt).toBeUndefined();
  });

  it("gives pushed items sequential ids so they can be tracked", () => {
    const run = runOperations([], [
      { type: "push", value: 1 },
      { type: "push", value: 2 },
    ]);
    expect(run.final.map((item) => item.id)).toEqual(["p0", "p1"]);
  });

  it("stops where Java would throw: pop() on an empty stack", () => {
    const run = runOperations(stackFromValues([5]), [
      { type: "pop" },
      { type: "pop" },
      { type: "push", value: 1 },
    ]);
    expect(run.threwAt).toBe(1);
    expect(run.steps).toHaveLength(2);
    expect(run.popped).toEqual([5]);
  });

  it("records null for peek() on an empty stack and keeps going", () => {
    const run = runOperations([], [{ type: "peek" }, { type: "push", value: 3 }]);
    expect(run.peeked).toEqual([null]);
    expect(stackValues(run.final)).toEqual([3]);
  });
});
