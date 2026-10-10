import { z } from "zod";
import {
  actionStatement,
  dfsCode,
  dfsLine,
  dfsVisual,
  narrateVisit,
  orderNames,
  plainTree,
  valuesOf,
} from "@/curriculum/concepts/trees";
import {
  leaves,
  nodeMap,
  orderActions,
  parentOf,
  pathTo,
  traceDfs,
  traversal,
  treeProblems,
  TRAVERSAL_ORDERS,
  type DfsTrace,
  type Tree,
} from "@/lib/domain/tree";
import {
  difficultySchema,
  type ChoiceQuestion,
  type LessonStepInput,
  type NumberListQuestion,
} from "@/lib/learning/schema";
import { hashString, seededRandom, shuffle } from "../random";
import type { ExerciseKindDefinition } from "../types";

/**
 * Binary-tree DFS exercises. A candidate proposes a small tree, a traversal
 * order and a question (`ask`). The tree is validated structurally, every
 * traversal and trace is computed by the tree domain, and the candidate's
 * claimed traversals are checked, never used.
 */

export const TREE_ASKS = ["next-visit", "traversal", "resumes", "path", "leaves", "visit-position"] as const;
export type TreeAsk = (typeof TREE_ASKS)[number];

/** Generated trees stay small enough to trace by eye. */
export const TREE_EXERCISE_LIMITS = { maxNodes: 9, maxLevels: 4 };

const idSchema = z.string().trim().min(1).max(16);

export const treeCandidateSchema = z.object({
  kind: z.literal("tree-dfs"),
  concept: z.literal("trees.dfs"),
  difficulty: difficultySchema,
  tree: z.object({
    root: idSchema,
    nodes: z
      .array(
        z.object({
          id: idSchema,
          value: z.number().int().min(0).max(99),
          left: idSchema.nullable(),
          right: idSchema.nullable(),
        }),
      )
      .min(3)
      .max(TREE_EXERCISE_LIMITS.maxNodes),
  }),
  order: z.enum(TRAVERSAL_ORDERS),
  ask: z.enum(TREE_ASKS),
  /** The node a "resumes" or "path" question is about. */
  focus: idSchema.optional(),
  /** For "next-visit": how many nodes have already been visited (at least two must remain). */
  visited: z.number().int().optional(),
  /** For "visit-position": which of the three body lines is missing. */
  blank: z.enum(["visit", "left", "right"]).optional(),
  /** The generator's claims about the traversals. Verified, never trusted. */
  expected: z.object({
    preorder: z.array(z.number()),
    inorder: z.array(z.number()),
    postorder: z.array(z.number()),
  }),
});

export type TreeCandidate = z.infer<typeof treeCandidateSchema>;

type Truth = { tree: Tree; trace: DfsTrace };

const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

function verify(candidate: TreeCandidate) {
  const tree: Tree = candidate.tree;
  const problems = treeProblems(tree, TREE_EXERCISE_LIMITS);
  if (problems.length > 0) return { ok: false as const, problems };

  const values = tree.nodes.map((node) => node.value);
  if (new Set(values).size !== values.length) {
    problems.push("Node values must be distinct, so answers are unambiguous.");
  }

  const { ask, focus, visited, blank } = candidate;
  const known = nodeMap(tree);
  const uses = { focus: ask === "resumes" || ask === "path", visited: ask === "next-visit", blank: ask === "visit-position" };
  for (const [field, value] of Object.entries({ focus, visited, blank })) {
    const needed = uses[field as keyof typeof uses];
    if (needed && value === undefined) problems.push(`ask "${ask}" needs ${field}.`);
    if (!needed && value !== undefined) problems.push(`ask "${ask}" does not use ${field}.`);
  }
  if (uses.focus && focus !== undefined) {
    if (!known.has(focus)) problems.push(`focus "${focus}" is not a node.`);
    else if (focus === tree.root) problems.push(`focus "${focus}" is the root, which has no caller in the tree.`);
  }
  // At least two nodes must remain unvisited, or "which is next?" has only one possible answer.
  if (uses.visited && visited !== undefined && (visited < 1 || visited > tree.nodes.length - 2)) {
    problems.push(`visited must be between 1 and ${tree.nodes.length - 2}.`);
  }

  for (const order of TRAVERSAL_ORDERS) {
    const actual = traversal(tree, order);
    if (!same(candidate.expected[order], actual)) {
      problems.push(`expected.${order} [${candidate.expected[order].join(", ")}] does not match the actual ${order} [${actual.join(", ")}].`);
    }
  }

  return problems.length > 0
    ? { ok: false as const, problems }
    : { ok: true as const, value: { tree, trace: traceDfs(tree, candidate.order) } };
}

