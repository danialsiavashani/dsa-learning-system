/**
 * Deterministic queue and deque operations, modelled on Java's `ArrayDeque`.
 * Items are stored front → back: index 0 is the front (the head, the next to
 * leave a queue), the last index is the back (the tail, where a queue adds).
 *
 * A queue is a deque restricted to two moves: add at the back, remove from
 * the front. Both share this one model, so the Java method names map onto it
 * exactly as the `Deque` documentation says: offer = offerLast/addLast,
 * poll = pollFirst, peek = peekFirst.
 *
 * Items carry stable IDs: a value keeps its ID for as long as it waits, so it
 * can be tracked (and animated) while the values ahead of it leave.
 */

export type QueueValue = number | string;

export type QueueItem<V extends QueueValue = QueueValue> = {
  id: string;
  value: V;
};

export type End = "front" | "back";

/** The queue methods taught first: add at the back, remove/read the front. */
export const QUEUE_OPERATIONS = ["offer", "poll", "peek"] as const;

/** The explicit double-ended methods. */
export const DEQUE_OPERATIONS = [
  "addFirst",
  "addLast",
  "pollFirst",
  "pollLast",
  "peekFirst",
  "peekLast",
] as const;

export type QueueOperationType = (typeof QUEUE_OPERATIONS)[number];
export type DequeOperationType = (typeof DEQUE_OPERATIONS)[number];
export type OperationType = QueueOperationType | DequeOperationType;

type AddType = "offer" | "addFirst" | "addLast";

export type DequeOperation<V extends QueueValue = number> =
  | { type: AddType; value: V }
  | { type: Exclude<OperationType, AddType> };

export type Action = "add" | "remove" | "examine";

/**
 * What each method does and at which end. The removing and examining
 * methods here are Java's "special value" forms: on an empty deque they
 * return null instead of throwing.
 */
export const OPERATION_SEMANTICS: Record<OperationType, { action: Action; end: End }> = {
  offer: { action: "add", end: "back" },
  poll: { action: "remove", end: "front" },
  peek: { action: "examine", end: "front" },
  addFirst: { action: "add", end: "front" },
  addLast: { action: "add", end: "back" },
  pollFirst: { action: "remove", end: "front" },
  pollLast: { action: "remove", end: "back" },
  peekFirst: { action: "examine", end: "front" },
  peekLast: { action: "examine", end: "back" },
};

/** The methods that throw `NoSuchElementException` on an empty deque instead. */
export const THROWING_COUNTERPARTS: Partial<Record<OperationType, string>> = {
  poll: "remove",
  peek: "element",
  pollFirst: "removeFirst",
  pollLast: "removeLast",
  peekFirst: "getFirst",
  peekLast: "getLast",
};

export type DequeOutcome<V extends QueueValue = number> =
  | { type: "add"; end: End; item: QueueItem<V> }
  | { type: "remove"; end: End; item: QueueItem<V> }
  | { type: "examine"; end: End; item: QueueItem<V> }
  /** poll/peek on an empty deque: Java returns null and nothing changes. */
  | { type: "empty"; action: "remove" | "examine"; end: End };

export type DequeStep<V extends QueueValue = number> = {
  operation: DequeOperation<V>;
  before: QueueItem<V>[];
  after: QueueItem<V>[];
  outcome: DequeOutcome<V>;
};

export class QueueOperationError extends Error {}

export function queueFromValues<V extends QueueValue>(
  values: readonly V[],
  idPrefix = "q",
): QueueItem<V>[] {
  return values.map((value, position) => ({ id: `${idPrefix}${position}`, value }));
}

export function queueValues<V extends QueueValue>(items: readonly QueueItem<V>[]): V[] {
  return items.map((item) => item.value);
}

export function front<V extends QueueValue>(items: readonly QueueItem<V>[]): QueueItem<V> | undefined {
  return items[0];
}

export function back<V extends QueueValue>(items: readonly QueueItem<V>[]): QueueItem<V> | undefined {
  return items[items.length - 1];
}

const at = <V extends QueueValue>(items: readonly QueueItem<V>[], end: End) =>
  end === "front" ? front(items) : back(items);

