import { describe, expect, it } from "vitest";
import { DIFFICULTIES } from "@/lib/learning/schema";
import { createLocalGenerator } from "./localGenerator";
import { acceptCandidate, produceExercise } from "./pipeline";
import { seededRandom } from "./random";
import type { ExerciseGenerator } from "./types";

const context = { attempt: 1, previousProblems: [] };

describe("local generator", () => {
  it.each(DIFFICULTIES)("always produces candidates that pass the truth gate (%s)", async (difficulty) => {
    const generator = createLocalGenerator(seededRandom(42));
    const request = { kind: "array-insertion" as const, difficulty };

    for (let i = 0; i < 200; i++) {
      const raw = await generator.generate(request, context);
      const result = acceptCandidate(raw, request);
      if (!result.ok) throw new Error(result.problems.join("\n"));
    }
  });

  it("keeps intro examples small, with values on both sides of the insertion point", async () => {
    const generator = createLocalGenerator(seededRandom(7));
    for (let i = 0; i < 100; i++) {
      const raw = (await generator.generate(
        { kind: "array-insertion", difficulty: "intro" },
        context,
      )) as { initial: number[]; operation: { index: number } };

      expect(raw.initial.length).toBeGreaterThanOrEqual(4);
      expect(raw.initial.length).toBeLessThanOrEqual(5);
      expect(raw.operation.index).toBeGreaterThan(0);
      expect(raw.operation.index).toBeLessThan(raw.initial.length);
    }
  });

  it("covers both edge cases at challenge difficulty", async () => {
    const generator = createLocalGenerator(seededRandom(3));
    const positions = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const raw = (await generator.generate(
        { kind: "array-insertion", difficulty: "challenge" },
        context,
      )) as { initial: number[]; operation: { index: number } };
      if (raw.operation.index === 0) positions.add("front");
      if (raw.operation.index === raw.initial.length) positions.add("end");
    }
    expect(positions).toEqual(new Set(["front", "end"]));
  });

  it("generates genuinely different examples", async () => {
    const generator = createLocalGenerator(seededRandom(11));
    const fingerprints = new Set<string>();
    const seen: string[] = [];

    for (let i = 0; i < 20; i++) {
      const result = await produceExercise(generator, {
        kind: "array-insertion",
        difficulty: "standard",
        avoid: seen,
      });
      if (!result.ok) throw new Error(result.problems.join("\n"));
      fingerprints.add(result.value.fingerprint);
      seen.push(result.value.fingerprint);
    }
    expect(fingerprints.size).toBe(20);
  });
});

describe("produceExercise", () => {
  const request = { kind: "array-insertion" as const, difficulty: "intro" as const };

  it("retries after a rejected candidate and passes the reasons back", async () => {
    const local = createLocalGenerator(seededRandom(5));
    const seenProblems: string[][] = [];
    const flaky: ExerciseGenerator = {
      name: "flaky",
      async generate(req, ctx) {
        seenProblems.push(ctx.previousProblems);
        if (ctx.attempt === 1) {
          return {
            kind: "array-insertion",
            concept: "arrays.insertion",
            difficulty: "intro",
            initial: [1, 2, 3],
            operation: { type: "insert", index: 1, value: 9 },
            // Wrong: claims nothing shifts.
            expected: { result: [1, 9, 2, 3], shifted: [] },
          };
        }
        return local.generate(req, ctx);
      },
    };

    const result = await produceExercise(flaky, request);
    expect(result.ok).toBe(true);
    expect(seenProblems[0]).toEqual([]);
    expect(seenProblems[1].join()).toContain("expected.shifted");
  });

  it("gives up after the attempt budget with the reasons", async () => {
    const broken: ExerciseGenerator = {
      name: "broken",
      async generate() {
        return { kind: "array-insertion", nonsense: true };
      },
    };
    const result = await produceExercise(broken, request, { maxAttempts: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toContain("after 2 attempts");
  });

  it("survives a generator that throws", async () => {
    const throwing: ExerciseGenerator = {
      name: "offline",
      async generate() {
        throw new Error("network down");
      },
    };
    const result = await produceExercise(throwing, request, { maxAttempts: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join()).toContain("network down");
  });
});

describe("local stack generator", () => {
  it.each(DIFFICULTIES)("always produces stack candidates that pass the truth gate (%s)", async (difficulty) => {
    const generator = createLocalGenerator(seededRandom(17));
    const request = { kind: "stack-operations" as const, difficulty };

    for (let i = 0; i < 200; i++) {
      const raw = await generator.generate(request, context);
      const result = acceptCandidate(raw, request);
      if (!result.ok) throw new Error(`${JSON.stringify(raw)}\n${result.problems.join("\n")}`);
    }
  });

  it("varies the question, the sequence and the answer format", async () => {
    const generator = createLocalGenerator(seededRandom(23));
    const asks = new Set<string>();
    const modes = new Set<string>();
    const fingerprints = new Set<string>();
    const seen: string[] = [];

    for (let i = 0; i < 60; i++) {
      const result = await produceExercise(generator, {
        kind: "stack-operations",
        difficulty: "standard",
        avoid: seen,
      });
      if (!result.ok) throw new Error(result.problems.join("\n"));
      const ask = result.value.fingerprint.split("|").at(-1) ?? "";
      asks.add(ask);
      modes.add(result.value.lesson.steps[0].mode);
      fingerprints.add(result.value.fingerprint);
      seen.push(result.value.fingerprint);
    }

    expect(asks).toEqual(new Set(["top", "popped", "peek", "final", "operation"]));
    expect(modes).toEqual(new Set(["predict", "solve", "complete"]));
    expect(fingerprints.size).toBe(60);
  });

  it("keeps intro examples to one operation on a small stack, asking about that operation", async () => {
    const generator = createLocalGenerator(seededRandom(29));
    for (let i = 0; i < 50; i++) {
      const raw = (await generator.generate(
        { kind: "stack-operations", difficulty: "intro" },
        context,
      )) as { initial: number[]; operations: { type: string }[]; ask: string };
      expect(raw.operations).toHaveLength(1);
      expect(raw.initial.length).toBeGreaterThanOrEqual(3);
      expect(raw.initial.length).toBeLessThanOrEqual(4);
      // Each intro question matches its single operation.
      const expectedAsk = { push: "top", pop: "popped", peek: "peek" }[raw.operations[0].type];
      expect(raw.ask).toBe(expectedAsk);
    }
  });
});
