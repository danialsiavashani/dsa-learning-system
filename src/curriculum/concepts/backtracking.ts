import {
  javaList,
  listLabel,
  type BacktrackProblem,
  type BacktrackSnapshot,
  type BacktrackTrace,
  type DecisionNode,
} from "@/lib/domain/backtracking";
import type { BacktrackVisual } from "@/lib/learning/schema";

/**
 * Shared backtracking material: the Java method for each problem type, and
 * how a trace snapshot is shown (decision tree + shared `current` list,
 * highlighted line, narration). Lesson and generated exercises both use it.
 */

const fields = ["List<List<Integer>> result = new ArrayList<>();", "List<Integer> current = new ArrayList<>();", ""];

export type BacktrackCode = {
  source: string;
  language: "java";
  lines: {
    enter: number;
    record: number;
    add: number;
    recurse: number;
    undo: number;
    prune?: number;
    baseCheck?: number;
  };
};

/** The Java method for a problem; the rule check only appears when there is a rule. */
export function backtrackCode(problem: BacktrackProblem): BacktrackCode {
  if (problem.type === "subsets") {
    return {
      source: [
        ...fields,
        "void backtrack(int[] nums, int start) {",
        "    result.add(new ArrayList<>(current));",
        "    for (int i = start; i < nums.length; i++) {",
        "        current.add(nums[i]);",
        "        backtrack(nums, i + 1);",
        "        current.remove(current.size() - 1);",
        "    }",
        "}",
      ].join("\n"),
      language: "java",
      lines: { enter: 4, record: 5, add: 7, recurse: 8, undo: 9 },
    };
  }
  const rule = problem.rule ? ["        if (breaksRule(x)) continue;   // prune"] : [];
  const shift = rule.length;
  return {
    source: [
      ...fields,
      "void backtrack(int[] nums) {",
      "    if (current.size() == nums.length) {",
      "        result.add(new ArrayList<>(current));",
      "        return;",
      "    }",
      "    for (int x : nums) {",
      "        if (current.contains(x)) continue;",
      ...rule,
      "        current.add(x);",
      "        backtrack(nums);",
      "        current.remove(current.size() - 1);",
      "    }",
      "}",
    ].join("\n"),
    language: "java",
    lines: {
      enter: 5,
      baseCheck: 5,
      record: 6,
      add: 11 + shift,
      recurse: 12 + shift,
      undo: 13 + shift,
      prune: problem.rule ? 11 : undefined,
    },
  };
}

/** The Java line executing at a snapshot. */
export function backtrackLine(code: BacktrackCode, snapshot: BacktrackSnapshot): number[] {
  switch (snapshot.kind) {
    case "start":
    case "enter":
      return [code.lines.enter];
    case "record":
      return [code.lines.record];
    case "choose":
      return [code.lines.add];
    case "return":
      return [code.lines.recurse];
    case "undo":
      return [code.lines.undo];
    case "prune":
      return code.lines.prune ? [code.lines.prune] : [];
    case "done":
      return [];
  }
}

const chip = (value: number) => ({ id: `v${value}`, value });

function nodeState(
  trace: BacktrackTrace,
  node: DecisionNode,
  snapshot: BacktrackSnapshot,
): BacktrackVisual["nodes"][number]["state"] {
  if (node.status === "pruned") return snapshot.pruned.includes(node.id) ? "pruned" : "unexplored";
  if (node.status === "cut") {
    // Show a cut subtree once the branch above it has been rejected.
    const byId = new Map(trace.tree.map((n) => [n.id, n]));
    let above = byId.get(node.parent ?? "");
    while (above && above.status === "cut") above = byId.get(above.parent ?? "");
    return above && snapshot.pruned.includes(above.id) ? "cut" : "unexplored";
  }
  if (!snapshot.explored.includes(node.id)) return "unexplored";
  const recorded = snapshot.results.some((r) => listLabel(r) === listLabel(node.candidate));
  return node.solution && recorded ? "solution" : "explored";
}

/** The visual for one snapshot. */
export function backtrackVisual(
  trace: BacktrackTrace,
  snapshot: BacktrackSnapshot,
  extra: Partial<BacktrackVisual> = {},
): BacktrackVisual {
  return {
    kind: "backtrack",
    nodes: trace.tree.map((node) => ({
      id: node.id,
      label: listLabel(node.candidate),
      parent: node.parent,
      state: nodeState(trace, node, snapshot),
    })),
    path: snapshot.kind === "done" ? [] : snapshot.path,
    current: snapshot.current.map(chip),
    added: snapshot.kind === "choose" && snapshot.value !== undefined ? `v${snapshot.value}` : undefined,
    removed: snapshot.kind === "undo" && snapshot.value !== undefined ? chip(snapshot.value) : undefined,
    results: snapshot.results.map((r, i) => ({
      id: `r${i}`,
      label: listLabel(r),
      fresh: snapshot.kind === "record" && i === snapshot.results.length - 1 ? true : undefined,
    })),
    ...extra,
  };
}

/** The whole decision tree before the search starts: every node quiet, current empty. */
export function treeOverview(trace: BacktrackTrace, extra: Partial<BacktrackVisual> = {}): BacktrackVisual {
  return backtrackVisual(trace, trace.snapshots[0], { path: [], ...extra });
}

const labelOf = (trace: BacktrackTrace, id: string | undefined) =>
  javaList(trace.tree.find((node) => node.id === id)?.candidate ?? []);

/** Narration for a snapshot: a title and one sentence on why it happens. */
export function narrateBacktrack(trace: BacktrackTrace, index: number): { title: string; body: string } {
  const s = trace.snapshots[index];
  const frame = labelOf(trace, s.node);
  switch (s.kind) {
    case "start":
      return { title: "The search starts at the root.", body: "`current` is empty: nothing has been chosen yet." };
    case "choose":
      return {
        title: `\`current.add(${s.value})\`: current is ${javaList(s.current)}.`,
        body: `The ${frame} frame picks ${s.value} and changes the shared list before exploring.`,
      };
    case "enter":
      return {
        title: `Explore ${labelOf(trace, s.node)}.`,
        body: "The recursive call starts a new frame. It sees the same shared `current`.",
      };
    case "record":
      return {
        title: `Record a copy of ${javaList(s.current)}.`,
        body: `\`result\` gets its own snapshot; it now holds ${s.results.length}.`,
      };
    case "return":
      return {
        title: `Back in the ${frame} frame; current is still ${javaList(s.current)}.`,
        body: "Returning from the call does not undo anything in the shared list.",
      };
    case "undo":
      return {
        title: `Undo: remove ${s.value}. current is ${javaList(s.current)} again.`,
        body: `The ${frame} frame has its own state back, so its next choice starts clean.`,
      };
    case "prune":
      return {
        title: `Skip ${s.value}: the rule rules it out.`,
        body: `Nothing is added, so the whole ${labelOf(trace, s.child)} branch is never explored.`,
      };
    case "done":
      return {
        title: `Done: ${s.results.length} recorded.`,
        body: `result holds ${s.results.map(javaList).join(", ")}.`,
      };
  }
}
