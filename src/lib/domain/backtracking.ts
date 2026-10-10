/**
 * Deterministic backtracking over small decision trees.
 *
 * Two problems are supported, each matching a conventional Java method that
 * keeps ONE shared mutable list, `current`:
 *
 * - "permutations": every ordering of `items`; a candidate is complete when it
 *   uses every item. An optional rule forbids `forbid` directly after `after`;
 *   choices breaking it are pruned with their whole subtree.
 * - "subsets": every subset; each node is recorded on entry, and a frame only
 *   adds items after the last one chosen.
 *
 * `traceBacktracking` produces the step-by-step execution (choose, enter,
 * record, return, undo, prune). `simulate` runs the same algorithm on a real
 * mutable list, optionally without the undo line or without copying, so
 * buggy variants have deterministic outcomes too.
 */

export type BacktrackRule = { after: number; forbid: number };

export type BacktrackProblem =
  | { type: "permutations"; items: number[]; rule?: BacktrackRule }
  | { type: "subsets"; items: number[] };

export type NodeStatus = "valid" | "pruned" | "cut";

export type DecisionNode = {
  /** Stable path id: "b" is the root, "b.1.3" chose 1 then 3. */
  id: string;
  parent: string | null;
  candidate: number[];
  /** valid; pruned (breaks the rule, never entered); cut (below a pruned node). */
  status: NodeStatus;
  /** A complete candidate that the method records. */
  solution: boolean;
};

export const BACKTRACK_LIMITS = { maxItems: 4, maxNodes: 20 };

export class BacktrackError extends Error {}

export function problemProblems(problem: BacktrackProblem): string[] {
  const problems: string[] = [];
  const { items } = problem;
  if (items.length < 2 || items.length > BACKTRACK_LIMITS.maxItems) {
    problems.push(`Use 2 to ${BACKTRACK_LIMITS.maxItems} items, not ${items.length}.`);
  }
  if (new Set(items).size !== items.length) problems.push("Items must be distinct.");
  if (items.some((item) => !Number.isInteger(item))) problems.push("Items must be integers.");
  if (problem.type === "permutations" && problem.rule) {
    const { after, forbid } = problem.rule;
    if (!items.includes(after) || !items.includes(forbid)) problems.push("The rule must use two of the items.");
    if (after === forbid) problems.push("The rule needs two different items.");
  }
  if (problems.length === 0) {
    const size = buildDecisionTree(problem, false).length;
    if (size > BACKTRACK_LIMITS.maxNodes) {
      problems.push(`The decision tree has ${size} nodes; the limit is ${BACKTRACK_LIMITS.maxNodes}.`);
    }
  }
  return problems;
}

function assertProblem(problem: BacktrackProblem) {
  const problems = problemProblems(problem);
  if (problems.length > 0) throw new BacktrackError(problems.join(" "));
}

const childId = (parent: string, value: number) => `${parent}.${value}`;

function breaksRule(problem: BacktrackProblem, candidate: number[], value: number): boolean {
  if (problem.type !== "permutations" || !problem.rule) return false;
  return candidate[candidate.length - 1] === problem.rule.after && value === problem.rule.forbid;
}

/** The values a frame tries, in loop order (including ones the rule will prune). */
export function choicesFor(problem: BacktrackProblem, candidate: number[]): number[] {
  if (problem.type === "permutations") return problem.items.filter((item) => !candidate.includes(item));
  const last = candidate.length === 0 ? -1 : problem.items.indexOf(candidate[candidate.length - 1]);
  return problem.items.slice(last + 1);
}

function isComplete(problem: BacktrackProblem, candidate: number[]): boolean {
  return problem.type === "subsets" || candidate.length === problem.items.length;
}

/** The whole decision tree in depth-first order, with pruned and cut nodes marked. */
export function buildDecisionTree(problem: BacktrackProblem, check = true): DecisionNode[] {
  if (check) assertProblem(problem);
  const nodes: DecisionNode[] = [];
  const grow = (id: string, parent: string | null, candidate: number[], status: NodeStatus) => {
    const complete = isComplete(problem, candidate);
    nodes.push({ id, parent, candidate, status, solution: status === "valid" && complete });
    if (problem.type === "permutations" && complete) return;
    for (const value of choicesFor(problem, candidate)) {
      const next: NodeStatus =
        status !== "valid" ? "cut" : breaksRule(problem, candidate, value) ? "pruned" : "valid";
      grow(childId(id, value), id, [...candidate, value], next);
    }
  };
  grow("b", null, [], "valid");
  return nodes;
}

