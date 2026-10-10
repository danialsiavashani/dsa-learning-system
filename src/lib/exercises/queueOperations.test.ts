import { describe, expect, it } from "vitest";
import { DIFFICULTIES, EXERCISE_SKILLS, type LessonStep, type QueueVisual } from "@/lib/learning/schema";
import { createLocalGenerator } from "./localGenerator";
import { acceptCandidate, produceExercise } from "./pipeline";
import { seededRandom } from "./random";

/** Well-formed candidates, as an LLM provider might emit them. */
function queue(overrides: Record<string, unknown> = {}) {
  return {
    kind: "queue-operations",
    concept: "queues.operations",
    difficulty: "standard",
    initial: [4, 8],
    operations: [{ type: "offer", value: 2 }, { type: "poll" }, { type: "poll" }],
    ask: "dequeued",
    expected: { final: [2], removed: [4, 8], examined: [] },
    ...overrides,
  };
}

function deque(overrides: Record<string, unknown> = {}) {
  return {
    kind: "deque-operations",
    concept: "deques.operations",
    difficulty: "standard",
    initial: [4, 8],
    operations: [{ type: "addFirst", value: 2 }, { type: "addLast", value: 9 }, { type: "pollLast" }],
    ask: "final",
    expected: { final: [2, 4, 8], removed: [9], examined: [] },
    ...overrides,
  };
}

function recognition(kind: "queue-operations" | "deque-operations", overrides: Record<string, unknown> = {}) {
  return {
    kind,
    concept: kind === "queue-operations" ? "queues.operations" : "deques.operations",
    difficulty: "standard",
    ask: kind === "queue-operations" ? "stack-or-queue" : "queue-or-deque",
    arrivals: [3, 7, 1],
    required: [1, 7, 3],
    expected: { structure: "stack" },
    ...overrides,
  };
}

function accept(raw: unknown) {
  const result = acceptCandidate(raw);
  if (!result.ok) throw new Error(result.problems.join("\n"));
  return result.value;
}

function problemsOf(raw: unknown): string[] {
  const result = acceptCandidate(raw);
  return result.ok ? [] : result.problems;
}

function questionOf(raw: unknown) {
  const step = accept(raw).lesson.steps[0];
  if (!("question" in step)) throw new Error("expected a question first");
  return { step, question: step.question };
}

function correctLabel(raw: unknown) {
  const { question } = questionOf(raw);
  if (question.kind !== "choice") throw new Error("expected a choice question");
  return question.options.find((o) => o.id === question.correctOptionId)?.label;
}

function optionsOf(raw: unknown) {
  const { question } = questionOf(raw);
  if (question.kind !== "choice") throw new Error("expected a choice question");
  return question.options;
}

const queueVisual = (step: LessonStep) => step.visual as QueueVisual;

