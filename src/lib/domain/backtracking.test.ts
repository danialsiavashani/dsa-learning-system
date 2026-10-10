import { describe, expect, it } from "vitest";
import {
  BacktrackError,
  buildDecisionTree,
  problemProblems,
  simulate,
  traceBacktracking,
  type BacktrackProblem,
} from "./backtracking";

const perms: BacktrackProblem = { type: "permutations", items: [1, 2, 3] };
const subsets: BacktrackProblem = { type: "subsets", items: [1, 2, 3] };
const ruled: BacktrackProblem = { type: "permutations", items: [1, 2, 3], rule: { after: 1, forbid: 2 } };

describe("decision trees", () => {
  it("builds the full permutation tree: 1 + 3 + 6 + 6 nodes, 6 leaves", () => {
    const tree = buildDecisionTree(perms);
    expect(tree).toHaveLength(16);
    expect(tree.filter((n) => n.solution).map((n) => n.candidate)).toEqual([
      [1, 2, 3],
      [1, 3, 2],
      [2, 1, 3],
      [2, 3, 1],
      [3, 1, 2],
      [3, 2, 1],
    ]);
  });

  it("gives every node a stable path id", () => {
    const ids = buildDecisionTree(perms).map((n) => n.id);
    expect(ids.slice(0, 4)).toEqual(["b", "b.1", "b.1.2", "b.1.2.3"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("builds the subset tree, where every node is a subset (8 for 3 items)", () => {
    const tree = buildDecisionTree(subsets);
    expect(tree).toHaveLength(8);
    expect(tree.every((n) => n.solution)).toBe(true);
  });

  it("marks branches that break a rule as pruned, and everything below them as cut", () => {
    const tree = buildDecisionTree(ruled);
    expect(tree.find((n) => n.id === "b.1.2")?.status).toBe("pruned");
    expect(tree.find((n) => n.id === "b.1.2.3")?.status).toBe("cut");
    expect(tree.find((n) => n.id === "b.3.1.2")?.status).toBe("pruned");
  });
});

describe("problem validation", () => {
  it.each([
    [{ type: "permutations", items: [1, 1, 2] }, "distinct"],
    [{ type: "permutations", items: [1] }, "Use 2"],
    [{ type: "subsets", items: [1, 2, 3, 4, 5] }, "Use 2"],
    [{ type: "permutations", items: [1, 2, 3, 4] }, "limit is 20"],
    [{ type: "permutations", items: [1, 2, 3], rule: { after: 1, forbid: 7 } }, "two of the items"],
    [{ type: "permutations", items: [1, 2, 3], rule: { after: 2, forbid: 2 } }, "two different"],
  ] as [BacktrackProblem, string][])("rejects %j", (problem, message) => {
    expect(problemProblems(problem).join()).toContain(message);
    expect(() => traceBacktracking(problem)).toThrow(BacktrackError);
  });
});

describe("search trace", () => {
  const trace = traceBacktracking(perms);
  const s = trace.snapshots;

  it("records solutions in depth-first order", () => {
    expect(trace.solutions).toEqual([
      [1, 2, 3],
      [1, 3, 2],
      [2, 1, 3],
      [2, 3, 1],
      [3, 1, 2],
      [3, 2, 1],
    ]);
  });

  it("changes current on choose, before the recursive call", () => {
    const choose = s.find((x) => x.kind === "choose" && x.node === "b.1" && x.value === 2)!;
    expect(choose.current).toEqual([1, 2]);
    expect(choose.path.at(-1)).toBe("b.1");
    const next = s[s.indexOf(choose) + 1];
    expect(next).toMatchObject({ kind: "enter", node: "b.1.2", current: [1, 2] });
  });

  it("leaves current unchanged on return; only the undo restores it", () => {
    s.forEach((snap, i) => {
      if (snap.kind !== "return") return;
      const child = trace.tree.find((n) => n.id === snap.child)!;
      const parent = trace.tree.find((n) => n.id === snap.node)!;
      expect(snap.current).toEqual(child.candidate);
      expect(s[i + 1]).toMatchObject({ kind: "undo", current: parent.candidate });
    });
  });

  it("every frame removes exactly the value it added", () => {
    const chosen = s.filter((x) => x.kind === "choose").map((x) => `${x.node}+${x.value}`);
    const undone = s.filter((x) => x.kind === "undo").map((x) => `${x.node}+${x.value}`);
    expect(new Set(undone)).toEqual(new Set(chosen));
    expect(s.at(-1)?.current).toEqual([]);
  });

  it("keeps the active path a chain of parent links ending at the frame in control", () => {
    for (const snap of s) {
      expect(snap.path[0]).toBe("b");
      snap.path.slice(1).forEach((id, i) => expect(trace.tree.find((n) => n.id === id)?.parent).toBe(snap.path[i]));
      expect(snap.path.at(-1)).toBe(snap.node);
    }
  });

  it("saves a copy when recording: later changes to current do not reach it", () => {
    const record = s.find((x) => x.kind === "record")!;
    expect(record.results).toEqual([[1, 2, 3]]);
    const later = s.find((x) => x.kind === "undo" && x.value === 3)!;
    expect(later.current).toEqual([1, 2]);
    expect(later.results).toEqual([[1, 2, 3]]);
  });

  it("is deterministic", () => {
    expect(traceBacktracking(perms)).toEqual(trace);
  });
});

describe("pruning", () => {
  const trace = traceBacktracking(ruled);

  it("never enters pruned or cut branches, and records only valid orderings", () => {
    const entered = trace.snapshots.filter((x) => x.kind === "enter").map((x) => x.node);
    expect(entered).not.toContain("b.1.2");
    expect(entered).not.toContain("b.1.2.3");
    expect(trace.solutions).toEqual([
      [1, 3, 2],
      [2, 1, 3],
      [2, 3, 1],
      [3, 2, 1],
    ]);
  });

  it("does not touch current when a choice is pruned", () => {
    const prune = trace.snapshots.find((x) => x.kind === "prune" && x.child === "b.1.2")!;
    expect(prune.current).toEqual([1]);
    expect(prune.pruned).toEqual(["b.1.2"]);
  });
});

describe("subsets", () => {
  it("records on entry, in depth-first order", () => {
    expect(traceBacktracking(subsets).solutions).toEqual([[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]]);
  });
});

describe("simulating the Java method", () => {
  it("matches the trace when written correctly", () => {
    for (const problem of [perms, subsets, ruled]) {
      expect(simulate(problem, { undo: true, copy: true }).results).toEqual(traceBacktracking(problem).solutions);
    }
  });

  it("without the undo line, a permutation search records only its first candidate", () => {
    expect(simulate(perms, { undo: false, copy: true })).toEqual({ results: [[1, 2, 3]], finalCurrent: [1, 2, 3] });
  });

  it("without copying, every saved entry is the same list, empty at the end", () => {
    const { results, finalCurrent } = simulate(perms, { undo: true, copy: false });
    expect(finalCurrent).toEqual([]);
    expect(results).toEqual([[], [], [], [], [], []]);
  });
});
