import { insertAt, itemsFromValues, removeAt, valuesOf } from "@/lib/domain/array";
import {
  recursiveFunctions,
  traceRecursion,
  type RecursiveFunctionId,
} from "@/lib/domain/recursion";
import {
  traversal,
  TRAVERSAL_ORDERS,
  type TraversalOrder,
  type Tree,
  type TreeNode,
} from "@/lib/domain/tree";
import {
  runOperations,
  stackFromValues,
  stackValues,
  type StackOperation,
} from "@/lib/domain/stack";
import { EXERCISE_SKILLS, type Difficulty, type ExerciseKindId } from "@/lib/learning/schema";
import {
  arrayInsertionKind,
  type ArrayInsertionCandidate,
} from "./kinds/arrayInsertion";
import { arrayRemovalKind, type ArrayRemovalCandidate } from "./kinds/arrayRemoval";
import {
  RECURSION_ASKS,
  recursionTraceKind,
  type RecursionAsk,
  type RecursionCandidate,
} from "./kinds/recursionTrace";
import {
  TREE_EXERCISE_LIMITS,
  treeDfsKind,
  type TreeAsk,
  type TreeCandidate,
} from "./kinds/treeDfs";
import {
  MAX_STACK_SIZE,
  STACK_ASKS,
  stackOperationsKind,
  type StackAsk,
  type StackCandidate,
} from "./kinds/stackOperations";
import { distinctInts, randomInt, type Random } from "./random";
import type { ExerciseGenerator, ExerciseRequest } from "./types";

/**
 * A local stand-in for an LLM provider. It invents fresh inputs within
 * pedagogically sensible bounds and emits a candidate in exactly the shape a
 * remote model would. Its output still goes through the full truth gate.
 */

type InsertionProfile = {
  length: [number, number];
  values: [number, number];
  /** Picks an insertion index for an array of the given length. */
  index: (random: Random, length: number) => number;
};

const insertionProfiles: Record<Difficulty, InsertionProfile> = {
  // Short arrays, an insertion point with values on both sides.
  intro: {
    length: [4, 5],
    values: [1, 9],
    index: (random, length) => randomInt(random, 1, length - 1),
  },
  // Longer arrays; the front is fair game.
  standard: {
    length: [5, 6],
    values: [1, 20],
    index: (random, length) => randomInt(random, 0, length - 1),
  },
  // Edge cases half the time: insert at the front or append at the end.
  challenge: {
    length: [5, 7],
    values: [-9, 30],
    index: (random, length) =>
      random() < 0.5
        ? (random() < 0.5 ? 0 : length)
        : randomInt(random, 0, length),
  },
};

function arrayInsertionCandidate(
  difficulty: Difficulty,
  random: Random,
): ArrayInsertionCandidate {
  const profile = insertionProfiles[difficulty];
  const length = randomInt(random, ...profile.length);
  const [value, ...initial] = distinctInts(random, length + 1, ...profile.values);
  const index = profile.index(random, length);

  // Like a model would, the generator states its own expectations. The
  // pipeline recomputes them independently and rejects any mismatch.
  const outcome = insertAt(itemsFromValues(initial), index, value, "new");
  return {
    kind: "array-insertion",
    concept: "arrays.insertion",
    difficulty,
    initial,
    operation: { type: "insert", index, value },
    expected: {
      result: valuesOf(outcome.after) as number[],
      shifted: valuesOf(outcome.shifted) as number[],
    },
  };
}

type RemovalProfile = {
  length: [number, number];
  index: (random: Random, length: number) => number;
};

const removalProfiles: Record<Difficulty, RemovalProfile> = {
  // Values on both sides of the removed slot.
  intro: { length: [4, 5], index: (random, length) => randomInt(random, 1, length - 2) },
  standard: { length: [5, 6], index: (random, length) => randomInt(random, 0, length - 1) },
  // Edge cases half the time: the first or the last slot.
  challenge: {
    length: [5, 7],
    index: (random, length) =>
      random() < 0.5 ? (random() < 0.5 ? 0 : length - 1) : randomInt(random, 0, length - 1),
  },
};

