import type { ReactNode } from "react";
import type { Response } from "@/lib/learning/answers";
import type { LessonStep, StepMode } from "@/lib/learning/schema";
import type { StepAnswer } from "@/lib/learning/session";
import CodePanel from "./CodePanel";
import QuestionPrompt from "./QuestionPrompt";
import RichText from "./RichText";

const modeLabels: Record<StepMode, string> = {
  show: "Current idea",
  trace: "Trace",
  predict: "Predict",
  explain: "Explain",
  complete: "Complete",
  solve: "Solve",
};

type StepPanelProps = {
  step: LessonStep;
  answer: StepAnswer | undefined;
  onAnswer: (response: Response) => void;
  /** Extra controls under the step, e.g. "Another example". */
  footer?: ReactNode;
};

export default function StepPanel({ step, answer, onAnswer, footer }: StepPanelProps) {
  const question = "question" in step ? step.question : undefined;
  const reveal = "reveal" in step ? step.reveal : undefined;

  // A completed "fill the blank" shows the right line in the code.
  let fill: string | undefined;
  if (step.mode === "complete" && answer) {
    fill = step.question.options.find(
      (option) => option.id === step.question.correctOptionId,
    )?.label;
  }

  return (
    <>
      <p className="text-sm font-semibold text-muted">{modeLabels[step.mode]}</p>

      <h2 className="mt-2 text-xl font-bold">
        <RichText text={step.title} />
      </h2>

      {step.body && (
        <p className="mt-3 leading-7 text-muted">
          <RichText text={step.body} />
        </p>
      )}

      {question && (
        <QuestionPrompt
          key={step.id}
          question={question}
          answer={answer}
          onAnswer={onAnswer}
        />
      )}

      {answer && reveal?.body && (
        <p className="mt-4 leading-7 text-muted">
          <RichText text={reveal.body} />
        </p>
      )}

      {step.code && <CodePanel code={step.code} fill={fill} />}

      {footer}
    </>
  );
}
