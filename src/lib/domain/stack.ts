/**
 * Deterministic stack operations, modelled on Java's `ArrayDeque` used as a
 * stack. Stacks are stored bottom → top: the last element is the top.
 *
 * Items carry stable IDs so the same value can be tracked (and animated) as
 * it is pushed and popped.
 */

export type StackValue = number | string;

export type StackItem<V extends StackValue = StackValue> = {
  id: string;
  value: V;
};

export type StackOperation<V extends StackValue = number> =
  | { type: "push"; value: V }
  | { type: "pop" }
  | { type: "peek" };

/**
 * What an operation did. Empty-stack cases mirror `ArrayDeque`:
 * `pop()` throws NoSuchElementException, `peek()` returns null.
 */
export type StackOutcome<V extends StackValue = number> =
  | { type: "push"; item: StackItem<V> }
  | { type: "pop"; item: StackItem<V> }
  | { type: "peek"; item: StackItem<V> }
  | { type: "pop-empty" }
  | { type: "peek-empty" };

export type StackStep<V extends StackValue = number> = {
  operation: StackOperation<V>;
  before: StackItem<V>[];
  after: StackItem<V>[];
  outcome: StackOutcome<V>;
};

export class StackOperationError extends Error {}

export function stackFromValues<V extends StackValue>(
  values: readonly V[],
  idPrefix = "s",
): StackItem<V>[] {
  return values.map((value, position) => ({ id: `${idPrefix}${position}`, value }));
}

export function stackValues<V extends StackValue>(items: readonly StackItem<V>[]): V[] {
  return items.map((item) => item.value);
}

export function top<V extends StackValue>(items: readonly StackItem<V>[]): StackItem<V> | undefined {
  return items[items.length - 1];
}

export function push<V extends StackValue>(
  items: StackItem<V>[],
  value: V,
  id: string,
): StackStep<V> {
  if (items.some((item) => item.id === id)) {
    throw new StackOperationError(`ID "${id}" is already in use.`);
  }
  const item = { id, value };
  return {
    operation: { type: "push", value },
    before: items,
    after: [...items, item],
    outcome: { type: "push", item },
  };
}

export function pop<V extends StackValue>(items: StackItem<V>[]): StackStep<V> {
  const item = top(items);
  return {
    operation: { type: "pop" },
    before: items,
    after: item ? items.slice(0, -1) : items,
    outcome: item ? { type: "pop", item } : { type: "pop-empty" },
  };
}

export function peek<V extends StackValue>(items: StackItem<V>[]): StackStep<V> {
  const item = top(items);
  return {
    operation: { type: "peek" },
    before: items,
    after: items,
    outcome: item ? { type: "peek", item } : { type: "peek-empty" },
  };
}

export function applyOperation<V extends StackValue>(
  items: StackItem<V>[],
  operation: StackOperation<V>,
  newId: string,
): StackStep<V> {
  switch (operation.type) {
    case "push":
      return push(items, operation.value, newId);
    case "pop":
      return pop(items);
    case "peek":
      return peek(items);
  }
}

export type StackRun<V extends StackValue = number> = {
  steps: StackStep<V>[];
  final: StackItem<V>[];
  /** Values returned by pop(), in order. */
  popped: V[];
  /** Values returned by peek(), in order (null for an empty stack). */
  peeked: (V | null)[];
  /** Set when a pop() hit an empty stack: Java would throw, so the run stops there. */
  threwAt?: number;
};

/** Runs a sequence of operations, giving pushed items IDs `${idPrefix}0`, `${idPrefix}1`, ... */
export function runOperations<V extends StackValue>(
  initial: StackItem<V>[],
  operations: readonly StackOperation<V>[],
  idPrefix = "p",
): StackRun<V> {
  const steps: StackStep<V>[] = [];
  const popped: V[] = [];
  const peeked: (V | null)[] = [];
  let items = initial;
  let pushes = 0;

  for (let i = 0; i < operations.length; i++) {
    const step = applyOperation(items, operations[i], `${idPrefix}${pushes}`);
    if (step.operation.type === "push") pushes++;
    steps.push(step);
    items = step.after;

    const { outcome } = step;
    if (outcome.type === "pop") popped.push(outcome.item.value);
    if (outcome.type === "peek") peeked.push(outcome.item.value);
    if (outcome.type === "peek-empty") peeked.push(null);
    if (outcome.type === "pop-empty") {
      return { steps, final: items, popped, peeked, threwAt: i };
    }
  }
  return { steps, final: items, popped, peeked };
}
