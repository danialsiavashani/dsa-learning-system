import { z } from "zod";
import { describeLine, javaCall, stepVisual, type QueueVariant } from "@/curriculum/concepts/queue";
import {
  applyOperation,
  dequeRemovalPlan,
  describeOperation,
  OPERATION_SEMANTICS,
  queueFromValues,
  queueValues,
  runOperations,
  simplestDiscipline,
  type DequeOperation,
  type DequeRun,
  type Discipline,
  type End,
  type QueueItem,
} from "@/lib/domain/queue";
import { runOperations as runStack } from "@/lib/domain/stack";
import { listValues } from "@/lib/learning/format";
import {
  difficultySchema,
  EXERCISE_SKILLS,
  type ChoiceQuestion,
  type ExerciseKindId,
  type LessonStepInput,
} from "@/lib/learning/schema";
import { hashString, seededRandom, shuffle } from "../random";
import type { ExerciseKindDefinition } from "../types";
import { choice, type Draft } from "./stackOperations";

/**
 * Queue and deque exercises on a Java `ArrayDeque`.
 *
 * Most candidates are a starting line (front → back), a short sequence of
 * operations and one question about it (`ask`). Recognition candidates instead
 * give an arrival order and a required service order, and ask which structure
 * produces it. Either way the candidate's claims (`expected`) are checked
 * against the queue domain, and every answer key is derived here.
 *
 * Queue exercises only use offer/poll/peek; deque exercises use the explicit
 * First/Last methods and must use an end a plain queue cannot.
 */

export const QUEUE_ASKS = EXERCISE_SKILLS["queue-operations"];
export const DEQUE_ASKS = EXERCISE_SKILLS["deque-operations"];
export type QueueAsk = (typeof QUEUE_ASKS)[number];
export type DequeAsk = (typeof DEQUE_ASKS)[number];

const QUEUE_SEQUENCE_ASKS = ["dequeued", "peek", "front", "back", "final", "operation"] as const satisfies readonly QueueAsk[];
const DEQUE_SEQUENCE_ASKS = ["after-add", "removed", "final", "end-operation"] as const satisfies readonly DequeAsk[];

/** Most values waiting at once, so the line fits the visualizer on a phone. */
export const MAX_QUEUE_SIZE = 6;

const valueSchema = z.number().int().min(-99).max(99);

const queueOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("offer"), value: valueSchema }),
  z.object({ type: z.literal("poll") }),
  z.object({ type: z.literal("peek") }),
]);

const dequeOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.enum(["addFirst", "addLast"]), value: valueSchema }),
  z.object({ type: z.enum(["pollFirst", "pollLast", "peekFirst", "peekLast"]) }),
]);

/** The generator's claims about a sequence. Verified, never trusted. */
const sequenceExpectedSchema = z.object({
  final: z.array(z.number()),
  removed: z.array(z.number()),
  examined: z.array(z.number()),
});

const framing = z.string().trim().min(1).max(160).optional();

const recognitionFields = {
  difficulty: difficultySchema,
  /** The order values arrive in. */
  arrivals: z.array(valueSchema).min(3).max(5),
  /** The order they must be handled in. */
  required: z.array(valueSchema).min(3).max(5),
  expected: z.object({ structure: z.enum(["queue", "stack", "deque"]) }),
  framing,
};

export const queueCandidateSchema = z.discriminatedUnion("ask", [
  z.object({
    kind: z.literal("queue-operations"),
    concept: z.literal("queues.operations"),
    difficulty: difficultySchema,
    /** Front → back. */
    initial: z.array(valueSchema).max(5),
    operations: z.array(queueOperationSchema).min(1).max(6),
    ask: z.enum(QUEUE_SEQUENCE_ASKS),
    expected: sequenceExpectedSchema,
    framing,
  }),
  z.object({
    kind: z.literal("queue-operations"),
    concept: z.literal("queues.operations"),
    ask: z.literal("stack-or-queue"),
    ...recognitionFields,
  }),
]);

