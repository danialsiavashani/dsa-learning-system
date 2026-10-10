import { z } from "zod";
import {
  callOf,
  narrate,
  recursionCode,
  snapshotLine,
  snapshotVisual,
} from "@/curriculum/concepts/recursion";
import {
  RECURSIVE_FUNCTIONS,
  RecursionError,
  recursiveFunctions,
  traceRecursion,
  type RecursionTrace,
} from "@/lib/domain/recursion";
import {
  difficultySchema,
  EXERCISE_SKILLS,
  type ChoiceQuestion,
  type LessonStepInput,
  type NumberListQuestion,
} from "@/lib/learning/schema";
import { hashString, seededRandom, shuffle } from "../random";
import type { ExerciseKindDefinition } from "../types";

/**
 * Recursion trace exercises. A candidate names a supported single-call method,
 * an input and a question (`ask`), optionally about one frame (`focus`, the
 * n of that call). The trace engine computes calls, returns, output and the
 * result; the candidate's claims about them are checked, never used.
 */

export const RECURSION_ASKS = EXERCISE_SKILLS["recursion-trace"];
export type RecursionAsk = (typeof RECURSION_ASKS)[number];

/** Asks that are about one particular frame. */
const FOCUSED: readonly RecursionAsk[] = ["next-call", "return-value", "resumes"];

/** Most recursive frames allowed at once (plus main), so the whole stack stays on screen. */
export const MAX_RECURSION_DEPTH = 5;

export const recursionCandidateSchema = z.object({
  kind: z.literal("recursion-trace"),
  concept: z.literal("recursion.single-call"),
  difficulty: difficultySchema,
  function: z.enum(RECURSIVE_FUNCTIONS),
  input: z.number().int(),
  ask: z.enum(RECURSION_ASKS),
  focus: z.number().int().optional(),
  /** The generator's claims about the execution. Verified, never trusted. */
  expected: z.object({
    calls: z.array(z.number()),
    returns: z.array(z.number()),
    result: z.number().nullable(),
    output: z.array(z.number()),
  }),
});

export type RecursionCandidate = z.infer<typeof recursionCandidateSchema>;

const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

function verify(candidate: RecursionCandidate) {
  const { function: fn, input, ask, focus, expected } = candidate;
  const spec = recursiveFunctions[fn];

  let trace: RecursionTrace;
  try {
    trace = traceRecursion(fn, input);
  } catch (error) {
    if (error instanceof RecursionError) return { ok: false as const, problems: [error.message] };
    throw error;
  }

  const problems: string[] = [];
  if (trace.maxDepth > MAX_RECURSION_DEPTH) {
    problems.push(`${callOf(fn, input)} needs ${trace.maxDepth} frames; the limit is ${MAX_RECURSION_DEPTH}.`);
  }
  if (trace.maxDepth < 2) {
    problems.push(`${callOf(fn, input)} is the base case immediately; there is nothing to trace.`);
  }

  const needsValue: readonly RecursionAsk[] = ["base-return", "return-value", "final", "returns"];
  if (needsValue.includes(ask) && !spec.returnsValue) {
    problems.push(`ask "${ask}" needs a method that returns a value; ${fn} is void.`);
  }
  if (ask === "printed" && !spec.prints) {
    problems.push(`ask "printed" needs a method that prints; ${fn} does not.`);
  }

  const base = trace.calls[trace.calls.length - 1];
  if (FOCUSED.includes(ask)) {
    if (focus === undefined) {
      problems.push(`ask "${ask}" needs a focus frame.`);
    } else if (!trace.calls.includes(focus)) {
      problems.push(`focus ${focus} is not one of the calls (${trace.calls.join(", ")}).`);
    } else if ((ask === "next-call" || ask === "return-value") && focus === base) {
      problems.push(`focus ${focus} is the base case, which makes no further call.`);
    }
  } else if (focus !== undefined) {
    problems.push(`ask "${ask}" does not use a focus frame.`);
  }

  if (!same(expected.calls, trace.calls)) {
    problems.push(`expected.calls [${expected.calls.join(", ")}] does not match the actual calls [${trace.calls.join(", ")}].`);
  }
  if (!same(expected.returns, trace.returns)) {
    problems.push(`expected.returns [${expected.returns.join(", ")}] does not match the actual returns [${trace.returns.join(", ")}].`);
  }
  if (expected.result !== trace.result) {
    problems.push(`expected.result ${expected.result} does not match the actual result ${trace.result}.`);
  }
  if (!same(expected.output, trace.output)) {
    problems.push(`expected.output [${expected.output.join(", ")}] does not match what is printed [${trace.output.join(", ")}].`);
  }

  return problems.length > 0
    ? { ok: false as const, problems }
    : { ok: true as const, value: trace };
}

