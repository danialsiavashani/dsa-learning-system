import { z } from "zod";
import {
  runOperations,
  stackFromValues,
  stackValues,
  top,
  type StackItem,
  type StackOperation,
  type StackRun,
} from "@/lib/domain/stack";
import { listValues } from "@/lib/learning/format";
import {
  difficultySchema,
  EXERCISE_SKILLS,
  type ChoiceQuestion,
  type LessonStepInput,
} from "@/lib/learning/schema";
import { hashString, seededRandom, shuffle } from "../random";
import type { ExerciseKindDefinition } from "../types";

/**
 * Stack exercises: a starting stack, a short sequence of push/pop/peek calls
 * on a Java `ArrayDeque`, and one question about it (`ask`).
 *
 * A candidate claims the outcome (`expected`); the claims are checked against
 * the stack domain, and every answer key is derived from the domain here.
 */

export const STACK_ASKS = EXERCISE_SKILLS["stack-operations"];
export type StackAsk = (typeof STACK_ASKS)[number];

/** Most values the stack may hold at once, so it fits the visualizer. */
export const MAX_STACK_SIZE = 7;

const valueSchema = z.number().int().min(-99).max(99);

const operationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("push"), value: valueSchema }),
  z.object({ type: z.literal("pop") }),
  z.object({ type: z.literal("peek") }),
]);

export const stackCandidateSchema = z.object({
  kind: z.literal("stack-operations"),
  concept: z.literal("stacks.operations"),
  difficulty: difficultySchema,
  /** Bottom → top. */
  initial: z.array(valueSchema).max(5),
  operations: z.array(operationSchema).min(1).max(5),
  ask: z.enum(STACK_ASKS),
  /** The generator's claims about the outcome. Verified, never trusted. */
  expected: z.object({
    final: z.array(z.number()),
    popped: z.array(z.number()),
    peeked: z.array(z.number()),
  }),
  framing: z.string().trim().min(1).max(160).optional(),
});

export type StackCandidate = z.infer<typeof stackCandidateSchema>;

type Truth = { initial: StackItem<number>[]; run: StackRun<number> };

const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

function verify(candidate: StackCandidate) {
  const { initial, operations, ask, expected } = candidate;
  const problems: string[] = [];

  const pushed = operations.flatMap((op) => (op.type === "push" ? [op.value] : []));
  const all = [...initial, ...pushed];
  if (new Set(all).size !== all.length) {
    problems.push("Values (initial and pushed) must be distinct.");
  }
  if (all.length < 2) {
    problems.push("At least two values must be involved, so wrong answers are real alternatives.");
  }

  const items = stackFromValues(initial, "s");
  const run = runOperations(items, operations, "p");

  if (run.threwAt !== undefined) {
    problems.push(
      `Operation ${run.threwAt + 1} pops an empty stack; Java's ArrayDeque would throw NoSuchElementException.`,
    );
  }
  run.steps.forEach((step, i) => {
    if (step.outcome.type === "peek-empty") {
      problems.push(
        `Operation ${i + 1} peeks an empty stack; peek() returns null, which an int cannot hold.`,
      );
    }
    if (step.after.length > MAX_STACK_SIZE) {
      problems.push(`The stack grows past ${MAX_STACK_SIZE} values.`);
    }
  });
  if (problems.length > 0) return { ok: false as const, problems };

  const final = stackValues(run.final);
  const last = operations[operations.length - 1];
  const askProblem: Record<StackAsk, string | null> = {
    top: final.length === 0 ? `ask "top" needs a non-empty final stack.` : null,
    popped: run.popped.length === 0 ? `ask "popped" needs at least one pop().` : null,
    peek: last.type !== "peek" ? `ask "peek" needs the last operation to be peek().` : null,
    final: final.length === 0 ? `ask "final" needs a non-empty final stack.` : null,
    operation:
      operations.length !== 1 || last.type === "peek"
        ? `ask "operation" needs exactly one push() or pop().`
        : null,
  };
  if (askProblem[ask]) problems.push(askProblem[ask]);

  if (!same(expected.final, final)) {
    problems.push(
      `expected.final [${expected.final.join(", ")}] does not match the actual stack [${final.join(", ")}].`,
    );
  }
  if (!same(expected.popped, run.popped)) {
    problems.push(
      `expected.popped [${expected.popped.join(", ")}] does not match what pop() returns [${run.popped.join(", ")}].`,
    );
  }
  const peeked = run.peeked.filter((value): value is number => value !== null);
  if (!same(expected.peeked, peeked)) {
    problems.push(
      `expected.peeked [${expected.peeked.join(", ")}] does not match what peek() returns [${peeked.join(", ")}].`,
    );
  }

  return problems.length > 0
    ? { ok: false as const, problems }
    : { ok: true as const, value: { initial: items, run } };
}