/** Adds `value` at one end. Items already waiting keep their IDs and order. */
export function addAt<V extends QueueValue>(
  items: QueueItem<V>[],
  end: End,
  value: V,
  id: string,
  type: AddType = end === "front" ? "addFirst" : "addLast",
): DequeStep<V> {
  if (items.some((item) => item.id === id)) {
    throw new QueueOperationError(`ID "${id}" is already in use.`);
  }
  const item = { id, value };
  return {
    operation: { type, value },
    before: items,
    after: end === "front" ? [item, ...items] : [...items, item],
    outcome: { type: "add", end, item },
  };
}

/** Removes the value at one end, or reports an empty deque (Java: null). */
export function removeAt<V extends QueueValue>(
  items: QueueItem<V>[],
  end: End,
  type: DequeOperation<V>["type"] = end === "front" ? "pollFirst" : "pollLast",
): DequeStep<V> {
  const item = at(items, end);
  return {
    operation: { type } as DequeOperation<V>,
    before: items,
    after: !item ? items : end === "front" ? items.slice(1) : items.slice(0, -1),
    outcome: item ? { type: "remove", end, item } : { type: "empty", action: "remove", end },
  };
}

/** Reads the value at one end without changing anything. */
export function examineAt<V extends QueueValue>(
  items: QueueItem<V>[],
  end: End,
  type: DequeOperation<V>["type"] = end === "front" ? "peekFirst" : "peekLast",
): DequeStep<V> {
  const item = at(items, end);
  return {
    operation: { type } as DequeOperation<V>,
    before: items,
    after: items,
    outcome: item ? { type: "examine", end, item } : { type: "empty", action: "examine", end },
  };
}

/** `queue.offer(value)`: join at the back. */
export const offer = <V extends QueueValue>(items: QueueItem<V>[], value: V, id: string) =>
  addAt(items, "back", value, id, "offer");

/** `queue.poll()`: the front leaves. */
export const poll = <V extends QueueValue>(items: QueueItem<V>[]) => removeAt(items, "front", "poll");

/** `queue.peek()`: read the front. */
export const peek = <V extends QueueValue>(items: QueueItem<V>[]) => examineAt(items, "front", "peek");

export function applyOperation<V extends QueueValue>(
  items: QueueItem<V>[],
  operation: DequeOperation<V>,
  newId: string,
): DequeStep<V> {
  const { action, end } = OPERATION_SEMANTICS[operation.type];
  if (action === "add") {
    if (!("value" in operation)) throw new QueueOperationError(`${operation.type} needs a value.`);
    return addAt(items, end, operation.value, newId, operation.type as AddType);
  }
  return action === "remove" ? removeAt(items, end, operation.type) : examineAt(items, end, operation.type);
}

export type DequeRun<V extends QueueValue = number> = {
  steps: DequeStep<V>[];
  final: QueueItem<V>[];
  /** Values returned by poll/pollFirst/pollLast, in order. */
  removed: V[];
  /** Values returned by peek/peekFirst/peekLast, in order. */
  examined: V[];
  /** Indices of operations that met an empty deque and returned null. */
  nulls: number[];
};

/** Runs a sequence, giving added items IDs `${idPrefix}0`, `${idPrefix}1`, ... */
export function runOperations<V extends QueueValue>(
  initial: QueueItem<V>[],
  operations: readonly DequeOperation<V>[],
  idPrefix = "n",
): DequeRun<V> {
  const steps: DequeStep<V>[] = [];
  const removed: V[] = [];
  const examined: V[] = [];
  const nulls: number[] = [];
  let items = initial;
  let adds = 0;

  operations.forEach((operation, i) => {
    const step = applyOperation(items, operation, `${idPrefix}${adds}`);
    if (step.outcome.type === "add") adds++;
    if (step.outcome.type === "remove") removed.push(step.outcome.item.value);
    if (step.outcome.type === "examine") examined.push(step.outcome.item.value);
    if (step.outcome.type === "empty") nulls.push(i);
    steps.push(step);
    items = step.after;
  });
  return { steps, final: items, removed, examined, nulls };
}

/** "offer(4)", "poll()". */
export function describeOperation(operation: DequeOperation<QueueValue>): string {
  return "value" in operation ? `${operation.type}(${operation.value})` : `${operation.type}()`;
}

// ---------------------------------------------------------------------------
// Which ordering does a problem need?

export type Discipline = "queue" | "stack" | "deque";

