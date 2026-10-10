import {
  callOf,
  methodCode,
  pendingWork,
  recursionCode,
  snapshotVisual,
} from "@/curriculum/concepts/recursion";
import { frameId, traceRecursion } from "@/lib/domain/recursion";
import type { CallStackVisual } from "@/lib/learning/schema";
import { defineLesson } from "@/lib/learning/validate";

/**
 * The canonical Recursion lesson. It starts from the call stack the learner
 * met in the Stack lesson, then follows factorial(3) down to its base case
 * and back up. Every recursive state comes from the trace engine.
 */

const bridgeCode = {
  source: [
    'void main() { a(); System.out.println("main"); }',
    'void a()    { b(); System.out.println("a"); }',
    'void b()    { System.out.println("b"); }',
  ].join("\n"),
  language: "java" as const,
};

const fact3 = traceRecursion("factorial", 3);
const fact3Code = recursionCode("factorial", 3);
const at = (index: number) => snapshotVisual(fact3, fact3.snapshots[index]);
// Snapshots of factorial(3): 0-2 calls, 3 base case, 4-5 returns, 6 back in main.
const [callThree, callTwo, callOne, baseCase, returnTwo, returnThree, done] = [0, 1, 2, 3, 4, 5, 6].map(at);

const lines = (highlight: number[]) => ({
  source: fact3Code.source,
  language: fact3Code.language,
  highlight,
});

// Without a base case, factorial(1) would keep calling: 0, -1, ...
const runaway: CallStackVisual = {
  kind: "callStack",
  frames: [
    { id: "main", call: "main()", status: "waiting", detail: "result = factorial(3)" },
    ...[3, 2, 1, 0].map((n, depth) => ({
      id: frameId(depth),
      call: callOf("factorial", n),
      status: "waiting" as const,
      detail: pendingWork("factorial", n),
    })),
    { id: frameId(4), call: callOf("factorial", -1), status: "running", detail: "n = -1, and on, and on" },
  ],
  entering: frameId(4),
  phase: "calling",
  caption: "…until the stack runs out of space: StackOverflowError",
};

const fact5 = traceRecursion("factorial", 5);
const fact5Deepest = fact5.snapshots.findIndex((s) => s.kind === "base");

const fact4 = traceRecursion("factorial", 4);
const fact4Code = recursionCode("factorial", 4);

const sum3 = traceRecursion("sumTo", 3);
const sumMethod = methodCode("sumTo");

const digitSum: CallStackVisual = {
  kind: "callStack",
  frames: [
    { id: "main", call: "main()", status: "waiting", detail: "result = digitSum(4096)" },
    { id: "d0", call: "digitSum(4096)", status: "waiting", detail: "6 + digitSum(409)" },
    { id: "d1", call: "digitSum(409)", status: "waiting", detail: "9 + digitSum(40)" },
    { id: "d2", call: "digitSum(40)", status: "waiting", detail: "0 + digitSum(4)" },
    { id: "d3", call: "digitSum(4)", status: "running", detail: "n = 4" },
  ],
  entering: "d3",
  phase: "calling",
  caption: "The same problem, one digit smaller each time",
};

