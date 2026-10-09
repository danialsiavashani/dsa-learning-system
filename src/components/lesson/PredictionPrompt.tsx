"use client";

import type { Prediction } from "@/curriculum/types";

type PredictionPromptProps = {
  prediction: Prediction;
  selectedId: string | null;
  onSelect: (optionId: string) => void;
};

export default function PredictionPrompt({
  prediction,
  selectedId,
  onSelect,
}: PredictionPromptProps) {
  const answered = selectedId !== null;
  const correct = selectedId === prediction.correctOptionId;

  return (
    <div className="mt-6 rounded-xl border border-[#C9D4E2] p-4">
      <p className="font-bold">{prediction.question}</p>

      <div className="mt-4 flex flex-col gap-2">
        {prediction.options.map((option) => {
          const selected = selectedId === option.id;

          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              disabled={answered}
              className={[
                "rounded-xl border px-4 py-3 text-left transition",
                selected
                  ? "border-[#2B6CE0] bg-[#E3ECFC]"
                  : "border-[#C9D4E2] bg-white",
                answered ? "cursor-default" : "hover:border-[#18263A]",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {answered && (
        <p
          className={[
            "mt-4 font-semibold",
            correct ? "text-green-700" : "text-red-700",
          ].join(" ")}
        >
          {correct
            ? "Correct."
            : "Not quite. Every value at index 2 and after it has to move."}
        </p>
      )}
    </div>
  );
}