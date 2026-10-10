import { describe, expect, it } from "vitest";
import {
  addAt,
  arrayOffer,
  arrayPoll,
  arrayQueueValues,
  back,
  dequeRemovalPlan,
  emptyArrayQueue,
  examineAt,
  front,
  offer,
  peek,
  poll,
  QueueOperationError,
  queueFromValues,
  queueValues,
  removeAt,
  runOperations,
  shiftingPoll,
  simplestDiscipline,
} from "./queue";

const queue = queueFromValues([4, 8, 2]);

describe("offer (enqueue)", () => {
  it("adds the value at the back", () => {
    const step = offer(queue, 9, "nine");
    expect(queueValues(step.after)).toEqual([4, 8, 2, 9]);
    expect(step.outcome).toEqual({ type: "add", end: "back", item: { id: "nine", value: 9 } });
    expect(back(step.after)?.value).toBe(9);
  });

  it("leaves the front and every waiting item (same objects) untouched", () => {
    const step = offer(queue, 9, "nine");
    expect(front(step.after)).toBe(queue[0]);
    step.after.slice(0, 3).forEach((item, i) => expect(item).toBe(queue[i]));
    expect(queueValues(queue)).toEqual([4, 8, 2]);
  });

  it("rejects a duplicate id", () => {
    expect(() => offer(queue, 9, "q1")).toThrow(QueueOperationError);
  });
});

describe("poll (dequeue)", () => {
  it("removes and returns the front value", () => {
    const step = poll(queue);
    expect(step.outcome).toMatchObject({ type: "remove", end: "front", item: { value: 4 } });
    expect(queueValues(step.after)).toEqual([8, 2]);
  });

  it("keeps the survivors' identities: they are not recreated", () => {
    const step = poll(queue);
    expect(step.after[0]).toBe(queue[1]);
    expect(step.after.map((item) => item.id)).toEqual(["q1", "q2"]);
  });

  it("returns null-style 'empty' on an empty queue and changes nothing", () => {
    const step = poll([]);
    expect(step.outcome).toEqual({ type: "empty", action: "remove", end: "front" });
    expect(step.after).toEqual([]);
  });
});

describe("peek", () => {
  it("returns the front value and leaves the queue as it was", () => {
    const step = peek(queue);
    expect(step.outcome).toMatchObject({ type: "examine", end: "front", item: { value: 4 } });
    expect(step.after).toBe(queue);
  });

  it("reports an empty queue (Java returns null)", () => {
    expect(peek([]).outcome).toEqual({ type: "empty", action: "examine", end: "front" });
  });
});

describe("FIFO", () => {
  it("values leave in the order they arrived", () => {
    const run = runOperations(
      [],
      [
        ...[4, 8, 2, 9].map((value) => ({ type: "offer" as const, value })),
        ...[1, 2, 3, 4].map(() => ({ type: "poll" as const })),
      ],
    );
    expect(run.removed).toEqual([4, 8, 2, 9]);
    expect(run.final).toEqual([]);
  });

  it("traces the lesson's sequence: enqueue 4, 8, 2, dequeue, enqueue 9, dequeue", () => {
    const run = runOperations([], [
      { type: "offer", value: 4 },
      { type: "offer", value: 8 },
      { type: "offer", value: 2 },
      { type: "poll" },
      { type: "offer", value: 9 },
      { type: "poll" },
    ]);
    expect(run.removed).toEqual([4, 8]);
    expect(queueValues(run.final)).toEqual([2, 9]);
    expect(run.steps.map((step) => queueValues(step.after))).toEqual([
      [4],
      [4, 8],
      [4, 8, 2],
      [8, 2],
      [8, 2, 9],
      [2, 9],
    ]);
  });

  it("gives added items sequential ids, and keeps them while they wait", () => {
    const run = runOperations([], [
      { type: "offer", value: 1 },
      { type: "offer", value: 2 },
      { type: "poll" },
      { type: "offer", value: 3 },
    ]);
    expect(run.final.map((item) => item.id)).toEqual(["n1", "n2"]);
  });

  it("records null results for empty poll/peek and keeps going", () => {
    const run = runOperations([], [{ type: "poll" }, { type: "peek" }, { type: "offer", value: 3 }, { type: "peek" }]);
    expect(run.nulls).toEqual([0, 1]);
    expect(run.examined).toEqual([3]);
    expect(queueValues(run.final)).toEqual([3]);
  });
});

