import {
  dfsCode,
  dfsLine,
  dfsVisual,
  plainTree,
  treeNodeCode,
} from "@/curriculum/concepts/trees";
import {
  subtreeOf,
  traceDfs,
  treeFromShape,
  type DfsSnapshot,
  type DfsTrace,
} from "@/lib/domain/tree";
import { defineLesson } from "@/lib/learning/validate";

/**
 * The canonical Binary Trees + DFS lesson. It follows OpenDSA's binary tree
 * modules: the recursive definition (empty, or a root with left and right
 * subtrees), left/right as distinct positions with empty subtrees, recursive
 * traversals that check for an empty tree at the start, and preorder,
 * inorder and postorder defined by when the node is visited. Java follows the
 * conventions of algs4's BST.java (node fields; `if (x == null)` first).
 * Every traversal state comes from the tree domain's DFS trace.
 *
 * The canonical tree is deliberately not ordered (8 sits left of 3), so it
 * cannot be mistaken for a binary search tree.
 */

const java = (lines: string[]) => ({ source: lines.join("\n"), language: "java" as const });

const tree = treeFromShape({ v: 7, l: { v: 3, l: { v: 8 }, r: { v: 1 } }, r: { v: 9, r: { v: 5 } } });
const pre = traceDfs(tree, "preorder");
const ino = traceDfs(tree, "inorder");
const post = traceDfs(tree, "postorder");

const preCode = dfsCode("preorder");
const inCode = dfsCode("inorder");
const postCode = dfsCode("postorder");

/** Index of the first snapshot matching `test`. */
function find(trace: DfsTrace, test: (s: DfsSnapshot) => boolean): number {
  const index = trace.snapshots.findIndex(test);
  if (index < 0) throw new Error("snapshot not found");
  return index;
}
const enter = (trace: DfsTrace, node: string) => find(trace, (s) => s.kind === "enter" && s.node === node);
const visit = (trace: DfsTrace, node: string) => find(trace, (s) => s.kind === "visit" && s.node === node);
const back = (trace: DfsTrace, node: string, from: string) =>
  find(trace, (s) => s.kind === "return" && s.node === node && s.from === from);
const nullAt = (trace: DfsTrace, parent: string, side: "left" | "right") =>
  find(trace, (s) => s.kind === "null" && s.parent === parent && s.side === side);
const last = (trace: DfsTrace) => trace.snapshots.length - 1;

/** Visual + highlighted line for a preorder snapshot. */
const at = (index: number) => ({
  visual: dfsVisual(tree, pre.snapshots[index]),
  code: { ...preCode, highlight: dfsLine("preorder", pre.snapshots[index]) },
});

// A chain: same idea, but every node has only a right child.
const chain = treeFromShape({ v: 4, r: { v: 6, r: { v: 2, r: { v: 9, r: { v: 7 } } } } }, "c");
const chainTrace = traceDfs(chain, "preorder");

// The independent exercise: an unfamiliar, lopsided tree.
const fresh = treeFromShape({ v: 5, l: { v: 2, r: { v: 4, l: { v: 6 } } }, r: { v: 8, l: { v: 1 } } }, "m");
const freshInorder = traceDfs(fresh, "inorder");

const subtreeThree = subtreeOf(tree, "n3");
const subtreeNine = subtreeOf(tree, "n9");
const marksFor = (focus: string[]) =>
  Object.fromEntries(tree.nodes.map((node) => [node.id, focus.includes(node.id) ? ("focus" as const) : ("muted" as const)]));

const countCode = java([
  "int count(TreeNode node) {",
  "    if (node == null) {",
  "        return 0;",
  "    }",
  "    return 1 + count(node.left) + count(node.right);",
  "}",
]);

