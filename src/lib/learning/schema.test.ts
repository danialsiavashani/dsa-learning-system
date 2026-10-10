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

  it.each(concepts)("the $label lesson cites OpenDSA and Princeton (algs4 / introcs)", ({ lesson }) => {
    const urls = (lesson.sources ?? []).map((source) => source.url);
    expect(urls.some((url) => url.includes("opendsa"))).toBe(true);
    expect(urls.some((url) => /(algs4|introcs)\.cs\.princeton\.edu/.test(url))).toBe(true);
  });

  it.each(concepts)("the $label lesson keeps asking the learner, not just once per mode", ({ lesson }) => {
    const questions = lesson.steps.filter((step) => "question" in step);
    expect(questions.length).toBeGreaterThanOrEqual(10);
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

describe("call stack visual validation", () => {
  const callStackStep = (visual: Record<string, unknown>): LessonStepInput =>
    ({ id: "c", mode: "show", title: "Calls", visual: { kind: "callStack", ...visual } }) as LessonStepInput;
  const frames = [
    { id: "main", call: "main()", status: "waiting" },
    { id: "f0", call: "factorial(2)", status: "waiting", detail: "2 * factorial(1)" },
    { id: "f1", call: "factorial(1)", status: "base", detail: "n <= 1: return 1" },
  ];

  it("accepts a valid stack with a carried value", () => {
    expect(
      problemsOf(
        lessonWith(callStackStep({ frames, carry: { id: "r", value: "1", frameId: "f1" }, phase: "unwinding" })),
      ),
    ).toEqual([]);
  });

  it("rejects an active frame below the top", () => {
    const broken = [frames[0], { ...frames[1], status: "running" }, frames[2]];
    expect(problemsOf(lessonWith(callStackStep({ frames: broken }))).join()).toContain("must be waiting");
  });

  it("rejects a carried value on a missing frame, a non-top entering frame and duplicate ids", () => {
    const problems = problemsOf(
      lessonWith(
        callStackStep({
          frames: [...frames, { ...frames[2] }],
          carry: { id: "r", value: "1", frameId: "ghost" },
          entering: "main",
        }),
      ),
    ).join();
    expect(problems).toContain('Duplicate frame id "f1"');
    expect(problems).toContain("unknown frame");
    expect(problems).toContain("Only the top frame");
  });

  it("rejects stacks too tall to show", () => {
    const tall = Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, call: `f(${i})`, status: "waiting" }));
    expect(problemsOf(lessonWith(callStackStep({ frames: tall })))).not.toEqual([]);
  });
});