// ---------------------------------------------------------------------------
// Questions, derived from the trace

type Draft = { label: string; feedback?: string };

function choice(
  prompt: string,
  correct: string,
  wrong: Draft[],
  explanation: string,
  seed: string,
): ChoiceQuestion {
  const seen = new Set([correct]);
  const distractors = wrong.filter((draft) => {
    if (seen.has(draft.label)) return false;
    seen.add(draft.label);
    return true;
  });
  const right: Draft = { label: correct };
  const ordered = shuffle([right, ...distractors.slice(0, 3)], seededRandom(hashString(seed)));
  const options = ordered.map((draft, i) => ({
    id: `option-${i + 1}`,
    label: draft.label,
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

type QuestionStep = {
  mode: "predict" | "solve";
  title: string;
  question: ChoiceQuestion | NumberListQuestion;
};

/** The question and the snapshot it is asked at. */
type Question = { index: number; step: QuestionStep };

function question(candidate: RecursionCandidate, trace: RecursionTrace, seed: string): Question {
  const { function: fn, input, focus } = candidate;
  const { snapshots, calls } = trace;
  const base = calls[calls.length - 1];
  const callIndex = (n: number) =>
    snapshots.findIndex((s) => s.kind === "call" && s.frames.at(-1)?.n === n);
  // The snapshot in which the frame for `n` is the one returning.
  const returningIndex = (n: number) =>
    snapshots.findIndex((s) => (s.kind === "return" || s.kind === "base") && s.frames.at(-1)?.n === n);

  switch (candidate.ask) {
    case "next-call": {
      const n = focus!;
      return {
        index: callIndex(n),
        step: {
          mode: "predict",
          title: "What call happens next?",
          question: choice(
            `\`${callOf(fn, n)}\` is running and the base case does not apply. Which call does it make?`,
            callOf(fn, n - 1),
            [
              { label: callOf(fn, n), feedback: "Calling with the same n would never get any closer to the base case." },
              { label: callOf(fn, n + 1), feedback: "The argument is n - 1: every call moves toward the base case." },
              { label: callOf(fn, base), feedback: "Calls go one step at a time; each frame makes exactly one call." },
            ],
            `With n = ${n}, \`n - 1\` is ${n - 1}, so it calls \`${callOf(fn, n - 1)}\` and waits.`,
            seed,
          ),
        },
      };
    }
    case "base-return": {
      const value = recursiveFunctions[fn].baseValue ?? 0;
      return {
        index: callIndex(base),
        step: {
          mode: "predict",
          title: "The base case answers.",
          question: choice(
            `\`${callOf(fn, base)}\` finds its base case true. What does it return?`,
            String(value),
            [
              { label: String(value === 1 ? 0 : 1), feedback: `Read the base case: it returns ${value}.` },
              {
                label: `It calls \`${callOf(fn, base - 1)}\``,
                feedback: "The base case returns directly; that is what stops the calls.",
              },
              { label: String(input), feedback: "That is the original input, not what the base case returns." },
            ],
            `The base case returns ${value} without another call. That is where unwinding begins.`,
            seed,
          ),
        },
      };
    }
    case "return-value": {
      const n = focus!;
      const at = returningIndex(n);
      const frame = snapshots[at].frames.at(-1)!;
      const received = frame.received ?? 0;
      const child = callOf(fn, n - 1);
      return {
        index: at - 1,
        step: {
          mode: "predict",
          title: "What comes back?",
          question: choice(
            `\`${child}\` returns ${received} to \`${callOf(fn, n)}\`. What does \`${callOf(fn, n)}\` return?`,
            String(frame.returnValue),
            [
              { label: String(received), feedback: `That is what it received; it still combines it with its own n = ${n}.` },
              { label: String(n), feedback: `n alone ignores the ${received} that came back.` },
              { label: String(trace.result), feedback: "That is the final result of the whole chain, not this frame's return." },
              {
                label: String(fn === "factorial" ? n + received : n * received),
                feedback: `Check the operator in the return line: \`${fn === "factorial" ? "*" : "+"}\`.`,
              },
            ],
            `\`${callOf(fn, n)}\` computes ${fn === "factorial" ? `${n} * ${received}` : `${n} + ${received}`} = ${frame.returnValue}.`,
            seed,
          ),
        },
      };
    }
    case "resumes": {
      const n = focus!;
      const position = calls.indexOf(n);
      const parent = position === 0 ? "main()" : callOf(fn, calls[position - 1]);
      return {
        index: returningIndex(n),
        step: {
          mode: "predict",
          title: "Who resumes?",
          question: choice(
            `\`${callOf(fn, n)}\` is returning. Which frame resumes next?`,
            parent,
            [
              { label: callOf(fn, input), feedback: "The first call has waited longest, so it resumes last." },
              { label: "main()", feedback: "main is at the bottom; it resumes only after the original call returns." },
              { label: callOf(fn, n), feedback: "This frame is finishing; it disappears once it returns." },
            ],
            "The frame directly underneath, the most recent caller still waiting, resumes next: last in, first out.",
            seed,
          ),
        },
      };
    }
    case "final":
      return {
        index: 0,
        step: {
          mode: "solve",
          title: "Trace to the answer.",
          question: {
            kind: "number-list",
            prompt: `Type the value \`${callOf(fn, input)}\` returns.`,
            expected: [trace.result ?? 0],
            explanation: `Returns came back ${trace.returns.join(" → ")}, so the result is ${trace.result}.`,
          },
        },
      };
    case "calls":
      return {
        index: 0,
        step: {
          mode: "solve",
          title: "Trace the calls.",
          question: {
            kind: "number-list",
            prompt: `Type n for each call, in order, starting with ${input}.`,
            expected: calls,
            explanation: `Each call subtracts 1 until the base case: ${calls.join(" → ")}.`,
          },
        },
      };
    case "returns":
      return {
        index: 0,
        step: {
          mode: "solve",
          title: "Trace the returns.",
          question: {
            kind: "number-list",
            prompt: "Type the value each call returns, in the order they return.",
            expected: trace.returns,
            explanation: `The base case returns first, then each waiting frame: ${trace.returns.join(" → ")}.`,
          },
        },
      };
    case "printed":
      return {
        index: 0,
        step: {
          mode: "solve",
          title: "What gets printed?",
          question: {
            kind: "number-list",
            prompt: "Type the numbers printed, in order.",
            expected: trace.output,
            explanation:
              recursiveFunctions[fn].prints === "before"
                ? "Each call prints before making its call, so numbers appear on the way down."
                : "Each call prints after its call returns, so numbers appear on the way back up.",
          },
        },
      };
  }
}

function compile(candidate: RecursionCandidate, trace: RecursionTrace) {
  const fingerprint = fingerprintOf(candidate);
  const code = recursionCode(trace.fn, trace.input);
  const { index, step } = question(candidate, trace, fingerprint);
  const at = (i: number) => ({
    visual: snapshotVisual(trace, trace.snapshots[i]),
    code: { source: code.source, language: code.language, highlight: [snapshotLine(trace, trace.snapshots[i])] },
  });

  const traces: LessonStepInput[] = trace.snapshots.slice(index + 1).map((_, offset) => {
    const i = index + 1 + offset;
    return { id: `snapshot-${i}`, mode: "trace", ...narrate(trace, i), ...at(i) };
  });
  traces[traces.length - 1] = {
    ...traces[traces.length - 1],
    practice: { kind: "recursion-trace", difficulty: candidate.difficulty },
  };

  const first = {
    id: "question",
    ...at(index),
    body: index === 0 ? `Start from \`${callOf(trace.fn, trace.input)}\` and follow every frame.` : narrate(trace, index).body,
    ...step,
  } as LessonStepInput;

  return {
    difficulty: candidate.difficulty,
    title: callOf(trace.fn, trace.input),
    subtitle: "A freshly generated recursion trace.",
    steps: [first, ...traces],
  };
}

function fingerprintOf(candidate: RecursionCandidate): string {
  return `recursion-trace:${candidate.function}(${candidate.input})|${candidate.ask}|${candidate.focus ?? ""}`;
}

export const recursionTraceKind: ExerciseKindDefinition<RecursionCandidate, RecursionTrace> = {
  id: "recursion-trace",
  concept: "recursion.single-call",
  label: "Recursion trace",
  schema: recursionCandidateSchema,
  fingerprint: fingerprintOf,
  skill: (candidate) => candidate.ask,
  verify,
  compile,
};
