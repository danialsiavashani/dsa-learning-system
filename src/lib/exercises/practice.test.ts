import { describe, expect, it } from "vitest";
import { concepts } from "@/curriculum";
import { DIFFICULTIES } from "@/lib/learning/schema";
import { createLocalGenerator } from "./localGenerator";
import { acceptCandidate, produceExercise } from "./pipeline";
import { seededRandom } from "./random";

const context = { attempt: 1, previousProblems: [] };

describe("local removal generator", () => {
  it.each(DIFFICULTIES)("always produces removal candidates that pass the truth gate (%s)", async (difficulty) => {
    const generator = createLocalGenerator(seededRandom(43));
    const request = { kind: "array-removal" as const, difficulty };
    for (let i = 0; i < 200; i++) {
      const result = acceptCandidate(await generator.generate(request, context), request);
      if (!result.ok) throw new Error(result.problems.join("\n"));
    }
  });
});

describe("skill-focused practice", () => {
  it("only drills the requested stack skills", async () => {
    const generator = createLocalGenerator(seededRandom(47));
    const skills = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const result = await produceExercise(generator, {
        kind: "stack-operations",
        difficulty: "standard",
        skills: ["final", "popped"],
      });
      if (!result.ok) throw new Error(result.problems.join("\n"));
      skills.add(result.value.skill);
    }
    expect(skills).toEqual(new Set(["final", "popped"]));
  });

  it("honours a skill the difficulty would not normally ask", async () => {
    const generator = createLocalGenerator(seededRandom(53));
    for (let i = 0; i < 20; i++) {
      const result = await produceExercise(generator, {
        kind: "recursion-trace",
        difficulty: "intro",
        skills: ["printed"],
      });
      if (!result.ok) throw new Error(result.problems.join("\n"));
      expect(result.value.skill).toBe("printed");
    }
  });

  it("rejects a generated exercise that drills a different skill", () => {
    const raw = {
      kind: "stack-operations",
      concept: "stacks.operations",
      difficulty: "standard",
      initial: [4, 8],
      operations: [{ type: "push", value: 2 }],
      ask: "top",
      expected: { final: [4, 8, 2], popped: [], peeked: [] },
    };
    const result = acceptCandidate(raw, {
      kind: "stack-operations",
      difficulty: "standard",
      skills: ["popped"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join()).toContain("Asked to practise popped");
  });
});

describe("every canonical practice request can be served", () => {
  const requests = concepts.flatMap(({ label, lesson }) =>
    lesson.steps.flatMap((step) => (step.practice ? [{ label, step: step.id, request: step.practice }] : [])),
  );

  it.each(requests)("$label / $step", async ({ request }) => {
    const generator = createLocalGenerator(seededRandom(59));
    for (let i = 0; i < 10; i++) {
      const result = await produceExercise(generator, request);
      if (!result.ok) throw new Error(result.problems.join("\n"));
      if (request.skills) expect(request.skills).toContain(result.value.skill);
    }
  });
});
