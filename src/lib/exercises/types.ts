import type { z } from "zod";
import type {
  Difficulty,
  ExerciseKindId,
  Lesson,
  LessonStepInput,
  PracticeRequest,
} from "@/lib/learning/schema";
import type { ValidationResult } from "@/lib/learning/validate";

/** What the learner (or tutor) is asking for. */
export type ExerciseRequest = PracticeRequest & {
  /** Free-text learner intent ("make it harder"); for LLM-backed generators. */
  intent?: string;
  /** Fingerprints of examples already shown, so the next one is new. */
  avoid?: string[];
};

export type GenerationContext = {
  attempt: number;
  /** Why the previous attempt was rejected, so a model can self-correct. */
  previousProblems: string[];
};

/**
 * The provider boundary. A generator proposes content; it is never trusted.
 * Its output is `unknown` on purpose: everything it returns goes through
 * `acceptCandidate` before it can reach the UI. A DeepSeek-backed generator
 * implements this same interface.
 */
export interface ExerciseGenerator {
  readonly name: string;
  generate(request: ExerciseRequest, context: GenerationContext): Promise<unknown>;
}

/** Exercise content that passed domain verification, before lesson validation. */
export type CompiledExercise = {
  fingerprint: string;
  /** Which of the kind's skills this exercise drills. */
  skill: string;
  difficulty: Difficulty;
  title: string;
  subtitle: string;
  steps: LessonStepInput[];
};

/**
 * One exercise format: how to parse a candidate, verify it against domain
 * truth, and compile it into ordinary lesson steps.
 */
export type ExerciseKindDefinition<Candidate, Truth> = {
  id: ExerciseKindId;
  concept: string;
  label: string;
  schema: z.ZodType<Candidate>;
  fingerprint: (candidate: Candidate) => string;
  /** The skill (from EXERCISE_SKILLS) this candidate drills. */
  skill: (candidate: Candidate) => string;
  /** Recompute the truth and compare it with the candidate's claims. */
  verify: (candidate: Candidate) => ValidationResult<Truth>;
  compile: (candidate: Candidate, truth: Truth) => Omit<CompiledExercise, "fingerprint" | "skill">;
};

/** Type-erased view of a kind, so kinds with different candidates share one registry. */
export type ExerciseKind = {
  id: ExerciseKindId;
  concept: string;
  label: string;
  accept: (raw: unknown) => ValidationResult<CompiledExercise>;
};

/** An exercise that is safe to render. */
export type AcceptedExercise = {
  fingerprint: string;
  skill: string;
  kind: ExerciseKindId;
  concept: string;
  label: string;
  difficulty: Difficulty;
  lesson: Lesson;
};
