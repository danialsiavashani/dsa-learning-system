"use client";

import { useState } from "react";
import type { Lesson } from "@/curriculum/types";
import AnimatedArray from "@/components/visualizers/AnimatedArray";
import PredictionPrompt from "@/components/lesson/PredictionPrompt";

type LessonRunnerProps = {
  lesson: Lesson;
};

export default function LessonRunner({ lesson }: LessonRunnerProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [replayStepIndex, setReplayStepIndex] = useState<number | null>(null);

  const [predictionAnswers, setPredictionAnswers] = useState<
    Record<string, string>
  >({});

  const currentLessonStep = lesson.steps[stepIndex];

  const displayedStepIndex = replayStepIndex ?? stepIndex;
  const step = lesson.steps[displayedStepIndex];

  const currentStep = stepIndex + 1;
  const totalSteps = lesson.steps.length;
  const progress = (currentStep / totalSteps) * 100;

  const selectedPrediction =
    predictionAnswers[currentLessonStep.id] ?? null;

  const predictionComplete =
    !currentLessonStep.prediction || selectedPrediction !== null;

  function goBack() {
    setStepIndex((index) => Math.max(0, index - 1));
  }

  function goNext() {
    setStepIndex((index) => Math.min(totalSteps - 1, index + 1));
  }

  function answerPrediction(optionId: string) {
    setPredictionAnswers((answers) => ({
      ...answers,
      [currentLessonStep.id]: optionId,
    }));
  }

  function replay() {
    if (stepIndex === 0) return;

    setReplayStepIndex(stepIndex - 1);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setReplayStepIndex(null);
      });
    });
  }

  return (
    <main className="min-h-screen bg-[#EAF0F6] text-[#18263A]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-5">
        <header className="mb-5">
          <p className="text-sm font-semibold text-[#5B6B80]">
            Interactive DSA Tutor
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {lesson.title}
          </h1>

          {lesson.subtitle && (
            <p className="mt-2 max-w-3xl text-[#5B6B80]">
              {lesson.subtitle}
            </p>
          )}
        </header>

        <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border border-[#C9D4E2] bg-[#F9FBFD] p-5">
            {step.visual?.type === "array" ? (
              <AnimatedArray
                items={step.visual.items}
                activeId={step.visual.activeId}
              />
            ) : (
              <div className="flex min-h-[420px] items-center justify-center">
                <p className="text-[#5B6B80]">
                  No visual for this step yet.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#C9D4E2] bg-[#F9FBFD] p-5">
            <p className="text-sm font-semibold text-[#5B6B80]">
              Current idea
            </p>

            <h2 className="mt-2 text-xl font-bold">
              {step.title}
            </h2>

            {step.explanation && (
              <p className="mt-3 leading-7 text-[#5B6B80]">
                {step.explanation}
              </p>
            )}

            {currentLessonStep.prediction && (
              <PredictionPrompt
                prediction={currentLessonStep.prediction}
                selectedId={selectedPrediction}
                onSelect={answerPrediction}
              />
            )}
          </section>
        </section>

        <footer className="mt-5 border-t border-[#C9D4E2] pt-4">
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#C9D4E2]">
            <div
              className="h-full rounded-full bg-[#2B6CE0] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={stepIndex === 0}
              className="rounded-xl border border-[#C9D4E2] bg-[#F9FBFD] px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>

            <div className="flex items-center gap-3">
              <span className="text-sm text-[#5B6B80]">
                Step {currentStep} of {totalSteps}
              </span>

              <button
                onClick={replay}
                disabled={stepIndex === 0}
                className="rounded-xl border border-[#C9D4E2] bg-[#F9FBFD] px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Replay
              </button>
            </div>

            <button
              onClick={goNext}
              disabled={
                stepIndex === totalSteps - 1 ||
                !predictionComplete
              }
              className="rounded-xl bg-[#18263A] px-5 py-2 font-semibold text-[#EAF0F6] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}