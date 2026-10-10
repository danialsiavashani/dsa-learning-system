import { describe, expect, it } from "vitest";
import { concepts } from "@/curriculum";
import { createLocalGenerator } from "@/lib/exercises/localGenerator";
import { produceExercise } from "@/lib/exercises/pipeline";
import { seededRandom } from "@/lib/exercises/random";
import { DIFFICULTIES, EXERCISE_KINDS, type Lesson } from "./schema";
import { validateLesson } from "./validate";

/** Constructs that would mean JavaScript/TypeScript leaked into teaching code. */
const NON_JAVA = [/\bfunction\b/, /\bconst\b/, /\blet\b/, /\bvar\b/, /=>/, /===/];

function codeOf(lesson: Lesson): string[] {
  return lesson.steps.flatMap((step) => {
    const snippets = step.code ? [step.code.source] : [];
    // Fill-in-the-blank options are learner-facing code too.
    if (step.mode === "complete") {
      snippets.push(...step.question.options.map((option) => option.label));
    }
    return snippets;
  });
}

function expectJava(lesson: Lesson) {
  for (const step of lesson.steps) {
    if (step.code) expect(step.code.language).toBe("java");
  }
  for (const source of codeOf(lesson)) {
    for (const pattern of NON_JAVA) expect(source).not.toMatch(pattern);
  }
}

describe("learner-facing code is Java", () => {
  it.each(concepts)("in the canonical $label lesson", ({ lesson }) => {
    expect(codeOf(lesson).length).toBeGreaterThan(0);
    expectJava(lesson);
  });

  it.each(EXERCISE_KINDS)("in generated %s examples", async (kind) => {
    const generator = createLocalGenerator(seededRandom(99));
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 40; i++) {
        const result = await produceExercise(generator, { kind, difficulty });
        if (!result.ok) throw new Error(result.problems.join("\n"));
        expectJava(result.value.lesson);
      }
    }
  });

  it("defaults code without a language to Java", () => {
    const result = validateLesson({
      id: "x",
      title: "X",
      steps: [{ id: "s", mode: "show", title: "S", code: { source: "int x = 1;" } }],
    });
    expect(result.ok && result.value.steps[0].code?.language).toBe("java");
  });

  it.each(["javascript", "typescript", "python"])("rejects %s code", (language) => {
    const result = validateLesson({
      id: "x",
      title: "X",
      steps: [{ id: "s", mode: "show", title: "S", code: { source: "x = 1", language } }],
    });
    expect(result.ok).toBe(false);
  });
});
