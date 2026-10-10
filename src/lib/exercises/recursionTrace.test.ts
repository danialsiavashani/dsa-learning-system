import { describe, expect, it } from "vitest";
import { acceptCandidate } from "./pipeline";

/** A well-formed recursion candidate, as an LLM provider might emit it. */
function candidate(overrides: Record<string, unknown> = {}) {
  return {
    kind: "recursion-trace",
    concept: "recursion.single-call",
    difficulty: "standard",
    function: "factorial",
    input: 4,
    ask: "returns",
    expected: { calls: [4, 3, 2, 1], returns: [1, 2, 6, 24], result: 24, output: [] },
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

function firstStep(raw: unknown) {
  const step = accept(raw).lesson.steps[0];
  if (!("question" in step)) throw new Error("expected a question first");
  return step;
}

function correctLabel(raw: unknown) {
  const { question } = firstStep(raw);
  if (question.kind !== "choice") throw new Error("expected a choice question");
  return question.options.find((o) => o.id === question.correctOptionId)?.label;
}

const countdown = {
  function: "countdown",
  input: 3,
  expected: { calls: [3, 2, 1, 0], returns: [], result: null, output: [3, 2, 1] },
};

describe("accepting recursion candidates", () => {
  it("asks for the return sequence as a typed answer, then traces every snapshot", () => {
    const { lesson } = accept(candidate());
    const step = lesson.steps[0];
    expect(step.mode).toBe("solve");
    if ("question" in step) expect(step.question).toMatchObject({ expected: [1, 2, 6, 24] });
    // 9 snapshots: the question shows the first, then 8 trace steps.
    expect(lesson.steps).toHaveLength(9);
    expect(lesson.steps.slice(1).every((s) => s.mode === "trace")).toBe(true);
    expect(lesson.steps.at(-1)?.practice).toEqual({ kind: "recursion-trace", difficulty: "standard" });
  });

  it("derives the next call", () => {
    expect(correctLabel(candidate({ ask: "next-call", focus: 3 }))).toBe("factorial(2)");
  });

  it("derives the base-case return value", () => {
    expect(correctLabel(candidate({ ask: "base-return" }))).toBe("1");
    expect(
      correctLabel(
        candidate({
          function: "sumTo",
          input: 3,
          ask: "base-return",
          expected: { calls: [3, 2, 1, 0], returns: [0, 1, 3, 6], result: 6, output: [] },
        }),
      ),
    ).toBe("0");
  });

  it("derives a frame's return value and asks it while the child is returning", () => {
    const step = firstStep(candidate({ ask: "return-value", focus: 3 }));
    expect(correctLabel(candidate({ ask: "return-value", focus: 3 }))).toBe("6");
    expect(step.visual).toMatchObject({
      kind: "callStack",
      carry: { value: "2", label: "returns" },
    });
  });

  it("derives which frame resumes, including main for the first call", () => {
    expect(correctLabel(candidate({ ask: "resumes", focus: 1 }))).toBe("factorial(2)");
    expect(correctLabel(candidate({ ask: "resumes", focus: 4 }))).toBe("main()");
  });

  it("asks for the calls, the final result and printed output", () => {
    expect(firstStep(candidate({ ask: "calls" })).question).toMatchObject({ expected: [4, 3, 2, 1] });
    expect(firstStep(candidate({ ask: "final" })).question).toMatchObject({ expected: [24] });
    expect(firstStep(candidate({ ...countdown, ask: "printed" })).question).toMatchObject({
      expected: [3, 2, 1],
    });
  });

  it("ignores any answer the generator volunteers", () => {
    expect(correctLabel(candidate({ ask: "next-call", focus: 3, answer: "factorial(4)" }))).toBe(
      "factorial(2)",
    );
  });

  it("highlights the Java line each snapshot is executing", () => {
    const { lesson } = accept(candidate({ input: 2, expected: { calls: [2, 1], returns: [1, 2], result: 2, output: [] } }));
    // main is lines 1-3; factorial starts at line 5: if at 6, return 1 at 7, recursive return at 9.
    expect(lesson.steps.map((s) => s.code?.highlight)).toEqual([[6], [6], [7], [9], [2]]);
  });
});

describe("rejecting recursion candidates", () => {
  it.each([
    ["an unsupported method", { function: "fibonacci" }],
    ["a fractional input", { input: 2.5 }],
    ["an unknown ask", { ask: "draw-tree" }],
    ["missing claims", { expected: undefined }],
    ["the wrong concept", { concept: "trees.dfs" }],
  ])("rejects %s", (_label, overrides) => {
    expect(problemsOf(candidate(overrides))).not.toEqual([]);
  });

  it("rejects inputs that would make an unreasonable trace", () => {
    const problems = problemsOf(
      candidate({ input: 9, expected: { calls: [], returns: [], result: 362880, output: [] } }),
    );
    expect(problems.join()).toContain("accepts inputs 1..6");
  });

  it("rejects a trace deeper than the call-stack limit", () => {
    const problems = problemsOf(
      candidate({ input: 6, expected: { calls: [6, 5, 4, 3, 2, 1], returns: [1, 2, 6, 24, 120, 720], result: 720, output: [] } }),
    );
    expect(problems.join()).toContain("the limit is 5");
  });

  it("rejects an input that is the base case immediately", () => {
    const problems = problemsOf(
      candidate({ input: 1, expected: { calls: [1], returns: [1], result: 1, output: [] } }),
    );
    expect(problems.join()).toContain("nothing to trace");
  });

  it("rejects wrong claims about calls, returns and the result", () => {
    const problems = problemsOf(
      candidate({ expected: { calls: [4, 3, 2, 1, 0], returns: [24, 6, 2, 1], result: 10, output: [] } }),
    );
    expect(problems.join()).toContain("expected.calls");
    expect(problems.join()).toContain("expected.returns");
    expect(problems.join()).toContain("expected.result");
  });

  it("rejects value questions about a void method", () => {
    expect(problemsOf({ ...candidate(countdown), ask: "final" }).join()).toContain("void");
  });

  it("rejects a print question about a method that does not print", () => {
    expect(problemsOf(candidate({ ask: "printed" })).join()).toContain("does not");
  });

  it("checks the focus frame", () => {
    expect(problemsOf(candidate({ ask: "next-call" })).join()).toContain("needs a focus");
    expect(problemsOf(candidate({ ask: "next-call", focus: 7 })).join()).toContain("not one of the calls");
    expect(problemsOf(candidate({ ask: "next-call", focus: 1 })).join()).toContain("base case");
    expect(problemsOf(candidate({ ask: "final", focus: 3 })).join()).toContain("does not use a focus");
  });
});
