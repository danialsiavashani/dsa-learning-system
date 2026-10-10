import { describe, expect, it } from "vitest";
import { DIFFICULTIES } from "@/lib/learning/schema";
import { createLocalGenerator } from "./localGenerator";
import { acceptCandidate, produceExercise } from "./pipeline";
import { seededRandom } from "./random";
import { TREE_EXERCISE_LIMITS } from "./kinds/treeDfs";

const nodes = [
  { id: "a", value: 7, left: "b", right: "c" },
  { id: "b", value: 3, left: "d", right: "e" },
  { id: "c", value: 9, left: null, right: "f" },
  { id: "d", value: 8, left: null, right: null },
  { id: "e", value: 1, left: null, right: null },
  { id: "f", value: 5, left: null, right: null },
];

/** A well-formed tree candidate, as an LLM provider might emit it. */
function candidate(overrides: Record<string, unknown> = {}) {
  return {
    kind: "tree-dfs",
    concept: "trees.dfs",
    difficulty: "standard",
    tree: { root: "a", nodes },
    order: "preorder",
    ask: "traversal",
    expected: { preorder: [7, 3, 8, 1, 9, 5], inorder: [8, 3, 1, 7, 9, 5], postorder: [8, 1, 3, 5, 9, 7] },
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

describe("accepting tree candidates", () => {
  it("asks for a typed traversal, then traces each visit", () => {
    const exercise = accept(candidate({ order: "postorder" }));
    expect(exercise.skill).toBe("postorder");
    expect(exercise.lesson.steps[0].mode).toBe("solve");
    expect(firstQuestion(candidate({ order: "postorder" }))).toMatchObject({ expected: [8, 1, 3, 5, 9, 7] });
    expect(exercise.lesson.steps.slice(1).every((s) => s.mode === "trace")).toBe(true);
    expect(exercise.lesson.steps.at(-1)?.practice).toEqual({
      kind: "tree-dfs",
      difficulty: "standard",
      skills: ["postorder"],
    });
  });

  it("derives the next node in the requested order", () => {
    expect(correctLabel(candidate({ ask: "next-visit", visited: 3 }))).toBe("1");
    expect(correctLabel(candidate({ ask: "next-visit", order: "inorder", visited: 3 }))).toBe("7");
  });

  it("derives which call resumes after a node returns", () => {
    expect(correctLabel(candidate({ ask: "resumes", focus: "d" }))).toBe("dfs(3)");
    expect(correctLabel(candidate({ ask: "resumes", focus: "c" }))).toBe("dfs(7)");
  });

  it("derives the active path and the leaves", () => {
    expect(firstQuestion(candidate({ ask: "path", focus: "e" }))).toMatchObject({ expected: [7, 3, 1] });
    expect(firstQuestion(candidate({ ask: "leaves" }))).toMatchObject({ expected: [8, 1, 5] });
  });

  it("turns 'where does visit go' into a Java fill-in on the right line", () => {
    const exercise = accept(candidate({ ask: "visit-position", order: "inorder", blank: "visit" }));
    const step = exercise.lesson.steps[0];
    expect(step.mode).toBe("complete");
    expect(step.code?.blankLine).toBe(6);
    expect(correctLabel(candidate({ ask: "visit-position", order: "inorder", blank: "visit" }))).toBe("visit(node);");
  });

  it("ignores answers the candidate volunteers", () => {
    expect(correctLabel(candidate({ ask: "resumes", focus: "d", answer: "dfs(7)" }))).toBe("dfs(3)");
  });
});

describe("rejecting tree candidates", () => {
  it("rejects structural problems", () => {
    const withCycle = nodes.map((n) => (n.id === "f" ? { ...n, left: "a" } : n));
    expect(problemsOf(candidate({ tree: { root: "a", nodes: withCycle } })).join()).toMatch(/parent|cycle/);
    const twoParents = nodes.map((n) => (n.id === "c" ? { ...n, left: "d" } : n));
    expect(problemsOf(candidate({ tree: { root: "a", nodes: twoParents } })).join()).toContain("more than one parent");
    const dangling = nodes.map((n) => (n.id === "f" ? { ...n, right: "zz" } : n));
    expect(problemsOf(candidate({ tree: { root: "a", nodes: dangling } })).join()).toContain("missing child");
    expect(problemsOf(candidate({ tree: { root: "b", nodes } })).join()).toMatch(/has a parent|not reachable/);
  });

  it("rejects trees that are too big or too deep", () => {
    const chain = Array.from({ length: 5 }, (_, i) => ({
      id: `n${i}`,
      value: i + 10,
      left: i < 4 ? `n${i + 1}` : null,
      right: null,
    }));
    const problems = problemsOf(
      candidate({ tree: { root: "n0", nodes: chain }, expected: { preorder: [], inorder: [], postorder: [] } }),
    ).join();
    expect(problems).toContain(`limit is ${TREE_EXERCISE_LIMITS.maxLevels}`);
  });

  it("rejects wrong traversal claims", () => {
    const problems = problemsOf(
      candidate({ expected: { preorder: [7, 9, 5, 3, 8, 1], inorder: [8, 3, 1, 7, 9, 5], postorder: [7, 3, 8, 1, 9, 5] } }),
    ).join();
    expect(problems).toContain("expected.preorder");
    expect(problems).toContain("expected.postorder");
  });

  it("rejects repeated values", () => {
    const repeated = nodes.map((n) => (n.id === "f" ? { ...n, value: 7 } : n));
    expect(problemsOf(candidate({ tree: { root: "a", nodes: repeated } })).join()).toContain("distinct");
  });

  it("checks the fields each question needs", () => {
    expect(problemsOf(candidate({ ask: "resumes" })).join()).toContain("needs focus");
    expect(problemsOf(candidate({ ask: "resumes", focus: "a" })).join()).toContain("root");
    expect(problemsOf(candidate({ ask: "resumes", focus: "zz" })).join()).toContain("not a node");
    expect(problemsOf(candidate({ ask: "next-visit", visited: 5 })).join()).toContain("between 1 and 4");
    expect(problemsOf(candidate({ ask: "visit-position" })).join()).toContain("needs blank");
    expect(problemsOf(candidate({ focus: "b" })).join()).toContain("does not use focus");
  });

  it.each([
    ["an unknown order", { order: "levelorder" }],
    ["an unknown ask", { ask: "balance" }],
    ["a tree with too few nodes", { tree: { root: "a", nodes: nodes.slice(0, 2) } }],
    ["the wrong concept", { concept: "trees.bst" }],
  ])("rejects %s", (_label, overrides) => {
    expect(problemsOf(candidate(overrides))).not.toEqual([]);
  });
});

describe("local tree generator", () => {
  it.each(DIFFICULTIES)("always produces trees that pass the truth gate (%s)", async (difficulty) => {
    const generator = createLocalGenerator(seededRandom(61));
    const request = { kind: "tree-dfs" as const, difficulty };
    for (let i = 0; i < 200; i++) {
      const raw = (await generator.generate(request, { attempt: 1, previousProblems: [] })) as {
        tree: { nodes: unknown[] };
      };
      expect(raw.tree.nodes.length).toBeLessThanOrEqual(TREE_EXERCISE_LIMITS.maxNodes);
      const result = acceptCandidate(raw, request);
      if (!result.ok) throw new Error(result.problems.join("\n"));
    }
  });

  it("varies the tree, the order and the question", async () => {
    const generator = createLocalGenerator(seededRandom(67));
    const skills = new Set<string>();
    const shapes = new Set<string>();
    const seen: string[] = [];
    for (let i = 0; i < 80; i++) {
      const result = await produceExercise(generator, { kind: "tree-dfs", difficulty: "standard", avoid: seen });
      if (!result.ok) throw new Error(result.problems.join("\n"));
      skills.add(result.value.skill);
      shapes.add(result.value.fingerprint.split("|")[0]);
      seen.push(result.value.fingerprint);
    }
    expect(skills).toEqual(
      new Set(["next-visit", "preorder", "inorder", "postorder", "resumes", "path", "leaves", "visit-position"]),
    );
    expect(shapes.size).toBeGreaterThan(60);
  });

  it("keeps intro trees near-complete and three levels deep at most", async () => {
    const generator = createLocalGenerator(seededRandom(71));
    for (let i = 0; i < 50; i++) {
      const result = await produceExercise(generator, { kind: "tree-dfs", difficulty: "intro" });
      if (!result.ok) throw new Error(result.problems.join("\n"));
      const visual = result.value.lesson.steps.find((s) => s.visual?.kind === "tree")?.visual;
      if (visual?.kind !== "tree") throw new Error("expected a tree visual");
      expect(visual.nodes.length).toBeLessThanOrEqual(6);
      const depth = (id: string | null): number => {
        const n = visual.nodes.find((x) => x.id === id);
        return n ? 1 + Math.max(depth(n.left), depth(n.right)) : 0;
      };
      expect(depth(visual.root)).toBeLessThanOrEqual(3);
    }
  });

  it("drills exactly the requested skill", async () => {
    const generator = createLocalGenerator(seededRandom(73));
    for (const skill of ["resumes", "visit-position", "inorder"]) {
      for (let i = 0; i < 10; i++) {
        const result = await produceExercise(generator, { kind: "tree-dfs", difficulty: "intro", skills: [skill] });
        if (!result.ok) throw new Error(result.problems.join("\n"));
        expect(result.value.skill).toBe(skill);
      }
    }
  });
});
