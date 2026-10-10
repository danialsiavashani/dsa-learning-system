import { z } from "zod";
import { insertAtCode } from "@/curriculum/concepts/arrays";
import {
  insertAt,
  itemsFromValues,
  valuesOf,
  type ArrayItem,
  type InsertionResult,
} from "@/lib/domain/array";
import { describeValues, listValues } from "@/lib/learning/format";
import { difficultySchema, type LessonStepInput } from "@/lib/learning/schema";
import { hashString, seededRandom, shuffle } from "../random";
import type { ExerciseKindDefinition } from "../types";

/**
 * Array insertion exercises: "insert `value` at `index` in `initial`".
 *
 * A candidate states the operation and claims its outcome. The claims are
 * verified against `insertAt`; everything the learner is graded on (the
 * answer options and which one is correct) is derived here from domain truth.
 * Any extra fields a generator adds, such as its own "correct answer", are
 * stripped by the schema and never used.
 */

export const MAX_INITIAL_LENGTH = 8;
const valueSchema = z.number().int().min(-99).max(99);

export const arrayInsertionCandidateSchema = z.object({
  kind: z.literal("array-insertion"),
  concept: z.literal("arrays.insertion"),
  difficulty: difficultySchema,
  initial: z.array(valueSchema).min(2).max(MAX_INITIAL_LENGTH),
  operation: z.object({
    type: z.literal("insert"),
    index: z.number().int(),
    value: valueSchema,
  }),
  /** The generator's claims about the outcome. Verified, never trusted. */
  expected: z.object({
    result: z.array(z.number()),
    shifted: z.array(z.number()),
  }),
  /** Optional one-sentence framing, e.g. "A queue of ticket numbers:". */
  framing: z.string().trim().min(1).max(160).optional(),
});

export type ArrayInsertionCandidate = z.infer<typeof arrayInsertionCandidateSchema>;

const INSERTED_ID = "inserted";

const codeView = { source: insertAtCode.source, language: "java" } as const;

function sameNumbers(a: readonly (number | null)[], b: readonly (number | null)[]) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function verify(candidate: ArrayInsertionCandidate) {
  const { initial, operation, expected } = candidate;
  const problems: string[] = [];

  if (operation.index < 0 || operation.index > initial.length) {
    problems.push(
      `operation.index ${operation.index} is outside 0..${initial.length}.`,
    );
  }
  const all = [...initial, operation.value];
  if (new Set(all).size !== all.length) {
    // Repeated values make "which values move" ambiguous to a learner.
    problems.push("Values (including the inserted value) must be distinct.");
  }
  if (problems.length > 0) return { ok: false as const, problems };

  const truth = insertAt(
    itemsFromValues(initial, "v"),
    operation.index,
    operation.value,
    INSERTED_ID,
  );

  const actualResult = valuesOf(truth.after);
  if (!sameNumbers(expected.result, actualResult)) {
    problems.push(
      `expected.result [${expected.result.join(", ")}] does not match the actual result [${actualResult.join(", ")}].`,
    );
  }
  const actualShifted = valuesOf(truth.shifted);
  if (!sameNumbers(expected.shifted, actualShifted)) {
    problems.push(
      `expected.shifted [${expected.shifted.join(", ")}] does not match the values that actually shift [${actualShifted.join(", ")}].`,
    );
  }

  return problems.length > 0
    ? { ok: false as const, problems }
    : { ok: true as const, value: truth };
}

// ---------------------------------------------------------------------------
// Answer options, derived from the truth

type OptionDraft = { values: number[]; feedback?: string };

function plainValues(items: ArrayItem[]): number[] {
  return items.map((item) => item.value ?? 0);
}

/**
 * Common misconceptions, each a plausible wrong answer with targeted
 * feedback, strongest first (only the first three are used).
 */
function distractors(truth: InsertionResult): OptionDraft[] {
  const values = plainValues(truth.before);
  const { index } = truth;
  const length = values.length;
  const drafts: OptionDraft[] = [];

  if (index < length) {
    drafts.push({
      values: values.slice(index + 1),
      feedback: `The value at index ${index} has to move too, or ${truth.value} would overwrite it.`,
    });
    drafts.push({
      values: [values[index]],
      feedback: `Moving only ${values[index]} would land it on top of the next value, so that value must move as well, and so on to the end.`,
    });
  } else {
    drafts.push({
      values: [values[length - 1]],
      feedback: `Index ${index} is one past the last value. ${truth.value} lands in a fresh slot, so nothing is in the way.`,
    });
  }
  if (index > 0) {
    drafts.push({
      values: values.slice(0, index),
      feedback: `Values before index ${index} keep their positions. Insertion only disturbs what sits at or after the insertion point.`,
    });
    drafts.push({
      values,
      feedback: `Values before index ${index} are not in the way, so they stay put.`,
    });
  }
  if (index < length) {
    drafts.push({
      values: [],
      feedback: `Index ${index} is occupied, so something has to make room first.`,
    });
  }
  return drafts;
}

