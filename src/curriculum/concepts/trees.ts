import {
  nodeMap,
  orderActions,
  type DfsSnapshot,
  type DfsTrace,
  type TraversalOrder,
  type Tree,
} from "@/lib/domain/tree";
import type { TreeVisual } from "@/lib/learning/schema";

/**
 * Shared tree material: the Java `TreeNode` and `dfs` for each traversal
 * order, and how a DFS snapshot is shown (tree visual, highlighted line,
 * narration). Lesson and generated exercises both use it.
 */

export const treeNodeCode = {
  source: ["class TreeNode {", "    int val;", "    TreeNode left;", "    TreeNode right;", "}"].join("\n"),
  language: "java" as const,
};

const actionLines = {
  visit: "    visit(node);",
  left: "    dfs(node.left);",
  right: "    dfs(node.right);",
};

/** `dfs` for an order: the same method, with `visit(node)` moved. Body actions sit on lines 5-7. */
export function dfsCode(order: TraversalOrder) {
  const actions = orderActions[order];
  const lineOf = (action: (typeof actions)[number]) => 5 + actions.indexOf(action);
  return {
    source: [
      "void dfs(TreeNode node) {",
      "    if (node == null) {",
      "        return;",
      "    }",
      ...actions.map((action) => actionLines[action]),
      "}",
    ].join("\n"),
    language: "java" as const,
    lines: {
      nullCheck: 2,
      nullReturn: 3,
      visit: lineOf("visit"),
      left: lineOf("left"),
      right: lineOf("right"),
    },
  };
}

/** The Java statement for one of the three body actions, e.g. "dfs(node.left);". */
export function actionStatement(action: "visit" | "left" | "right") {
  return actionLines[action].trim();
}

export const orderNames: Record<TraversalOrder, string> = {
  preorder: "Preorder",
  inorder: "Inorder",
  postorder: "Postorder",
};

/** The line executing at a snapshot. */
export function dfsLine(order: TraversalOrder, snapshot: DfsSnapshot): number[] {
  const lines = dfsCode(order).lines;
  switch (snapshot.kind) {
    case "enter":
      return [lines.nullCheck];
    case "null":
      return [lines.nullReturn];
    case "visit":
      return [lines.visit];
    case "return":
      return [lines[snapshot.side]];
    case "done":
      return [];
  }
}

export function plainTree(tree: Tree, extra: Partial<TreeVisual> = {}): TreeVisual {
  return { kind: "tree", root: tree.root, nodes: tree.nodes, ...extra };
}

export function dfsVisual(tree: Tree, snapshot: DfsSnapshot, extra: Partial<TreeVisual> = {}): TreeVisual {
  return plainTree(tree, {
    path: snapshot.path,
    visited: snapshot.visited,
    nullAt: snapshot.kind === "null" ? { parent: snapshot.parent, side: snapshot.side } : undefined,
    ...extra,
  });
}

export function valuesOf(tree: Tree, ids: string[]): number[] {
  const byId = nodeMap(tree);
  return ids.map((id) => byId.get(id)!.value);
}

const why: Record<TraversalOrder, string> = {
  preorder: "Preorder visits a node as soon as its call starts, before either subtree.",
  inorder: "Its left subtree is finished, so inorder visits it now, before going right.",
  postorder: "Both of its subtrees are finished, so postorder visits it now.",
};

/** Narration for a visit snapshot: which call is on top and why it is processed now. */
export function narrateVisit(tree: Tree, trace: DfsTrace, index: number): { title: string; body: string } {
  const snapshot = trace.snapshots[index];
  if (snapshot.kind !== "visit") throw new Error("narrateVisit expects a visit snapshot");
  const value = valuesOf(tree, [snapshot.node])[0];
  const stack = valuesOf(tree, snapshot.path).map((v) => `dfs(${v})`).join(" › ");
  return {
    title: `visit(${value}): number ${snapshot.visited.length}.`,
    body: `Calls in progress: ${stack}. ${why[trace.order]}`,
  };
}