export const dequeCandidateSchema = z.discriminatedUnion("ask", [
  z.object({
    kind: z.literal("deque-operations"),
    concept: z.literal("deques.operations"),
    difficulty: difficultySchema,
    initial: z.array(valueSchema).max(5),
    operations: z.array(dequeOperationSchema).min(1).max(6),
    ask: z.enum(DEQUE_SEQUENCE_ASKS),
    expected: sequenceExpectedSchema,
    framing,
  }),
  z.object({
    kind: z.literal("deque-operations"),
    concept: z.literal("deques.operations"),
    ask: z.literal("queue-or-deque"),
    ...recognitionFields,
  }),
]);

export type QueueCandidate = z.infer<typeof queueCandidateSchema>;
export type DequeCandidate = z.infer<typeof dequeCandidateSchema>;
type AnyCandidate = QueueCandidate | DequeCandidate;
type SequenceCandidate = Extract<AnyCandidate, { operations: unknown }>;
type RecognitionCandidate = Extract<AnyCandidate, { arrivals: unknown }>;

type SequenceTruth = { mode: "sequence"; initial: QueueItem<number>[]; run: DequeRun<number> };
type RecognitionTruth = { mode: "recognition"; structure: Discipline; plan: End[] };
export type QueueTruth = SequenceTruth | RecognitionTruth;

const isRecognition = (candidate: AnyCandidate): candidate is RecognitionCandidate => "arrivals" in candidate;
const variantOf = (candidate: AnyCandidate): QueueVariant =>
  candidate.kind === "queue-operations" ? "queue" : "deque";

const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

// ---------------------------------------------------------------------------
// Verification

/** Whether the question can be asked of this sequence; null when it can. */
function askProblem(candidate: SequenceCandidate, run: DequeRun<number>): string | null {
  const { ask, operations, initial } = candidate;
  const final = queueValues(run.final);
  const last = operations[operations.length - 1];
  const actions = operations.map((op) => OPERATION_SEMANTICS[op.type].action);
  const single = operations.length === 1 && actions[0] !== "examine";
  switch (ask) {
    case "dequeued":
      return run.removed.length === 0 ? `ask "dequeued" needs at least one poll().` : null;
    case "removed":
      return run.removed.length === 0 ? `ask "removed" needs at least one pollFirst() or pollLast().` : null;
    case "peek":
      return last.type !== "peek" ? `ask "peek" needs the last operation to be peek().` : null;
    case "front":
    case "back":
    case "final":
      return final.length === 0 ? `ask "${ask}" needs a non-empty final ${variantOf(candidate)}.` : null;
    case "after-add":
      return actions.some((action) => action !== "add")
        ? `ask "after-add" needs only addFirst()/addLast() operations.`
        : null;
    case "operation":
    case "end-operation":
      // With fewer than two values, different ends can give the same result.
      return !single || initial.length < 2
        ? `ask "${ask}" needs exactly one add or remove, starting from at least two values.`
        : null;
  }
}

