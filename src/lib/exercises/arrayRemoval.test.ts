import { describe, expect, it } from "vitest";
import { acceptCandidate } from "./pipeline";

/** A well-formed removal candidate, as an LLM provider might emit it. */
function candidate(overrides: Record<string, unknown> = {}) {
  return {
    kind: "array-removal",
    concept: "arrays.removal",
    difficulty: "intro",
    initial: [4, 8, 2, 9, 3],
    operation: { type: "remove", index: 1 },
    expected: { result: [4, 2, 9, 3], removed: 8, shifted: [2, 9, 3] },
    ...overrides,
  };
}

function problemsOf(raw: unknown): string[] {
  const result = acceptCandidate(raw);
  return result.ok ? [] : result.problems;
}

function correctLabel(raw: unknown) {
  const result = acceptCandidate(raw);
  if (!result.ok) throw new Error(result.problems.join("\n"));
  const step = result.value.lesson.steps[0];
  if (step.mode !== "predict" || step.question.kind !== "choice") throw new Error("expected a choice");
  const { question } = step;
  return question.options.find((o) => o.id === question.correctOptionId)?.label;
}

describe("accepting removal candidates", () => {
  it("compiles predict → gap → close steps", () => {
    const result = acceptCandidate(candidate());
    if (!result.ok) throw new Error(result.problems.join("\n"));
    expect(result.value.lesson.steps.map((s) => `${s.mode}:${s.id}`)).toEqual([
      "predict:predict",
      "trace:gap",
      "trace:close",
    ]);
    expect(result.value.skill).toBe("remove");
  });

  it("derives which values shift left, ignoring any answer the candidate volunteers", () => {
    expect(correctLabel(candidate({ answer: "Only 2" }))).toBe("2, 9, and 3");
  });

  it("handles removing the last value: nothing shifts", () => {
    expect(
      correctLabel(
        candidate({
          operation: { type: "remove", index: 4 },
          expected: { result: [4, 8, 2, 9], removed: 3, shifted: [] },
        }),
      ),
    ).toBe("None of them");
  });
});

describe("rejecting removal candidates", () => {
  it("rejects wrong claims", () => {
    const problems = problemsOf(
      candidate({ expected: { result: [4, 8, 9, 3], removed: 2, shifted: [9] } }),
    ).join();
    expect(problems).toContain("expected.result");
    expect(problems).toContain("expected.removed");
    expect(problems).toContain("expected.shifted");
  });

  it.each([-1, 5])("rejects index %i", (index) => {
    expect(problemsOf(candidate({ operation: { type: "remove", index } })).join()).toContain("outside 0..4");
  });

  it("rejects repeated values", () => {
    expect(problemsOf(candidate({ initial: [4, 4, 2, 9, 3] })).join()).toContain("distinct");
  });

  it.each([
    ["an insert operation", { operation: { type: "insert", index: 1, value: 3 } }],
    ["a single-value array", { initial: [4] }],
    ["the wrong concept", { concept: "arrays.insertion" }],
  ])("rejects %s", (_label, overrides) => {
    expect(problemsOf(candidate(overrides))).not.toEqual([]);
  });
});