function arrayRemovalCandidate(difficulty: Difficulty, random: Random): ArrayRemovalCandidate {
  const profile = removalProfiles[difficulty];
  const length = randomInt(random, ...profile.length);
  const initial = distinctInts(random, length, 1, 20);
  const index = profile.index(random, length);
  const outcome = removeAt(itemsFromValues(initial), index);
  return {
    kind: "array-removal",
    concept: "arrays.removal",
    difficulty,
    initial,
    operation: { type: "remove", index },
    expected: {
      result: valuesOf(outcome.after) as number[],
      removed: outcome.removed.value as number,
      shifted: valuesOf(outcome.shifted) as number[],
    },
  };
}

type StackProfile = {
  initial: [number, number];
  operations: [number, number];
  asks: StackAsk[];
};

const stackProfiles: Record<Difficulty, StackProfile> = {
  // One operation on a small stack: push, pop or peek, then predict.
  intro: { initial: [3, 4], operations: [1, 1], asks: ["top", "popped", "peek"] },
  // A short sequence, or "which line did this?".
  standard: {
    initial: [1, 4],
    operations: [2, 3],
    asks: ["top", "popped", "peek", "final", "operation"],
  },
  // Longer sequences, possibly from empty; typed answers.
  challenge: { initial: [0, 3], operations: [3, 5], asks: ["final", "popped", "top"] },
};

/**
 * The questions to draw from: the difficulty's usual mix, narrowed to the
 * requested skills. If the difficulty never asks a requested skill, the
 * request wins, so practice always drills what was asked for.
 */
function allowedAsks<A extends string>(usual: readonly A[], all: readonly A[], skills?: string[]): A[] {
  if (!skills) return [...usual];
  const narrowed = usual.filter((ask) => skills.includes(ask));
  return narrowed.length > 0 ? narrowed : all.filter((ask) => skills.includes(ask));
}

function stackCandidate(difficulty: Difficulty, random: Random, skills?: string[]): StackCandidate {
  const profile = {
    ...stackProfiles[difficulty],
    asks: allowedAsks(stackProfiles[difficulty].asks, STACK_ASKS, skills),
  };
  // Rejection sampling: draw sequences until one supports the chosen question.
  for (let attempt = 0; attempt < 1000; attempt++) {
    const ask = profile.asks[randomInt(random, 0, profile.asks.length - 1)];
    const length = randomInt(random, ...profile.initial);
    const count = ask === "operation" ? 1 : randomInt(random, ...profile.operations);
    const values = distinctInts(random, length + count, 1, 30);
    const initial = values.slice(0, length);
    let fresh = values.slice(length);

    const operations: StackOperation[] = [];
    let size = initial.length;
    for (let i = 0; i < count; i++) {
      const lastOp = i === count - 1;
      const options: StackOperation["type"][] = [];
      if (size < MAX_STACK_SIZE) options.push("push");
      if (size > 0) options.push("pop", "pop");
      if (size > 0 && ask !== "operation") options.push("peek");
      // Steer the final operation toward the question being asked.
      const type =
        lastOp && ask === "peek" && size > 0
          ? "peek"
          : options[randomInt(random, 0, options.length - 1)];
      if (type === "push") {
        operations.push({ type, value: fresh[0] });
        fresh = fresh.slice(1);
        size++;
      } else {
        operations.push({ type });
        if (type === "pop") size--;
      }
    }

    const run = runOperations(stackFromValues(initial), operations);
    const final = stackValues(run.final);
    const valid =
      run.threwAt === undefined &&
      (ask !== "popped" || run.popped.length > 0) &&
      (ask !== "peek" || operations[operations.length - 1].type === "peek") &&
      ((ask !== "top" && ask !== "final") || final.length > 0) &&
      (ask !== "operation" || operations[0].type !== "peek") &&
      // "What is on top after one peek()/pop()?" is a weak question; ask it about a push.
      (ask !== "top" || operations.length > 1 || operations[0].type === "push") &&
      initial.length + operations.filter((op) => op.type === "push").length >= 2;
    if (!valid) continue;

    return {
      kind: "stack-operations",
      concept: "stacks.operations",
      difficulty,
      initial,
      operations,
      ask,
      expected: {
        final,
        popped: run.popped,
        peeked: run.peeked.filter((value): value is number => value !== null),
      },
    };
  }
  throw new Error(`Could not draw a valid ${difficulty} stack sequence.`);
}

type RecursionProfile = {
  inputs: Record<RecursiveFunctionId, [number, number]>;
  asks: RecursionAsk[];
};