export const treesLesson = defineLesson({
  id: "trees",
  title: "Binary Trees + DFS",
  subtitle: "Branching data, explored one path at a time.",
  sources: [
    {
      title: "OpenDSA: Binary Trees: Definitions and Properties",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/Binary/BinaryTree.rst",
      role: "concept",
    },
    {
      title: "OpenDSA: Binary Tree as a Recursive Data Structure",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/Binary/RecursiveDS.rst",
      role: "concept",
    },
    {
      title: "OpenDSA: Binary Tree Traversals",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/Binary/BinaryTreeTraversal.rst",
      role: "pedagogy",
    },
    {
      title: "OpenDSA: Writing Recursive Traversals",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/Binary/WritingTraversals.rst",
      role: "pedagogy",
    },
    {
      title: "OpenDSA: The Full Binary Tree Theorem (empty subtrees)",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/Binary/BinaryTreeFullThm.rst",
      role: "concept",
    },
    {
      title: "OpenDSA: Binary Search Trees (contrast only)",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/Binary/BST.rst",
      role: "concept",
    },
    {
      title: "algs4 BST.java (node structure and recursive helpers)",
      url: "https://algs4.cs.princeton.edu/32bst/BST.java.html",
      role: "implementation",
    },
  ],
  steps: [
    // --- Structure ---------------------------------------------------------------
    {
      id: "branching",
      mode: "show",
      title: "Some data branches instead of lining up.",
      body: "An array or a stack is a line: each value has at most one next value. Much data branches instead: a folder holds several folders, and `(a + b) * c` splits around each operator. A binary tree stores branching data. It also sits behind structures you will meet later, such as priority queues and expression trees.",
      visual: plainTree(tree),
    },
    {
      id: "root",
      mode: "show",
      title: "Nodes, edges, and one root at the top.",
      body: "Each circle is a node holding a value. An edge joins a node to a node directly below it. The root is the one node with nothing above it; trees are drawn upside down, root first.",
      visual: plainTree(tree, { marks: { n7: "focus" }, tags: { n7: "root" } }),
      code: { ...treeNodeCode, highlight: [2] },
    },
    {
      id: "predict-children",
      mode: "predict",
      title: "Parents and children.",
      body: "Every node has two child positions: left and right.",
      visual: plainTree(tree, { marks: { n3: "focus" } }),
      code: { ...treeNodeCode, highlight: [3, 4] },
      question: {
        kind: "choice",
        prompt: "Which nodes are 3's children?",
        options: [
          { id: "up", label: "7 and 9", feedback: "7 is 3's parent, and 9 is its sibling." },
          { id: "right", label: "8 and 1" },
          { id: "one", label: "Only 8", feedback: "1 is 3's right child." },
        ],
        correctOptionId: "right",
        explanation: "3's left child is 8 and its right child is 1, so 3 is their parent. `node.left` and `node.right` hold them in Java.",
      },
      reveal: {
        visual: plainTree(tree, {
          marks: { n8: "focus", n1: "focus" },
          tags: { n3: "parent", n8: "left child", n1: "right child" },
        }),
      },
    },
    {
      id: "explain-positions",
      mode: "explain",
      title: "Left and right are positions, not sizes.",
      body: "8 is larger than 3, yet it sits on 3's left.",
      visual: plainTree(tree, { marks: { n3: "focus", n8: "focus" } }),
      question: {
        kind: "choice",
        prompt: "Is this tree broken?",
        options: [
          {
            id: "smaller-left",
            label: "Yes: smaller values must go on the left.",
            feedback: "That ordering rule belongs to a binary search tree, a special kind of binary tree with an extra rule. A plain binary tree has no such rule.",
          },
          { id: "positions", label: "No: in a binary tree, left and right are just positions." },
          {
            id: "larger-right",
            label: "Yes: the larger child must be on the right.",
            feedback: "Nothing about a plain binary tree compares values. That is an extra rule some trees add.",
          },
        ],
        correctOptionId: "positions",
        explanation: "A binary tree only says each node has a left slot and a right slot. Swapping them gives a different tree, but neither position says a value is bigger or smaller.",
      },
    },
    {
      id: "predict-leaves",
      mode: "predict",
      title: "Leaves: the ends of the branches.",
      body: "A leaf is a node with no children at all.",
      visual: plainTree(tree),
      question: {
        kind: "choice",
        prompt: "Which nodes are leaves?",
        options: [
          { id: "five", label: "Only 5", feedback: "8 and 1 have no children either." },
          { id: "right", label: "8, 1 and 5" },
          { id: "nine", label: "9 and 5", feedback: "9 has a right child, 5, so it is not a leaf." },
        ],
        correctOptionId: "right",
        explanation: "A leaf's left and right slots are both empty. Every other node has at least one child.",
      },
      reveal: {
        visual: plainTree(tree, {
          marks: { n8: "focus", n1: "focus", n5: "focus" },
          tags: { n8: "leaf", n1: "leaf", n5: "leaf" },
        }),
      },
    },
    {
      id: "null-child",
      mode: "show",
      title: "A missing child is `null`.",
      body: "9 has a right child, 5, but nothing on its left. In Java that empty slot holds `null`: `node.left == null`. Empty slots are part of the tree's shape; a leaf is simply a node whose `left` and `right` are both `null`.",
      visual: plainTree(tree, { marks: { n9: "focus" }, tags: { n9: "left = null" } }),
      code: { ...treeNodeCode, highlight: [3] },
    },
    {
      id: "subtrees",
      mode: "show",
      title: "Every child is the root of a smaller tree.",
      body: "Hide 7, and the part under 3 is a complete binary tree on its own, rooted at 3. So is the part under 9. A binary tree is either empty, or a root with a left subtree and a right subtree, which are binary trees themselves.",
      visual: plainTree(tree, { marks: marksFor(subtreeThree), tags: { n3: "subtree root" } }),
    },
    {
      id: "solve-subtree",
      mode: "solve",
      title: "Read off a subtree.",
      body: "Find the smaller tree hanging from 9.",
      visual: plainTree(tree, { marks: { n9: "focus" } }),
      question: {
        kind: "number-list",
        prompt: "Type the values in the subtree rooted at 9, starting with its root.",
        expected: subtreeNine.map((id) => tree.nodes.find((n) => n.id === id)!.value),
        explanation: "9 and everything below it: 9 and 5. Its left subtree is empty.",
      },
      reveal: { visual: plainTree(tree, { marks: marksFor(subtreeNine), tags: { n9: "subtree root" } }) },
      practice: { kind: "tree-dfs", difficulty: "intro", skills: ["leaves"] },
    },

    // --- Recursion bridge ------------------------------------------------------------
    {
      id: "explain-two-problems",
      mode: "explain",
      title: "From one smaller problem to two.",
      body: "In the Recursion lesson, factorial(n) handed one smaller problem, factorial(n - 1), to another call.",
      visual: plainTree(tree),
      question: {
        kind: "choice",
        prompt: "For the whole tree rooted at 7, what are the smaller problems?",
        options: [
          {
            id: "rebuild",
            label: "The tree with 7 removed and its children merged",
            feedback: "Nothing needs rebuilding: the two subtrees already are smaller trees.",
          },
          { id: "both", label: "The subtrees rooted at 3 and at 9" },
          {
            id: "left-only",
            label: "Just the subtree rooted at 3",
            feedback: "There are two child subtrees, so there are two smaller problems.",
          },
        ],
        correctOptionId: "both",
        explanation: "A tree contains two smaller trees: its left and right subtrees. So a tree method usually makes two recursive calls where factorial made one.",
      },
      reveal: { visual: plainTree(tree, { marks: { n7: "muted" }, tags: { n3: "left subtree", n9: "right subtree" } }) },
    },
    {
      id: "dfs-code",
      mode: "show",
      title: "`dfs`: handle one node, hand off both subtrees.",
      body: "`if (node == null) return;` is the base case: there is no subtree here. Otherwise `visit(node)` processes this node (prints its value, say) and two recursive calls hand each subtree to another `dfs` call. Each call goes as deep as it can down the left before it ever tries the right: depth-first.",
      visual: plainTree(tree),
      code: { ...preCode, highlight: [2, 3, 5, 6, 7] },
    },
    {
      id: "complete-base",
      mode: "complete",
      title: "Rebuild the base case.",
      body: "When `node` is `null`, there is nothing to process.",
      code: { ...preCode, highlight: [2], blankLine: 3 },
      question: {
        kind: "choice",
        prompt: "What belongs inside the null check?",
        options: [
          {
            id: "visit",
            label: "visit(node);",
            feedback: "There is no node to visit; reading null.val throws NullPointerException.",
          },
          {
            id: "left",
            label: "dfs(node.left);",
            feedback: "node is null, so node.left throws NullPointerException.",
          },
          { id: "return", label: "return;" },
        ],
        correctOptionId: "return",
        explanation: "An empty subtree needs no work, so the call returns at once. Checking at the very start also handles an empty tree, so callers never need to test children before calling.",
      },
    },

    // --- One preorder DFS, traced -------------------------------------------------------
    {
      id: "enter-root",
      mode: "trace",
      title: "`dfs(7)`: the first call.",
      body: "The first call gets the root. 7 is not null, so the call continues. The small stack beside the tree lists the calls in progress.",
      ...at(enter(pre, "n7")),
    },
    {
      id: "visit-root",
      mode: "trace",
      title: "Preorder visits 7 first.",
      body: "`visit(node)` comes before both recursive calls, so 7 is processed the moment its call starts.",
      ...at(visit(pre, "n7")),
    },
    {
      id: "predict-call",
      mode: "predict",
      title: "Which call happens next?",
      body: "`dfs(7)` reaches `dfs(node.left)`.",
      ...at(visit(pre, "n7")),
      question: {
        kind: "choice",
        prompt: "Which call does `dfs(7)` make next?",
        options: [
          { id: "right", label: "dfs(9)", feedback: "The right call waits until the whole left subtree is finished." },
          { id: "left", label: "dfs(3)" },
          { id: "deep", label: "dfs(8)", feedback: "dfs(7) calls its own child; 8 is two levels down." },
        ],
        correctOptionId: "left",
        explanation: "Line 6 is `dfs(node.left)`, and 7's left child is 3. A new call starts on the subtree rooted at 3.",
      },
      reveal: { visual: dfsVisual(tree, pre.snapshots[enter(pre, "n3")]) },
    },
    {
      id: "explain-parent-waits",
      mode: "explain",
      title: "The parent is still there.",
      body: "dfs(3) is now running.",
      ...at(enter(pre, "n3")),
      question: {
        kind: "choice",
        prompt: "While `dfs(3)` runs, what is `dfs(7)` doing?",
        options: [
          {
            id: "gone",
            label: "It has finished; its frame is gone.",
            feedback: "dfs(7) still has its right call to make. It stays on the stack, paused.",
          },
          { id: "waiting", label: "Waiting at its left call, to continue later." },
          { id: "parallel", label: "Running at the same time.", feedback: "Only the top call runs; everything below it waits." },
        ],
        correctOptionId: "waiting",
        explanation: "Exactly as in the Recursion lesson, a caller waits on the call stack until its call returns. dfs(7) will resume right after `dfs(node.left)`.",
      },
    },
    {
      id: "down-left",
      mode: "trace",
      title: "dfs(3) visits 3, then goes left to 8.",
      body: "The same three lines run again, one level down: visit 3, then call `dfs(node.left)` on 8. Now two calls wait: dfs(7) and dfs(3).",
      ...at(enter(pre, "n8")),
    },
    {
      id: "predict-null",
      mode: "predict",
      title: "8 has no children.",
      body: "dfs(8) has visited 8 and reached `dfs(node.left)`.",
      ...at(visit(pre, "n8")),
      question: {
        kind: "choice",
        prompt: "What does `dfs(node.left)` receive inside `dfs(8)`?",
        options: [
          { id: "sibling", label: "1", feedback: "1 is 8's sibling, not its child." },
          { id: "parent", label: "3", feedback: "3 is 8's parent." },
          { id: "null", label: "null" },
        ],
        correctOptionId: "null",
        explanation: "8's left slot is empty, so the call is `dfs(null)`. It hits the base case and returns immediately: there is no subtree here.",
      },
      reveal: { visual: dfsVisual(tree, pre.snapshots[nullAt(pre, "n8", "left")]) },
    },
    {
      id: "null-right",
      mode: "trace",
      title: "Then `dfs(null)` on the right, too.",
      body: "8's right slot is empty as well. Both of dfs(8)'s calls have returned, so dfs(8) is finished.",
      ...at(nullAt(pre, "n8", "right")),
    },
    {
      id: "predict-resume",
      mode: "predict",
      title: "Where does control go now?",
      body: "dfs(8) returns.",
      ...at(nullAt(pre, "n8", "right")),
      question: {
        kind: "choice",
        prompt: "Which call resumes?",
        options: [
          { id: "root", label: "dfs(7)", feedback: "dfs(7) is further down the stack; the nearest waiting call is dfs(3)." },
          { id: "parent", label: "dfs(3)" },
          { id: "sibling", label: "dfs(1)", feedback: "dfs(1) has not been called yet." },
        ],
        correctOptionId: "parent",
        explanation: "Returning pops dfs(8). The call that made it, dfs(3), resumes right after its `dfs(node.left)` line.",
      },
      reveal: { visual: dfsVisual(tree, pre.snapshots[back(pre, "n3", "n8")]) },
      practice: { kind: "tree-dfs", difficulty: "intro", skills: ["resumes", "path"] },
    },
    {
      id: "predict-next-value",
      mode: "predict",
      title: "Left is done; now right.",
      body: "Preorder so far: 7 3 8. dfs(3) moves on to `dfs(node.right)`.",
      ...at(back(pre, "n3", "n8")),
      question: {
        kind: "choice",
        prompt: "Which node is visited next?",
        options: [
          { id: "nine", label: "9", feedback: "dfs(3) still has its right call to make. 9 waits until 3's whole subtree is done." },
          { id: "one", label: "1" },
          { id: "seven", label: "7", feedback: "Every node is visited exactly once, and 7 was first." },
        ],
        correctOptionId: "one",
        explanation: "dfs(3) calls `dfs(node.right)`, which starts on 1 and, in preorder, visits it immediately.",
      },
      reveal: { visual: dfsVisual(tree, pre.snapshots[visit(pre, "n1")]) },
    },
    {
      id: "frame-done",
      mode: "trace",
      title: "Left, return, right, return: dfs(3) is done.",
      body: "dfs(1)'s two null calls return, then dfs(1) returns. dfs(3) has now worked on its left subtree and its right subtree, so it returns too, and dfs(7) resumes after its left call.",
      ...at(back(pre, "n7", "n3")),
    },
    {
      id: "predict-processed",
      mode: "predict",
      title: "Has 9 been visited yet?",
      body: "dfs(7) is back, and its left subtree is completely finished.",
      ...at(back(pre, "n7", "n3")),
      question: {
        kind: "choice",
        prompt: "Has 9 been processed at this point?",
        options: [
          {
            id: "yes",
            label: "Yes: it was visited right after 7.",
            feedback: "Preorder goes deep on the left first. 9 waits until 7's entire left subtree is done.",
          },
          { id: "no", label: "No: dfs(7) is only now making its right call." },
        ],
        correctOptionId: "no",
        explanation: "Nothing on the right has been touched yet. Next, `dfs(node.right)` starts dfs(9), which visits 9 and then its own children.",
      },
      reveal: { visual: dfsVisual(tree, pre.snapshots[visit(pre, "n9")]) },
    },
    {
      id: "preorder-done",
      mode: "trace",
      title: "Preorder: 7 3 8 1 9 5.",
      body: "Every node was visited the moment its call began: the node, then its left subtree, then its right subtree. The stack is empty again.",
      ...at(last(pre)),
      practice: { kind: "tree-dfs", difficulty: "intro", skills: ["next-visit", "preorder"] },
    },

    // --- Moving visit(node) --------------------------------------------------------------
    {
      id: "predict-inorder",
      mode: "predict",
      title: "Move `visit(node)` between the calls.",
      body: "Same calls, same order. Only line 6 changed.",
      visual: plainTree(tree),
      code: { ...inCode, highlight: [inCode.lines.visit] },
      question: {
        kind: "choice",
        prompt: "With `visit(node)` between the two calls, which value is printed first?",
        options: [
          { id: "seven", label: "7", feedback: "7 now waits until its whole left subtree is done." },
          { id: "three", label: "3", feedback: "3 waits for its left subtree, 8, first." },
          { id: "eight", label: "8" },
        ],
        correctOptionId: "eight",
        explanation: "Inorder: left subtree, node, right subtree. The calls go all the way left before anything is printed, giving 8 3 1 7 9 5.",
      },
      reveal: { visual: dfsVisual(tree, ino.snapshots[last(ino)], { caption: "inorder: 8 3 1 7 9 5" }) },
    },
    {
      id: "solve-postorder",
      mode: "solve",
      title: "Now move it after both calls.",
      body: "A node is printed only after both of its subtrees are finished.",
      visual: plainTree(tree),
      code: { ...postCode, highlight: [postCode.lines.visit] },
      question: {
        kind: "number-list",
        prompt: "Type the postorder of this tree.",
        expected: post.values,
        explanation: `Postorder: left, right, node. Each node comes after everything below it, so the root is last: ${post.values.join(" ")}.`,
      },
      reveal: { visual: dfsVisual(tree, post.snapshots[last(post)], { caption: `postorder: ${post.values.join(" ")}` }) },
      practice: { kind: "tree-dfs", difficulty: "standard", skills: ["inorder", "postorder"] },
    },
    {
      id: "explain-same-walk",
      mode: "explain",
      title: "Three orders, one walk.",
      body: "Preorder copies a tree well, because each parent exists before its children. Postorder suits deleting one, because children go before their parent.",
      question: {
        kind: "choice",
        prompt: "Which statement about the three traversals is true?",
        options: [
          {
            id: "branches",
            label: "Inorder explores the branches in a different order.",
            feedback: "All three go left before right; the calls are identical.",
          },
          {
            id: "only-pre",
            label: "Only preorder is depth-first.",
            feedback: "All three are depth-first. They differ only in when a node is processed.",
          },
          { id: "moment", label: "They make exactly the same calls; only the moment of `visit(node)` differs." },
        ],
        correctOptionId: "moment",
        explanation: "Before the calls: preorder. Between them: inorder. After both: postorder. The walk is the same; what changes is when each node is processed.",
      },
    },
    {
      id: "complete-visit",
      mode: "complete",
      title: "Place `visit(node)` for inorder.",
      body: "This method must print 8 3 1 7 9 5.",
      visual: dfsVisual(tree, ino.snapshots[last(ino)], { caption: "target: 8 3 1 7 9 5" }),
      code: { ...inCode, highlight: [], blankLine: inCode.lines.visit },
      question: {
        kind: "choice",
        prompt: "Which line goes in the gap?",
        options: [
          {
            id: "left-again",
            label: "dfs(node.left);",
            feedback: "Line 5 already calls left; calling it twice never reaches the right subtree.",
          },
          { id: "visit", label: "visit(node);" },
          { id: "return", label: "return;", feedback: "Returning here would skip the right subtree." },
          {
            id: "right-twice",
            label: "dfs(node.right);",
            feedback: "Line 7 already calls right; nothing would ever be printed.",
          },
        ],
        correctOptionId: "visit",
        explanation: "Inorder processes a node after its left subtree and before its right one, so `visit(node)` sits between the calls.",
      },
      practice: { kind: "tree-dfs", difficulty: "standard", skills: ["visit-position"] },
    },

    // --- Cost ---------------------------------------------------------------------------
    {
      id: "time",
      mode: "show",
      title: "Time: O(n).",
      body: "Every node gets exactly one `dfs` call and one visit. Every empty slot gets one quick `dfs(null)` call, and a tree with n nodes has exactly n + 1 empty slots. So the total work grows in step with n: O(n).",
      ...at(last(pre)),
    },
    {
      id: "space-balanced",
      mode: "show",
      title: "Space: only the current path is waiting.",
      body: "At any moment, the calls in progress are one path from the root down. Here the longest path is 7 → 3 → 8: the tree's height is 2 edges, so the stack never holds more than 3 dfs calls, plus a brief dfs(null).",
      ...at(nullAt(pre, "n8", "left")),
    },
    {
      id: "predict-chain",
      mode: "solve",
      title: "Same idea, different shape.",
      body: "This tree also has few nodes, but each one has only a right child.",
      visual: plainTree(chain),
      code: { ...preCode, highlight: [7] },
      question: {
        kind: "number-list",
        prompt: "At its deepest point, how many dfs calls (not counting dfs(null)) are on the stack at once?",
        expected: [chain.nodes.length],
        explanation: "Every node is on the one long path, so all 5 calls wait at once. Stack space is O(h), where h is the height: a bushy tree keeps paths short, and a chain makes the path as long as the tree.",
      },
      reveal: { visual: dfsVisual(chain, chainTrace.snapshots[enter(chainTrace, "c7")]) },
    },

    // --- Practice, recognize, transfer ------------------------------------------------------
    {
      id: "solve-inorder",
      mode: "solve",
      title: "A new tree, on your own.",
      body: "No walkthrough this time. Remember: left subtree, node, right subtree.",
      visual: plainTree(fresh),
      code: { ...inCode, highlight: [inCode.lines.visit] },
      question: {
        kind: "number-list",
        prompt: "Type the inorder of this tree.",
        expected: freshInorder.values,
        explanation: `2 has no left child, so it is printed first; 4's left child 6 comes before 4. Inorder: ${freshInorder.values.join(" ")}.`,
      },
      reveal: {
        visual: dfsVisual(fresh, freshInorder.snapshots[last(freshInorder)], {
          caption: `inorder: ${freshInorder.values.join(" ")}`,
        }),
      },
      practice: { kind: "tree-dfs", difficulty: "standard", skills: ["preorder", "inorder", "postorder"] },
    },
    {
      id: "recognize",
      mode: "explain",
      title: "When is tree DFS the right tool?",
      body: "Tree DFS fits when you have to inspect every node, search downward, follow root-to-leaf paths, or build a node's answer from the answers of its left and right subtrees.",
      question: {
        kind: "choice",
        prompt: "Which task is a natural fit for recursive tree DFS?",
        options: [
          {
            id: "array",
            label: "Read the 3rd value of an array",
            feedback: "An array reaches any index directly; there is nothing to traverse.",
          },
          {
            id: "queue",
            label: "Serve customers in the order they arrived",
            feedback: "Arrival order is a queue's job, not a tree's.",
          },
          { id: "count", label: "Count the nodes in a tree: 1 plus the counts of its two subtrees" },
        ],
        correctOptionId: "count",
        explanation: "Counting needs every node, and a node's answer is built from its subtrees' answers: exactly the recursive shape of DFS.",
      },
    },
    {
      id: "transfer-count",
      mode: "complete",
      title: "New problem: count the nodes.",
      body: "Trust each recursive call to count its own subtree. An empty tree has 0 nodes.",
      visual: plainTree(tree, { caption: "count(root) should be 6" }),
      code: { ...countCode, highlight: [2, 3], blankLine: 5 },
      question: {
        kind: "choice",
        prompt: "Which line completes `count`?",
        options: [
          {
            id: "no-self",
            label: "return count(node.left) + count(node.right);",
            feedback: "This never counts the node itself, so every answer adds up to 0.",
          },
          {
            id: "left-only",
            label: "return 1 + count(node.left);",
            feedback: "That ignores every right subtree: it would count only 7, 3 and 8.",
          },
          { id: "right", label: "return 1 + count(node.left) + count(node.right);" },
          {
            id: "self-only",
            label: "return 1;",
            feedback: "That counts this node and ignores both subtrees.",
          },
        ],
        correctOptionId: "right",
        explanation: "This node contributes 1; each subtree's count comes back from a recursive call; null contributes 0. Combining left and right results like this is the core pattern of tree DFS.",
      },
    },
  ],
});
