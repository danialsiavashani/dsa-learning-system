import { z } from "zod";
import { exerciseKindSchema } from "@/lib/learning/schema";
import { validateLesson, type ValidationResult } from "@/lib/learning/validate";
import { hashString } from "./random";
import { exerciseKinds } from "./registry";
import type {
  AcceptedExercise,
  ExerciseGenerator,
  ExerciseRequest,
} from "./types";

const envelopeSchema = z.object({ kind: exerciseKindSchema });

/**
 * The truth gate. Takes untrusted generator output and either returns an
 * exercise that is safe to render, or the reasons it was rejected.
 *
 *   raw → known kind? → schema → matches request? → new? → domain verification
 *       → compile to steps → lesson schema → accepted
 */
export function acceptCandidate(
  raw: unknown,
  request?: ExerciseRequest,
): ValidationResult<AcceptedExercise> {
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) {
    return {
      ok: false,
      problems: ["Candidate must be an object with a known exercise `kind`."],
    };
  }
  const kind = exerciseKinds[envelope.data.kind];

  const compiled = kind.accept(raw);
  if (!compiled.ok) return compiled;
  const exercise = compiled.value;

  if (request) {
    const mismatches: string[] = [];
    if (request.kind !== kind.id) {
      mismatches.push(`Asked for "${request.kind}" but got "${kind.id}".`);
    }
    if (request.difficulty !== exercise.difficulty) {
      mismatches.push(
        `Asked for difficulty "${request.difficulty}" but got "${exercise.difficulty}".`,
      );
    }
    if (request.skills && !request.skills.includes(exercise.skill)) {
      mismatches.push(
        `Asked to practise ${request.skills.join(" or ")} but got "${exercise.skill}".`,
      );
    }
    if (request.avoid?.includes(exercise.fingerprint)) {
      mismatches.push("This example was already shown; a new one is required.");
    }
    if (mismatches.length > 0) return { ok: false, problems: mismatches };
  }

  const lesson = validateLesson({
    id: `generated-${hashString(exercise.fingerprint).toString(36)}`,
    title: exercise.title,
    subtitle: exercise.subtitle,
    steps: exercise.steps,
  });
  if (!lesson.ok) {
    return {
      ok: false,
      problems: lesson.problems.map((problem) => `Compiled lesson: ${problem}`),
    };
  }

  return {
    ok: true,
    value: {
      fingerprint: exercise.fingerprint,
      skill: exercise.skill,
      kind: kind.id,
      concept: kind.concept,
      label: kind.label,
      difficulty: exercise.difficulty,
      lesson: lesson.value,
    },
  };
}

/**
 * Asks a generator for an exercise, retrying with the rejection reasons
 * until a candidate passes `acceptCandidate` or attempts run out.
 */
export async function produceExercise(
  generator: ExerciseGenerator,
  request: ExerciseRequest,
  { maxAttempts = 3 }: { maxAttempts?: number } = {},
): Promise<ValidationResult<AcceptedExercise>> {
  let previousProblems: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let raw: unknown;
    try {
      raw = await generator.generate(request, { attempt, previousProblems });
    } catch (error) {
      previousProblems = [
        `Generator "${generator.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
      ];
      continue;
    }
    const result = acceptCandidate(raw, request);
    if (result.ok) return result;
    previousProblems = result.problems;
  }

  return {
    ok: false,
    problems: [
      `No valid exercise after ${maxAttempts} attempts.`,
      ...previousProblems,
    ],
  };
}
