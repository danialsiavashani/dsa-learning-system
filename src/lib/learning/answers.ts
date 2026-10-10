import type {
  ChoiceQuestion,
  NumberListQuestion,
  Question,
} from "./schema";

/** What the learner submitted. Grading never involves free-form judgement. */
export type Response =
  | { kind: "choice"; optionId: string }
  | { kind: "number-list"; values: number[] };

export type AnswerResult = {
  correct: boolean;
  /** Feedback specific to what was submitted. */
  feedback: string;
  /** Human-readable correct answer, for display after a miss. */
  correctAnswer: string;
  explanation?: string;
};

export function checkAnswer(question: Question, response: Response): AnswerResult {
  if (question.kind === "choice" && response.kind === "choice") {
    return checkChoice(question, response.optionId);
  }
  if (question.kind === "number-list" && response.kind === "number-list") {
    return checkNumberList(question, response.values);
  }
  throw new Error(
    `A "${response.kind}" response cannot answer a "${question.kind}" question.`,
  );
}

function checkChoice(question: ChoiceQuestion, optionId: string): AnswerResult {
  const picked = question.options.find((option) => option.id === optionId);
  const answer = question.options.find(
    (option) => option.id === question.correctOptionId,
  );
  if (!picked || !answer) {
    throw new Error(`Option "${optionId}" does not belong to this question.`);
  }
  const correct = picked.id === answer.id;

  return {
    correct,
    feedback: picked.feedback ?? (correct ? "Correct." : "Not quite."),
    correctAnswer: answer.label,
    explanation: question.explanation,
  };
}

function checkNumberList(
  question: NumberListQuestion,
  values: number[],
): AnswerResult {
  const correct =
    values.length === question.expected.length &&
    values.every((value, index) => value === question.expected[index]);

  let feedback = "Correct.";
  if (!correct) {
    const expected = question.expected.length;
    if (values.length !== expected) {
      feedback = `Not quite. Your answer has ${values.length} ${values.length === 1 ? "value" : "values"}; the answer has ${expected}.`;
    } else if (expected === 1) {
      feedback = "Not quite.";
    } else {
      const position = values.findIndex((value, index) => value !== question.expected[index]) + 1;
      feedback = `Not quite. The first difference is value ${position} of ${expected}.`;
    }
  }

  return {
    correct,
    feedback,
    correctAnswer: question.expected.join(", "),
    explanation: question.explanation,
  };
}

/**
 * Parses learner input such as "4, 7, 8", "{4, 7, 8}", "[4 7 8]" or "4;7;8". Returns an
 * error message instead of guessing when the input is ambiguous.
 */
export function parseNumberList(
  input: string,
): { ok: true; values: number[] } | { ok: false; error: string } {
  const trimmed = input.trim().replace(/^[[{]/, "").replace(/[\]}]$/, "").trim();
  if (trimmed === "") return { ok: false, error: "Enter at least one number." };

  const tokens = trimmed.split(/[\s,;]+/).filter(Boolean);
  const values: number[] = [];
  for (const token of tokens) {
    if (!/^-?\d+(\.\d+)?$/.test(token)) {
      return { ok: false, error: `"${token}" is not a number.` };
    }
    values.push(Number(token));
  }
  return { ok: true, values };
}