/**
 * Values arrive in `arrivals` order and all wait; then they are removed one by
 * one. Returns the end each removal must use so that they leave in `required`
 * order, or undefined when taking from the two ends cannot produce it.
 */
export function dequeRemovalPlan(
  arrivals: readonly number[],
  required: readonly number[],
): End[] | undefined {
  if (arrivals.length !== required.length) return undefined;
  let waiting = [...arrivals];
  const plan: End[] = [];
  for (const value of required) {
    if (waiting[0] === value) {
      plan.push("front");
      waiting = waiting.slice(1);
    } else if (waiting[waiting.length - 1] === value) {
      plan.push("back");
      waiting = waiting.slice(0, -1);
    } else {
      return undefined;
    }
  }
  return plan;
}

/**
 * The most restricted structure that produces `required` from `arrivals`:
 * a queue keeps arrival order, a stack reverses it, and a deque can take
 * from either end. Undefined when none of them can. Values must be distinct.
 */
export function simplestDiscipline(
  arrivals: readonly number[],
  required: readonly number[],
): Discipline | undefined {
  const same = (a: readonly number[], b: readonly number[]) =>
    a.length === b.length && a.every((value, i) => value === b[i]);
  if (same(arrivals, required)) return "queue";
  if (same([...arrivals].reverse(), required)) return "stack";
  return dequeRemovalPlan(arrivals, required) ? "deque" : undefined;
}

// ---------------------------------------------------------------------------
// Inside an array-backed queue

/** One array slot: a waiting value, or free space (`value: null`). */
export type ArraySlot = { id: string; value: number | null };

/**
 * An array-backed queue in the style of algs4's ResizingArrayQueue, without
 * the resizing: `first` is the index of the front, `last` the next free slot
 * at the back, and both wrap around to 0 at the end of the array.
 */
export type ArrayQueue = {
  slots: ArraySlot[];
  first: number;
  last: number;
  size: number;
};

export function emptyArrayQueue(capacity: number, idPrefix = "slot"): ArrayQueue {
  return {
    slots: Array.from({ length: capacity }, (_, i) => ({ id: `${idPrefix}${i}`, value: null })),
    first: 0,
    last: 0,
    size: 0,
  };
}

/** `a[last] = x; last++` (wrapping). Writes one slot; nothing else moves. */
export function arrayOffer(queue: ArrayQueue, value: number, id: string): ArrayQueue {
  if (queue.size === queue.slots.length) throw new QueueOperationError("The array is full.");
  // The slot being overwritten gives up its ID; every other slot keeps its own.
  if (queue.slots.some((slot, i) => slot.id === id && i !== queue.last)) {
    throw new QueueOperationError(`ID "${id}" is already in use.`);
  }
  const next = queue.slots.map((slot, i) => (i === queue.last ? { id, value } : slot));
  return {
    slots: next,
    first: queue.first,
    last: (queue.last + 1) % queue.slots.length,
    size: queue.size + 1,
  };
}

/**
 * `x = a[first]; first++` (wrapping). The slot is freed, keeping its ID, and
 * `first` moves on; no other value moves.
 */
export function arrayPoll(queue: ArrayQueue): { removed: number | null; after: ArrayQueue } {
  if (queue.size === 0) return { removed: null, after: queue };
  const slot = queue.slots[queue.first];
  return {
    removed: slot.value,
    after: {
      slots: queue.slots.map((s, i) => (i === queue.first ? { id: s.id, value: null } : s)),
      first: (queue.first + 1) % queue.slots.length,
      last: queue.last,
      size: queue.size - 1,
    },
  };
}

/** The values waiting in an array queue, front → back, following the wrap. */
export function arrayQueueValues(queue: ArrayQueue): number[] {
  return Array.from(
    { length: queue.size },
    (_, k) => queue.slots[(queue.first + k) % queue.slots.length].value as number,
  );
}

/**
 * The naive alternative: keep the front pinned at index 0, so every removal
 * slides every remaining value one slot left. Returns which values moved.
 */
export function shiftingPoll<V extends QueueValue>(
  items: QueueItem<V>[],
): { removed: QueueItem<V> | undefined; after: QueueItem<V>[]; moved: string[] } {
  const [removed, ...rest] = items;
  return { removed, after: rest, moved: rest.map((item) => item.id) };
}