// ---------------------------------------------------------------------------
// Steps

type Draft = { label: string; feedback?: string };

function choice(prompt: string, correct: string, wrong: Draft[], explanation: string, seed: string): ChoiceQuestion {
  const seen = new Set([correct]);
  const distractors = wrong.filter((draft) => {
    if (seen.has(draft.label)) return false;
    seen.add(draft.label);
    return true;
  });
  const right: Draft = { label: correct };
  const ordered = shuffle([right, ...distractors.slice(0, 3)], seededRandom(hashString(seed)));
  const options = ordered.map((draft, i) => ({ id: `option-${i + 1}`, label: draft.label, feedback: draft.feedback }));
  return { kind: "choice", prompt, options, correctOptionId: options[ordered.indexOf(right)].id, explanation };
}

type QuestionStep = {
  mode: "predict" | "solve" | "complete";
  title: string;
  body: string;
  question: ChoiceQuestion | NumberListQuestion;
  visual: LessonStepInput["visual"];
  code: LessonStepInput["code"];
  reveal?: { visual: NonNullable<LessonStepInput["visual"]> };
};

function compile(candidate: TreeCandidate, { tree, trace }: Truth) {
  const fingerprint = fingerprintOf(candidate);
  const { order } = candidate;
  const code = dfsCode(order);
  const byId = nodeMap(tree);
  const value = (id: string) => byId.get(id)!.value;
  const visitIndexes = trace.snapshots.flatMap((s, i) => (s.kind === "visit" ? [i] : []));
  const at = (i: number) => ({
    visual: dfsVisual(tree, trace.snapshots[i]),
    code: { source: code.source, language: code.language, highlight: dfsLine(order, trace.snapshots[i]) },
  });
  const visitSteps = (fromSnapshot: number): LessonStepInput[] =>
    visitIndexes
      .filter((i) => i > fromSnapshot)
      .map((i) => ({ id: `visit-${i}`, mode: "trace", ...narrateVisit(tree, trace, i), ...at(i) }));
  const plainCode = (highlight: number[]) => ({ source: code.source, language: code.language, highlight });

  let question: QuestionStep;
  let rest: LessonStepInput[];

  switch (candidate.ask) {
    case "traversal":
      question = {
        mode: "solve",
        title: `Trace the ${order}.`,
        body: `Follow \`dfs\` from the root. ${orderNames[order]} processes a node ${order === "preorder" ? "before" : order === "inorder" ? "between" : "after"} its subtrees.`,
        visual: plainTree(tree),
        code: plainCode([code.lines.visit]),
        question: {
          kind: "number-list",
          prompt: `Type the ${order} order.`,
          expected: trace.values,
          explanation: `${orderNames[order]}: ${trace.values.join(" ")}.`,
        },
      };
      rest = visitSteps(-1);
      break;

    case "next-visit": {
      const k = candidate.visited!;
      const nextId = trace.visitOrder[k];
      const done = new Set(trace.visitOrder.slice(0, k));
      const others = TRAVERSAL_ORDERS.filter((o) => o !== order);
      const wrong: Draft[] = [
        ...others.flatMap((o) => {
          const id = traceDfs(tree, o).visitOrder[k];
          return id && !done.has(id) ? [{ label: String(value(id)), feedback: `That would be next in ${o}.` }] : [];
        }),
        ...tree.nodes
          .filter((node) => !done.has(node.id) && node.id !== nextId)
          .map((node) => ({ label: String(node.value) })),
      ];
      question = {
        mode: "predict",
        title: "Which node is next?",
        body: `${orderNames[order]} so far: ${valuesOf(tree, trace.visitOrder.slice(0, k)).join(" ")}.`,
        ...at(visitIndexes[k - 1]),
        question: choice(
          `Which node does ${order} visit next?`,
          String(value(nextId)),
          wrong,
          `Next is ${value(nextId)}: ${narrateVisit(tree, trace, visitIndexes[k]).body}`,
          fingerprint,
        ),
        reveal: { visual: dfsVisual(tree, trace.snapshots[visitIndexes[k]]) },
      };
      rest = visitSteps(visitIndexes[k]);
      break;
    }

    case "resumes": {
      const focus = candidate.focus!;
      const parent = parentOf(tree, focus)!;
      const returnIndex = trace.snapshots.findIndex(
        (s) => s.kind === "return" && s.node === parent.id && s.from === focus,
      );
      const focusNode = byId.get(focus)!;
      const sibling = parent.left === focus ? parent.right : parent.left;
      const wrong: Draft[] = [
        ...(parent.id !== tree.root
          ? [{ label: `dfs(${value(tree.root!)})`, feedback: "The root resumes only after its whole subtree is finished; a nearer call is waiting." }]
          : []),
        ...(sibling ? [{ label: `dfs(${value(sibling)})`, feedback: "That is a sibling, not a caller. Siblings never wait on each other." }] : []),
        ...[focusNode.left, focusNode.right].flatMap((child) =>
          child ? [{ label: `dfs(${value(child)})`, feedback: "Its children already returned; they are not on the stack any more." }] : [],
        ),
        { label: "dfs(null)", feedback: "dfs(null) calls return immediately; they never wait for anything." },
      ];
      question = {
        mode: "predict",
        title: "Where does control return?",
        body: `\`dfs(${value(focus)})\` has made both of its calls.`,
        ...at(returnIndex - 1),
        question: choice(
          `\`dfs(${value(focus)})\` returns. Which call resumes?`,
          `dfs(${parent.value})`,
          wrong,
          `Returning pops dfs(${value(focus)}). The frame underneath it, dfs(${parent.value}), continues after the call it made.`,
          fingerprint,
        ),
        reveal: { visual: dfsVisual(tree, trace.snapshots[returnIndex]) },
      };
      rest = visitSteps(returnIndex);
      break;
    }

    case "path": {
      const focus = candidate.focus!;
      const path = pathTo(tree, focus);
      const enterIndex = trace.snapshots.findIndex((s) => s.kind === "enter" && s.node === focus);
      question = {
        mode: "solve",
        title: "Which calls are waiting?",
        body: `\`dfs\` has just been called on ${value(focus)}.`,
        visual: plainTree(tree, { marks: { [focus]: "focus" } }),
        code: plainCode([code.lines.left, code.lines.right]),
        question: {
          kind: "number-list",
          prompt: `While inside \`dfs(${value(focus)})\`, which calls are on the stack? Type their values from the bottom (the root) to the top.`,
          expected: valuesOf(tree, path),
          explanation: `Each call waits for the one it made, so the stack is exactly the path from the root down: ${valuesOf(tree, path).join(" → ")}.`,
        },
      };
      rest = [
        {
          id: "path",
          mode: "trace",
          title: `Inside dfs(${value(focus)}).`,
          body: `The waiting calls form the path from the root: ${valuesOf(tree, path).join(" → ")}.`,
          ...at(enterIndex),
        },
      ];
      break;
    }

    case "leaves": {
      const leafNodes = leaves(tree);
      question = {
        mode: "solve",
        title: "Find the leaves.",
        body: "A leaf has no children: both of its child slots are null.",
        visual: plainTree(tree),
        code: plainCode([]),
        question: {
          kind: "number-list",
          prompt: "Type the leaf values from left to right.",
          expected: leafNodes.map((node) => node.value),
          explanation: `Nodes with no children: ${leafNodes.map((node) => node.value).join(", ")}.`,
        },
      };
      rest = [
        {
          id: "leaves",
          mode: "show",
          title: "The leaves.",
          body: "Every other node has at least one child.",
          visual: plainTree(tree, {
            marks: Object.fromEntries(leafNodes.map((node) => [node.id, "focus"])),
            tags: Object.fromEntries(leafNodes.map((node) => [node.id, "leaf"])),
          }),
        },
      ];
      break;
    }

    case "visit-position": {
      const missing = candidate.blank!;
      const lineOf = { visit: code.lines.visit, left: code.lines.left, right: code.lines.right };
      const correct = actionStatement(missing);
      const wrong: Draft[] = [
        ...(["visit", "left", "right"] as const)
          .filter((action) => action !== missing)
          .map((action) => ({
            label: actionStatement(action),
            feedback: "That line is already in the method; writing it twice changes what is printed.",
          })),
        { label: "return;", feedback: "Returning here would skip the rest of the method." },
      ];
      question = {
        mode: "complete",
        title: "Rebuild the traversal.",
        body: `This method must print the tree in ${order}: ${trace.values.join(" ")}.`,
        visual: dfsVisual(tree, trace.snapshots[trace.snapshots.length - 1], {
          caption: `${order}: ${trace.values.join(" ")}`,
        }),
        code: { source: code.source, language: code.language, highlight: [], blankLine: lineOf[missing] },
        question: choice(
          "Which line is missing?",
          correct,
          wrong,
          `${orderNames[order]} runs ${orderActions[order].map((action) => `\`${actionStatement(action)}\``).join(", then ")}. The missing line is \`${correct}\`.`,
          fingerprint,
        ),
      };
      rest = visitSteps(-1);
      break;
    }
  }

  const first = { id: "question", ...question } as LessonStepInput;
  const steps = [first, ...rest];
  steps[steps.length - 1] = {
    ...steps[steps.length - 1],
    practice: { kind: "tree-dfs", difficulty: candidate.difficulty, skills: [skillOf(candidate)] },
  } as LessonStepInput;

  return {
    difficulty: candidate.difficulty,
    title: `Tree DFS: ${candidate.ask === "traversal" ? order : candidate.ask.replace("-", " ")}`,
    subtitle: "A freshly generated binary tree.",
    steps,
  };
}

/** Compact shape description, e.g. "7(3(8,1),9(,5))". */
export function shapeOf(tree: Tree): string {
  const byId = nodeMap(tree);
  const write = (id: string | null): string => {
    const node = id === null ? undefined : byId.get(id);
    if (!node) return "";
    return node.left || node.right ? `${node.value}(${write(node.left)},${write(node.right)})` : `${node.value}`;
  };
  return write(tree.root);
}

function skillOf(candidate: TreeCandidate): string {
  return candidate.ask === "traversal" ? candidate.order : candidate.ask;
}

function fingerprintOf(candidate: TreeCandidate): string {
  const extra = candidate.focus ?? candidate.visited ?? candidate.blank ?? "";
  return `tree-dfs:${shapeOf(candidate.tree)}|${candidate.order}|${candidate.ask}|${extra}`;
}

export const treeDfsKind: ExerciseKindDefinition<TreeCandidate, Truth> = {
  id: "tree-dfs",
  concept: "trees.dfs",
  label: "Tree DFS",
  schema: treeCandidateSchema,
  fingerprint: fingerprintOf,
  skill: skillOf,
  verify,
  compile,
};