// ---------------------------------------------------------------------------
// Java code

/** Result variables for pop()/peek() lines, in order: a, b, c, ... */
function javaLines(candidate: StackCandidate) {
  const lines = ["Deque<Integer> stack = new ArrayDeque<>();"];
  if (candidate.initial.length > 0) {
    lines.push(`for (int v : new int[] {${candidate.initial.join(", ")}}) stack.push(v);`);
  }
  const firstOpLine = lines.length + 1;
  let results = 0;
  const opLines = candidate.operations.map((op) => {
    if (op.type === "push") return `stack.push(${op.value});`;
    // Identifying the operation is the question, so keep the bare call.
    if (candidate.ask === "operation") return `stack.${op.type}();`;
    return `int ${String.fromCharCode(97 + results++)} = stack.${op.type}();`;
  });
  return { source: [...lines, ...opLines].join("\n"), firstOpLine, opLines };
}

/** The bare call from a Java line: "int a = stack.pop();" → "stack.pop()". */
const callOf = (line: string) => line.replace(/^int \w+ = /, "").replace(/;$/, "");

const braces = (values: readonly (number | string)[]) => `{${values.join(", ")}}`;

function describeStack(values: readonly number[]): string {
  return values.length === 0 ? "an empty stack" : `${braces(values)} (bottom → top)`;
}

// ---------------------------------------------------------------------------
// Answer options, derived from the truth

type Draft = { value: number; feedback?: string };

function choice(
  prompt: string,
  correct: number,
  wrong: Draft[],
  explanation: string,
  seed: string,
): ChoiceQuestion {
  const seen = new Set([correct]);
  const distractors = wrong.filter((draft) => {
    if (seen.has(draft.value)) return false;
    seen.add(draft.value);
    return true;
  });
  const right: Draft = { value: correct };
  const ordered = shuffle([right, ...distractors.slice(0, 3)], seededRandom(hashString(seed)));
  const options = ordered.map((draft, i) => ({
    id: `option-${i + 1}`,
    label: String(draft.value),
    feedback: draft.feedback,
  }));
  return {
    kind: "choice",
    prompt,
    options,
    correctOptionId: options[ordered.indexOf(right)].id,
    explanation,
  };
}

/** Plausible wrong answers when the question is "what is on top of `stack`?". */
function misreadings(stack: readonly number[], history: readonly number[]): Draft[] {
  const drafts: Draft[] = [];
  if (stack.length > 1) {
    drafts.push({
      value: stack[0],
      feedback: `${stack[0]} is at the bottom: it has been there longest. A stack gives back the newest value first.`,
    });
    drafts.push({
      value: stack[stack.length - 2],
      feedback: `${stack[stack.length - 2]} is just below the top.`,
    });
  }
  for (const value of history) {
    drafts.push({
      value,
      feedback: stack.includes(value)
        ? `${value} is in the stack, but not on top.`
        : `${value} was already popped, so it is no longer in the stack.`,
    });
  }
  return drafts;
}

