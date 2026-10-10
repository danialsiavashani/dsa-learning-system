import { createLocalGenerator } from "./localGenerator";
import type { ExerciseGenerator } from "./types";

export { acceptCandidate, produceExercise } from "./pipeline";
export type { AcceptedExercise, ExerciseGenerator, ExerciseRequest } from "./types";

/**
 * The configured exercise provider. This is the single swap point for a
 * remote (e.g. DeepSeek-backed) generator; everything downstream of it
 * (validation, rendering, grading) stays the same.
 */
export const exerciseGenerator: ExerciseGenerator = createLocalGenerator();