export const recursionLesson = defineLesson({
  id: "recursion",
  title: "Recursion",
  subtitle: "Follow the call stack down to a base case and back up.",
  steps: [
    {
      id: "frames",
      mode: "show",
      title: "Every call gets a frame.",
      body: "This is the call stack from the Stack lesson. `main` called `a()`, so `a` gets a frame on top, and `main` pauses mid-line: it cannot print until `a()` finishes.",
      visual: {
        kind: "callStack",
        frames: [
          { id: "main", call: "main()", status: "waiting", detail: "waiting for a()" },
          { id: "a", call: "a()", status: "running", detail: "next: b()" },
        ],
        entering: "a",
        phase: "calling",
      },
      code: { ...bridgeCode, highlight: [2] },
    },
    {
      id: "predict-finish",
      mode: "predict",
      title: "a() calls b().",
      body: "Now three calls are unfinished.",
      visual: {
        kind: "callStack",
        frames: [
          { id: "main", call: "main()", status: "waiting", detail: "waiting for a()" },
          { id: "a", call: "a()", status: "waiting", detail: "waiting for b()" },
          { id: "b", call: "b()", status: "running", detail: 'prints "b"' },
        ],
        entering: "b",
        phase: "calling",
        output: [],
      },
      code: { ...bridgeCode, highlight: [3] },
      question: {
        kind: "choice",
        prompt: "Which call finishes first?",
        options: [
          { id: "main", label: "main()", feedback: "main has waited the longest; it finishes last." },
          { id: "a", label: "a()", feedback: "a() is waiting for b() to return." },
          { id: "b", label: "b()" },
        ],
        correctOptionId: "b",
        explanation: "b() is on top and calls nothing, so it runs to the end and returns first.",
      },
      reveal: {
        visual: {
          kind: "callStack",
          frames: [
            { id: "main", call: "main()", status: "waiting", detail: "waiting for a()" },
            { id: "a", call: "a()", status: "waiting", detail: "waiting for b()" },
            { id: "b", call: "b()", status: "returning", detail: 'printed "b", returns' },
          ],
          phase: "unwinding",
          output: ["b"],
        },
      },
    },
    {
      id: "lifo",
      mode: "show",
      title: "Then a(), then main(): last in, first out.",
      body: "a() resumed, printed a and returned; then main resumed and printed main. The most recent unfinished call always returns first, exactly like `pop()`.",
      visual: {
        kind: "callStack",
        frames: [{ id: "main", call: "main()", status: "returning", detail: 'printed "main", returns' }],
        phase: "unwinding",
        output: ["b", "a", "main"],
      },
      code: { ...bridgeCode, highlight: [1] },
    },
    {
      id: "self-call",
      mode: "show",
      title: "A method can call itself.",
      body: "That is all recursion is. `factorial(3)` is an ordinary call: it gets a frame with its own n = 3, then checks `n <= 1`. That is false, so it moves on to line 9.",
      visual: callThree,
      code: lines([fact3Code.lines.baseCheck]),
    },
    {
      id: "predict-call",
      mode: "predict",
      title: "What call happens next?",
      body: "Line 9 is `return n * factorial(n - 1);` and this frame has n = 3.",
      visual: callThree,
      code: lines([fact3Code.lines.recurse]),
      question: {
        kind: "choice",
        prompt: "Which call does `factorial(3)` make?",
        options: [
          { id: "same", label: "factorial(3)", feedback: "The same n would never get closer to the base case." },
          { id: "next", label: "factorial(2)" },
          { id: "up", label: "factorial(4)", feedback: "The argument is n - 1, and 3 - 1 is 2." },
        ],
        correctOptionId: "next",
        explanation: "n - 1 is 2, so `factorial(3)` calls `factorial(2)`. Another frame goes on top.",
      },
      reveal: { visual: callTwo },
    },
    {
      id: "explain-waiting",
      mode: "explain",
      title: "factorial(3) is waiting.",
      body: "Its frame is paused in the middle of line 9.",
      visual: callTwo,
      code: lines([fact3Code.lines.recurse]),
      question: {
        kind: "choice",
        prompt: "Has `factorial(3)` multiplied anything by 3 yet?",
        options: [
          {
            id: "three-two",
            label: "Yes, it already computed 3 * 2.",
            feedback: "factorial(2) has not returned anything yet, so there is no 2 to multiply by.",
          },
          { id: "no", label: "No. It needs factorial(2)'s result before it can multiply." },
          {
            id: "three-three",
            label: "Yes, it computed 3 * 3.",
            feedback: "The right side of * is factorial(2), whose value is still unknown.",
          },
        ],
        correctOptionId: "no",
        explanation: "`n * factorial(n - 1)` needs both sides. Until `factorial(2)` returns, the multiplication is pending and the frame just waits.",
      },
    },
    {
      id: "predict-running",
      mode: "predict",
      title: "One more call.",
      body: "`factorial(2)` also reached line 9 and called `factorial(1)`.",
      visual: callOne,
      code: lines([fact3Code.lines.baseCheck]),
      question: {
        kind: "choice",
        prompt: "Which frame is running right now?",
        options: [
          { id: "bottom", label: "factorial(3)", feedback: "factorial(3) has waited longest; it is paused at line 9." },
          { id: "all", label: "All three at once", feedback: "Only the top frame runs; every frame below it waits." },
          { id: "top", label: "factorial(1)" },
        ],
        correctOptionId: "top",
        explanation: "Only the top frame runs. factorial(3) and factorial(2) are both paused at line 9, each waiting for the call above it.",
      },
    },
    {
      id: "runaway",
      mode: "show",
      title: "What if nothing stopped it?",
      body: "Picture factorial without its `if`. factorial(1) would call factorial(0), which calls factorial(-1), and so on. Each call waits on the next, so frames pile up until Java runs out of stack space and throws `StackOverflowError`.",
      visual: runaway,
      code: {
        source: ["int factorial(int n) {", "    return n * factorial(n - 1);", "}"].join("\n"),
        language: "java",
        highlight: [2],
      },
    },
    {
      id: "base-case",
      mode: "trace",
      title: "The base case stops it.",
      body: "With the `if` in place, factorial(1) finds `n <= 1` true and returns 1 directly, without another call. It is the first call to finish, so unwinding starts here.",
      visual: baseCase,
      code: lines([fact3Code.lines.baseReturn]),
    },
    {
      id: "explain-base",
      mode: "explain",
      title: "Why does it stop here?",
      body: "Compare factorial(1) with the frames under it.",
      code: lines([fact3Code.lines.baseCheck, fact3Code.lines.baseReturn]),
      question: {
        kind: "choice",
        prompt: "What makes factorial(1) different from the calls below it?",
        options: [
          {
            id: "smallest",
            label: "1 is the smallest int Java allows.",
            feedback: "Java allows 0 and negatives too. The method itself decides to stop at n <= 1.",
          },
          { id: "direct", label: "It returns a value without making another call." },
          {
            id: "faster",
            label: "It runs faster than the others.",
            feedback: "Speed is not the point. It is the first call that does not have to wait.",
          },
        ],
        correctOptionId: "direct",
        explanation: "A base case answers directly. Without one, every frame would wait on another call and nothing would ever return.",
      },
    },
    {
      id: "predict-return",
      mode: "predict",
      title: "The value comes back.",
      body: "factorial(1) is gone; its 1 travels back to the frame that called it.",
      visual: baseCase,
      code: lines([fact3Code.lines.recurse]),
      question: {
        kind: "choice",
        prompt: "`factorial(2)` receives 1. What does `factorial(2)` return?",
        options: [
          { id: "received", label: "1", feedback: "That is what it received; it still multiplies by its own n = 2." },
          { id: "right", label: "2" },
          { id: "sum", label: "3", feedback: "The return line multiplies: 2 * 1." },
        ],
        correctOptionId: "right",
        explanation: "factorial(2) resumes at line 9 and finally multiplies: 2 * 1 = 2.",
      },
      reveal: { visual: returnTwo },
    },
    {
      id: "predict-resume",
      mode: "predict",
      title: "Who resumes next?",
      body: "factorial(2) is returning 2.",
      visual: returnTwo,
      code: lines([fact3Code.lines.recurse]),
      question: {
        kind: "choice",
        prompt: "Which frame resumes next?",
        options: [
          { id: "main", label: "main()", feedback: "main is waiting for factorial(3), which has not returned yet." },
          { id: "three", label: "factorial(3)" },
          { id: "one", label: "factorial(1)", feedback: "factorial(1) already returned; its frame is gone." },
        ],
        correctOptionId: "three",
        explanation: "factorial(3), the most recent caller still waiting, resumes and multiplies at last: 3 * 2 = 6.",
      },
      reveal: { visual: returnThree },
    },
    {
      id: "done",
      mode: "trace",
      title: "main receives 6.",
      body: "factorial(3)'s frame is gone and main resumes with result = 6. Calls went down 3 → 2 → 1; returns came back up 1 → 2 → 6.",
      visual: done,
      code: lines([fact3Code.lines.caller]),
      practice: { kind: "recursion-trace", difficulty: "intro" },
    },
    {
      id: "explain-phases",
      mode: "explain",
      title: "Two directions.",
      body: "Calling down creates frames and leaves work pending. Unwinding finishes that work, newest frame first.",
      question: {
        kind: "choice",
        prompt: "When is 3 * 2 actually multiplied?",
        options: [
          {
            id: "down",
            label: "On the way down, before factorial(2) is called.",
            feedback: "Going down, factorial(3) only knows it needs factorial(2); there is nothing to multiply yet.",
          },
          {
            id: "end",
            label: "All at the end, in one step.",
            feedback: "Each frame multiplies as soon as its own call returns, one frame at a time.",
          },
          { id: "up", label: "On the way back up, once factorial(2) has returned." },
        ],
        correctOptionId: "up",
        explanation: "The multiplication waits in factorial(3)'s frame during the whole trip down and happens on the trip back up.",
      },
    },
    {
      id: "complexity",
      mode: "show",
      title: "n calls, n frames.",
      body: "factorial(n) makes n calls, each doing a constant amount of work: O(n) time. At the deepest point all n calls are unfinished at once, so n frames sit on the call stack: O(n) extra space, even though no array was created.",
      visual: snapshotVisual(fact5, fact5.snapshots[fact5Deepest], {
        caption: "factorial(5) at its deepest: 5 frames at once",
      }),
      code: {
        source: recursionCode("factorial", 5).source,
        language: "java",
        highlight: [recursionCode("factorial", 5).lines.baseReturn],
      },
    },
    {
      id: "complete-sum",
      mode: "complete",
      title: "Rebuild the recursive step.",
      body: "`sumTo(n)` adds 1 + 2 + … + n. The base case is written; the recursive line is missing.",
      visual: snapshotVisual(sum3, sum3.snapshots[0]),
      code: {
        source: sumMethod.source,
        language: sumMethod.language,
        highlight: [sumMethod.lines.baseCheck],
        blankLine: sumMethod.lines.recurse,
      },
      question: {
        kind: "choice",
        prompt: "Which line completes `sumTo`?",
        options: [
          {
            id: "same",
            label: "return n + sumTo(n);",
            feedback: "sumTo(n) calls itself with the same n, never reaches 0, and overflows the stack.",
          },
          {
            id: "drop",
            label: "return sumTo(n - 1);",
            feedback: "That throws away n: every frame adds nothing, so the answer is always 0.",
          },
          { id: "right", label: "return n + sumTo(n - 1);" },
          {
            id: "up",
            label: "return n + sumTo(n + 1);",
            feedback: "n + 1 moves away from the base case, so the calls never stop.",
          },
        ],
        correctOptionId: "right",
        explanation: "Each frame adds its own n to the sum of everything smaller, and n - 1 moves one step closer to the base case at 0.",
      },
    },
    {
      id: "solve-returns",
      mode: "solve",
      title: "Trace factorial(4) yourself.",
      body: "Go down to the base case, then come back up.",
      visual: snapshotVisual(fact4, fact4.snapshots[0]),
      code: { source: fact4Code.source, language: fact4Code.language, highlight: [fact4Code.lines.caller] },
      question: {
        kind: "number-list",
        prompt: "Type the value each call returns, in the order they return.",
        expected: fact4.returns,
        explanation: `Calls go ${fact4.calls.join(" → ")}; returns come back ${fact4.returns.join(" → ")}.`,
      },
      reveal: { visual: snapshotVisual(fact4, fact4.snapshots[fact4.snapshots.length - 1]) },
      practice: { kind: "recursion-trace", difficulty: "standard" },
    },
    {
      id: "recognize",
      mode: "explain",
      title: "Spot the recursion-shaped problem.",
      body: "Recursion fits when a problem contains a smaller copy of itself, a point where it stops, and some work before or after the smaller call. Later, one call will sometimes make two calls instead of one: that is how trees and backtracking work.",
      question: {
        kind: "choice",
        prompt: "Which problem is recursion-shaped?",
        options: [
          {
            id: "greetings",
            label: "Print three fixed greetings",
            feedback: "There is no smaller version of the same problem; a plain sequence does it.",
          },
          {
            id: "digits",
            label: "Sum the digits of 4096: its last digit plus the digit sum of 409",
          },
          {
            id: "swap",
            label: "Swap two variables",
            feedback: "Nothing shrinks and there is no stopping point.",
          },
        ],
        correctOptionId: "digits",
        explanation: "digitSum(4096) = 6 + digitSum(409): a smaller copy of the same problem, a stop when one digit is left, and an addition after each call returns.",
      },
      reveal: { visual: digitSum },
    },
  ],
});