function verifySequence(candidate: SequenceCandidate) {
  const { initial, operations, expected } = candidate;
  const noun = variantOf(candidate);
  const problems: string[] = [];

  const added = operations.flatMap((op) => ("value" in op ? [op.value] : []));
  const all = [...initial, ...added];
  if (new Set(all).size !== all.length) problems.push("Values (initial and added) must be distinct.");
  if (all.length < 2) problems.push("At least two values must be involved, so wrong answers are real alternatives.");

  const items = queueFromValues(initial, "q");
  const run = runOperations(items, operations as DequeOperation<number>[], "n");

  for (const i of run.nulls) {
    const call = describeOperation(operations[i]);
    problems.push(
      `Operation ${i + 1}, ${call}, meets an empty ${noun}: it returns null, which an int cannot hold.`,
    );
  }
  run.steps.forEach((step) => {
    if (step.after.length > MAX_QUEUE_SIZE && !problems.some((p) => p.includes("grows past"))) {
      problems.push(`The ${noun} grows past ${MAX_QUEUE_SIZE} values.`);
    }
  });
  if (noun === "deque" && !operations.some((op) => ["addFirst", "pollLast", "peekLast"].includes(op.type))) {
    problems.push("A deque exercise must use an end a plain queue cannot (addFirst, pollLast or peekLast).");
  }
  if (problems.length > 0) return { ok: false as const, problems };

  const problem = askProblem(candidate, run);
  if (problem) problems.push(problem);

  const final = queueValues(run.final);
  if (!same(expected.final, final)) {
    problems.push(`expected.final [${expected.final.join(", ")}] does not match the actual ${noun} [${final.join(", ")}].`);
  }
  if (!same(expected.removed, run.removed)) {
    problems.push(
      `expected.removed [${expected.removed.join(", ")}] does not match the values removed [${run.removed.join(", ")}].`,
    );
  }
  if (!same(expected.examined, run.examined)) {
    problems.push(
      `expected.examined [${expected.examined.join(", ")}] does not match what peek returns [${run.examined.join(", ")}].`,
    );
  }
  return problems.length > 0
    ? { ok: false as const, problems }
    : { ok: true as const, value: { mode: "sequence" as const, initial: items, run } };
}

function verifyRecognition(candidate: RecognitionCandidate) {
  const { arrivals, required, expected, ask } = candidate;
  const problems: string[] = [];
  if (new Set(arrivals).size !== arrivals.length) problems.push("Arriving values must be distinct.");
  if (!same([...arrivals].sort((a, b) => a - b), [...required].sort((a, b) => a - b))) {
    problems.push("The required order must contain exactly the arriving values.");
  }
  if (problems.length > 0) return { ok: false as const, problems };

  const structure = simplestDiscipline(arrivals, required);
  if (!structure) {
    problems.push("No stack, queue or deque produces that order by taking values from its ends.");
  } else {
    if (ask === "stack-or-queue" && structure === "deque") {
      problems.push("That order needs both ends (a deque), so it cannot be a stack-or-queue question.");
    }
    if (expected.structure !== structure) {
      problems.push(`expected.structure "${expected.structure}" does not match the simplest fit, "${structure}".`);
    }
  }
  return problems.length > 0 || !structure
    ? { ok: false as const, problems }
    : {
        ok: true as const,
        value: { mode: "recognition" as const, structure, plan: dequeRemovalPlan(arrivals, required) ?? [] },
      };
}

function verify(candidate: AnyCandidate) {
  return isRecognition(candidate) ? verifyRecognition(candidate) : verifySequence(candidate);
}

// ---------------------------------------------------------------------------
// Java code

type SequenceCode = { source: string; firstOpLine: number; opLines: string[] };

/** What every sequence question step shares: the starting line and the code. */
type QuestionBase = {
  id: string;
  body: string;
  visual: { kind: "queue"; variant: QueueVariant; items: QueueItem<number>[] };
  code: { source: string; language: "java"; highlight: number[] };
};

const letter = (n: number) => String.fromCharCode(97 + n);

function sequenceCode(candidate: SequenceCandidate): SequenceCode {
  const name = variantOf(candidate);
  const fill = name === "queue" ? "offer" : "addLast";
  const lines = [`Deque<Integer> ${name} = new ArrayDeque<>();`];
  if (candidate.initial.length > 0) {
    lines.push(`for (int v : new int[] {${candidate.initial.join(", ")}}) ${name}.${fill}(v);`);
  }
  const firstOpLine = lines.length + 1;
  // Identifying the operation is the question, so keep its line a bare call.
  const bare = candidate.ask === "operation" || candidate.ask === "end-operation";
  let results = 0;
  const opLines = candidate.operations.map((op) => {
    const call = javaCall(op, name);
    return "value" in op || bare ? `${call};` : `int ${letter(results++)} = ${call};`;
  });
  return { source: [...lines, ...opLines].join("\n"), firstOpLine, opLines };
}

/** The bare call from a Java line: "int a = queue.poll();" → "queue.poll()". */
const callOf = (line: string) => line.replace(/^int \w+ = /, "").replace(/;$/, "");