describe("accepting queue candidates", () => {
  it("compiles a question step followed by one trace step per operation", () => {
    const { lesson } = accept(queue());
    expect(lesson.steps.map((step) => step.mode)).toEqual(["solve", "trace", "trace", "trace"]);
    expect(lesson.steps.at(-1)?.practice).toEqual({ kind: "queue-operations", difficulty: "standard" });
  });

  it("asks for several dequeued values in arrival order (FIFO), derived from the domain", () => {
    expect(questionOf(queue()).question).toMatchObject({ kind: "number-list", expected: [4, 8] });
  });

  it("answers a single poll with the front, offering the newest value as the stack-thinking distractor", () => {
    const raw = queue({
      initial: [4, 8, 2],
      operations: [{ type: "poll" }],
      expected: { final: [8, 2], removed: [4], examined: [] },
      // Any answer a generator volunteers is ignored.
      answer: "2",
    });
    expect(correctLabel(raw)).toBe("4");
    const back = optionsOf(raw).find((o) => o.label === "2");
    expect(back?.feedback).toContain("stack");
  });

  it("answers peek with the front value", () => {
    expect(
      correctLabel(
        queue({
          operations: [{ type: "offer", value: 6 }, { type: "peek" }],
          ask: "peek",
          expected: { final: [4, 8, 6], removed: [], examined: [4] },
        }),
      ),
    ).toBe("4");
  });

  it("derives the front and the back after a sequence", () => {
    const fields = {
      operations: [{ type: "offer", value: 2 }, { type: "poll" }],
      expected: { final: [8, 2], removed: [4], examined: [] },
    };
    expect(correctLabel(queue({ ...fields, ask: "front" }))).toBe("8");
    expect(correctLabel(queue({ ...fields, ask: "back" }))).toBe("2");
  });

  it("asks for the final queue front → back", () => {
    expect(questionOf(queue({ ask: "final" })).question).toMatchObject({ kind: "number-list", expected: [2] });
  });

  it("turns 'which operation' into a Java fill-in-the-blank with simulated feedback", () => {
    const { step, question } = questionOf(
      queue({
        operations: [{ type: "poll" }],
        ask: "operation",
        expected: { final: [8], removed: [4], examined: [] },
      }),
    );
    expect(step.mode).toBe("complete");
    expect(step.code?.blankLine).toBe(3);
    if (question.kind !== "choice") throw new Error("expected choice");
    expect(question.options.find((o) => o.id === question.correctOptionId)?.label).toBe("queue.poll();");
    expect(question.options.find((o) => o.label === "queue.peek();")?.feedback).toContain("only reads");
  });

  it("animates offer entering at the back and poll leaving through the front, keeping ids", () => {
    const { lesson } = accept(queue());
    const [, offered, polled, polledAgain] = lesson.steps.map(queueVisual);
    expect(offered).toMatchObject({ items: [{ value: 4 }, { value: 8 }, { value: 2 }], entering: { end: "back" } });
    expect(polled).toMatchObject({ leaving: { value: 4, end: "front", label: "poll() → 4" } });
    // Survivors keep the ids they had while waiting.
    expect(polled.items.map((i) => i.id)).toEqual(offered.items.slice(1).map((i) => i.id));
    expect(polledAgain.items.map((i) => i.id)).toEqual(offered.items.slice(2).map((i) => i.id));
  });

  it("is deterministic for the same candidate", () => {
    const raw = queue({ ask: "front", expected: { final: [2], removed: [4, 8], examined: [] } });
    expect(accept(raw).lesson).toEqual(accept(raw).lesson);
  });

  it("writes queue code with offer/poll/peek only", () => {
    const { lesson } = accept(queue());
    const source = lesson.steps[0].code?.source ?? "";
    expect(source).toContain("Deque<Integer> queue = new ArrayDeque<>();");
    expect(source).toContain("int a = queue.poll();");
    expect(source).not.toMatch(/First|Last|push|pop\(/);
  });
});

describe("accepting stack-or-queue recognition", () => {
  it("derives 'stack' for a reversed order and 'queue' for arrival order", () => {
    expect(correctLabel(recognition("queue-operations"))).toMatch(/^A stack/);
    expect(
      correctLabel(recognition("queue-operations", { required: [3, 7, 1], expected: { structure: "queue" } })),
    ).toMatch(/^A queue/);
  });

  it("offers only stack and queue, and traces the answer with that structure", () => {
    const raw = recognition("queue-operations");
    expect(optionsOf(raw)).toHaveLength(2);
    const { lesson } = accept(raw);
    expect(lesson.steps.slice(1).every((step) => step.visual?.kind === "stack")).toBe(true);
    expect(lesson.steps.at(-1)?.body).toContain("1, 7, and 3");
  });
});

describe("accepting deque candidates", () => {
  it("asks for the final deque after adds and removals at both ends", () => {
    expect(questionOf(deque()).question).toMatchObject({ kind: "number-list", expected: [2, 4, 8] });
  });

  it("shows addFirst entering at the front and pollLast leaving through the back", () => {
    const { lesson } = accept(deque());
    expect(queueVisual(lesson.steps[1])).toMatchObject({ variant: "deque", entering: { end: "front" } });
    expect(queueVisual(lesson.steps[3])).toMatchObject({ leaving: { value: 9, end: "back", label: "pollLast() → 9" } });
  });

  it("answers a single pollLast with the back value", () => {
    const raw = deque({
      initial: [4, 8, 2],
      operations: [{ type: "pollLast" }],
      ask: "removed",
      expected: { final: [4, 8], removed: [2], examined: [] },
    });
    expect(correctLabel(raw)).toBe("2");
    expect(optionsOf(raw).find((o) => o.label === "4")?.feedback).toContain("other end");
  });

  it("asks where added values land", () => {
    const raw = deque({
      operations: [
        { type: "addFirst", value: 2 },
        { type: "addLast", value: 9 },
      ],
      ask: "after-add",
      expected: { final: [2, 4, 8, 9], removed: [], examined: [] },
    });
    expect(questionOf(raw).question).toMatchObject({ expected: [2, 4, 8, 9] });
  });

  it("asks which end operation produced a change, with all four ends offered", () => {
    const raw = deque({
      operations: [{ type: "addFirst", value: 2 }],
      ask: "end-operation",
      expected: { final: [2, 4, 8], removed: [], examined: [] },
    });
    const labels = optionsOf(raw).map((o) => o.label).sort();
    expect(labels).toEqual(
      ["deque.addFirst(2);", "deque.addLast(2);", "deque.pollFirst();", "deque.pollLast();"].sort(),
    );
    expect(correctLabel(raw)).toBe("deque.addFirst(2);");
    expect(optionsOf(raw).find((o) => o.label === "deque.addLast(2);")?.feedback).toContain("{4, 8, 2}");
  });

  it("recognises an order that needs both ends", () => {
    const raw = recognition("deque-operations", {
      arrivals: [3, 7, 1, 5],
      required: [3, 5, 7, 1],
      expected: { structure: "deque" },
    });
    expect(correctLabel(raw)).toMatch(/^A deque/);
    const { lesson } = accept(raw);
    expect(lesson.steps[0].visual?.kind).toBe("array");
    expect(lesson.steps[1].code?.source).toContain("deque.pollLast()");
  });
});

describe("rejecting queue and deque candidates", () => {
  it("rejects a wrong final line and LIFO claims about removals", () => {
    expect(problemsOf(queue({ expected: { final: [4], removed: [4, 8], examined: [] } })).join()).toContain(
      "expected.final",
    );
    expect(problemsOf(queue({ expected: { final: [2], removed: [2, 8], examined: [] } })).join()).toContain(
      "expected.removed",
    );
  });

  it("rejects polling an empty queue: poll() returns null, which an int cannot hold", () => {
    const problems = problemsOf(
      queue({
        initial: [4, 8],
        operations: [{ type: "poll" }, { type: "poll" }, { type: "poll" }],
        expected: { final: [], removed: [4, 8], examined: [] },
      }),
    );
    expect(problems.join()).toContain("returns null");
  });

  it("rejects peeking an empty deque", () => {
    const problems = problemsOf(
      deque({
        initial: [],
        operations: [{ type: "peekLast" }, { type: "addFirst", value: 1 }, { type: "addLast", value: 2 }],
        expected: { final: [1, 2], removed: [], examined: [] },
      }),
    );
    expect(problems.join()).toContain("empty deque");
  });

  it("rejects operations the kind does not support", () => {
    expect(problemsOf(queue({ operations: [{ type: "addFirst", value: 1 }] }))).not.toEqual([]);
    expect(problemsOf(deque({ operations: [{ type: "offer", value: 1 }] }))).not.toEqual([]);
    expect(problemsOf(queue({ operations: [{ type: "shift" }] }))).not.toEqual([]);
  });

  it("rejects a deque exercise that a plain queue could do", () => {
    const problems = problemsOf(
      deque({
        operations: [{ type: "addLast", value: 2 }, { type: "pollFirst" }],
        expected: { final: [8, 2], removed: [4], examined: [] },
      }),
    );
    expect(problems.join()).toContain("an end a plain queue cannot");
  });

  it("rejects a question the sequence cannot answer (skill mismatch)", () => {
    expect(problemsOf(queue({ ask: "peek" })).join()).toContain('ask "peek"');
    expect(problemsOf(deque({ ask: "after-add" })).join()).toContain('ask "after-add"');
    expect(
      problemsOf(
        queue({
          initial: [4],
          operations: [{ type: "offer", value: 2 }],
          ask: "operation",
          expected: { final: [4, 2], removed: [], examined: [] },
        }),
      ).join(),
    ).toContain("at least two values");
  });

  it("rejects repeated values, oversized lines and over-long sequences", () => {
    expect(
      problemsOf(
        queue({
          operations: [{ type: "offer", value: 8 }],
          ask: "final",
          expected: { final: [4, 8, 8], removed: [], examined: [] },
        }),
      ).join(),
    ).toContain("distinct");
    expect(
      problemsOf(
        queue({
          initial: [1, 2, 3, 4, 5],
          operations: [{ type: "offer", value: 6 }, { type: "offer", value: 7 }],
          ask: "final",
          expected: { final: [1, 2, 3, 4, 5, 6, 7], removed: [], examined: [] },
        }),
      ).join(),
    ).toContain("grows past");
    expect(problemsOf(queue({ operations: Array.from({ length: 7 }, () => ({ type: "peek" })) }))).not.toEqual([]);
  });

  it("rejects recognition candidates whose claims or orders do not hold", () => {
    expect(problemsOf(recognition("queue-operations", { expected: { structure: "queue" } })).join()).toContain(
      "simplest fit",
    );
    expect(problemsOf(recognition("queue-operations", { required: [1, 7, 9] })).join()).toContain("exactly the arriving");
    expect(
      problemsOf(
        recognition("deque-operations", {
          arrivals: [3, 7, 1, 5],
          required: [7, 3, 1, 5],
          expected: { structure: "deque" },
        }),
      ).join(),
    ).toContain("No stack, queue or deque");
    expect(
      problemsOf(
        recognition("queue-operations", {
          arrivals: [3, 7, 1, 5],
          required: [3, 5, 7, 1],
          expected: { structure: "deque" },
        }),
      ).join(),
    ).toContain("cannot be a stack-or-queue question");
  });

  it.each([
    ["the wrong concept", queue({ concept: "stacks.operations" })],
    ["missing claims", queue({ expected: undefined })],
    ["an unknown ask", queue({ ask: "bottom" })],
    ["a fractional value", queue({ initial: [1.5, 2] })],
    ["too few arrivals", recognition("queue-operations", { arrivals: [3, 7], required: [7, 3] })],
  ])("rejects %s", (_label, raw) => {
    expect(problemsOf(raw)).not.toEqual([]);
  });
});

describe("local queue and deque generation", () => {
  const context = { attempt: 1, previousProblems: [] };

  it.each(DIFFICULTIES.flatMap((difficulty) => [
    ["queue-operations", difficulty],
    ["deque-operations", difficulty],
  ] as const))("always passes the truth gate (%s, %s)", async (kind, difficulty) => {
    const generator = createLocalGenerator(seededRandom(61));
    const request = { kind, difficulty };
    for (let i = 0; i < 200; i++) {
      const result = acceptCandidate(await generator.generate(request, context), request);
      if (!result.ok) throw new Error(result.problems.join("\n"));
    }
  });

  it.each([
    ...EXERCISE_SKILLS["queue-operations"].map((skill) => ["queue-operations", skill] as const),
    ...EXERCISE_SKILLS["deque-operations"].map((skill) => ["deque-operations", skill] as const),
  ])("targets %s / %s on request, at every difficulty", async (kind, skill) => {
    const generator = createLocalGenerator(seededRandom(67));
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 8; i++) {
        const result = await produceExercise(generator, { kind, difficulty, skills: [skill] });
        if (!result.ok) throw new Error(result.problems.join("\n"));
        expect(result.value.skill).toBe(skill);
      }
    }
  });

  it("generates genuinely different examples across every skill", async () => {
    for (const kind of ["queue-operations", "deque-operations"] as const) {
      const generator = createLocalGenerator(seededRandom(71));
      const seen: string[] = [];
      const skills = new Set<string>();
      for (let i = 0; i < 60; i++) {
        const result = await produceExercise(generator, { kind, difficulty: "standard", avoid: seen });
        if (!result.ok) throw new Error(result.problems.join("\n"));
        seen.push(result.value.fingerprint);
        skills.add(result.value.skill);
      }
      expect(new Set(seen).size).toBe(seen.length);
      expect(skills).toEqual(new Set(EXERCISE_SKILLS[kind]));
    }
  });

  it("never asks about an empty queue and keeps lines small", async () => {
    const generator = createLocalGenerator(seededRandom(73));
    for (let i = 0; i < 200; i++) {
      const raw = (await generator.generate({ kind: "queue-operations", difficulty: "challenge" }, context)) as {
        operations?: unknown[];
        expected: { final?: number[] };
      };
      if (raw.operations) expect(raw.operations.length).toBeLessThanOrEqual(6);
    }
  });
});
