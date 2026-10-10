import { describe, expect, it } from "vitest";
import { concepts, findConcept } from "@/curriculum";
import { queueLesson } from "@/curriculum/lessons/queue";
import type { VisualState } from "@/lib/learning/schema";

const visualsOf = (state: VisualState | undefined): VisualState[] =>
  !state ? [] : state.kind === "compare" ? state.panes.map((pane) => pane.visual) : [state];

const stepVisuals = (from: number, to: number) =>
  queueLesson.steps.slice(from, to).flatMap((step) => [
    ...visualsOf(step.visual),
    ...visualsOf("reveal" in step ? step.reveal?.visual : undefined),
  ]);

describe("the Queue / Deque lesson", () => {
  it("comes after the five earlier concepts, which are all still there", () => {
    expect(concepts.map((c) => c.slug)).toEqual(["arrays", "stack", "recursion", "trees", "backtracking", "queue"]);
    expect(findConcept("queue")?.label).toBe("Queue / Deque");
  });

  it("cites OpenDSA's queue pages, algs4's queue code and the Java Deque/ArrayDeque docs", () => {
    const urls = (queueLesson.sources ?? []).map((source) => source.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://opendsa-server.cs.vt.edu/ODSA/RST/en/List/Queue.rst",
        "https://algs4.cs.princeton.edu/13stacks/Queue.java.html",
        "https://algs4.cs.princeton.edu/13stacks/ResizingArrayQueue.java.html",
        "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html",
        "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Deque.html",
      ]),
    );
  });

  it("starts from behaviour: FIFO and code only come after the line has been watched", () => {
    const text = (i: number) => `${queueLesson.steps[i].title} ${queueLesson.steps[i].body ?? ""}`;
    const firstFifo = queueLesson.steps.findIndex((_, i) => /FIFO|first in, first out/i.test(text(i)));
    const firstCode = queueLesson.steps.findIndex((step) => step.code);
    expect(firstFifo).toBeGreaterThan(5);
    expect(firstCode).toBeGreaterThan(firstFifo);
    expect(text(0)).not.toMatch(/FIFO|data structure/);
  });

  it("introduces the deque only after the queue is complete", () => {
    const firstDeque = queueLesson.steps.findIndex((step) =>
      visualsOf(step.visual).some((v) => v.kind === "queue" && v.variant === "deque"),
    );
    const complexity = queueLesson.steps.findIndex((step) => step.id === "complexity");
    expect(complexity).toBeGreaterThan(0);
    expect(firstDeque).toBeGreaterThan(complexity);
  });

  it("contrasts a stack and a queue side by side: pop gives 2, dequeue gives 4", () => {
    const step = queueLesson.steps.find((s) => s.id === "predict-contrast");
    const reveal = step && "reveal" in step ? step.reveal?.visual : undefined;
    if (reveal?.kind !== "compare") throw new Error("expected a compare visual");
    const [stack, queue] = reveal.panes.map((pane) => pane.visual);
    expect(stack.kind === "stack" && stack.held?.value).toBe(2);
    expect(queue.kind === "queue" && queue.leaving).toMatchObject({ value: 4, end: "front" });
  });

  it("keeps a value's id while it waits (stable identity from arrival to service)", () => {
    const opening = stepVisuals(0, 9);
    const fourIds = new Set(
      opening.flatMap((v) =>
        v.kind === "queue"
          ? [...v.items, ...(v.leaving ? [v.leaving] : [])].filter((i) => i.value === 4).map((i) => i.id)
          : [],
      ),
    );
    const fiveIds = new Set(
      opening.flatMap((v) =>
        v.kind === "queue"
          ? [...v.items, ...(v.waiting ? [v.waiting] : [])].filter((i) => i.value === 5).map((i) => i.id)
          : [],
      ),
    );
    expect(fourIds.size).toBe(1);
    // 5 is the same element waiting outside the back and after joining.
    expect(fiveIds.size).toBe(1);
  });

  it("teaches the non-throwing Java methods and names the throwing ones once", () => {
    const code = queueLesson.steps.map((step) => step.code?.source ?? "").join("\n");
    expect(code).toMatch(/\.offer\(/);
    expect(code).toMatch(/\.poll\(\)/);
    expect(code).toMatch(/\.peek\(\)/);
    expect(code).toMatch(/\.addFirst\(/);
    expect(code).toMatch(/\.pollLast\(\)/);
    expect(code).not.toMatch(/\.(remove|element|getFirst|removeFirst)\(\)/);
    const empty = queueLesson.steps.find((step) => step.id === "predict-empty");
    const explanation = empty && "question" in empty ? empty.question.explanation : "";
    expect(explanation).toContain("NoSuchElementException");
    expect(explanation).toContain("refuses null values");
  });

  it("offers generated practice at several skill points across both kinds", () => {
    const practice = queueLesson.steps.flatMap((step) => (step.practice ? [step.practice] : []));
    expect(practice.length).toBeGreaterThanOrEqual(6);
    expect(new Set(practice.map((p) => p.kind))).toEqual(new Set(["queue-operations", "deque-operations"]));
  });

  it("mixes typed answers in with multiple choice", () => {
    const kinds = queueLesson.steps.flatMap((step) => ("question" in step ? [step.question.kind] : []));
    expect(kinds.filter((kind) => kind === "number-list").length).toBeGreaterThanOrEqual(3);
  });
});
