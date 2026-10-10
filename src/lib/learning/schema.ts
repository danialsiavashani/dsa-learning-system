import { z } from "zod";
import { DEFAULT_TREE_LIMITS, treeProblems } from "@/lib/domain/tree";

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

export const EXERCISE_KINDS = [
  "array-insertion",
  "array-removal",
  "stack-operations",
  "recursion-trace",
  "tree-dfs",
] as const;
export const DIFFICULTIES = ["intro", "standard", "challenge"] as const;

/**
 * The skills each exercise kind can drill. A lesson step's practice request
 * may name a subset, so "Another example" reinforces exactly what that step
 * just taught; the pipeline rejects generated exercises outside the subset.
 */
export const EXERCISE_SKILLS = {
  "array-insertion": ["insert"],
  "array-removal": ["remove"],
  "stack-operations": ["top", "popped", "peek", "final", "operation"],
  "recursion-trace": [
    "next-call",
    "base-return",
    "return-value",
    "resumes",
    "final",
    "calls",
    "returns",
    "printed",
  ],
  "tree-dfs": [
    "next-visit",
    "preorder",
    "inorder",
    "postorder",
    "resumes",
    "path",
    "leaves",
    "visit-position",
  ],
} as const satisfies Record<(typeof EXERCISE_KINDS)[number], readonly string[]>;

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

const stackValueSchema = z.union([
  z.number().finite(),
  z.string().trim().min(1).max(10),
]);

/**
 * A stack, bottom → top. `held` is a value just outside the top of the stack,
 * either waiting to be pushed or just popped; because it keeps its ID, it
 * visibly travels into or out of the stack between states.
 */
export const stackVisualSchema = z
  .object({
    kind: z.literal("stack"),
    items: z.array(z.object({ id: idSchema, value: stackValueSchema })).max(8),
    marks: z.record(idSchema, z.enum(VISUAL_MARKS)).optional(),
    held: z
      .object({ id: idSchema, value: stackValueSchema, label: shortText })
      .optional(),
    /** A note beside the top, e.g. "peek() → 5". */
    callout: shortText.optional(),
    caption: shortText.optional(),
  })
  .superRefine((visual, ctx) => {
    const ids = [
      ...visual.items.map((item) => item.id),
      ...(visual.held ? [visual.held.id] : []),
    ];
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
    if (visual.callout && visual.items.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["callout"],
        message: "A callout points at the top, so the stack cannot be empty.",
      });
    }
  });

export const FRAME_STATUSES = ["running", "waiting", "base", "returning"] as const;

/**
 * A call stack, bottom → top. Only the top frame can be active; every frame
 * beneath it is waiting for the call above it. `carry` is a returned value
 * travelling down the stack; it keeps its ID so it visibly moves from the
 * returning frame to the one that resumes.
 */
export const callStackVisualSchema = z
  .object({
    kind: z.literal("callStack"),
    frames: z
      .array(
        z.object({
          id: idSchema,
          call: z.string().trim().min(1).max(28),
          status: z.enum(FRAME_STATUSES),
          detail: z.string().trim().min(1).max(40).optional(),
        }),
      )
      .max(7),
    carry: z
      .object({
        id: idSchema,
        value: z.string().trim().min(1).max(10),
        frameId: idSchema,
        label: z.string().trim().min(1).max(16).optional(),
      })
      .optional(),
    /** The frame that was just called, so it can animate in. */
    entering: idSchema.optional(),
    phase: z.enum(["calling", "unwinding"]).optional(),
    /** Lines printed so far, for methods that print. */
    output: z.array(z.string().trim().min(1).max(12)).max(10).optional(),
    caption: shortText.optional(),
  })
  .superRefine((visual, ctx) => {
    const ids = visual.frames.map((frame) => frame.id);
    for (const id of duplicates(ids)) {
      ctx.addIssue({ code: "custom", path: ["frames"], message: `Duplicate frame id "${id}".` });
    }
    visual.frames.slice(0, -1).forEach((frame, position) => {
      if (frame.status !== "waiting") {
        ctx.addIssue({
          code: "custom",
          path: ["frames", position, "status"],
          message: `Frame "${frame.call}" is below the top, so it must be waiting, not ${frame.status}.`,
        });
      }
    });
    if (visual.carry && !ids.includes(visual.carry.frameId)) {
      ctx.addIssue({
        code: "custom",
        path: ["carry", "frameId"],
        message: `The carried value points at unknown frame "${visual.carry.frameId}".`,
      });
    }
    if (visual.entering && visual.entering !== ids[ids.length - 1]) {
      ctx.addIssue({
        code: "custom",
        path: ["entering"],
        message: "Only the top frame can be entering: new calls go on top.",
      });
    }
  });

/**
 * A binary tree, optionally mid-traversal: `path` is the chain of active DFS
 * calls from the root, `visited` the processed nodes in order, and `nullAt`
 * a dfs(null) call on an empty child slot (the base case).
 */
