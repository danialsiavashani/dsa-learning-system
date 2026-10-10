import type { ExerciseKindId } from "@/lib/learning/schema";
import { describeZodError } from "@/lib/learning/validate";
import { arrayInsertionKind } from "./kinds/arrayInsertion";
import { recursionTraceKind } from "./kinds/recursionTrace";
import { stackOperationsKind } from "./kinds/stackOperations";
import type { ExerciseKind, ExerciseKindDefinition } from "./types";

/** Erases a kind's candidate/truth types behind a uniform parse → verify → compile. */
function erase<Candidate, Truth>(
  definition: ExerciseKindDefinition<Candidate, Truth>,
): ExerciseKind {
  return {
    id: definition.id,
    concept: definition.concept,
    label: definition.label,
    accept(raw) {
      const parsed = definition.schema.safeParse(raw);
      if (!parsed.success) {
        return { ok: false, problems: describeZodError(parsed.error) };
      }
      const verified = definition.verify(parsed.data);
      if (!verified.ok) return verified;
      return {
        ok: true,
        value: {
          fingerprint: definition.fingerprint(parsed.data),
          ...definition.compile(parsed.data, verified.value),
        },
      };
    },
  };
}

/** Adding an exercise format = adding its definition here. */
export const exerciseKinds: Record<ExerciseKindId, ExerciseKind> = {
  "array-insertion": erase(arrayInsertionKind),
  "stack-operations": erase(stackOperationsKind),
  "recursion-trace": erase(recursionTraceKind),
};
