import { describe, expect, it } from "vitest";
import type { LessonStep } from "@/lib/learning/schema";
import { acceptCandidate } from "./pipeline";

/** A well-formed stack candidate, as an LLM provider might emit it. */
function candidate(overrides: Record<string, unknown> = {}) {
  return {
    kind: "stack-operations",
    concept: "stacks.operations",
    difficulty: "standard",
    initial: [4, 8],
    operations: [{ type: "push", value: 2 }, { type: "pop" }, { type: "pop" }],
    ask: "popped",
    expected: { final: [4], popped: [2, 8], peeked: [] },
    ...overrides,
  };
}

function accept(raw: unknown) {
  const result = acceptCandidate(raw);
  if (!result.ok) throw new Error(result.problems.join("\n"));
  return result.value;
}

function problemsOf(raw: unknown): string[] {
  const result = acceptCandidate(raw);
  return result.ok ? [] : result.problems;
}

function questionOf(raw: unknown) {
  const step = accept(raw).lesson.steps[0];
  if (!("question" in step)) throw new Error("expected a question first");
  return { step, question: step.question };
}

function correctLabel(raw: unknown) {
  const { question } = questionOf(raw);
  if (question.kind !== "choice") throw new Error("expected a choice question");
  return question.options.find((o) => o.id === question.correctOptionId)?.label;
}

describe("accepting stack candidates", () => {
  it("compiles a question step followed by one trace step per operation", () => {
    const { lesson } = accept(candidate());
    expect(lesson.steps.map((step: LessonStep) => step.mode)).toEqual([
      "solve",
      "trace",
      "trace",
      "trace",
    ]);
    expect(lesson.steps.at(-1)?.practice).toEqual({
      kind: "stack-operations",
      difficulty: "standard",
    });
  });

  it("asks for several popped values as a typed answer derived from the domain", () => {
    const { question } = questionOf(candidate());
    expect(question).toMatchObject({ kind: "number-list", expected: [2, 8] });
  });

  it("derives the answer to 'what is on top' itself", () => {
    expect(
      correctLabel(
        candidate({
          operations: [{ type: "push", value: 2 }],
          ask: "top",
          expected: { final: [4, 8, 2], popped: [], peeked: [] },
          // Any answer a generator volunteers is ignored.
          answer: "4",
        }),
      ),
    ).toBe("2");
  });

  it("answers a single pop with the top value, offering the bottom as a distractor", () => {
    const raw = candidate({
      initial: [4, 8, 2],
      operations: [{ type: "pop" }],
      ask: "popped",
      expected: { final: [4, 8], popped: [2], peeked: [] },
    });
    const { question } = questionOf(raw);
    expect(correctLabel(raw)).toBe("2");
    if (question.kind === "choice") {
      expect(question.options.map((o) => o.label)).toContain("4");
    }
  });

  it("answers peek with the top value", () => {
    expect(
      correctLabel(
        candidate({
          operations: [{ type: "push", value: 6 }, { type: "peek" }],
          ask: "peek",
          expected: { final: [4, 8, 6], popped: [], peeked: [6] },
        }),
      ),
    ).toBe("6");
  });

  it("asks for the final stack bottom → top", () => {
    const { question } = questionOf(candidate({ ask: "final" }));
    expect(question).toMatchObject({ kind: "number-list", expected: [4] });
  });

  it("turns 'which operation' into a Java fill-in-the-blank", () => {
    const { step, question } = questionOf(
      candidate({
        operations: [{ type: "push", value: 2 }],
        ask: "operation",
        expected: { final: [4, 8, 2], popped: [], peeked: [] },
      }),
    );
    expect(step.mode).toBe("complete");
    expect(step.code?.blankLine).toBe(3);
    if (question.kind !== "choice") throw new Error("expected choice");
    const correct = question.options.find((o) => o.id === question.correctOptionId);
    expect(correct?.label).toBe("stack.push(2);");
    expect(question.options.map((o) => o.label)).toContain("stack.peek();");
  });

  it("animates pops as the value leaving the top", () => {
    const { lesson } = accept(candidate());
    const popStep = lesson.steps[2];
    expect(popStep.visual).toMatchObject({
      kind: "stack",
      items: [{ value: 4 }, { value: 8 }],
      held: { value: 2, label: "pop() → 2" },
    });
  });

  it("is deterministic for the same candidate", () => {
    const raw = candidate({ ask: "top", expected: { final: [4], popped: [2, 8], peeked: [] } });
    expect(accept(raw).lesson).toEqual(accept(raw).lesson);
  });
});

describe("rejecting stack candidates", () => {
  it("rejects a wrong final stack", () => {
    expect(problemsOf(candidate({ expected: { final: [8], popped: [2, 8], peeked: [] } })).join()).toContain(
      "expected.final",
    );
  });

  it("rejects wrong popped values (e.g. first in, first out)", () => {
    expect(problemsOf(candidate({ expected: { final: [4], popped: [4, 8], peeked: [] } })).join()).toContain(
      "expected.popped",
    );
  });

  it("rejects popping an empty stack, which throws in Java", () => {
    const problems = problemsOf(
      candidate({
        initial: [4],
        operations: [{ type: "pop" }, { type: "pop" }],
        expected: { final: [], popped: [4], peeked: [] },
      }),
    );
    expect(problems.join()).toContain("NoSuchElementException");
  });

  it("rejects peeking an empty stack", () => {
    const problems = problemsOf(
      candidate({
        initial: [],
        operations: [{ type: "peek" }, { type: "push", value: 1 }, { type: "push", value: 2 }],
        ask: "top",
        expected: { final: [1, 2], popped: [], peeked: [] },
      }),
    );
    expect(problems.join()).toContain("returns null");
  });

  it("rejects a question the sequence cannot answer", () => {
    const problems = problemsOf(candidate({ ask: "peek" }));
    expect(problems.join()).toContain('ask "peek"');
  });

  it("rejects repeated values", () => {
    const problems = problemsOf(
      candidate({
        operations: [{ type: "push", value: 8 }],
        ask: "top",
        expected: { final: [4, 8, 8], popped: [], peeked: [] },
      }),
    );
    expect(problems.join()).toContain("distinct");
  });

  it("rejects a stack that outgrows the visual", () => {
    const problems = problemsOf(
      candidate({
        initial: [1, 2, 3, 4, 5],
        operations: [3, 4].map((i) => ({ type: "push", value: 10 + i })),
        ask: "final",
        expected: { final: [1, 2, 3, 4, 5, 13, 14], popped: [], peeked: [] },
      }),
    );
    expect(problems).toEqual([]);
    const tooBig = problemsOf(
      candidate({
        initial: [1, 2, 3, 4, 5],
        operations: [1, 2, 3].map((i) => ({ type: "push", value: 10 + i })),
        ask: "final",
        expected: { final: [1, 2, 3, 4, 5, 11, 12, 13], popped: [], peeked: [] },
      }),
    );
    expect(tooBig.join()).toContain("grows past");
  });

  it.each([
    ["an unknown operation", { operations: [{ type: "shift" }] }],
    ["a push without a value", { operations: [{ type: "push" }] }],
    ["no operations", { operations: [] }],
    ["an unknown ask", { ask: "bottom" }],
    ["a fractional value", { initial: [1.5, 2] }],
    ["the wrong concept", { concept: "queues.operations" }],
    ["missing claims", { expected: undefined }],
  ])("rejects %s", (_label, overrides) => {
    expect(problemsOf(candidate(overrides))).not.toEqual([]);
  });
});