const recursionProfiles: Record<Difficulty, RecursionProfile> = {
  // Short traces; one well-defined moment to predict.
  intro: {
    inputs: { factorial: [3, 4], sumTo: [2, 3], countdown: [2, 3], countUp: [2, 3] },
    asks: ["next-call", "base-return", "return-value", "resumes"],
  },
  standard: {
    inputs: { factorial: [3, 5], sumTo: [2, 4], countdown: [2, 4], countUp: [2, 4] },
    asks: ["next-call", "base-return", "return-value", "resumes", "final", "calls", "returns", "printed"],
  },
  // Deeper traces with typed sequences.
  challenge: {
    inputs: { factorial: [4, 5], sumTo: [3, 4], countdown: [3, 4], countUp: [3, 4] },
    asks: ["return-value", "final", "calls", "returns", "printed"],
  },
};

const VALUE_ASKS: readonly RecursionAsk[] = ["base-return", "return-value", "final", "returns"];

function recursionCandidate(
  difficulty: Difficulty,
  random: Random,
  skills?: string[],
): RecursionCandidate {
  const profile = {
    ...recursionProfiles[difficulty],
    asks: allowedAsks(recursionProfiles[difficulty].asks, RECURSION_ASKS, skills),
  };
  const functions = Object.keys(profile.inputs) as RecursiveFunctionId[];
  for (let attempt = 0; attempt < 1000; attempt++) {
    const fn = functions[randomInt(random, 0, functions.length - 1)];
    const ask = profile.asks[randomInt(random, 0, profile.asks.length - 1)];
    const spec = recursiveFunctions[fn];
    if (VALUE_ASKS.includes(ask) && !spec.returnsValue) continue;
    if (ask === "printed" && !spec.prints) continue;

    const input = randomInt(random, ...profile.inputs[fn]);
    const trace = traceRecursion(fn, input);
    const nonBase = trace.calls.slice(0, -1);
    const focus =
      ask === "next-call" || ask === "return-value"
        ? nonBase[randomInt(random, 0, nonBase.length - 1)]
        : ask === "resumes"
          ? trace.calls[randomInt(random, 0, trace.calls.length - 1)]
          : undefined;

    return {
      kind: "recursion-trace",
      concept: "recursion.single-call",
      difficulty,
      function: fn,
      input,
      ask,
      ...(focus === undefined ? {} : { focus }),
      expected: {
        calls: trace.calls,
        returns: trace.returns,
        result: trace.result,
        output: trace.output,
      },
    };
  }
  throw new Error(`Could not draw a valid ${difficulty} recursion exercise.`);
}

type TreeSkill = (typeof EXERCISE_SKILLS)["tree-dfs"][number];

type TreeProfile = {
  nodes: [number, number];
  /** How far below the shallowest open slot a new node may go (0 = fill level by level). */
  slack: number;
  skills: TreeSkill[];
  /** Orders used by questions that are not about one specific traversal. */
  orders: TraversalOrder[];
};

const treeProfiles: Record<Difficulty, TreeProfile> = {
  // Near-complete small trees; preorder only.
  intro: {
    nodes: [5, 6],
    slack: 0,
    skills: ["next-visit", "preorder", "leaves", "resumes", "path"],
    orders: ["preorder"],
  },
  standard: {
    nodes: [6, 7],
    slack: 1,
    skills: ["next-visit", "preorder", "inorder", "postorder", "resumes", "path", "leaves", "visit-position"],
    orders: ["preorder", "inorder", "postorder"],
  },
  // Lopsided shapes allowed; inorder and postorder.
  challenge: {
    nodes: [6, 8],
    slack: TREE_EXERCISE_LIMITS.maxLevels,
    skills: ["inorder", "postorder", "next-visit", "visit-position", "resumes"],
    orders: ["inorder", "postorder"],
  },
};