function buildQuestionStep(
  candidate: StackCandidate,
  truth: Truth,
  code: ReturnType<typeof javaLines>,
  fingerprint: string,
): LessonStepInput {
  const { run } = truth;
  const initial = candidate.initial;
  const final = stackValues(run.final);
  const opRange = code.opLines.map((_, i) => code.firstOpLine + i);
  const allValues = [
    ...initial,
    ...candidate.operations.flatMap((op) => (op.type === "push" ? [op.value] : [])),
  ];
  const single = candidate.operations.length === 1;
  const base = {
    id: "question",
    body: [
      candidate.framing,
      `The stack starts as ${describeStack(initial)}.`,
      single ? "Predict before it runs." : "Trace the highlighted lines in order.",
    ]
      .filter(Boolean)
      .join(" "),
    visual: { kind: "stack" as const, items: truth.initial },
    code: { source: code.source, language: "java" as const, highlight: opRange },
  };

  switch (candidate.ask) {
    case "top": {
      const answer = final[final.length - 1];
      return {
        ...base,
        mode: "predict",
        title: single ? singleTitle(candidate.operations[0]) : "What ends up on top?",
        question: choice(
          single
            ? `What is on top after \`${callOf(code.opLines[0])}\`?`
            : "After these lines run, which value is on top?",
          answer,
          misreadings(final, allValues),
          `The last value pushed that has not been popped is on top: ${answer}.`,
          fingerprint,
        ),
      };
    }
    case "popped": {
      if (run.popped.length === 1) {
        const index = run.steps.findIndex((step) => step.outcome.type === "pop");
        const before = stackValues(run.steps[index].before);
        const answer = run.popped[0];
        return {
          ...base,
          mode: "predict",
          title: single ? singleTitle(candidate.operations[0]) : "Which value comes out?",
          question: choice(
            `Which value does \`${callOf(code.opLines[index])}\` return?`,
            answer,
            misreadings(before, allValues),
            `When that pop() runs, ${answer} is the most recently pushed value still in the stack, so it leaves first.`,
            fingerprint,
          ),
        };
      }
      return {
        ...base,
        mode: "solve",
        title: "Which values come out?",
        question: {
          kind: "number-list",
          prompt: "Type the values returned by pop(), in order.",
          expected: run.popped,
          explanation: `Each pop() takes the newest remaining value: ${listValues(run.popped)}.`,
        },
      };
    }
    case "peek": {
      const last = run.steps[run.steps.length - 1];
      const answer = last.outcome.type === "peek" ? last.outcome.item.value : 0;
      return {
        ...base,
        mode: "predict",
        title: single ? singleTitle(candidate.operations[0]) : "What does peek see?",
        question: choice(
          `What does \`${callOf(code.opLines[code.opLines.length - 1])}\` return?`,
          answer,
          misreadings(stackValues(last.before), allValues),
          `peek() returns the top value, ${answer}, and leaves it in place.`,
          fingerprint,
        ),
      };
    }
    case "final":
      return {
        ...base,
        mode: "solve",
        title: "Trace the stack.",
        question: {
          kind: "number-list",
          prompt: "Type the stack from bottom to top after these lines run.",
          expected: final,
          explanation: `Bottom to top, the stack ends as ${braces(final)}.`,
        },
      };
    case "operation": {
      const op = candidate.operations[0];
      const result = stackValues(run.steps[0].after);
      const correct = code.opLines[0];
      const others = [
        op.type === "push" ? "stack.pop();" : `stack.push(${initial[initial.length - 1]});`,
        "stack.peek();",
        op.type === "push" && initial.length > 0
          ? `stack.push(${initial[0]});`
          : `stack.push(${result[result.length - 1] ?? 0});`,
      ].filter((line) => line !== correct);
      const feedbackFor = (label: string) => {
        if (label === "stack.peek();") {
          return "peek() only looks at the top; the stack would not change.";
        }
        if (label === "stack.pop();") return "pop() removes the top value, but this stack gained one.";
        return op.type === "pop"
          ? "push() adds a value, but this stack lost one."
          : `That pushes a different value; the new top here is ${result[result.length - 1]}.`;
      };
      const ordered = shuffle([correct, ...new Set(others)], seededRandom(hashString(fingerprint)));
      const options = ordered.map((label, i) => ({
        id: `option-${i + 1}`,
        label,
        feedback: label === correct ? undefined : feedbackFor(label),
      }));
      return {
        ...base,
        mode: "complete",
        title: "Pick the operation.",
        body: [
          candidate.framing,
          `One line turns ${describeStack(initial)} into ${describeStack(result)}.`,
        ]
          .filter(Boolean)
          .join(" "),
        code: { ...base.code, blankLine: code.firstOpLine, highlight: [] },
        question: {
          kind: "choice",
          prompt: "Which line is missing?",
          options,
          correctOptionId: options[ordered.indexOf(correct)].id,
          explanation:
            op.type === "push"
              ? `Only push(${op.value}) adds ${op.value} on top.`
              : `pop() removes the top value, ${initial[initial.length - 1]}.`,
        },
      };
    }
  }
}

