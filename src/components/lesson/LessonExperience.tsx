"use client";

import { useReducer, useState, type ReactNode } from "react";
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
  /**
   * The lesson step's request that started this practice run. Follow-up
   * examples reuse it, so the whole run drills the skills that step taught.
   */
  origin: PracticeRequest | null;
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
export default function LessonExperience({
  lesson,
  nav,
}: {
  lesson: Lesson;
  /** Concept navigation, shown while on the lesson itself. */
  nav?: ReactNode;
}) {
  const [lessonSession, lessonDispatch] = useReducer(sessionReducer, initialSession);
  const [exerciseSession, exerciseDispatch] = useReducer(sessionReducer, initialSession);
  const [practice, setPractice] = useState<PracticeState>({
    exercise: null,
    origin: null,
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
      origin: request,
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
  // Inside a generated example, "Another example" repeats the originating request.
  const { origin } = practice;
  const exerciseControls = origin ? { ...controls, onRequest: () => requestExample(origin) } : controls;

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
        practice={exerciseControls}
      />
    );
  }

  return (
    <LessonRunner
      lesson={lesson}
      session={lessonSession}
      dispatch={lessonDispatch}
      eyebrow="Java DSA Tutor"
      headerAction={nav}
      practice={controls}
    />
  );
}
