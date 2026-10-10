import { describe, expect, it } from "vitest";
import { checkAnswer } from "./answers";
import { lessonStepsSchema, type LessonStep } from "./schema";
import {
  canAdvance,
  initialSession,
  resolveVisual,
  sessionReducer,
  stageFrame,
  type SessionState,
} from "./session";

const before = { kind: "array" as const, items: [{ id: "a", value: 1 }] };
const after = {
  kind: "array" as const,
  items: [
    { id: "a", value: 1 },
    { id: "b", value: 2 },
  ],
};

const steps: LessonStep[] = lessonStepsSchema.parse([
  { id: "intro", mode: "show", title: "Intro", visual: before },
  {
    id: "guess",
    mode: "predict",
    title: "Guess",
    question: {
      kind: "number-list",
      prompt: "Result?",
      expected: [1, 2],
    },
    reveal: { visual: after },
  },
  { id: "result", mode: "show", title: "Result", visual: after },
]);

function answerGuess(state: SessionState, values: number[]): SessionState {
  const step = steps[1];
  if (!("question" in step)) throw new Error("expected a question step");
  const response = { kind: "number-list" as const, values };
  return sessionReducer(state, {
    type: "answer",
    stepId: step.id,
    answer: { response, result: checkAnswer(step.question, response) },
  });
}

describe("sessionReducer", () => {
  it("moves forward and back within bounds", () => {
    let state = sessionReducer(initialSession, { type: "back" });
    expect(state.stepIndex).toBe(0);
    state = sessionReducer(state, { type: "next", steps });
    expect(state.stepIndex).toBe(1);
    state = sessionReducer(state, { type: "back" });
    expect(state.stepIndex).toBe(0);
  });

  it("blocks Next until the question is answered", () => {
    let state = sessionReducer(initialSession, { type: "next", steps });
    expect(canAdvance(steps[1], state)).toBe(false);
    expect(sessionReducer(state, { type: "next", steps })).toBe(state);

    state = answerGuess(state, [9, 9]);
    expect(canAdvance(steps[1], state)).toBe(true);
    expect(sessionReducer(state, { type: "next", steps }).stepIndex).toBe(2);
  });

  it("keeps the first answer", () => {
    let state = sessionReducer(initialSession, { type: "next", steps });
    state = answerGuess(state, [9, 9]);
    state = answerGuess(state, [1, 2]);
    expect(state.answers.guess.result.correct).toBe(false);
  });

  it("does not advance past the last step", () => {
    const state: SessionState = { stepIndex: 2, answers: {} };
    expect(sessionReducer(state, { type: "next", steps })).toBe(state);
  });

  it("resets", () => {
    const state = answerGuess({ stepIndex: 1, answers: {} }, [1, 2]);
    expect(sessionReducer(state, { type: "reset" })).toEqual(initialSession);
  });
});

describe("stage frames", () => {
  it("keeps the previous visual on steps without one", () => {
    expect(resolveVisual(steps, 1)).toBe(steps[0].visual);
  });

  it("reveals the answer state once a question is answered, replaying from the question state", () => {
    const open: SessionState = { stepIndex: 1, answers: {} };
    expect(stageFrame(steps, 1, open)).toEqual({ visual: steps[0].visual, replayFrom: undefined });

    const answered = answerGuess(open, [1, 2]);
    const frame = stageFrame(steps, 1, answered);
    expect(frame.visual?.items).toHaveLength(2);
    expect(frame.replayFrom).toBe(steps[0].visual);
  });

  it("replays from the previous step's visual", () => {
    const frame = stageFrame(steps, 2, { stepIndex: 2, answers: {} });
    expect(frame.visual).toBe(steps[2].visual);
    expect(frame.replayFrom).toBe(steps[0].visual);
  });

  it("has nothing to replay on the first step", () => {
    expect(stageFrame(steps, 0, initialSession).replayFrom).toBeUndefined();
  });
});
