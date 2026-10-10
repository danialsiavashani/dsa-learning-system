"use client";

import { useEffect, useRef, type Dispatch, type ReactNode } from "react";
import VisualStage from "@/components/visualizers/VisualStage";
import { checkAnswer, type Response } from "@/lib/learning/answers";
import type { Lesson } from "@/lib/learning/schema";
import {
  canAdvance,
  stageFrame,
  type SessionAction,
  type SessionState,
} from "@/lib/learning/session";
import AnotherExample, { type PracticeControls } from "./AnotherExample";
import StepPanel from "./StepPanel";
import { useReplay } from "./useReplay";

type LessonRunnerProps = {
  /** Any validated step sequence: a handcrafted lesson or a generated exercise. */
  lesson: Lesson;
  session: SessionState;
  dispatch: Dispatch<SessionAction>;
  eyebrow: string;
  headerAction?: ReactNode;
  practice: PracticeControls;
};

const buttonBase =
  "rounded-xl px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40";

export default function LessonRunner({
  lesson,
  session,
  dispatch,
  eyebrow,
  headerAction,
  practice,
}: LessonRunnerProps) {
  const { steps } = lesson;
  const index = Math.min(session.stepIndex, steps.length - 1);
  const step = steps[index];
  const answer = session.answers[step.id];
  const unlocked = canAdvance(step, session);
  const last = index === steps.length - 1;

  const frame = stageFrame(steps, index, session);
  const { rewound, replay } = useReplay(
    `${lesson.id}/${step.id}/${answer ? "answered" : "open"}`,
  );
  const visual = rewound && frame.replayFrom ? frame.replayFrom : frame.visual;

  // On desktop the step panel scrolls internally; start each step at its top.
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [lesson.id, step.id]);

  function respond(response: Response) {
    if (!("question" in step)) return;
    dispatch({
      type: "answer",
      stepId: step.id,
      answer: { response, result: checkAnswer(step.question, response) },
    });
  }

  return (
    // Desktop: exactly one viewport tall, no page scroll. Mobile: normal scrolling.
    <main className="min-h-screen bg-canvas text-ink lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 sm:px-5 lg:h-full lg:min-h-0">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{lesson.title}</h1>
            {lesson.subtitle && (
              <p className="mt-2 max-w-3xl text-muted">{lesson.subtitle}</p>
            )}
          </div>
          {headerAction}
        </header>

        <section className="grid flex-1 grid-cols-1 gap-5 lg:min-h-0 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
          <section
            className="rounded-2xl border border-line bg-panel p-5 lg:min-h-0 lg:overflow-hidden"
            aria-label="Visualization"
          >
            <VisualStage visual={visual} instant={rewound} />
          </section>

          <section
            ref={panelRef}
            className="rounded-2xl border border-line bg-panel p-5 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain"
            aria-label="Lesson step"
          >
            <StepPanel
              step={step}
              answer={answer}
              onAnswer={respond}
              footer={
                step.practice &&
                unlocked && <AnotherExample request={step.practice} controls={practice} />
              }
            />
          </section>
        </section>

        <footer className="mt-5 border-t border-line pt-4">
          <div
            className="mb-3 h-1.5 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={index + 1}
            aria-label="Lesson progress"
          >
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${((index + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => dispatch({ type: "back" })}
              disabled={index === 0}
              className={`${buttonBase} border border-line bg-panel`}
            >
              Back
            </button>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">
                Step {index + 1} of {steps.length}
                {!unlocked && <span className="hidden sm:inline"> · answer to continue</span>}
              </span>
              <button
                type="button"
                onClick={replay}
                disabled={!frame.replayFrom}
                className={`${buttonBase} border border-line bg-panel`}
              >
                Replay
              </button>
            </div>

            <button
              type="button"
              onClick={() => dispatch({ type: "next", steps })}
              disabled={last || !unlocked}
              className={`${buttonBase} bg-ink px-5 text-canvas`}
            >
              Next
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