describe("deque operations", () => {
  it("addFirst puts the value at the front", () => {
    const step = addAt(queue, "front", 5, "five");
    expect(queueValues(step.after)).toEqual([5, 4, 8, 2]);
    expect(step.operation).toEqual({ type: "addFirst", value: 5 });
  });

  it("addLast puts the value at the back, exactly like offer", () => {
    expect(queueValues(addAt(queue, "back", 5, "five").after)).toEqual(queueValues(offer(queue, 5, "five").after));
  });

  it("pollFirst removes the front; pollLast removes the back", () => {
    expect(removeAt(queue, "front").outcome).toMatchObject({ item: { value: 4 } });
    const last = removeAt(queue, "back");
    expect(last.outcome).toMatchObject({ type: "remove", end: "back", item: { value: 2 } });
    expect(queueValues(last.after)).toEqual([4, 8]);
  });

  it("peekFirst / peekLast read both ends without changing anything", () => {
    expect(examineAt(queue, "front").outcome).toMatchObject({ item: { value: 4 } });
    expect(examineAt(queue, "back").outcome).toMatchObject({ item: { value: 2 } });
    expect(examineAt(queue, "back").after).toBe(queue);
  });

  it("pollLast on an empty deque returns null-style 'empty'", () => {
    expect(removeAt([], "back").outcome).toEqual({ type: "empty", action: "remove", end: "back" });
  });

  it("runs a mixed sequence and tracks front and back", () => {
    const run = runOperations([], [
      { type: "addLast", value: 4 },
      { type: "addLast", value: 8 },
      { type: "addFirst", value: 2 },
      { type: "addLast", value: 9 },
      { type: "pollFirst" },
      { type: "pollLast" },
      { type: "peekLast" },
    ]);
    expect(queueValues(run.final)).toEqual([4, 8]);
    expect(run.removed).toEqual([2, 9]);
    expect(run.examined).toEqual([8]);
    expect(front(run.final)?.value).toBe(4);
    expect(back(run.final)?.value).toBe(8);
  });

  it("a deque used only at the back behaves like a stack", () => {
    const run = runOperations([], [
      { type: "addLast", value: 1 },
      { type: "addLast", value: 2 },
      { type: "addLast", value: 3 },
      { type: "pollLast" },
      { type: "pollLast" },
    ]);
    expect(run.removed).toEqual([3, 2]);
  });

  it("an add without a value is an error", () => {
    expect(() => runOperations([], [{ type: "addFirst" } as never])).toThrow(QueueOperationError);
  });
});

describe("which ordering a problem needs", () => {
  it("arrival order is a queue; reversed is a stack", () => {
    expect(simplestDiscipline([3, 7, 1], [3, 7, 1])).toBe("queue");
    expect(simplestDiscipline([3, 7, 1], [1, 7, 3])).toBe("stack");
  });

  it("taking from both ends needs a deque", () => {
    expect(dequeRemovalPlan([3, 7, 1, 5], [3, 5, 7, 1])).toEqual(["front", "back", "front", "front"]);
    expect(simplestDiscipline([3, 7, 1, 5], [3, 5, 7, 1])).toBe("deque");
  });

  it("an order no end-only structure produces has no answer", () => {
    expect(dequeRemovalPlan([3, 7, 1, 5], [7, 3, 1, 5])).toBeUndefined();
    expect(simplestDiscipline([3, 7, 1, 5], [7, 3, 1, 5])).toBeUndefined();
  });
});

describe("inside an array-backed queue", () => {
  const filled = [4, 8, 2, 9].reduce((q, value, i) => arrayOffer(q, value, `v${i}`), emptyArrayQueue(6));

  it("offer writes at `last` and moves it on", () => {
    expect(filled.first).toBe(0);
    expect(filled.last).toBe(4);
    expect(arrayQueueValues(filled)).toEqual([4, 8, 2, 9]);
  });

  it("poll reads `first` and moves it on; no value moves", () => {
    const { removed, after } = arrayPoll(filled);
    expect(removed).toBe(4);
    expect(after.first).toBe(1);
    expect(after.slots[0]).toEqual({ id: "v0", value: null });
    after.slots.slice(1, 4).forEach((slot, i) => expect(slot).toBe(filled.slots[i + 1]));
    expect(arrayQueueValues(after)).toEqual([8, 2, 9]);
  });

  it("wraps `last` around to reuse freed slots at the start", () => {
    let q = arrayPoll(arrayPoll(filled).after).after; // first = 2
    q = arrayOffer(q, 5, "v4");
    q = arrayOffer(q, 7, "v5");
    expect(q.last).toBe(0);
    q = arrayOffer(q, 3, "v6");
    expect(q.slots[0]).toEqual({ id: "v6", value: 3 });
    expect(q.last).toBe(1);
    expect(arrayQueueValues(q)).toEqual([2, 9, 5, 7, 3]);
  });

  it("rejects writing into a full array and polls of an empty one return null", () => {
    let q = emptyArrayQueue(2);
    q = arrayOffer(arrayOffer(q, 1, "a"), 2, "b");
    expect(() => arrayOffer(q, 3, "c")).toThrow(QueueOperationError);
    expect(arrayPoll(emptyArrayQueue(2)).removed).toBeNull();
  });

  it("the naive version slides every remaining value: n - 1 moves", () => {
    const { removed, after, moved } = shiftingPoll(queueFromValues([4, 8, 2, 9]));
    expect(removed?.value).toBe(4);
    expect(queueValues(after)).toEqual([8, 2, 9]);
    expect(moved).toHaveLength(3);
  });
});