function traceSteps(
  candidate: StackCandidate,
  truth: Truth,
  code: ReturnType<typeof javaLines>,
): LessonStepInput[] {
  return truth.run.steps.map((step, i) => {
    const line = code.firstOpLine + i;
    const call = callOf(code.opLines[i]);
    const below = top(step.before);
    const after = top(step.after);
    const common = {
      id: `op-${i + 1}`,
      mode: "trace" as const,
      code: { source: code.source, language: "java" as const, highlight: [line] },
    };
    const { outcome } = step;

    switch (outcome.type) {
      case "push":
        return {
          ...common,
          title: `\`${call}\` puts ${outcome.item.value} on top.`,
          body: below
            ? `${outcome.item.value} lands on ${below.value}, which is no longer the top.`
            : `The stack was empty, so ${outcome.item.value} is now both the bottom and the top.`,
          visual: {
            kind: "stack" as const,
            items: step.after,
            marks: { [outcome.item.id]: "new" as const },
          },
        };
      case "pop":
        return {
          ...common,
          title: `\`${call}\` returns ${outcome.item.value}.`,
          body: `pop() removes the top value and hands it back. ${
            after ? `${after.value} is the new top.` : "The stack is now empty."
          }`,
          visual: {
            kind: "stack" as const,
            items: step.after,
            held: { ...outcome.item, label: `pop() → ${outcome.item.value}` },
          },
        };
      case "peek":
        return {
          ...common,
          title: `\`${call}\` returns ${outcome.item.value}.`,
          body: "peek() reads the top value and leaves the stack unchanged.",
          visual: {
            kind: "stack" as const,
            items: step.after,
            marks: { [outcome.item.id]: "focus" as const },
            callout: `peek() → ${outcome.item.value}`,
          },
        };
      default:
        // verify() rejects runs that touch an empty stack.
        throw new Error(`Unexpected ${outcome.type} in a verified exercise.`);
    }
  });
}

function summary(candidate: StackCandidate, truth: Truth): string {
  const final = stackValues(truth.run.final);
  switch (candidate.ask) {
    case "top":
      return `${final[final.length - 1]} ends on top.`;
    case "popped":
      return `pop() returned ${listValues(truth.run.popped)}.`;
    case "peek":
      return "The stack never changed for peek().";
    case "final":
    case "operation":
      return `Bottom to top, the stack is ${braces(final)}.`;
  }
}

function compile(candidate: StackCandidate, truth: Truth) {
  const fingerprint = fingerprintOf(candidate);
  const code = javaLines(candidate);
  const traces = traceSteps(candidate, truth, code);
  const last = traces[traces.length - 1];
  traces[traces.length - 1] = {
    ...last,
    body: `${last.body} ${summary(candidate, truth)}`,
    practice: { kind: "stack-operations", difficulty: candidate.difficulty },
  };

  const titles: Record<StackAsk, string> = {
    top: "What ends up on top?",
    popped: "Which values come out?",
    peek: "What does peek see?",
    final: "Trace the stack",
    operation: "Pick the operation",
  };
  return {
    difficulty: candidate.difficulty,
    title: titles[candidate.ask],
    subtitle: `Starting from ${describeStack(candidate.initial)}: a freshly generated stack example.`,
    steps: [buildQuestionStep(candidate, truth, code, fingerprint), ...traces],
  };
}

function singleTitle(op: StackOperation): string {
  if (op.type === "push") return `Push ${op.value}.`;
  return op.type === "pop" ? "Pop once." : "Peek at the top.";
}

function describeOperation(op: StackOperation): string {
  return op.type === "push" ? `push(${op.value})` : `${op.type}()`;
}

function fingerprintOf(candidate: StackCandidate): string {
  return `stack-operations:${candidate.initial.join(",")}|${candidate.operations
    .map(describeOperation)
    .join(",")}|${candidate.ask}`;
}

export const stackOperationsKind: ExerciseKindDefinition<StackCandidate, Truth> = {
  id: "stack-operations",
  concept: "stacks.operations",
  label: "Stack operations",
  schema: stackCandidateSchema,
  fingerprint: fingerprintOf,
  skill: (candidate) => candidate.ask,
  verify,
  compile,
};
