import { z } from "zod";

/**
 * The learning-content schema. Handcrafted lessons and generated exercises
 * both have to pass through it before they reach the UI, so it is the
 * contract a future LLM provider emits JSON against.
 *
 * Structural rules live in the Zod shapes; cross-field rules (unique IDs,
 * answer keys that point at real options, highlights inside the code) live in
 * `superRefine` checks next to the shape they constrain.
 */

// ---------------------------------------------------------------------------
// Shared vocabulary

export const EXERCISE_KINDS = ["array-insertion"] as const;
export const DIFFICULTIES = ["intro", "standard", "challenge"] as const;

export const exerciseKindSchema = z.enum(EXERCISE_KINDS);
export const difficultySchema = z.enum(DIFFICULTIES);

const idSchema = z.string().trim().min(1).max(64);
const shortText = z.string().trim().min(1).max(200);
const longText = z.string().trim().min(1).max(1200);

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

// ---------------------------------------------------------------------------
// Visual states. Each visualizer owns one variant, discriminated by `kind`.

export const VISUAL_MARKS = ["focus", "moved", "new", "muted"] as const;

export const arrayVisualSchema = z
  .object({
    kind: z.literal("array"),
    items: z
      .array(
        z.object({
          id: idSchema,
          value: z.number().finite().nullable(),
        }),
      )
      .max(12),
    marks: z.record(idSchema, z.enum(VISUAL_MARKS)).optional(),
    pointers: z
      .array(z.object({ index: z.number().int().min(0), label: shortText }))
      .max(4)
      .optional(),
    caption: shortText.optional(),
  })
  .superRefine((visual, ctx) => {
    const ids = visual.items.map((item) => item.id);
    for (const id of duplicates(ids)) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: `Duplicate item id "${id}".`,
      });
    }
    for (const id of Object.keys(visual.marks ?? {})) {
      if (!ids.includes(id)) {
        ctx.addIssue({
          code: "custom",
          path: ["marks", id],
          message: `Mark refers to unknown item "${id}".`,
        });
      }
    }
    visual.pointers?.forEach((pointer, position) => {
      // A pointer may sit one past the end: that is where an append lands.
      if (pointer.index > visual.items.length) {
        ctx.addIssue({
          code: "custom",
          path: ["pointers", position, "index"],
          message: `Pointer index ${pointer.index} is past the end of the array.`,
        });
      }
    });
  });

export const visualStateSchema = z.discriminatedUnion("kind", [
  arrayVisualSchema,
]);

// ---------------------------------------------------------------------------
// Code

/**
 * Learner-facing code is Java, always. The field exists so the rule is
 * explicit (and enforced) for generated content, not as a per-step choice.
 */
export const CODE_LANGUAGES = ["java"] as const;

export const codeViewSchema = z
  .object({
    source: z.string().min(1).max(4000),
    language: z.enum(CODE_LANGUAGES).default("java"),
    /** 1-based line numbers to emphasise. */
    highlight: z.array(z.number().int().min(1)).optional(),
    /** 1-based line rendered as a blank for the learner to complete. */
    blankLine: z.number().int().min(1).optional(),
  })
  .superRefine((code, ctx) => {
    const lineCount = code.source.split("\n").length;
    code.highlight?.forEach((line, position) => {
      if (line > lineCount) {
        ctx.addIssue({
          code: "custom",
          path: ["highlight", position],
          message: `Highlighted line ${line} is past the last line (${lineCount}).`,
        });
      }
    });
    if (code.blankLine !== undefined && code.blankLine > lineCount) {
      ctx.addIssue({
        code: "custom",
        path: ["blankLine"],
        message: `Blank line ${code.blankLine} is past the last line (${lineCount}).`,
      });
    }
  });

// ---------------------------------------------------------------------------
// Questions. Answer keys are data; grading is done by `checkAnswer`.

export const choiceQuestionSchema = z
  .object({
    kind: z.literal("choice"),
    prompt: shortText,
    options: z
      .array(
        z.object({
          id: idSchema,
          label: shortText,
          /** Shown when this option is picked. */
          feedback: longText.optional(),
        }),
      )
      .min(2)
      .max(6),
    correctOptionId: idSchema,
    /** Shown after any answer: the reasoning behind the correct option. */
    explanation: longText.optional(),
  })
  .superRefine((question, ctx) => {
    const ids = question.options.map((option) => option.id);
    for (const id of duplicates(ids)) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: `Duplicate option id "${id}".`,
      });
    }
    for (const label of duplicates(question.options.map((o) => o.label))) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: `Two options share the label "${label}".`,
      });
    }
    if (!ids.includes(question.correctOptionId)) {
      ctx.addIssue({
        code: "custom",
        path: ["correctOptionId"],
        message: `Correct option "${question.correctOptionId}" is not one of the options.`,
      });
    }
  });

