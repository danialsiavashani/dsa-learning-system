import { z } from "zod";
import { removeAtCode } from "@/curriculum/concepts/arrays";
import {
  itemsFromValues,
  removeAt,
  valuesOf,
  type ArrayItem,
  type RemovalResult,
} from "@/lib/domain/array";
import { describeValues, listValues } from "@/lib/learning/format";
import { difficultySchema, type LessonStepInput } from "@/lib/learning/schema";
import { hashString, seededRandom, shuffle } from "../random";
import type { ExerciseKindDefinition } from "../types";

/**
 * Array removal exercises: "remove the value at `index` from `initial`".
 * The mirror image of insertion: later values shift left to close the gap.
 * Claims are verified against `removeAt`; answer options come from the truth.
 */

const valueSchema = z.number().int().min(-99).max(99);

export const arrayRemovalCandidateSchema = z.object({
  kind: z.literal("array-removal"),
  concept: z.literal("arrays.removal"),
  difficulty: difficultySchema,
  initial: z.array(valueSchema).min(2).max(8),
  operation: z.object({ type: z.literal("remove"), index: z.number().int() }),
  /** The generator's claims about the outcome. Verified, never trusted. */
  expected: z.object({
    result: z.array(z.number()),
    removed: z.number(),
    shifted: z.array(z.number()),
  }),
});

export type ArrayRemovalCandidate = z.infer<typeof arrayRemovalCandidateSchema>;