// ---------------------------------------------------------------------------
// Answer options, derived from the truth

/**
 * Plausible wrong answers when the question is "which value is at `end` of
 * this line?". `otherEnd` explains why the value at the opposite end is wrong.
 */
function misreadings(
  line: readonly number[],
  end: End,
  history: readonly number[],
  otherEnd: (value: number) => string,
  noun: QueueVariant,
): Draft[] {
  const drafts: Draft[] = [];
  if (line.length > 1) {
    const far = end === "front" ? line[line.length - 1] : line[0];
    const next = end === "front" ? line[1] : line[line.length - 2];
    drafts.push({ value: far, feedback: otherEnd(far) });
    drafts.push({ value: next, feedback: `${next} is next to the ${end}, not at it.` });
  }
  for (const value of history) {
    drafts.push({
      value,
      feedback: line.includes(value)
        ? `${value} is in the ${noun}, but not at the ${end}.`
        : `${value} has already left the ${noun}.`,
    });
  }
  return drafts;
}

function sequenceQuestion(
  candidate: SequenceCandidate,
  truth: SequenceTruth,
  code: SequenceCode,
  fingerprint: string,
): LessonStepInput {
  const { run } = truth;
  const noun = variantOf(candidate);
  const final = queueValues(run.final);
  const all = [...candidate.initial, ...candidate.operations.flatMap((op) => ("value" in op ? [op.value] : []))];
  const single = candidate.operations.length === 1;
  const base: QuestionBase = {
    id: "question",
    body: [
      candidate.framing,
      `The ${noun} starts as ${describeLine(candidate.initial, noun)}.`,
      single ? "Predict before it runs." : "Trace the highlighted lines in order.",
    ]
      .filter(Boolean)
      .join(" "),
    visual: { kind: "queue", variant: noun, items: truth.initial },
    code: {
      source: code.source,
      language: "java",
      highlight: code.opLines.map((_, i) => code.firstOpLine + i),
    },
  };
  const newest = (value: number) =>
    `${value} is at the back: it joined most recently. A stack would hand that back first; a queue serves whoever has waited longest.`;

  switch (candidate.ask) {
    case "dequeued":
    case "removed": {
      if (run.removed.length > 1) {
        return {
          ...base,
          mode: "solve",
          title: "Which values leave?",
          question: {
            kind: "number-list",
            prompt: `Type the values the ${noun} hands back, in order.`,
            expected: run.removed,
            explanation:
              noun === "queue"
                ? `Each poll() takes whoever is at the front at that moment: ${listValues(run.removed)}.`
                : `Each removal takes the value at its own end at that moment: ${listValues(run.removed)}.`,
          },
        };
      }
      const index = run.steps.findIndex((step) => step.outcome.type === "remove");
      const step = run.steps[index];
      const end = step.outcome.type === "remove" ? step.outcome.end : "front";
      const answer = run.removed[0];
      const call = callOf(code.opLines[index]);
      return {
        ...base,
        mode: "predict",
        title: single ? `Run \`${call}\`.` : "Which value leaves?",
        question: choice(
          `Which value does \`${call}\` return?`,
          answer,
          misreadings(
            queueValues(step.before),
            end,
            all,
            noun === "queue" ? newest : (value) => `${value} is at the other end; \`${call}\` works at the ${end}.`,
            noun,
          ),
          noun === "queue"
            ? `When that poll() runs, ${answer} has waited longest, so it is at the front and leaves first.`
            : `\`${call}\` takes the value at the ${end}: ${answer}.`,
          fingerprint,
        ),
      };
    }
    case "peek": {
      const last = run.steps[run.steps.length - 1];
      const before = queueValues(last.before);
      const answer = before[0];
      return {
        ...base,
        mode: "predict",
        title: single ? "Peek at the front." : "What does peek see?",
        question: choice(
          `What does \`${callOf(code.opLines[code.opLines.length - 1])}\` return?`,
          answer,
          misreadings(before, "front", all, (value) => `${value} is at the back. peek() reads the front.`, noun),
          `peek() returns the front value, ${answer}, and leaves the queue unchanged.`,
          fingerprint,
        ),
      };
    }
    case "front":
    case "back": {
      const end = candidate.ask;
      const answer = end === "front" ? final[0] : final[final.length - 1];
      return {
        ...base,
        mode: "predict",
        title: `What is at the ${end}?`,
        question: choice(
          `After these lines run, which value is at the ${end}?`,
          answer,
          misreadings(
            final,
            end,
            all,
            (value) =>
              end === "front"
                ? `${value} is at the back: new values join there, not at the front.`
                : `${value} is at the front: it has waited longest, so it is next to leave.`,
            noun,
          ),
          end === "front"
            ? `The front is the value that has waited longest and not yet left: ${answer}.`
            : `The back is the value that joined most recently and has not left: ${answer}.`,
          fingerprint,
        ),
      };
    }
    case "final":
    case "after-add":
      return {
        ...base,
        mode: "solve",
        title: candidate.ask === "after-add" ? "Where do the values go?" : `Trace the ${noun}.`,
        question: {
          kind: "number-list",
          prompt: `Type the ${noun} from front to back after these lines run.`,
          expected: final,
          explanation: `Front to back, the ${noun} ends as {${final.join(", ")}}.`,
        },
      };
    case "operation":
    case "end-operation":
      return operationQuestion(candidate, truth, code, base, fingerprint);
  }
}

