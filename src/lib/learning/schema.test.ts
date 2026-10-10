import { describe, expect, it } from "vitest";
import { concepts } from "@/curriculum";
import { arraysLesson } from "@/curriculum/lessons/arrays";
import type { LessonInput, LessonStepInput } from "./schema";
import { defineLesson, LessonValidationError, validateLesson } from "./validate";

function lessonWith(...steps: LessonStepInput[]): LessonInput {
  return { id: "test", title: "Test", steps };
}

const visual = {
  kind: "array" as const,
  items: [
    { id: "a", value: 1 },
    { id: "b", value: 2 },
  ],
};

function problemsOf(input: unknown): string[] {
  const result = validateLesson(input);
  return result.ok ? [] : result.problems;
}

describe("canonical lessons", () => {
  it.each(concepts)("the $label lesson passes validation", ({ lesson }) => {
    expect(validateLesson(lesson).ok).toBe(true);
  });

  it.each(concepts)("the $label lesson covers every learning mode", ({ lesson }) => {
    const modes = new Set(lesson.steps.map((step) => step.mode));
    expect([...modes].sort()).toEqual(
      ["complete", "explain", "predict", "show", "solve", "trace"].sort(),
    );
  });

  it.each(concepts)("the $label lesson offers generated practice", ({ lesson }) => {
    expect(lesson.steps.some((step) => step.practice)).toBe(true);
  });

  it("concept slugs are unique", () => {
    expect(new Set(concepts.map((c) => c.slug)).size).toBe(concepts.length);
  });

  it("the Arrays lesson is still first", () => {
    expect(concepts[0].lesson).toBe(arraysLesson);
  });
});

describe("stack visual validation", () => {
  const stackStep = (visual: Record<string, unknown>): LessonStepInput =>
    ({ id: "s", mode: "show", title: "Stack", visual: { kind: "stack", ...visual } }) as LessonStepInput;

  it("accepts numbers, short labels and a held value", () => {
    expect(
      problemsOf(
        lessonWith(
          stackStep({
            items: [
              { id: "a", value: 1 },
              { id: "b", value: "main()" },
            ],
            held: { id: "c", value: 3, label: "push(3)" },
            marks: { c: "focus" },
            callout: "peek() → main()",
          }),
        ),
      ),
    ).toEqual([]);
  });

  it("rejects a held value that reuses an item id", () => {
    const problems = problemsOf(
      lessonWith(
        stackStep({
          items: [{ id: "a", value: 1 }],
          held: { id: "a", value: 2, label: "pop() → 2" },
        }),
      ),
    );
    expect(problems.join()).toContain('Duplicate item id "a"');
  });

  it("rejects a callout on an empty stack and marks on unknown items", () => {
    const problems = problemsOf(
      lessonWith(stackStep({ items: [], callout: "peek() → ?", marks: { ghost: "new" } })),
    );
    expect(problems.join()).toContain("cannot be empty");
    expect(problems.join()).toContain('unknown item "ghost"');
  });

  it("rejects labels too long to fit a stack cell", () => {
    expect(
      problemsOf(lessonWith(stackStep({ items: [{ id: "a", value: "averyverylonglabel" }] }))),
    ).not.toEqual([]);
  });
});

describe("lesson validation", () => {
  it("accepts a minimal show step", () => {
    expect(problemsOf(lessonWith({ id: "s", mode: "show", title: "Hi" }))).toEqual([]);
  });

  it("rejects duplicate step ids", () => {
    const problems = problemsOf(
      lessonWith(
        { id: "s", mode: "show", title: "One" },
        { id: "s", mode: "show", title: "Two" },
      ),
    );
    expect(problems.join()).toContain('Duplicate step id "s"');
  });

  it("rejects an unknown mode", () => {
    expect(problemsOf({ id: "x", title: "X", steps: [{ id: "s", mode: "lecture", title: "?" }] })).not.toEqual([]);
  });

  it("requires code and a visual on trace steps", () => {
    expect(problemsOf(lessonWith({ id: "t", mode: "trace", title: "Trace" } as LessonStepInput))).not.toEqual([]);
  });

  it("rejects a correct option that is not among the options", () => {
    const problems = problemsOf(
      lessonWith({
        id: "p",
        mode: "predict",
        title: "Predict",
        question: {
          kind: "choice",
          prompt: "?",
          options: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
          correctOptionId: "c",
        },
      }),
    );
    expect(problems.join()).toContain('Correct option "c"');
  });

  it("rejects duplicate option labels", () => {
    const problems = problemsOf(
      lessonWith({
        id: "p",
        mode: "predict",
        title: "Predict",
        question: {
          kind: "choice",
          prompt: "?",
          options: [
            { id: "a", label: "Same" },
            { id: "b", label: "Same" },
          ],
          correctOptionId: "a",
        },
      }),
    );
    expect(problems.join()).toContain("share the label");
  });

  it("rejects highlights past the end of the code", () => {
    const problems = problemsOf(
      lessonWith({
        id: "s",
        mode: "show",
        title: "Code",
        code: { source: "one\ntwo", highlight: [3] },
      }),
    );
    expect(problems.join()).toContain("Highlighted line 3");
  });

  it("rejects marks that point at missing items and duplicate item ids", () => {
    const problems = problemsOf(
      lessonWith({
        id: "s",
        mode: "show",
        title: "Visual",
        visual: {
          kind: "array",
          items: [
            { id: "a", value: 1 },
            { id: "a", value: 2 },
          ],
          marks: { ghost: "focus" },
        },
      }),
    );
    expect(problems.join()).toContain('Duplicate item id "a"');
    expect(problems.join()).toContain('unknown item "ghost"');
  });

  it("rejects pointers beyond the append position", () => {
    const problems = problemsOf(
      lessonWith({
        id: "s",
        mode: "show",
        title: "Visual",
        visual: { ...visual, pointers: [{ index: 3, label: "far" }] },
      }),
    );
    expect(problems.join()).toContain("past the end");
  });

  it("requires a complete step's answer to match the blanked line", () => {
    const step = (correctLabel: string): LessonStepInput => ({
      id: "c",
      mode: "complete",
      title: "Complete",
      code: { source: "for (;;) {\n  x = y;\n}", blankLine: 2 },
      question: {
        kind: "choice",
        prompt: "Missing line?",
        options: [
          { id: "right", label: correctLabel },
          { id: "wrong", label: "y = x;" },
        ],
        correctOptionId: "right",
      },
    });

    expect(problemsOf(lessonWith(step("x = y;")))).toEqual([]);
    expect(problemsOf(lessonWith(step("x = z;"))).join()).toContain("must match blank line 2");
  });

  it("defineLesson throws a readable error for broken content", () => {
    expect(() => defineLesson(lessonWith())).toThrow(LessonValidationError);
  });
});