const same = (a: readonly (number | null)[], b: readonly (number | null)[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

const plain = (items: ArrayItem[]) => items.map((item) => item.value ?? 0);

function verify(candidate: ArrayRemovalCandidate) {
  const { initial, operation, expected } = candidate;
  const problems: string[] = [];
  if (operation.index < 0 || operation.index >= initial.length) {
    problems.push(`operation.index ${operation.index} is outside 0..${initial.length - 1}.`);
  }
  if (new Set(initial).size !== initial.length) {
    problems.push("Values must be distinct, so it is clear which ones move.");
  }
  if (problems.length > 0) return { ok: false as const, problems };

  const truth = removeAt(itemsFromValues(initial, "v"), operation.index);
  const result = valuesOf(truth.after);
  if (!same(expected.result, result)) {
    problems.push(`expected.result [${expected.result.join(", ")}] does not match the actual result [${result.join(", ")}].`);
  }
  if (expected.removed !== truth.removed.value) {
    problems.push(`expected.removed ${expected.removed} is not the value at index ${operation.index} (${truth.removed.value}).`);
  }
  const shifted = valuesOf(truth.shifted);
  if (!same(expected.shifted, shifted)) {
    problems.push(`expected.shifted [${expected.shifted.join(", ")}] does not match the values that actually shift [${shifted.join(", ")}].`);
  }
  return problems.length > 0 ? { ok: false as const, problems } : { ok: true as const, value: truth };
}

type Draft = { values: number[]; feedback?: string };

function distractors(truth: RemovalResult): Draft[] {
  const values = plain(truth.before);
  const { index } = truth;
  const removed = values[index];
  const drafts: Draft[] = [];
  if (index < values.length - 1) {
    drafts.push({
      values: values.slice(index),
      feedback: `${removed} is the value being removed; it leaves rather than shifts.`,
    });
    drafts.push({
      values: [values[index + 1]],
      feedback: `Moving only ${values[index + 1]} would leave a new gap where it was, so every later value must move too.`,
    });
  } else {
    drafts.push({
      values: [values[index - 1]],
      feedback: `${removed} is last, so nothing sits after it; ${values[index - 1]} stays put.`,
    });
  }
  if (index > 0) {
    drafts.push({
      values: values.slice(0, index),
      feedback: `Values before index ${index} are not affected by removing a later value.`,
    });
  }
  if (index < values.length - 1) {
    drafts.push({
      values: [],
      feedback: `Something has to fill the gap at index ${index}, or the array would have a hole in the middle.`,
    });
  }
  return drafts;
}

function buildOptions(truth: RemovalResult, fingerprint: string) {
  const correct: Draft = { values: plain(truth.shifted) };
  const seen = new Set([describeValues(correct.values)]);
  const wrong = distractors(truth).filter((draft) => {
    const label = describeValues(draft.values);
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
  const ordered = shuffle([correct, ...wrong.slice(0, 3)], seededRandom(hashString(fingerprint)));
  const options = ordered.map((draft, i) => ({
    id: `option-${i + 1}`,
    label: describeValues(draft.values),
    feedback: draft.feedback,
  }));
  return { options, correctOptionId: options[ordered.indexOf(correct)].id };
}

const codeView = { source: removeAtCode.source, language: "java" } as const;

function compile(candidate: ArrayRemovalCandidate, truth: RemovalResult) {
  const { index, removed } = truth;
  const shifted = plain(truth.shifted);
  const last = shifted.length === 0;
  const list = listValues(shifted);

  const steps: LessonStepInput[] = [
    {
      id: "predict",
      mode: "predict",
      title: `Remove the value at index ${index}.`,
      body: `The array is {${candidate.initial.join(", ")}}. Predict what has to happen so no gap is left behind.`,
      visual: {
        kind: "array",
        items: truth.before,
        marks: { [removed.id]: "focus" },
        pointers: [{ index, label: `remove ${removed.value}` }],
      },
      code: { ...codeView, highlight: [removeAtCode.lines.signature] },
      question: {
        kind: "choice",
        prompt: "Which values have to shift one position to the left?",
        ...buildOptions(truth, fingerprintOf(candidate)),
        explanation: last
          ? `${removed.value} is the last value, so nothing comes after it and nothing moves.`
          : `Every value after index ${index} moves one slot left to fill the gap: ${list}.`,
      },
    },
    {
      id: "gap",
      mode: "trace",
      title: `${removed.value} leaves a gap at index ${index}.`,
      body: last
        ? "It was the last value in use, so the gap is at the end and needs no filling."
        : `An array cannot have a hole in the middle, so ${list} ${shifted.length === 1 ? "has" : "have"} to move.`,
      visual: {
        kind: "array",
        items: truth.opened,
        marks: Object.fromEntries(truth.shifted.map((item) => [item.id, "moved"])),
        pointers: [{ index, label: "gap" }],
      },
      code: { ...codeView, highlight: [removeAtCode.lines.signature] },
    },
    {
      id: "close",
      mode: "trace",
      title: last ? "Nothing shifts." : `${list} ${shifted.length === 1 ? "shifts" : "shift"} left.`,
      body: `${last ? "The loop never runs." : "The loop starts at the gap and walks forward, copying each value one slot left."} The array now holds {${valuesOf(truth.after).join(", ")}}.`,
      visual: {
        kind: "array",
        items: truth.after,
        marks: Object.fromEntries(truth.shifted.map((item) => [item.id, "moved"])),
      },
      code: { ...codeView, highlight: [...removeAtCode.lines.loop] },
      practice: { kind: "array-removal", difficulty: candidate.difficulty },
    },
  ];

  return {
    difficulty: candidate.difficulty,
    title: `Remove index ${index}`,
    subtitle: `Starting from {${candidate.initial.join(", ")}}: a freshly generated removal example.`,
    steps,
  };
}

function fingerprintOf(candidate: ArrayRemovalCandidate): string {
  return `array-removal:${candidate.initial.join(",")}@${candidate.operation.index}`;
}

export const arrayRemovalKind: ExerciseKindDefinition<ArrayRemovalCandidate, RemovalResult> = {
  id: "array-removal",
  concept: "arrays.removal",
  label: "Array removal",
  schema: arrayRemovalCandidateSchema,
  fingerprint: fingerprintOf,
  skill: () => "remove",
  verify,
  compile,
};
