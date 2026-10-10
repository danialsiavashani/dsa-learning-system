/**
 * Deterministic binary-tree logic: structure validation, traversals, height,
 * and recursive DFS execution traces. Visualizers render these results;
 * validators and answer keys are derived from them.
 */

export type TreeNode = {
  id: string;
  value: number;
  left: string | null;
  right: string | null;
};

export type Tree = {
  root: string | null;
  nodes: TreeNode[];
};

export type TreeLimits = { maxNodes: number; maxLevels: number };

export const DEFAULT_TREE_LIMITS: TreeLimits = { maxNodes: 15, maxLevels: 5 };

export class TreeError extends Error {}

/**
 * Structural problems with a tree, or [] if it is a valid binary tree:
 * unique IDs, real child references, one parent per node, a root with no
 * parent from which every node is reachable (so no cycles), within limits.
 */
export function treeProblems(tree: Tree, limits: TreeLimits = DEFAULT_TREE_LIMITS): string[] {
  const problems: string[] = [];
  const byId = new Map<string, TreeNode>();
  for (const node of tree.nodes) {
    if (byId.has(node.id)) problems.push(`Duplicate node id "${node.id}".`);
    byId.set(node.id, node);
  }
  if (tree.nodes.length > limits.maxNodes) {
    problems.push(`The tree has ${tree.nodes.length} nodes; the limit is ${limits.maxNodes}.`);
  }

  const parents = new Map<string, string>();
  for (const node of tree.nodes) {
    for (const child of [node.left, node.right]) {
      if (child === null) continue;
      if (!byId.has(child)) {
        problems.push(`Node "${node.id}" points at missing child "${child}".`);
      } else if (parents.has(child)) {
        problems.push(`Node "${child}" has more than one parent.`);
      } else {
        parents.set(child, node.id);
      }
    }
    if (node.left !== null && node.left === node.right) {
      problems.push(`Node "${node.id}" uses "${node.left}" as both children.`);
    }
  }

  if (tree.root === null) {
    if (tree.nodes.length > 0) problems.push("A tree with nodes needs a root.");
    return problems;
  }
  if (!byId.has(tree.root)) {
    problems.push(`Root "${tree.root}" is not a node.`);
    return problems;
  }
  if (parents.has(tree.root)) problems.push(`Root "${tree.root}" has a parent.`);

  // Walk from the root; anything unreachable is a second root or part of a cycle.
  const seen = new Set<string>();
  let levels = 0;
  const walk = (id: string, depth: number) => {
    if (seen.has(id)) {
      problems.push(`Node "${id}" is reachable twice: the structure has a cycle.`);
      return;
    }
    seen.add(id);
    levels = Math.max(levels, depth);
    const node = byId.get(id);
    if (!node) return;
    for (const child of [node.left, node.right]) {
      if (child !== null && byId.has(child)) walk(child, depth + 1);
    }
  };
  walk(tree.root, 1);

  const unreachable = tree.nodes.filter((node) => !seen.has(node.id)).map((node) => node.id);
  if (unreachable.length > 0) {
    problems.push(`Nodes not reachable from the root: ${unreachable.join(", ")}.`);
  }
  if (levels > limits.maxLevels) {
    problems.push(`The tree is ${levels} levels tall; the limit is ${limits.maxLevels}.`);
  }
  return problems;
}

export function assertTree(tree: Tree, limits?: TreeLimits): Tree {
  const problems = treeProblems(tree, limits);
  if (problems.length > 0) throw new TreeError(problems.join(" "));
  return tree;
}

/** Nested shorthand for authoring: { v: 8, l: { v: 4 }, r: { v: 12 } }. */
export type TreeShape = { v: number; l?: TreeShape; r?: TreeShape };

/** Builds a tree from a shape; node IDs are `${prefix}${value}`, so values must be unique. */
export function treeFromShape(shape: TreeShape, prefix = "n"): Tree {
  const nodes: TreeNode[] = [];
  const build = (s: TreeShape | undefined): string | null => {
    if (!s) return null;
    const node: TreeNode = { id: `${prefix}${s.v}`, value: s.v, left: null, right: null };
    nodes.push(node);
    node.left = build(s.l);
    node.right = build(s.r);
    return node.id;
  };
  const root = build(shape);
  return assertTree({ root, nodes });
}

export function nodeMap(tree: Tree): Map<string, TreeNode> {
  return new Map(tree.nodes.map((node) => [node.id, node]));
}