export type BacktrackStepKind = "start" | "choose" | "enter" | "record" | "return" | "undo" | "prune" | "done";

export type BacktrackSnapshot = {
  kind: BacktrackStepKind;
  /** The frame where control is (for choose/return/undo/prune: the parent making the choice). */
  node: string;
  /** The child involved in a choose/enter/return/undo/prune. */
  child?: string;
  /** The value chosen, removed or pruned. */
  value?: number;
  /** Contents of the shared `current` list at this moment. */
  current: number[];
  /** Active frames from the root to `node` (for enter/record, `node` is the child). */
  path: string[];
  /** Nodes entered so far. */
  explored: string[];
  /** Branches rejected by the rule so far. */
  pruned: string[];
  /** Copies saved into `result` so far. */
  results: number[][];
};

export type BacktrackTrace = {
  problem: BacktrackProblem;
  tree: DecisionNode[];
  snapshots: BacktrackSnapshot[];
  solutions: number[][];
};

export function traceBacktracking(problem: BacktrackProblem): BacktrackTrace {
  const tree = buildDecisionTree(problem);
  const byId = new Map(tree.map((node) => [node.id, node]));
  const snapshots: BacktrackSnapshot[] = [];
  const current: number[] = [];
  const path: string[] = ["b"];
  const explored: string[] = ["b"];
  const pruned: string[] = [];
  const results: number[][] = [];

  const snap = (kind: BacktrackStepKind, node: string, extra: { child?: string; value?: number } = {}) =>
    snapshots.push({
      kind,
      node,
      ...extra,
      current: [...current],
      path: [...path],
      explored: [...explored],
      pruned: [...pruned],
      results: results.map((r) => [...r]),
    });

  const explore = (id: string) => {
    const node = byId.get(id)!;
    if (isComplete(problem, node.candidate)) {
      results.push([...current]);
      snap("record", id);
      if (problem.type === "permutations") return;
    }
    for (const value of choicesFor(problem, node.candidate)) {
      const child = childId(id, value);
      if (byId.get(child)!.status === "pruned") {
        pruned.push(child);
        snap("prune", id, { child, value });
        continue;
      }
      current.push(value);
      snap("choose", id, { child, value });
      path.push(child);
      explored.push(child);
      snap("enter", child);
      explore(child);
      path.pop();
      snap("return", id, { child, value });
      current.pop();
      snap("undo", id, { child, value });
    }
  };

  snap("start", "b");
  explore("b");
  snap("done", "b");
  return { problem, tree, snapshots, solutions: results.map((r) => [...r]) };
}

/**
 * Runs the Java algorithm on a real mutable list. With `undo: false` the
 * remove line is missing; with `copy: false` the base case stores `current`
 * itself, so every stored entry is the same list and shows its final state.
 */
export function simulate(
  problem: BacktrackProblem,
  options: { undo: boolean; copy: boolean },
): { results: number[][]; finalCurrent: number[] } {
  assertProblem(problem);
  const current: number[] = [];
  const stored: (number[] | "shared")[] = [];
  const save = () => stored.push(options.copy ? [...current] : "shared");

  const permute = () => {
    if (current.length === problem.items.length) {
      save();
      return;
    }
    for (const value of problem.items) {
      if (current.includes(value)) continue;
      if (breaksRule(problem, current, value)) continue;
      current.push(value);
      permute();
      if (options.undo) current.pop();
    }
  };
  const subsets = (start: number) => {
    save();
    for (let i = start; i < problem.items.length; i++) {
      current.push(problem.items[i]);
      subsets(i + 1);
      if (options.undo) current.pop();
    }
  };

  if (problem.type === "permutations") permute();
  else subsets(0);
  return {
    results: stored.map((entry) => (entry === "shared" ? [...current] : entry)),
    finalCurrent: [...current],
  };
}

/** "[1,2,3]": compact list label used in the decision tree. */
export function listLabel(values: readonly number[]): string {
  return `[${values.join(",")}]`;
}

/** "[1, 2, 3]": how Java prints a List. */
export function javaList(values: readonly number[]): string {
  return `[${values.join(", ")}]`;
}