export const numberListQuestionSchema = z.object({
  kind: z.literal("number-list"),
  prompt: shortText,
  expected: z.array(z.number().finite()).min(1).max(12),
  explanation: longText.optional(),
});

export const questionSchema = z.discriminatedUnion("kind", [
  choiceQuestionSchema,
  numberListQuestionSchema,
]);

// ---------------------------------------------------------------------------
// Steps. `mode` is the discriminator; each mode only carries what it needs.

/** Lets a step offer freshly generated examples of the same idea. */
export const practiceRequestSchema = z.object({
  kind: exerciseKindSchema,
  difficulty: difficultySchema,
});

/** What the stage shows once a question has been answered. */
export const revealSchema = z.object({
  visual: visualStateSchema,
  body: longText.optional(),
});

const stepBase = {
  id: idSchema,
  title: shortText,
  body: longText.optional(),
  visual: visualStateSchema.optional(),
  code: codeViewSchema.optional(),
  practice: practiceRequestSchema.optional(),
};

const showStepSchema = z.object({
  ...stepBase,
  mode: z.literal("show"),
});

const traceStepSchema = z.object({
  ...stepBase,
  mode: z.literal("trace"),
  visual: visualStateSchema,
  code: codeViewSchema,
});

const predictStepSchema = z.object({
  ...stepBase,
  mode: z.literal("predict"),
  question: questionSchema,
  reveal: revealSchema.optional(),
});

const explainStepSchema = z.object({
  ...stepBase,
  mode: z.literal("explain"),
  question: choiceQuestionSchema,
});

const completeStepSchema = z
  .object({
    ...stepBase,
    mode: z.literal("complete"),
    code: codeViewSchema,
    question: choiceQuestionSchema,
  })
  .superRefine((step, ctx) => {
    const { blankLine, source } = step.code;
    if (blankLine === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["code", "blankLine"],
        message: "A complete step needs a blank line to fill in.",
      });
      return;
    }
    // The answer key must be the code that was blanked out.
    const missing = source.split("\n")[blankLine - 1]?.trim();
    const correct = step.question.options.find(
      (option) => option.id === step.question.correctOptionId,
    );
    if (correct && missing !== undefined && correct.label.trim() !== missing) {
      ctx.addIssue({
        code: "custom",
        path: ["question", "correctOptionId"],
        message: `The correct option must match blank line ${blankLine} ("${missing}").`,
      });
    }
  });

const solveStepSchema = z.object({
  ...stepBase,
  mode: z.literal("solve"),
  question: questionSchema,
  reveal: revealSchema.optional(),
});

export const lessonStepSchema = z.discriminatedUnion("mode", [
  showStepSchema,
  traceStepSchema,
  predictStepSchema,
  explainStepSchema,
  completeStepSchema,
  solveStepSchema,
]);

export const lessonStepsSchema = z
  .array(lessonStepSchema)
  .min(1)
  .max(40)
  .superRefine((steps, ctx) => {
    for (const id of duplicates(steps.map((step) => step.id))) {
      ctx.addIssue({ code: "custom", message: `Duplicate step id "${id}".` });
    }
  });

export const lessonSchema = z.object({
  id: idSchema,
  title: shortText,
  subtitle: shortText.optional(),
  steps: lessonStepsSchema,
});

// ---------------------------------------------------------------------------
// Types. Inputs are what authors (or generators) write; outputs are what the
// engine consumes after validation.

export type ExerciseKindId = z.infer<typeof exerciseKindSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type VisualMark = (typeof VISUAL_MARKS)[number];
export type ArrayVisual = z.infer<typeof arrayVisualSchema>;
export type VisualState = z.infer<typeof visualStateSchema>;
export type CodeView = z.infer<typeof codeViewSchema>;
export type ChoiceQuestion = z.infer<typeof choiceQuestionSchema>;
export type NumberListQuestion = z.infer<typeof numberListQuestionSchema>;
export type Question = z.infer<typeof questionSchema>;
export type PracticeRequest = z.infer<typeof practiceRequestSchema>;
export type Reveal = z.infer<typeof revealSchema>;
export type LessonStep = z.infer<typeof lessonStepSchema>;
export type StepMode = LessonStep["mode"];
export type Lesson = z.infer<typeof lessonSchema>;
export type LessonInput = z.input<typeof lessonSchema>;
export type LessonStepInput = z.input<typeof lessonStepSchema>;
