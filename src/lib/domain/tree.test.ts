import { describe, expect, it } from "vitest";
import {
  height,
  leaves,
  levels,
  parentOf,
  pathTo,
  subtreeOf,
  traceDfs,
  traversal,
  treeFromShape,
  treeProblems,
  TreeError,
  TRAVERSAL_ORDERS,
  type Tree,
} from "./tree";

// 7(3(8, 1), 9(-, 5)): unordered on purpose.
const tree = treeFromShape({ v: 7, l: { v: 3, l: { v: 8 }, r: { v: 1 } }, r: { v: 9, r: { v: 5 } } });

const node = (id: string, left: string | null = null, right: string | null = null) => ({
  id,
  value: Number(id.slice(1)),
  left,
  right,
});

describe("tree validation", () => {
  it("accepts a well-formed tree and finds its root", () => {
    expect(treeProblems(tree)).toEqual([]);
    expect(tree.root).toBe("n7");
  });

  it("rejects duplicate ids", () => {
    const bad: Tree = { root: "n1", nodes: [node("n1", "n2"), node("n2"), node("n2")] };
    expect(treeProblems(bad).join()).toContain('Duplicate node id "n2"');
  });

  it("rejects missing child references", () => {
    const bad: Tree = { root: "n1", nodes: [node("n1", "n9")] };
    expect(treeProblems(bad).join()).toContain('missing child "n9"');
  });

  it("rejects a node with two parents", () => {
    const bad: Tree = { root: "n1", nodes: [node("n1", "n2", "n3"), node("n2", "n4"), node("n3", "n4"), node("n4")] };
    expect(treeProblems(bad).join()).toContain('"n4" has more than one parent');
  });

  it("rejects a cycle back to the root", () => {
    const bad: Tree = { root: "n1", nodes: [node("n1", "n2"), node("n2", "n1")] };
    expect(treeProblems(bad).join()).toContain('Root "n1" has a parent');
  });

  it("rejects a detached cycle (no node reachable twice from the root, but not all reachable)", () => {
    const bad: Tree = { root: "n1", nodes: [node("n1"), node("n2", "n3"), node("n3", "n2")] };
    expect(treeProblems(bad).join()).toContain("not reachable from the root");
  });

  it("rejects a second root and an invalid root", () => {
    expect(treeProblems({ root: "n1", nodes: [node("n1"), node("n2")] }).join()).toContain("not reachable");
    expect(treeProblems({ root: "n9", nodes: [node("n1")] }).join()).toContain('Root "n9" is not a node');
  });

  it("rejects the same child in both slots", () => {
    const bad: Tree = { root: "n1", nodes: [node("n1", "n2", "n2"), node("n2")] };
    expect(treeProblems(bad).join()).toContain("both children");
  });

  it("enforces size and depth limits", () => {
    const chain = treeFromShape({ v: 1, l: { v: 2, l: { v: 3, l: { v: 4 } } } });
    expect(treeProblems(chain, { maxNodes: 9, maxLevels: 3 }).join()).toContain("4 levels tall");
    expect(treeProblems(tree, { maxNodes: 5, maxLevels: 5 }).join()).toContain("6 nodes");
  });

  it("treeFromShape throws on duplicate values (which would duplicate ids)", () => {
    expect(() => treeFromShape({ v: 1, l: { v: 1 } })).toThrow(TreeError);
  });
});

describe("tree structure", () => {
  it("measures height in edges, as OpenDSA and algs4 do", () => {
    expect(levels(tree)).toBe(3);
    expect(height(tree)).toBe(2);
    expect(height(treeFromShape({ v: 1 }))).toBe(0);
  });

  it("finds leaves left to right, parents, paths and subtrees", () => {
    expect(leaves(tree).map((n) => n.value)).toEqual([8, 1, 5]);
    expect(parentOf(tree, "n8")?.id).toBe("n3");
    expect(parentOf(tree, "n7")).toBeUndefined();
    expect(pathTo(tree, "n5")).toEqual(["n7", "n9", "n5"]);
    expect(subtreeOf(tree, "n3")).toEqual(["n3", "n8", "n1"]);
  });
});

describe("traversals", () => {
  it("computes preorder, inorder and postorder", () => {
    expect(traversal(tree, "preorder")).toEqual([7, 3, 8, 1, 9, 5]);
    expect(traversal(tree, "inorder")).toEqual([8, 3, 1, 7, 9, 5]);
    expect(traversal(tree, "postorder")).toEqual([8, 1, 3, 5, 9, 7]);
  });

  it("makes exactly the same calls in every order; only the visits move", () => {
    const calls = (order: (typeof TRAVERSAL_ORDERS)[number]) =>
      traceDfs(tree, order).snapshots.flatMap((s) => (s.kind === "enter" ? [s.node] : s.kind === "null" ? [`null@${s.parent}.${s.side}`] : []));
    expect(calls("inorder")).toEqual(calls("preorder"));
    expect(calls("postorder")).toEqual(calls("preorder"));
  });
});

describe("DFS trace", () => {
  const trace = traceDfs(tree, "preorder");
  const count = (kind: string) => trace.snapshots.filter((s) => s.kind === kind).length;

  it("enters and visits each node once, and calls dfs(null) once per empty slot (n + 1)", () => {
    expect(count("enter")).toBe(6);
    expect(count("visit")).toBe(6);
    expect(count("null")).toBe(7);
    expect(count("return")).toBe(5);
    expect(trace.snapshots.at(-1)?.kind).toBe("done");
  });

  it("keeps the active path a chain from the root, topped by the current call", () => {
    for (const snapshot of trace.snapshots) {
      if (snapshot.path.length > 0) expect(snapshot.path[0]).toBe("n7");
      snapshot.path.slice(1).forEach((id, i) => expect(parentOf(tree, id)?.id).toBe(snapshot.path[i]));
      if (snapshot.kind === "enter" || snapshot.kind === "visit") expect(snapshot.path.at(-1)).toBe(snapshot.node);
    }
  });

  it("reaches the null base case under a leaf with the leaf on top of the path", () => {
    const nulls = trace.snapshots.filter((s) => s.kind === "null");
    expect(nulls[0]).toMatchObject({ parent: "n8", side: "left", path: ["n7", "n3", "n8"] });
    expect(nulls[1]).toMatchObject({ parent: "n8", side: "right" });
  });

  it("returns to the parent after a child finishes", () => {
    const back = trace.snapshots.find((s) => s.kind === "return" && s.from === "n8");
    expect(back).toMatchObject({ node: "n3", side: "left", path: ["n7", "n3"] });
  });

  it("finishes the whole left subtree before entering the right", () => {
    const entered = trace.snapshots.flatMap((s) => (s.kind === "enter" ? [s.node] : []));
    expect(entered).toEqual(["n7", "n3", "n8", "n1", "n9", "n5"]);
  });

  it("records visits in order, and only postorder visits a parent after its children", () => {
    expect(trace.visitOrder).toEqual(["n7", "n3", "n8", "n1", "n9", "n5"]);
    const postVisits = traceDfs(tree, "postorder").visitOrder;
    expect(postVisits.indexOf("n3")).toBeGreaterThan(postVisits.indexOf("n1"));
    expect(postVisits.at(-1)).toBe("n7");
  });

  it("refuses to trace an invalid tree", () => {
    expect(() => traceDfs({ root: "n1", nodes: [node("n1", "n2")] }, "preorder")).toThrow(TreeError);
  });
});