/** Grows a random tree by repeatedly filling an open child slot. */
function randomTree(random: Random, size: number, slack: number): Tree {
  const values = distinctInts(random, size, 1, 30);
  const nodes: TreeNode[] = [{ id: "t0", value: values[0], left: null, right: null }];
  let open = [
    { parent: 0, side: "left" as const, depth: 2 },
    { parent: 0, side: "right" as const, depth: 2 },
  ];
  for (let k = 1; k < size; k++) {
    const shallowest = Math.min(...open.map((slot) => slot.depth));
    const candidates = open.filter((slot) => slot.depth <= shallowest + slack);
    const slot = candidates[randomInt(random, 0, candidates.length - 1)];
    const node: TreeNode = { id: `t${k}`, value: values[k], left: null, right: null };
    nodes[slot.parent][slot.side] = node.id;
    nodes.push(node);
    open = open.filter((s) => s !== slot);
    if (slot.depth < TREE_EXERCISE_LIMITS.maxLevels) {
      open.push({ parent: k, side: "left", depth: slot.depth + 1 }, { parent: k, side: "right", depth: slot.depth + 1 });
    }
  }
  return { root: "t0", nodes };
}

function treeCandidate(difficulty: Difficulty, random: Random, skills?: string[]): TreeCandidate {
  const profile = treeProfiles[difficulty];
  const pool = allowedAsks(profile.skills, EXERCISE_SKILLS["tree-dfs"], skills);
  const skill = pool[randomInt(random, 0, pool.length - 1)];
  const isOrder = (TRAVERSAL_ORDERS as readonly string[]).includes(skill);
  const ask: TreeAsk = isOrder ? "traversal" : (skill as TreeAsk);
  const order = isOrder ? (skill as TraversalOrder) : profile.orders[randomInt(random, 0, profile.orders.length - 1)];

  const tree = randomTree(random, randomInt(random, ...profile.nodes), profile.slack);
  const nonRoot = tree.nodes.slice(1).map((node) => node.id);
  const extra =
    ask === "resumes" || ask === "path"
      ? { focus: nonRoot[randomInt(random, 0, nonRoot.length - 1)] }
      : ask === "next-visit"
        ? { visited: randomInt(random, 1, tree.nodes.length - 2) }
        : ask === "visit-position"
          ? { blank: (["visit", "left", "right"] as const)[randomInt(random, 0, 2)] }
          : {};

  // Like a model would, the generator states the traversals it expects.
  return {
    kind: "tree-dfs",
    concept: "trees.dfs",
    difficulty,
    tree: { root: tree.root!, nodes: tree.nodes },
    order,
    ask,
    ...extra,
    expected: {
      preorder: traversal(tree, "preorder"),
      inorder: traversal(tree, "inorder"),
      postorder: traversal(tree, "postorder"),
    },
  };
}

/** Each factory returns a candidate plus the fingerprint used to avoid repeats. */
type LocalFactory = (
  difficulty: Difficulty,
  random: Random,
  skills?: string[],
) => { candidate: unknown; fingerprint: string };

const factories: Record<ExerciseKindId, LocalFactory> = {
  "array-insertion": (difficulty, random) => {
    const candidate = arrayInsertionCandidate(difficulty, random);
    return { candidate, fingerprint: arrayInsertionKind.fingerprint(candidate) };
  },
  "array-removal": (difficulty, random) => {
    const candidate = arrayRemovalCandidate(difficulty, random);
    return { candidate, fingerprint: arrayRemovalKind.fingerprint(candidate) };
  },
  "stack-operations": (difficulty, random, skills) => {
    const candidate = stackCandidate(difficulty, random, skills);
    return { candidate, fingerprint: stackOperationsKind.fingerprint(candidate) };
  },
  "recursion-trace": (difficulty, random, skills) => {
    const candidate = recursionCandidate(difficulty, random, skills);
    return { candidate, fingerprint: recursionTraceKind.fingerprint(candidate) };
  },
  "tree-dfs": (difficulty, random, skills) => {
    const candidate = treeCandidate(difficulty, random, skills);
    return { candidate, fingerprint: treeDfsKind.fingerprint(candidate) };
  },
};

export function createLocalGenerator(random: Random = Math.random): ExerciseGenerator {
  return {
    name: "local",
    async generate(request: ExerciseRequest) {
      const create = factories[request.kind];
      const avoid = new Set(request.avoid ?? []);

      // Re-roll a few times so a repeat of an earlier example is unlikely.
      let draft = create(request.difficulty, random, request.skills);
      for (let i = 0; i < 10 && avoid.has(draft.fingerprint); i++) {
        draft = create(request.difficulty, random, request.skills);
      }
      return draft.candidate;
    },
  };
}
