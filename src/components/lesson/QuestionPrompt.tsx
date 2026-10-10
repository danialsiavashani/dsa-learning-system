"use client";

import { useState, type FormEvent } from "react";
import { parseNumberList, type Response } from "@/lib/learning/answers";
import type {
  ChoiceQuestion,
  NumberListQuestion,
  Question,
} from "@/lib/learning/schema";
import type { StepAnswer } from "@/lib/learning/session";
import RichText from "./RichText";

type QuestionPromptProps = {
  question: Question;
  answer: StepAnswer | undefined;
  onAnswer: (response: Response) => void;
};

export default function QuestionPrompt({
  question,
  answer,
  onAnswer,
}: QuestionPromptProps) {
  return (
    <div className="mt-6 rounded-xl border border-line p-4">
      <p className="font-bold">
        <RichText text={question.prompt} />
      </p>

      {question.kind === "choice" ? (
        <ChoiceInput question={question} answer={answer} onAnswer={onAnswer} />
      ) : (
        <NumberListInput question={question} answer={answer} onAnswer={onAnswer} />
      )}

      {answer && <Feedback answer={answer} />}
    </div>
  );
}

function ChoiceInput({
  question,
  answer,
  onAnswer,
}: QuestionPromptProps & { question: ChoiceQuestion }) {
  const selectedId = answer?.response.kind === "choice" ? answer.response.optionId : null;

  return (
    <div className="mt-4 flex flex-col gap-2">
      {question.options.map((option) => {
        const selected = selectedId === option.id;
        const isAnswer = answer !== undefined && option.id === question.correctOptionId;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onAnswer({ kind: "choice", optionId: option.id })}
            disabled={answer !== undefined}
            aria-pressed={selected}
            className={[
              "rounded-xl border px-4 py-3 text-left transition",
              selected
                ? "border-accent bg-accent-soft"
                : isAnswer
                  ? "border-fresh bg-white"
                  : "border-line bg-white",
              answer ? "cursor-default" : "hover:border-ink",
            ].join(" ")}
          >
            <RichText text={option.label} />
          </button>
        );
      })}
    </div>
  );
}

function NumberListInput({
  question,
  answer,
  onAnswer,
}: QuestionPromptProps & { question: NumberListQuestion }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseNumberList(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    onAnswer({ kind: "number-list", values: parsed.values });
  }

  if (answer?.response.kind === "number-list") {
    return (
      <p className="mt-4 rounded-xl border border-accent bg-accent-soft px-4 py-3 font-mono">
        {`{${answer.response.values.join(", ")}}`}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor="number-list-answer">
        Your answer
      </label>
      <input
        id="number-list-answer"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={`${question.expected.length} values, e.g. 1, 2, 3`}
        inputMode="text"
        autoComplete="off"
        className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-2.5 font-mono focus:border-accent focus:outline-none"
        aria-invalid={error !== null}
        aria-describedby={error ? "number-list-error" : undefined}
      />
      <button
        type="submit"
        className="rounded-xl bg-ink px-5 py-2.5 font-semibold text-canvas"
      >
        Check
      </button>
      {error && (
        <p id="number-list-error" className="text-sm text-miss sm:basis-full">
          {error}
        </p>
      )}
    </form>
  );
}

function Feedback({ answer }: { answer: StepAnswer }) {
  const { correct, feedback, correctAnswer, explanation } = answer.result;

  return (
    <div className="mt-4 space-y-2" role="status">
      <p className={["font-semibold", correct ? "text-fresh" : "text-miss"].join(" ")}>
        <RichText text={feedback} />
      </p>
      {!correct && (
        <p className="text-sm text-ink">
          Answer: <RichText text={correctAnswer} />
        </p>
      )}
      {explanation && (
        <p className="text-sm leading-6 text-muted">
          <RichText text={explanation} />
        </p>
      )}
    </div>
  );
}