function buildOptions(truth: InsertionResult, fingerprint: string) {
  const correct: OptionDraft = { values: plainValues(truth.shifted) };
  const seen = new Set([describeValues(correct.values)]);
  const wrong = distractors(truth).filter((draft) => {
    const label = describeValues(draft.values);
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });

  // Stable per exercise: the same candidate always yields the same order.
  const ordered = shuffle(
    [correct, ...wrong.slice(0, 3)],
    seededRandom(hashString(fingerprint)),
  );
  const options = ordered.map((draft, position) => ({
    id: `option-${position + 1}`,
    label: describeValues(draft.values),
    feedback: draft.feedback,
  }));
  return {
    options,
    correctOptionId: options[ordered.indexOf(correct)].id,
  };
}

// ---------------------------------------------------------------------------
// Compilation into ordinary lesson steps

function compile(candidate: ArrayInsertionCandidate, truth: InsertionResult) {
  const { index, value } = truth;
  const fingerprint = fingerprintOf(candidate);
  const shiftedValues = plainValues(truth.shifted);
  const appended = shiftedValues.length === 0;
  const shiftedList = listValues(shiftedValues);
  const occupant = truth.before[index];

  const explanation = appended
    ? `Index ${index} is one past the last value, so ${value} is appended and nothing moves.`
    : index === 0
      ? `Inserting at the front means every value moves one slot right: ${shiftedList}.`
      : `Every value from index ${index} to the end moves one slot right to open a gap: ${shiftedList}.`;

  const unchanged = plainValues(truth.unchanged);
  const unchangedNote =
    unchanged.length === 0
      ? "Every original value had to move."
      : `${listValues(unchanged)} never moved.`;

  const steps: LessonStepInput[] = [
    {
      id: "predict",
      mode: "predict",
      title: `Insert ${value} at index ${index}.`,
      body: [
        candidate.framing,
        "Before anything moves, predict what has to happen to make room.",
      ]
        .filter(Boolean)
        .join(" "),
      visual: {
        kind: "array",
        items: truth.before,
        marks: occupant ? { [occupant.id]: "focus" } : undefined,
        pointers: [{ index, label: `insert ${value}` }],
      },
      code: { ...codeView, highlight: [insertAtCode.lines.signature] },
      question: {
        kind: "choice",
        prompt: "Which existing values have to shift one position to the right?",
        ...buildOptions(truth, fingerprint),
        explanation,
      },
    },
    {
      id: "shift",
      mode: "trace",
      title: appended
        ? "Nothing needs to shift."
        : `${shiftedList} ${shiftedValues.length === 1 ? "shifts" : "shift"} right, starting from the back.`,
      body: appended
        ? `With size = ${truth.before.length}, the loop starts at i = ${truth.before.length - 1}, which is already below index ${index}, so its body never runs.`
        : "The loop begins at the last value and walks backwards, so each value moves into a free slot before its old slot is reused.",
      visual: {
        kind: "array",
        items: truth.opened,
        marks: Object.fromEntries(truth.shifted.map((item) => [item.id, "moved"])),
        pointers: [{ index, label: "gap" }],
      },
      code: { ...codeView, highlight: [...insertAtCode.lines.loop] },
    },
    {
      id: "write",
      mode: "trace",
      title: `Write ${value} into index ${index}.`,
      body: `The array now holds \`{${valuesOf(truth.after).join(", ")}}\`. ${unchangedNote}`,
      visual: {
        kind: "array",
        items: truth.after,
        marks: { [truth.insertedId]: "new" },
      },
      code: { ...codeView, highlight: [insertAtCode.lines.write] },
      practice: { kind: "array-insertion", difficulty: candidate.difficulty },
    },
  ];

  return {
    difficulty: candidate.difficulty,
    title: `Insert ${value} at index ${index}`,
    subtitle: `Starting from {${candidate.initial.join(", ")}}: a freshly generated insertion example.`,
    steps,
  };
}

function fingerprintOf(candidate: ArrayInsertionCandidate): string {
  const { initial, operation } = candidate;
  return `array-insertion:${initial.join(",")}@${operation.index}+${operation.value}`;
}

export const arrayInsertionKind: ExerciseKindDefinition<
  ArrayInsertionCandidate,
  InsertionResult
> = {
  id: "array-insertion",
  concept: "arrays.insertion",
  label: "Array insertion",
  schema: arrayInsertionCandidateSchema,
  fingerprint: fingerprintOf,
  verify,
  compile,
};