/** One missing line; every option is simulated so its feedback is true. */
function operationQuestion(
  candidate: SequenceCandidate,
  truth: SequenceTruth,
  code: SequenceCode,
  base: QuestionBase,
  fingerprint: string,
): LessonStepInput {
  const noun = variantOf(candidate);
  const op = candidate.operations[0];
  const result = queueValues(truth.run.final);
  const correct = code.opLines[0];

  let alternatives: DequeOperation<number>[];
  if (noun === "queue") {
    alternatives =
      op.type === "offer"
        ? [{ type: "poll" }, { type: "peek" }]
        : [{ type: "peek" }, { type: "offer", value: queueValues(truth.initial)[0] }];
  } else {
    alternatives =
      "value" in op
        ? [
            { type: "addFirst", value: op.value },
            { type: "addLast", value: op.value },
            { type: "pollFirst" },
            { type: "pollLast" },
          ]
        : [{ type: "pollFirst" }, { type: "pollLast" }, { type: "peekFirst" }, { type: "peekLast" }];
  }

  const feedbackFor = (alternative: DequeOperation<number>) => {
    const after = queueValues(applyOperation(truth.initial, alternative, "alt").after);
    const { action, end } = OPERATION_SEMANTICS[alternative.type];
    if (action === "examine") return `${describeOperation(alternative)} only reads the ${end}; the ${noun} would not change.`;
    return `That would give ${describeLine(after, noun)}, not ${describeLine(result, noun)}.`;
  };
  const options = [
    { label: correct, feedback: undefined as string | undefined },
    ...alternatives
      .map((alternative) => ({ label: `${javaCall(alternative, noun)};`, feedback: feedbackFor(alternative) }))
      .filter((option) => option.label !== correct),
  ];
  const ordered = shuffle(options, seededRandom(hashString(fingerprint)));
  const question: ChoiceQuestion = {
    kind: "choice",
    prompt: "Which line is missing?",
    options: ordered.map((option, i) => ({ id: `option-${i + 1}`, label: option.label, feedback: option.feedback })),
    correctOptionId: `option-${ordered.findIndex((option) => option.label === correct) + 1}`,
    explanation:
      "value" in op
        ? `Only \`${callOf(correct)}\` adds ${op.value} at the ${OPERATION_SEMANTICS[op.type].end}.`
        : `\`${callOf(correct)}\` removes the value at the ${OPERATION_SEMANTICS[op.type].end}.`,
  };
  return {
    ...base,
    mode: "complete",
    title: noun === "queue" ? "Pick the operation." : "Pick the end.",
    body: [
      candidate.framing,
      `One line turns ${describeLine(candidate.initial, noun)} into ${describeLine(result, noun)}.`,
    ]
      .filter(Boolean)
      .join(" "),
    code: { ...base.code, blankLine: code.firstOpLine, highlight: [] },
    question,
  };
}

