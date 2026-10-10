import type { AnswerResult, Response } from "./answers";
import type { LessonStep, VisualState } from "./schema";

/**
 * Pure navigation and progression state for one step sequence (a lesson or a
 * generated exercise). The React layer only dispatches actions.
 */

export type StepAnswer = { response: Response; result: AnswerResult };

export type SessionState = {
  stepIndex: number;
  answers: Record<string, StepAnswer>;
};

export type SessionAction =
  | { type: "next"; steps: LessonStep[] }
  | { type: "back" }
  | { type: "answer"; stepId: string; answer: StepAnswer }
  | { type: "reset" };

export const initialSession: SessionState = { stepIndex: 0, answers: {} };

export function stepHasQuestion(
  step: LessonStep,
): step is Extract<LessonStep, { question: unknown }> {
  return "question" in step;
}

/** A step blocks progression until its question has been answered. */
export function canAdvance(step: LessonStep, state: SessionState): boolean {
  return !stepHasQuestion(step) || step.id in state.answers;
}

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case "next": {
      const step = action.steps[state.stepIndex];
      const last = state.stepIndex >= action.steps.length - 1;
      if (!step || last || !canAdvance(step, state)) return state;
      return { ...state, stepIndex: state.stepIndex + 1 };
    }
    case "back":
      return state.stepIndex === 0
        ? state
        : { ...state, stepIndex: state.stepIndex - 1 };
    case "answer":
      // First response is final, so the learner commits before seeing results.
      if (action.stepId in state.answers) return state;
      return {
        ...state,
        answers: { ...state.answers, [action.stepId]: action.answer },
      };
    case "reset":
      return initialSession;
  }
}

/**
 * Visuals are sticky: a step without its own visual keeps showing the most
 * recent one, so the stage never goes blank mid-lesson.
 */
export function resolveVisual(
  steps: LessonStep[],
  index: number,
): VisualState | undefined {
  for (let i = Math.min(index, steps.length - 1); i >= 0; i--) {
    const visual = steps[i].visual;
    if (visual) return visual;
  }
  return undefined;
}

export type StageFrame = {
  /** What the stage should show now. */
  visual: VisualState | undefined;
  /** The state Replay rewinds to before animating into `visual`. */
  replayFrom: VisualState | undefined;
};

export function stageFrame(
  steps: LessonStep[],
  index: number,
  state: SessionState,
): StageFrame {
  const step = steps[index];
  const own = resolveVisual(steps, index);
  const reveal = "reveal" in step ? step.reveal : undefined;

  if (reveal && step.id in state.answers) {
    return { visual: reveal.visual, replayFrom: replayable(own, reveal.visual) };
  }

  const previous = index > 0 ? resolveVisual(steps, index - 1) : undefined;
  return { visual: own, replayFrom: replayable(previous, own) };
}

/** Replay only makes sense between two different states of one visualizer. */
function replayable(
  from: VisualState | undefined,
  to: VisualState | undefined,
): VisualState | undefined {
  return from && to && from !== to && from.kind === to.kind ? from : undefined;
}