export const treeVisualSchema = z
  .object({
    kind: z.literal("tree"),
    root: idSchema.nullable(),
    nodes: z
      .array(
        z.object({
          id: idSchema,
          value: z.number().int().min(-999).max(999),
          left: idSchema.nullable(),
          right: idSchema.nullable(),
        }),
      )
      .max(DEFAULT_TREE_LIMITS.maxNodes),
    path: z.array(idSchema).optional(),
    visited: z.array(idSchema).optional(),
    nullAt: z.object({ parent: idSchema, side: z.enum(["left", "right"]) }).optional(),
    marks: z.record(idSchema, z.enum(VISUAL_MARKS)).optional(),
    /** Short labels under nodes, e.g. "root", "leaf". */
    tags: z.record(idSchema, z.string().trim().min(1).max(14)).optional(),
    caption: shortText.optional(),
  })
  .superRefine((visual, ctx) => {
    for (const problem of treeProblems({ root: visual.root, nodes: visual.nodes })) {
      ctx.addIssue({ code: "custom", path: ["nodes"], message: problem });
    }
    const byId = new Map(visual.nodes.map((node) => [node.id, node]));
    const known = (field: string, ids: string[]) => {
      for (const id of ids) {
        if (!byId.has(id)) {
          ctx.addIssue({ code: "custom", path: [field], message: `${field} refers to unknown node "${id}".` });
        }
      }
    };
    known("visited", visual.visited ?? []);
    known("marks", Object.keys(visual.marks ?? {}));
    known("tags", Object.keys(visual.tags ?? {}));
    for (const id of duplicates(visual.visited ?? [])) {
      ctx.addIssue({ code: "custom", path: ["visited"], message: `Node "${id}" is visited twice.` });
    }

    const path = visual.path ?? [];
    if (path.length > 0 && path[0] !== visual.root) {
      ctx.addIssue({ code: "custom", path: ["path"], message: "The call path must start at the root." });
    }
    path.slice(1).forEach((id, i) => {
      const parent = byId.get(path[i]);
      if (!parent || (parent.left !== id && parent.right !== id)) {
        ctx.addIssue({
          code: "custom",
          path: ["path", i + 1],
          message: `"${id}" is not a child of "${path[i]}": a call path follows edges.`,
        });
      }
    });
    if (visual.nullAt) {
      const parent = byId.get(visual.nullAt.parent);
      if (!parent || parent[visual.nullAt.side] !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["nullAt"],
          message: `dfs(null) needs an empty ${visual.nullAt.side} child under "${visual.nullAt.parent}".`,
        });
      }
      if (path[path.length - 1] !== visual.nullAt.parent) {
        ctx.addIssue({
          code: "custom",
          path: ["nullAt"],
          message: "dfs(null) is called by the frame at the top of the path.",
        });
      }
    }
  });

export const visualStateSchema = z.discriminatedUnion("kind", [
  arrayVisualSchema,
  stackVisualSchema,
  callStackVisualSchema,
  treeVisualSchema,
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
export const practiceRequestSchema = z
  .object({
    kind: exerciseKindSchema,
    difficulty: difficultySchema,
    /** Restrict generated practice to these skills of the kind. */
    skills: z.array(z.string()).min(1).max(8).optional(),
  })
  .superRefine((request, ctx) => {
    const known: readonly string[] = EXERCISE_SKILLS[request.kind];
    for (const skill of request.skills ?? []) {
      if (!known.includes(skill)) {
        ctx.addIssue({
          code: "custom",
          path: ["skills"],
          message: `"${skill}" is not a skill of ${request.kind} (${known.join(", ")}).`,
        });
      }
    }
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
  reveal: revealSchema.optional(),
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

/**
 * Where a canonical lesson's explanations come from. Canonical content is
 * grounded in vetted sources (OpenDSA for concepts and pedagogy, Princeton
 * algs4 and the Java API docs for implementation), paraphrased, never copied.
 */
export const lessonSourceSchema = z.object({
  title: shortText,
  url: z.string().url(),
  role: z.enum(["concept", "implementation", "pedagogy"]),
});

export const lessonSchema = z.object({
  id: idSchema,
  title: shortText,
  subtitle: shortText.optional(),
  sources: z.array(lessonSourceSchema).max(12).optional(),
  steps: lessonStepsSchema,
});

// ---------------------------------------------------------------------------
// Types. Inputs are what authors (or generators) write; outputs are what the
// engine consumes after validation.

export type ExerciseKindId = z.infer<typeof exerciseKindSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type VisualMark = (typeof VISUAL_MARKS)[number];
export type ArrayVisual = z.infer<typeof arrayVisualSchema>;
export type StackVisual = z.infer<typeof stackVisualSchema>;
export type CallStackVisual = z.infer<typeof callStackVisualSchema>;
export type TreeVisual = z.infer<typeof treeVisualSchema>;
export type VisualState = z.infer<typeof visualStateSchema>;
export type CodeView = z.infer<typeof codeViewSchema>;
export type ChoiceQuestion = z.infer<typeof choiceQuestionSchema>;
export type NumberListQuestion = z.infer<typeof numberListQuestionSchema>;
export type Question = z.infer<typeof questionSchema>;
export type PracticeRequest = z.infer<typeof practiceRequestSchema>;
export type LessonSource = z.infer<typeof lessonSourceSchema>;
export type Reveal = z.infer<typeof revealSchema>;
export type LessonStep = z.infer<typeof lessonStepSchema>;
export type StepMode = LessonStep["mode"];
export type Lesson = z.infer<typeof lessonSchema>;
export type LessonInput = z.input<typeof lessonSchema>;
export type LessonStepInput = z.input<typeof lessonStepSchema>;