function sequenceTraces(candidate: SequenceCandidate, truth: SequenceTruth, code: SequenceCode): LessonStepInput[] {
  const noun = variantOf(candidate);
  return truth.run.steps.map((step, i) => {
    const call = callOf(code.opLines[i]);
    const common = {
      id: `op-${i + 1}`,
      mode: "trace" as const,
      code: { source: code.source, language: "java" as const, highlight: [code.firstOpLine + i] },
      visual: stepVisual(step, noun),
    };
    const { outcome } = step;
    const after = queueValues(step.after);
    switch (outcome.type) {
      case "add": {
        const { value } = outcome.item;
        const neighbour = outcome.end === "back" ? step.before[step.before.length - 1] : step.before[0];
        return {
          ...common,
          title: `\`${call}\` adds ${value} at the ${outcome.end}.`,
          body: neighbour
            ? outcome.end === "back"
              ? `${value} joins behind ${neighbour.value}. Nobody already waiting moves.`
              : `${value} goes in front of ${neighbour.value}, so it is now the first value at the front.`
            : `The ${noun} was empty, so ${value} is both the front and the back.`,
        };
      }
      case "remove": {
        const next = outcome.end === "front" ? after[0] : after[after.length - 1];
        return {
          ...common,
          title: `\`${call}\` returns ${outcome.item.value}.`,
          body: `${outcome.item.value} was at the ${outcome.end}. ${
            next === undefined ? `The ${noun} is now empty.` : `${next} is the new ${outcome.end}.`
          }`,
        };
      }
      case "examine":
        return {
          ...common,
          title: `\`${call}\` returns ${outcome.item.value}.`,
          body: `It reads the ${outcome.end} and leaves the ${noun} unchanged.`,
        };
      case "empty":
        // verify() rejects runs that touch an empty queue.
        throw new Error("Unexpected empty operation in a verified exercise.");
    }
  });
}

// ---------------------------------------------------------------------------
// Recognition: which ordering does the problem require?

const structureLabels: Record<Discipline, string> = {
  queue: "A queue: offer, then poll",
  stack: "A stack: push, then pop",
  deque: "A deque: take from either end",
};

const structureFeedback: Record<Discipline, string> = {
  queue: "A queue hands values back in the order they arrived.",
  stack: "A stack hands values back newest first: the arrival order reversed.",
  deque: "A deque can take from either end, but here one end is all you need; the simpler structure states the rule.",
};

function recognitionQuestion(
  candidate: RecognitionCandidate,
  truth: RecognitionTruth,
  fingerprint: string,
): LessonStepInput {
  const choices: Discipline[] = candidate.ask === "stack-or-queue" ? ["stack", "queue"] : ["stack", "queue", "deque"];
  const ordered = shuffle(choices, seededRandom(hashString(fingerprint)));
  const options = ordered.map((structure, i) => ({
    id: `option-${i + 1}`,
    label: structureLabels[structure],
    feedback:
      structure === truth.structure
        ? undefined
        : structure === "deque"
          ? structureFeedback.deque
          : `${structureFeedback[structure]} That gives ${listValues(
              structure === "queue" ? candidate.arrivals : [...candidate.arrivals].reverse(),
            )}.`,
  }));
  const explanations: Record<Discipline, string> = {
    queue: "The values must leave in exactly the order they arrived: first in, first out. That is a queue.",
    stack: "The values must leave newest first, the arrival order reversed: last in, first out. That is a stack.",
    deque: `Neither arrival order nor its reverse: some values leave from the front, some from the back (${truth.plan.join(", ")}). That needs both ends: a deque.`,
  };
  return {
    id: "question",
    mode: "solve",
    title: "Which ordering does this need?",
    body: [
      candidate.framing,
      `Values arrive in the order ${listValues(candidate.arrivals)}. They must be handled in the order ${listValues(candidate.required)}.`,
    ]
      .filter(Boolean)
      .join(" "),
    visual: {
      kind: "array",
      items: candidate.arrivals.map((value, i) => ({ id: `a${i}`, value })),
      caption: "arrival order, first to last",
    },
    question: {
      kind: "choice",
      prompt:
        candidate.ask === "stack-or-queue"
          ? "Which structure produces that order?"
          : "Which is the simplest structure that produces that order?",
      options,
      correctOptionId: options[ordered.indexOf(truth.structure)].id,
      explanation: explanations[truth.structure],
    },
  };
}

