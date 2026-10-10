import { z } from "zod";
import {
  lessonSchema,
  lessonStepsSchema,
  type Lesson,
  type LessonStep,
} from "./schema";

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; problems: string[] };

export class LessonValidationError extends Error {
  constructor(
    readonly lessonId: string,
    readonly problems: string[],
  ) {
    super(`Lesson "${lessonId}" is invalid:\n- ${problems.join("\n- ")}`);
  }
}

export function describeZodError(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function validateSteps(input: unknown): ValidationResult<LessonStep[]> {
  const parsed = lessonStepsSchema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, problems: describeZodError(parsed.error) };
}

export function validateLesson(input: unknown): ValidationResult<Lesson> {
  const parsed = lessonSchema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, problems: describeZodError(parsed.error) };
}

/**
 * For handcrafted lessons: a broken lesson is a programming error, so fail
 * loudly at module load (and therefore at build and test time).
 */
export function defineLesson(input: z.input<typeof lessonSchema>): Lesson {
  const result = validateLesson(input);
  if (!result.ok) throw new LessonValidationError(input.id, result.problems);
  return result.value;
}