/** Number of levels: nodes on the longest root-to-leaf path (empty tree: 0). */
export function levels(tree: Tree): number {
  const byId = nodeMap(tree);
  const count = (id: string | null): number => {
    const node = id === null ? undefined : byId.get(id);
    return node ? 1 + Math.max(count(node.left), count(node.right)) : 0;
  };
  return count(tree.root);
}

/**
 * Height in edges, as OpenDSA and algs4 define it: the depth of the deepest
 * node. A single node has height 0; an empty tree, -1.
 */
export function height(tree: Tree): number {
  return levels(tree) - 1;
}

/** IDs of the subtree rooted at `id`, in preorder. */
export function subtreeOf(tree: Tree, id: string): string[] {
  const byId = nodeMap(tree);
  const out: string[] = [];
  const walk = (current: string | null) => {
    const node = current === null ? undefined : byId.get(current);
    if (!node) return;
    out.push(node.id);
    walk(node.left);
    walk(node.right);
  };
  walk(id);
  return out;
}

export function leaves(tree: Tree): TreeNode[] {
  return inorderNodes(tree).filter((node) => node.left === null && node.right === null);
}

export function parentOf(tree: Tree, id: string): TreeNode | undefined {
  return tree.nodes.find((node) => node.left === id || node.right === id);
}

/** Node IDs from the root down to `id`. */
export function pathTo(tree: Tree, id: string): string[] {
  const path: string[] = [];
  for (let current: string | undefined = id; current; current = parentOf(tree, current)?.id) {
    path.unshift(current);
  }
  return path;
}

function inorderNodes(tree: Tree): TreeNode[] {
  const byId = nodeMap(tree);
  const out: TreeNode[] = [];
  const walk = (id: string | null) => {
    const node = id === null ? undefined : byId.get(id);
    if (!node) return;
    walk(node.left);
    out.push(node);
    walk(node.right);
  };
  walk(tree.root);
  return out;
}

// ---------------------------------------------------------------------------
// Traversals and DFS traces

export const TRAVERSAL_ORDERS = ["preorder", "inorder", "postorder"] as const;
export type TraversalOrder = (typeof TRAVERSAL_ORDERS)[number];

type Action = "visit" | "left" | "right";

/** What each order does inside one call, in sequence. */
export const orderActions: Record<TraversalOrder, readonly Action[]> = {
  preorder: ["visit", "left", "right"],
  inorder: ["left", "visit", "right"],
  postorder: ["left", "right", "visit"],
};

export type Side = "left" | "right";

export type DfsSnapshot =
  | { kind: "enter"; node: string; path: string[]; visited: string[] }
  | { kind: "visit"; node: string; path: string[]; visited: string[] }
  /** dfs(null): the base case. `path` is the caller's frames (the null frame is on top). */
  | { kind: "null"; parent: string; side: Side; path: string[]; visited: string[] }
  /** Back in `node` after dfs(child) on `side` returned. */
  | { kind: "return"; node: string; from: string; side: Side; path: string[]; visited: string[] }
  | { kind: "done"; path: string[]; visited: string[] };

export type DfsTrace = {
  order: TraversalOrder;
  snapshots: DfsSnapshot[];
  /** Node IDs in processing order. */
  visitOrder: string[];
  values: number[];
};

export function traceDfs(tree: Tree, order: TraversalOrder): DfsTrace {
  assertTree(tree);
  const byId = nodeMap(tree);
  const snapshots: DfsSnapshot[] = [];
  const path: string[] = [];
  const visited: string[] = [];
  const state = () => ({ path: [...path], visited: [...visited] });

  const dfs = (id: string | null, parent: string | null, side: Side | null) => {
    if (id === null) {
      if (parent !== null && side !== null) snapshots.push({ kind: "null", parent, side, ...state() });
      return;
    }
    const node = byId.get(id)!;
    path.push(id);
    snapshots.push({ kind: "enter", node: id, ...state() });
    for (const action of orderActions[order]) {
      if (action === "visit") {
        visited.push(id);
        snapshots.push({ kind: "visit", node: id, ...state() });
      } else {
        const child = action === "left" ? node.left : node.right;
        dfs(child, id, action);
        if (child !== null) snapshots.push({ kind: "return", node: id, from: child, side: action, ...state() });
      }
    }
    path.pop();
  };

  dfs(tree.root, null, null);
  snapshots.push({ kind: "done", ...state() });
  return { order, snapshots, visitOrder: visited, values: visited.map((id) => byId.get(id)!.value) };
}

export function traversal(tree: Tree, order: TraversalOrder): number[] {
  return traceDfs(tree, order).values;
}