function recognitionTraces(candidate: RecognitionCandidate, truth: RecognitionTruth): LessonStepInput[] {
  const { arrivals } = candidate;
  const list = arrivals.join(", ");
  const java = (lines: string[]) => ({ source: lines.join("\n"), language: "java" as const });

  if (truth.structure === "stack") {
    const run = runStack(
      [],
      [...arrivals.map((value) => ({ type: "push" as const, value })), ...arrivals.map(() => ({ type: "pop" as const }))],
      "a",
    );
    const code = java([
      "Deque<Integer> stack = new ArrayDeque<>();",
      `for (int v : new int[] {${list}}) stack.push(v);`,
      "while (!stack.isEmpty()) {",
      "    System.out.println(stack.pop());",
      "}",
    ]);
    const full = run.steps[arrivals.length - 1].after;
    return [
      {
        id: "arrive",
        mode: "trace",
        title: "Every value is pushed.",
        body: `${arrivals[arrivals.length - 1]}, the last to arrive, is on top.`,
        visual: { kind: "stack", items: full },
        code: { ...code, highlight: [2] },
      },
      ...run.steps.slice(arrivals.length).map((step, i) => {
        const item = step.outcome.type === "pop" ? step.outcome.item : full[0];
        return {
          id: `out-${i + 1}`,
          mode: "trace" as const,
          title: `\`stack.pop()\` hands back ${item.value}.`,
          body: i === arrivals.length - 1 ? `Out came ${listValues(run.popped)}: the required order.` : "The newest value left goes first.",
          visual: { kind: "stack" as const, items: step.after, held: { ...item, label: `pop() → ${item.value}` } },
          code: { ...code, highlight: [4] },
        };
      }),
    ];
  }

  const noun: QueueVariant = truth.structure === "queue" ? "queue" : "deque";
  const add = noun === "queue" ? "offer" : "addLast";
  const removals: DequeOperation<number>[] =
    noun === "queue"
      ? arrivals.map(() => ({ type: "poll" }))
      : truth.plan.map((end) => ({ type: end === "front" ? "pollFirst" : "pollLast" }));
  const run = runOperations(
    [],
    [...arrivals.map((value) => ({ type: add, value }) as DequeOperation<number>), ...removals],
    "a",
  );
  const code = java(
    noun === "queue"
      ? [
          "Deque<Integer> queue = new ArrayDeque<>();",
          `for (int v : new int[] {${list}}) queue.offer(v);`,
          "while (!queue.isEmpty()) {",
          "    System.out.println(queue.poll());",
          "}",
        ]
      : [
          "Deque<Integer> deque = new ArrayDeque<>();",
          `for (int v : new int[] {${list}}) deque.addLast(v);`,
          ...removals.map((op) => `System.out.println(${javaCall(op, "deque")});`),
        ],
  );
  const full = run.steps[arrivals.length - 1].after;
  return [
    {
      id: "arrive",
      mode: "trace",
      title: `Every value joins at the back.`,
      body: `${arrivals[0]}, the first to arrive, is at the front.`,
      visual: { kind: "queue", variant: noun, items: full },
      code: { ...code, highlight: [2] },
    },
    ...run.steps.slice(arrivals.length).map((step, i) => {
      const value = step.outcome.type === "remove" ? step.outcome.item.value : 0;
      const end = OPERATION_SEMANTICS[removals[i].type].end;
      return {
        id: `out-${i + 1}`,
        mode: "trace" as const,
        title: `\`${javaCall(removals[i], noun)}\` hands back ${value}.`,
        body:
          i === arrivals.length - 1
            ? `Out came ${listValues(run.removed)}: the required order.`
            : noun === "queue"
              ? "Whoever has waited longest goes next."
              : `This one is needed from the ${end}.`,
        visual: stepVisual(step, noun),
        code: { ...code, highlight: [noun === "queue" ? 4 : 3 + i] },
      };
    }),
  ];
}

