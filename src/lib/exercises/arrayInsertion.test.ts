import { describe, expect, it } from "vitest";
import type { LessonStep } from "@/lib/learning/schema";
import { acceptCandidate } from "./pipeline";

/** A well-formed candidate, as an LLM provider might emit it. */
function candidate(overrides: Record<string, unknown> = {}) {
  return {
    kind: "array-insertion",
    concept: "arrays.insertion",
    difficulty: "intro",
    initial: [4, 8, 2, 9, 3],
    operation: { type: "insert", index: 2, value: 7 },
    expected: { result: [4, 8, 7, 2, 9, 3], shifted: [2, 9, 3] },
    ...overrides,
  };
}

function problemsOf(raw: unknown): string[] {
  const result = acceptCandidate(raw);
  return result.ok ? [] : result.problems;
}

function predictStep(raw: unknown) {
  const result = acceptCandidate(raw);
  if (!result.ok) throw new Error(result.problems.join("\n"));
  const step = result.value.lesson.steps[0];
  if (step.mode !== "predict" || step.question.kind !== "choice") {
    throw new Error("expected a choice prediction first");
  }
  return { step, question: step.question, exercise: result.value };
}

describe("accepting valid candidates", () => {
  it("compiles a candidate into predict → shift → write steps", () => {
    const result = acceptCandidate(candidate());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { lesson } = result.value;
    expect(lesson.steps.map((step: LessonStep) => `${step.mode}:${step.id}`)).toEqual([
      "predict:predict",
      "trace:shift",
      "trace:write",
    ]);
    const written = lesson.steps[2].visual;
    if (written?.kind !== "array") throw new Error("expected an array visual");
    expect(written.items.map((item) => item.value)).toEqual([4, 8, 7, 2, 9, 3]);
    expect(lesson.steps[2].practice).toEqual({
      kind: "array-insertion",
      difficulty: "intro",
    });
  });

  it("derives the correct answer from the domain, not the candidate", () => {
    const { question } = predictStep(
      // A generator's own "answer" fields are ignored entirely.
      candidate({ correctAnswer: "Only 2", correctOptionId: "option-1" }),
    );
    const correct = question.options.find((o) => o.id === question.correctOptionId);

    expect(correct?.label).toBe("2, 9, and 3");
    expect(question.options.filter((o) => o.label === "2, 9, and 3")).toHaveLength(1);
  });

  it("offers distinct, plausible distractors", () => {
    const { question } = predictStep(candidate());
    const labels = question.options.map((o) => o.label);

    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toEqual(expect.arrayContaining(["9 and 3", "Only 2", "4 and 8"]));
  });

  it("is deterministic for the same candidate", () => {
    expect(predictStep(candidate()).question).toEqual(predictStep(candidate()).question);
  });

  it("handles appending at the end: nothing shifts", () => {
    const { question } = predictStep(
      candidate({
        difficulty: "challenge",
        operation: { type: "insert", index: 5, value: 7 },
        expected: { result: [4, 8, 2, 9, 3, 7], shifted: [] },
      }),
    );
    const correct = question.options.find((o) => o.id === question.correctOptionId);
    expect(correct?.label).toBe("None of them");
  });

  it("handles inserting at the front: everything shifts", () => {
    const { question } = predictStep(
      candidate({
        operation: { type: "insert", index: 0, value: 7 },
        expected: { result: [7, 4, 8, 2, 9, 3], shifted: [4, 8, 2, 9, 3] },
      }),
    );
    const correct = question.options.find((o) => o.id === question.correctOptionId);
    expect(correct?.label).toBe("4, 8, 2, 9, and 3");
  });
});

describe("rejecting inconsistent candidates", () => {
  it("rejects a claimed result that does not match the operation", () => {
    const problems = problemsOf(
      candidate({ expected: { result: [4, 8, 2, 7, 9, 3], shifted: [2, 9, 3] } }),
    );
    expect(problems.join()).toContain("expected.result");
  });

  it("rejects claimed shifted values that do not match", () => {
    const problems = problemsOf(
      candidate({ expected: { result: [4, 8, 7, 2, 9, 3], shifted: [2] } }),
    );
    expect(problems.join()).toContain("expected.shifted");
  });

  it.each([-1, 6])("rejects out-of-range index %i", (index) => {
    const problems = problemsOf(
      candidate({ operation: { type: "insert", index, value: 7 } }),
    );
    expect(problems.join()).toContain("outside 0..5");
  });

  it("rejects repeated values, which make the question ambiguous", () => {
    const problems = problemsOf(
      candidate({
        operation: { type: "insert", index: 2, value: 9 },
        expected: { result: [4, 8, 9, 2, 9, 3], shifted: [2, 9, 3] },
      }),
    );
    expect(problems.join()).toContain("distinct");
  });
});

describe("rejecting malformed candidates", () => {
  it.each([
    ["null", null],
    ["a string", "insert 7 at index 2"],
    ["an array", [1, 2, 3]],
    ["an unknown kind", { kind: "tree-rotation" }],
  ])("rejects %s", (_label, raw) => {
    expect(problemsOf(raw)).not.toEqual([]);
  });

  it.each([
    ["a fractional index", { operation: { type: "insert", index: 1.5, value: 7 } }],
    ["a non-numeric value", { operation: { type: "insert", index: 1, value: "7" } }],
    ["an unknown operation", { operation: { type: "delete", index: 1, value: 7 } }],
    ["a missing expected block", { expected: undefined }],
    ["a too-short array", { initial: [4] }],
    ["a too-long array", { initial: [1, 2, 3, 4, 5, 6, 7, 8, 9] }],
    ["an unknown difficulty", { difficulty: "impossible" }],
    ["the wrong concept", { concept: "arrays.deletion" }],
  ])("rejects %s", (_label, overrides) => {
    expect(problemsOf(candidate(overrides))).not.toEqual([]);
  });
});

describe("request matching", () => {
  it("rejects a difficulty other than the one requested", () => {
    const result = acceptCandidate(candidate(), {
      kind: "array-insertion",
      difficulty: "challenge",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an example the learner has already seen", () => {
    const first = acceptCandidate(candidate());
    if (!first.ok) throw new Error("expected acceptance");

    const again = acceptCandidate(candidate(), {
      kind: "array-insertion",
      difficulty: "intro",
      avoid: [first.value.fingerprint],
    });
    expect(again.ok).toBe(false);
  });
});
