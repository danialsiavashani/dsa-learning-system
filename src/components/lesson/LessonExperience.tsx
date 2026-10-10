"use client";

import { useReducer, useState } from "react";
import {
  exerciseGenerator,
  produceExercise,
  type AcceptedExercise,
} from "@/lib/exercises";
import type { Lesson, PracticeRequest } from "@/lib/learning/schema";
import { initialSession, sessionReducer } from "@/lib/learning/session";
import LessonRunner from "./LessonRunner";

type PracticeState = {
  exercise: AcceptedExercise | null;
  /** How many examples have been generated in this visit. */
  count: number;
  /** Fingerprints already shown, so each new example is different. */
  seen: string[];
  pending: boolean;
  error: string | null;
};

/**
 * Hosts a canonical lesson plus any generated examples requested from it.
 * Both are rendered by the same LessonRunner; the lesson's progress is kept
 * while the learner practices.
 */
export default function LessonExperience({ lesson }: { lesson: Lesson }) {
  const [lessonSession, lessonDispatch] = useReducer(sessionReducer, initialSession);
  const [exerciseSession, exerciseDispatch] = useReducer(sessionReducer, initialSession);
  const [practice, setPractice] = useState<PracticeState>({
    exercise: null,
    count: 0,
    seen: [],
    pending: false,
    error: null,
  });

  async function requestExample(request: PracticeRequest) {
    setPractice((state) => ({ ...state, pending: true, error: null }));
    const result = await produceExercise(exerciseGenerator, {
      ...request,
      avoid: practice.seen,
    });

    if (!result.ok) {
      console.warn("Generated exercise rejected:", result.problems);
      setPractice((state) => ({
        ...state,
        pending: false,
        error: "Couldn't build a valid example just now. Please try again.",
      }));
      return;
    }

    const exercise = result.value;
    exerciseDispatch({ type: "reset" });
    setPractice((state) => ({
      exercise,
      count: state.count + 1,
      seen: [...state.seen, exercise.fingerprint],
      pending: false,
      error: null,
    }));
    window.scrollTo({ top: 0 });
  }

  const controls = {
    onRequest: requestExample,
    pending: practice.pending,
    error: practice.error,
  };

  if (practice.exercise) {
    const { exercise } = practice;
    return (
      <LessonRunner
        key={exercise.fingerprint}
        lesson={exercise.lesson}
        session={exerciseSession}
        dispatch={exerciseDispatch}
        eyebrow={`${exercise.label} · generated example ${practice.count}`}
        headerAction={
          <button
            type="button"
            onClick={() =>
              setPractice((state) => ({ ...state, exercise: null, error: null }))
            }
            className="rounded-xl border border-line bg-panel px-4 py-2 text-sm font-semibold transition hover:border-ink"
          >
            Back to {lesson.title}
          </button>
        }
        practice={controls}
      />
    );
  }

  return (
    <LessonRunner
      lesson={lesson}
      session={lessonSession}
      dispatch={lessonDispatch}
      eyebrow="Interactive DSA Tutor"
      practice={controls}
    />
  );
}
