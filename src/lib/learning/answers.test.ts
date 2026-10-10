import { describe, expect, it } from "vitest";
import { checkAnswer, parseNumberList } from "./answers";
import type { ChoiceQuestion, NumberListQuestion } from "./schema";

const choice: ChoiceQuestion = {
  kind: "choice",
  prompt: "Which values shift?",
  options: [
    { id: "a", label: "Only 2", feedback: "Too few." },
    { id: "b", label: "2, 9, and 3" },
  ],
  correctOptionId: "b",
  explanation: "Everything from index 2 onward moves.",
};

const numbers: NumberListQuestion = {
  kind: "number-list",
  prompt: "Type the result.",
  expected: [4, 5, 8],
};

describe("checkAnswer: choice", () => {
  it("marks the correct option correct", () => {
    const result = checkAnswer(choice, { kind: "choice", optionId: "b" });
    expect(result.correct).toBe(true);
    expect(result.feedback).toBe("Correct.");
  });

  it("returns option-specific feedback and the right answer on a miss", () => {
    const result = checkAnswer(choice, { kind: "choice", optionId: "a" });
    expect(result).toMatchObject({
      correct: false,
      feedback: "Too few.",
      correctAnswer: "2, 9, and 3",
      explanation: "Everything from index 2 onward moves.",
    });
  });

  it("rejects options that are not part of the question", () => {
    expect(() => checkAnswer(choice, { kind: "choice", optionId: "z" })).toThrow();
  });

  it("rejects a response of the wrong kind", () => {
    expect(() => checkAnswer(choice, { kind: "number-list", values: [1] })).toThrow();
  });
});

describe("checkAnswer: number-list", () => {
  it("accepts an exact match", () => {
    expect(checkAnswer(numbers, { kind: "number-list", values: [4, 5, 8] }).correct).toBe(true);
  });

  it("points at the first difference", () => {
    const result = checkAnswer(numbers, { kind: "number-list", values: [4, 8, 5] });
    expect(result.correct).toBe(false);
    expect(result.feedback).toContain("index 1");
    expect(result.correctAnswer).toBe("4, 5, 8");
  });

  it("explains a length mismatch", () => {
    const result = checkAnswer(numbers, { kind: "number-list", values: [4, 5] });
    expect(result.correct).toBe(false);
    expect(result.feedback).toContain("2 values");
  });
});

describe("parseNumberList", () => {
  it.each([
    ["4, 5, 8", [4, 5, 8]],
    ["[4,5,8]", [4, 5, 8]],
    ["{4, 5, 8}", [4, 5, 8]],
    ["4 5 8", [4, 5, 8]],
    ["  -3; 0 ;12 ", [-3, 0, 12]],
  ])("parses %j", (input, expected) => {
    expect(parseNumberList(input)).toEqual({ ok: true, values: expected });
  });

  it.each(["", "[]", "{}", "4, five", "4,,x"])("rejects %j", (input) => {
    expect(parseNumberList(input).ok).toBe(false);
  });
});