describe("lesson sources and practice skills", () => {
  it("accepts well-formed source metadata", () => {
    expect(
      problemsOf({
        ...lessonWith({ id: "s", mode: "show", title: "Hi" }),
        sources: [{ title: "OpenDSA", url: "https://opendsa.org/x", role: "concept" }],
      }),
    ).toEqual([]);
  });

  it("rejects malformed source metadata", () => {
    const problems = problemsOf({
      ...lessonWith({ id: "s", mode: "show", title: "Hi" }),
      sources: [{ title: "Somewhere", url: "not a url", role: "vibes" }],
    });
    expect(problems.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects a practice skill the exercise kind does not have", () => {
    const problems = problemsOf(
      lessonWith({
        id: "s",
        mode: "show",
        title: "Hi",
        practice: { kind: "stack-operations", difficulty: "intro", skills: ["printed"] },
      }),
    );
    expect(problems.join()).toContain('"printed" is not a skill of stack-operations');
  });
});

describe("tree visual validation", () => {
  const nodes = [
    { id: "a", value: 7, left: "b", right: "c" },
    { id: "b", value: 3, left: null, right: null },
    { id: "c", value: 9, left: null, right: null },
  ];
  const treeStep = (visual: Record<string, unknown>): LessonStepInput =>
    ({ id: "t", mode: "show", title: "Tree", visual: { kind: "tree", root: "a", nodes, ...visual } }) as LessonStepInput;

  it("accepts a valid mid-traversal state", () => {
    expect(
      problemsOf(lessonWith(treeStep({ path: ["a", "b"], visited: ["a", "b"], nullAt: { parent: "b", side: "left" } }))),
    ).toEqual([]);
  });

  it("rejects a path that does not follow edges or start at the root", () => {
    expect(problemsOf(lessonWith(treeStep({ path: ["a", "b", "c"] }))).join()).toContain("follows edges");
    expect(problemsOf(lessonWith(treeStep({ path: ["b"] }))).join()).toContain("start at the root");
  });

  it("rejects a null call on an occupied slot or away from the current call", () => {
    expect(problemsOf(lessonWith(treeStep({ path: ["a"], nullAt: { parent: "a", side: "left" } }))).join()).toContain(
      "empty left child",
    );
    expect(problemsOf(lessonWith(treeStep({ path: ["a"], nullAt: { parent: "b", side: "left" } }))).join()).toContain(
      "top of the path",
    );
  });

  it("rejects unknown or repeated visits and a broken structure", () => {
    const problems = problemsOf(lessonWith(treeStep({ visited: ["a", "a", "zz"] }))).join();
    expect(problems).toContain('visited twice');
    expect(problems).toContain('unknown node "zz"');
    expect(
      problemsOf(lessonWith({ id: "t", mode: "show", title: "T", visual: { kind: "tree", root: "a", nodes: [{ id: "a", value: 1, left: "a", right: null }] } } as LessonStepInput)),
    ).not.toEqual([]);
  });
});

describe("backtrack visual validation", () => {
  const nodes = [
    { id: "b", label: "[]", parent: null, state: "explored" },
    { id: "b.1", label: "[1]", parent: "b", state: "explored" },
    { id: "b.2", label: "[2]", parent: "b", state: "unexplored" },
  ];
  const step = (visual: Record<string, unknown>): LessonStepInput =>
    ({ id: "x", mode: "show", title: "Search", visual: { kind: "backtrack", nodes, current: [], ...visual } }) as LessonStepInput;

  it("accepts a valid search state, with an undo in progress", () => {
    expect(
      problemsOf(lessonWith(step({ path: ["b"], current: [], removed: { id: "v1", value: 1 }, results: [{ id: "r0", label: "[1]" }] }))),
    ).toEqual([]);
  });

  it("rejects two roots, unknown parents and cycles", () => {
    const twoRoots = [...nodes, { id: "c", label: "[]", parent: null, state: "unexplored" }];
    expect(problemsOf(lessonWith(step({ nodes: twoRoots }))).join()).toContain("exactly one root");
    const orphan = [...nodes, { id: "b.9", label: "[9]", parent: "zz", state: "unexplored" }];
    expect(problemsOf(lessonWith(step({ nodes: orphan }))).join()).toContain("unknown parent");
    const cycle = [
      { id: "b", label: "[]", parent: null, state: "explored" },
      { id: "x", label: "[1]", parent: "y", state: "explored" },
      { id: "y", label: "[2]", parent: "x", state: "explored" },
    ];
    expect(problemsOf(lessonWith(step({ nodes: cycle }))).join()).toContain("cycle");
  });

  it("rejects a path that skips a level and an inconsistent current list", () => {
    expect(problemsOf(lessonWith(step({ path: ["b.1"] }))).join()).toContain("start at the root");
    expect(problemsOf(lessonWith(step({ path: ["b", "b.1", "b.2"] }))).join()).toContain("not a child");
    const problems = problemsOf(
      lessonWith(step({ current: [{ id: "v1", value: 1 }], added: "v9", removed: { id: "v1", value: 1 } })),
    ).join();
    expect(problems).toContain("added chip must be in current");
    expect(problems).toContain("cannot still be in current");
  });
});

describe("queue visual validation", () => {
  const step = (visual: Record<string, unknown>): LessonStepInput =>
    ({ id: "s", mode: "show", title: "Queue", visual: { kind: "queue", ...visual } }) as LessonStepInput;
  const items = [
    { id: "a", value: 4 },
    { id: "b", value: 8 },
  ];

  it("accepts a queue with a value entering at the back and one leaving at the front", () => {
    expect(
      problemsOf(
        lessonWith(
          step({
            items,
            entering: { id: "b", end: "back" },
            leaving: { id: "z", value: 2, end: "front", label: "poll() → 2" },
            peek: { end: "front", label: "peek() → 4" },
          }),
        ),
      ),
    ).toEqual([]);
  });

  it("keeps a plain queue to its two ends; a deque may use either", () => {
    const wrongEnds = {
      items,
      entering: { id: "a", end: "front" },
      leaving: { id: "z", value: 2, end: "back", label: "x" },
    };
    const problems = problemsOf(lessonWith(step(wrongEnds))).join();
    expect(problems).toContain("only adds at the back");
    expect(problems).toContain("only removes and peeks at the front");
    expect(problemsOf(lessonWith(step({ ...wrongEnds, variant: "deque" })))).toEqual([]);
  });

  it("rejects duplicate ids across the line and outside it, and stray marks", () => {
    const problems = problemsOf(
      lessonWith(step({ items, waiting: { id: "a", value: 9, end: "back", label: "offer(9)" }, marks: { q: "focus" } })),
    ).join();
    expect(problems).toContain('Duplicate item id "a"');
    expect(problems).toContain('unknown item "q"');
  });

  it("rejects an entering item that is not at its end, and peeking an empty queue", () => {
    expect(problemsOf(lessonWith(step({ items, entering: { id: "a", end: "back" } }))).join()).toContain(
      "entering item must be the one at the back",
    );
    expect(problemsOf(lessonWith(step({ items: [], peek: { end: "front", label: "peek()" } }))).join()).toContain(
      "cannot be empty",
    );
  });

  it("rejects lines too long to show", () => {
    const long = Array.from({ length: 8 }, (_, i) => ({ id: `i${i}`, value: i }));
    expect(problemsOf(lessonWith(step({ items: long })))).not.toEqual([]);
  });
});

describe("compare visual validation", () => {
  const pane = (id: string, visual: Record<string, unknown>) => ({ id, label: id, visual });
  const step = (panes: unknown[]): LessonStepInput =>
    ({ id: "s", mode: "show", title: "Compare", visual: { kind: "compare", panes } }) as LessonStepInput;

  it("accepts a stack beside a queue", () => {
    expect(
      problemsOf(
        lessonWith(
          step([
            pane("stack", { kind: "stack", items: [{ id: "a", value: 4 }] }),
            pane("queue", { kind: "queue", items: [{ id: "a", value: 4 }] }),
          ]),
        ),
      ),
    ).toEqual([]);
  });

  it("validates each pane with its own schema and needs exactly two unique panes", () => {
    const badQueue = pane("queue", { kind: "queue", items: [], peek: { end: "front", label: "x" } });
    expect(problemsOf(lessonWith(step([pane("stack", { kind: "stack", items: [] }), badQueue])))).not.toEqual([]);
    const stack = pane("s", { kind: "stack", items: [] });
    expect(problemsOf(lessonWith(step([stack, stack]))).join()).toContain("Duplicate pane id");
    expect(problemsOf(lessonWith(step([stack])))).not.toEqual([]);
    expect(problemsOf(lessonWith(step([stack, pane("t", { kind: "tree", root: null, nodes: [] })])))).not.toEqual([]);
  });
});