// ---------------------------------------------------------------------------
// Compile

function summary(candidate: SequenceCandidate, truth: SequenceTruth): string {
  const noun = variantOf(candidate);
  const final = queueValues(truth.run.final);
  switch (candidate.ask) {
    case "dequeued":
    case "removed":
      return `Removed: ${listValues(truth.run.removed)}.`;
    case "peek":
      return `peek() never changed the ${noun}.`;
    default:
      return `Front to back, the ${noun} is {${final.join(", ")}}.`;
  }
}

const titles: Record<QueueAsk | DequeAsk, string> = {
  dequeued: "Who leaves first?",
  peek: "What does peek see?",
  front: "What is at the front?",
  back: "What is at the back?",
  final: "Trace the line",
  operation: "Pick the operation",
  "stack-or-queue": "Stack or queue?",
  "after-add": "Both ends: adding",
  removed: "Both ends: removing",
  "end-operation": "Pick the end",
  "queue-or-deque": "Queue or deque?",
};

function compile(candidate: AnyCandidate, truth: QueueTruth) {
  const fingerprint = fingerprintOf(candidate);
  const kind: ExerciseKindId = candidate.kind;
  let steps: LessonStepInput[];
  let subtitle: string;

  if (isRecognition(candidate) && truth.mode === "recognition") {
    steps = [recognitionQuestion(candidate, truth, fingerprint), ...recognitionTraces(candidate, truth)];
    subtitle = `Arrivals ${listValues(candidate.arrivals)}: a freshly generated ordering question.`;
  } else if (!isRecognition(candidate) && truth.mode === "sequence") {
    const code = sequenceCode(candidate);
    const traces = sequenceTraces(candidate, truth, code);
    const last = traces[traces.length - 1];
    traces[traces.length - 1] = { ...last, body: `${last.body} ${summary(candidate, truth)}` };
    steps = [sequenceQuestion(candidate, truth, code, fingerprint), ...traces];
    subtitle = `Starting from ${describeLine(candidate.initial, variantOf(candidate))}: a freshly generated ${variantOf(candidate)} example.`;
  } else {
    throw new Error("Candidate and truth disagree about the exercise mode.");
  }

  const last = steps[steps.length - 1];
  steps[steps.length - 1] = { ...last, practice: { kind, difficulty: candidate.difficulty } };
  return { difficulty: candidate.difficulty, title: titles[candidate.ask], subtitle, steps };
}

function fingerprintOf(candidate: AnyCandidate): string {
  if (isRecognition(candidate)) {
    return `${candidate.kind}:${candidate.arrivals.join(",")}>${candidate.required.join(",")}|${candidate.ask}`;
  }
  return `${candidate.kind}:${candidate.initial.join(",")}|${candidate.operations
    .map((op) => describeOperation(op))
    .join(",")}|${candidate.ask}`;
}

export const queueOperationsKind: ExerciseKindDefinition<QueueCandidate, QueueTruth> = {
  id: "queue-operations",
  concept: "queues.operations",
  label: "Queue operations",
  schema: queueCandidateSchema,
  fingerprint: fingerprintOf,
  skill: (candidate) => candidate.ask,
  verify,
  compile,
};

export const dequeOperationsKind: ExerciseKindDefinition<DequeCandidate, QueueTruth> = {
  id: "deque-operations",
  concept: "deques.operations",
  label: "Deque operations",
  schema: dequeCandidateSchema,
  fingerprint: fingerprintOf,
  skill: (candidate) => candidate.ask,
  verify,
  compile,
};
