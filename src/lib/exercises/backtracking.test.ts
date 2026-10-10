import { describe, expect, it } from "vitest";
import { DIFFICULTIES, EXERCISE_SKILLS } from "@/lib/learning/schema";
import { momentsFor } from "./kinds/backtracking";
import { createLocalGenerator } from "./localGenerator";
import { acceptCandidate, produceExercise } from "./pipeline";
import { seededRandom } from "./random";
import { traceBacktracking } from "@/lib/domain/backtracking";

const PERMS = [
  [1, 2, 3],
  [1, 3, 2],
  [2, 1, 3],
  [2, 3, 1],
  [3, 1, 2],
  [3, 2, 1],
];

/** A well-formed candidate, as an LLM provider might emit it. */
function candidate(overrides: Record<string, unknown> = {}) {
  return {
    kind: "backtracking",
    concept: "backtracking.basics",
    difficulty: "standard",
    problem: { type: "permutations", items: [1, 2, 3] },
    ask: "count",
    expected: { solutions: PERMS },
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

function firstQuestion(raw: unknown) {
  const step = accept(raw).lesson.steps[0];
  if (!("question" in step)) throw new Error("expected a question");
  return step.question;
}

function correctLabel(raw: unknown) {
  const question = firstQuestion(raw);
  if (question.kind !== "choice") throw new Error("expected a choice");
  return question.options.find((o) => o.id === question.correctOptionId)?.label;
}

describe("accepting backtracking candidates", () => {
  it("counts recorded candidates, deriving the number itself", () => {
    expect(firstQuestion(candidate())).toMatchObject({ kind: "number-list", expected: [6] });
    const ruled = {
      problem: { type: "permutations", items: [1, 2, 3], rule: { after: 1, forbid: 2 } },
      expected: { solutions: [[1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 2, 1]] },
    };
    expect(firstQuestion(candidate(ruled))).toMatchObject({ expected: [4] });
  });

  it("derives the state after an undo, from the moment the domain identifies", () => {
    // Moment 0 among undos that leave something behind: back in [1,2] after [1,2,3].
    expect(firstQuestion(candidate({ ask: "after-undo", moment: 0 }))).toMatchObject({ expected: [1, 2] });
  });

  it("derives the state after a choice", () => {
    expect(firstQuestion(candidate({ ask: "after-choose", moment: 1 }))).toMatchObject({ expected: [1, 2] });
  });

  it("derives the next value added and the next branch", () => {
    expect(correctLabel(candidate({ ask: "next-choice", moment: 1 }))).toBe("2");
    expect(correctLabel(candidate({ ask: "next-branch", moment: 0 }))).toBe("[1,3]");
  });

  it("derives the next recorded candidate", () => {
    expect(correctLabel(candidate({ ask: "next-solution", moment: 0 }))).toBe("[1,3,2]");
  });

  it("derives the buggy output when the undo line is missing", () => {
    expect(correctLabel(candidate({ ask: "no-undo-bug" }))).toBe("[[1,2,3]]");
  });

  it("turns the undo and snapshot lines into Java fill-ins", () => {
    const undo = accept(candidate({ ask: "undo-line" })).lesson.steps[0];
    expect(undo.mode).toBe("complete");
    expect(undo.code?.blankLine).toBe(13);
    expect(correctLabel(candidate({ ask: "undo-line" }))).toBe("current.remove(current.size() - 1);");
    expect(correctLabel(candidate({ ask: "snapshot-line" }))).toBe("result.add(new ArrayList<>(current));");
  });

  it("works on subsets too", () => {
    const subsets = {
      problem: { type: "subsets", items: [1, 2, 3] },
      expected: { solutions: [[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]] },
    };
    expect(firstQuestion(candidate(subsets))).toMatchObject({ expected: [8] });
    expect(correctLabel(candidate({ ...subsets, ask: "next-solution", moment: 4 }))).toBe("[2]");
  });

  it("ignores answers the candidate volunteers, and tags practice with the skill", () => {
    const exercise = accept(candidate({ ask: "next-choice", moment: 1, answer: "3" }));
    expect(correctLabel(candidate({ ask: "next-choice", moment: 1, answer: "3" }))).toBe("2");
    expect(exercise.skill).toBe("next-choice");
    expect(exercise.lesson.steps.at(-1)?.practice?.skills).toEqual(["next-choice"]);
  });
});

describe("rejecting backtracking candidates", () => {
  it("rejects claimed solutions that disagree with the search", () => {
    expect(problemsOf(candidate({ expected: { solutions: PERMS.slice(0, 5) } })).join()).toContain("expected.solutions");
    expect(problemsOf(candidate({ expected: { solutions: [...PERMS].reverse() } })).join()).toContain("expected.solutions");
  });

  it("rejects unreasonable or malformed problems", () => {
    expect(problemsOf(candidate({ problem: { type: "permutations", items: [1, 1, 2] } })).join()).toContain("distinct");
    expect(problemsOf(candidate({ problem: { type: "permutations", items: [1, 2, 3, 4] } }))).not.toEqual([]);
    expect(problemsOf(candidate({ problem: { type: "subsets", items: [1, 2, 3, 4, 5] } }))).not.toEqual([]);
    expect(
      problemsOf(candidate({ problem: { type: "permutations", items: [1, 2, 3], rule: { after: 1, forbid: 9 } } })).join(),
    ).toContain("two of the items");
    expect(problemsOf(candidate({ problem: { type: "combinations", items: [1, 2] } }))).not.toEqual([]);
    expect(problemsOf(candidate({ problem: { type: "subsets", items: [1, 2], rule: { after: 1, forbid: 2 } } }))).toEqual([
      // A rule on subsets is stripped by the schema; the plain subsets claim then mismatches.
      expect.stringContaining("expected.solutions"),
    ]);
  });

  it("checks the moment each question needs", () => {
    expect(problemsOf(candidate({ ask: "after-undo" })).join()).toContain("needs a moment");
    expect(problemsOf(candidate({ ask: "after-undo", moment: 99 })).join()).toContain("moment must be between");
    expect(problemsOf(candidate({ moment: 0 })).join()).toContain("does not use a moment");
  });

  it("only asks the no-undo bug on permutations", () => {
    const subsets = {
      problem: { type: "subsets", items: [1, 2] },
      expected: { solutions: [[], [1], [1, 2], [2]] },
      ask: "no-undo-bug",
    };
    expect(problemsOf(candidate(subsets)).join()).toContain("only used with permutations");
  });

  it.each([
    ["an unknown ask", { ask: "solve-sudoku" }],
    ["the wrong concept", { concept: "graphs.dfs" }],
    ["missing claims", { expected: undefined }],
  ])("rejects %s", (_label, overrides) => {
    expect(problemsOf(candidate(overrides))).not.toEqual([]);
  });

  it("never offers an undo moment that empties current (typed answers need a value)", () => {
    const trace = traceBacktracking({ type: "permutations", items: [1, 2, 3] });
    for (const { answer } of momentsFor(trace, "after-undo")) {
      expect(trace.snapshots[answer].current.length).toBeGreaterThan(0);
    }
  });
});

describe("local backtracking generator", () => {
  it.each(DIFFICULTIES)("always produces candidates that pass the truth gate (%s)", async (difficulty) => {
    const generator = createLocalGenerator(seededRandom(79));
    const request = { kind: "backtracking" as const, difficulty };
    for (let i = 0; i < 200; i++) {
      const result = acceptCandidate(await generator.generate(request, { attempt: 1, previousProblems: [] }), request);
      if (!result.ok) throw new Error(result.problems.join("\n"));
    }
  });

  it("varies the problem, the skill and the moment", async () => {
    const generator = createLocalGenerator(seededRandom(83));
    const skills = new Set<string>();
    const fingerprints = new Set<string>();
    const types = new Set<string>();
    const seen: string[] = [];
    for (let i = 0; i < 90; i++) {
      const result = await produceExercise(generator, { kind: "backtracking", difficulty: "standard", avoid: seen });
      if (!result.ok) throw new Error(result.problems.join("\n"));
      skills.add(result.value.skill);
      fingerprints.add(result.value.fingerprint);
      types.add(result.value.fingerprint.split(":")[1]);
      seen.push(result.value.fingerprint);
    }
    expect(skills).toEqual(new Set(EXERCISE_SKILLS.backtracking));
    expect(types).toEqual(new Set(["permutations", "subsets"]));
    expect(fingerprints.size).toBe(90);
  });

  it("drills exactly the requested skill", async () => {
    const generator = createLocalGenerator(seededRandom(89));
    for (const skill of ["after-undo", "no-undo-bug", "snapshot-line", "next-branch"]) {
      for (let i = 0; i < 10; i++) {
        const result = await produceExercise(generator, { kind: "backtracking", difficulty: "intro", skills: [skill] });
        if (!result.ok) throw new Error(result.problems.join("\n"));
        expect(result.value.skill).toBe(skill);
      }
    }
  });
});
