import {
  callOf,
  methodCode,
  pendingWork,
  recursionCode,
  snapshotVisual,
} from "@/curriculum/concepts/recursion";
import { frameId, recursiveFunctions, traceRecursion } from "@/lib/domain/recursion";
import type { CallStackVisual } from "@/lib/learning/schema";
import { defineLesson } from "@/lib/learning/validate";

/**
 * The canonical Recursion lesson. It follows OpenDSA's recursion tutorial:
 * first the reasoning (solve a smaller instance, trust that call, reach a base
 * case, combine the returned result), then tracing as a separate skill
 * (winding and unwinding: parameters flow down, results flow back), with the
 * call stack as OpenDSA's activation-record model. algs4 1.1 supplies the
 * rules of thumb (base case; smaller subproblems). Every recursive state comes
 * from the trace engine.
 */

const java = (lines: string[]) => ({ source: lines.join("\n"), language: "java" as const });

const bridgeCode = java([
  'void main() { a(); System.out.println("main"); }',
  'void a()    { b(); System.out.println("a"); }',
  'void b()    { System.out.println("b"); }',
]);

const factorialMethod = methodCode("factorial");
const sumMethod = methodCode("sumTo");

const fact3 = traceRecursion("factorial", 3);
const fact3Code = recursionCode("factorial", 3);
const at = (index: number) => snapshotVisual(fact3, fact3.snapshots[index]);
// Snapshots of factorial(3): 0-2 calls, 3 base case, 4-5 returns, 6 back in main.
const [callThree, callTwo, callOne, baseCase, returnTwo, returnThree, done] = [0, 1, 2, 3, 4, 5, 6].map(at);
const lines = (highlight: number[]) => ({ source: fact3Code.source, language: fact3Code.language, highlight });

// "Trust the smaller call": factorial(4) has just returned 24 inside factorial(5).
const fact5 = traceRecursion("factorial", 5);
const fourReturns = fact5.snapshots.find((s) => s.kind === "return" && s.frames.at(-1)?.n === 4)!;
const fact5Deepest = fact5.snapshots.find((s) => s.kind === "base")!;
const fact5Code = recursionCode("factorial", 5);

const fact4 = traceRecursion("factorial", 4);
const fact4Code = recursionCode("factorial", 4);

const sum3 = traceRecursion("sumTo", 3);
const sum5 = traceRecursion("sumTo", 5);
const sumFourReturns = sum5.snapshots.find((s) => s.kind === "return" && s.frames.at(-1)?.n === 4)!;
const sumFour = traceRecursion("sumTo", 4).result ?? 0;
const sumFive = recursiveFunctions.sumTo.combine(5, sumFour) ?? 0;

const countdown = traceRecursion("countdown", 3);
const countdownCode = recursionCode("countdown", 3);
const countUp = traceRecursion("countUp", 3);
const countUpCode = recursionCode("countUp", 3);

// Asking the person in front for your row number: the same question, one row smaller.
const theater: CallStackVisual = {
  kind: "callStack",
  frames: [
    { id: "you", call: "you: my row?", status: "waiting", detail: "answer from ahead + 1" },
    { id: "row3", call: "row ahead: my row?", status: "waiting", detail: "answer from ahead + 1" },
    { id: "row2", call: "row ahead: my row?", status: "waiting", detail: "answer from ahead + 1" },
    { id: "front", call: "front row", status: "base", detail: "knows directly: row 1" },
  ],
  carry: { id: "answer", value: "1", frameId: "front", label: "answers" },
  phase: "unwinding",
};

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
  subtitle: "Solve a smaller version, then use its answer.",
  sources: [
    {
      title: "OpenDSA: Introduction to Recursion",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/RecurTutor/RecIntro.rst",
      role: "pedagogy",
    },
    {
      title: "OpenDSA: Writing a Recursive Function",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/RecurTutor/Write.rst",
      role: "concept",
    },
    {
      title: "OpenDSA: Tracing Recursive Code",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/RecurTutor/Trace.rst",
      role: "pedagogy",
    },
    {
      title: "OpenDSA: Implementing Recursion (stacks and activation records)",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/List/StackRecur.rst",
      role: "concept",
    },
    {
      title: "Algorithms, 4th Edition, 1.1 Basic Programming Model (recursion)",
      url: "https://algs4.cs.princeton.edu/11model/",
      role: "implementation",
    },
  ],
  steps: [
    // --- The recursive idea -------------------------------------------------
    {
      id: "smaller-question",
      mode: "show",
      title: "Answer a smaller version of the same question.",
      body: "In a dark theater you want your row number. You ask the person in front; they ask the person in front of them, and so on. The front row knows directly: row 1. Each answer then travels back one person at a time, and each person adds 1. That is recursion: answer a smaller version of the same question, then use its answer.",
      visual: theater,
    },
    {
      id: "three-parts",
      mode: "show",
      title: "Every recursive method has three parts.",
      body: "Base case (lines 2–4): an input small enough to answer directly. Recursive call: `factorial(n - 1)`, the same problem on a smaller input. Combine: `n * …` uses the smaller answer to build this one. factorial(4) is 4 × 3 × 2 × 1 = 24.",
      visual: snapshotVisual(fact4, fact4.snapshots[0]),
      code: { ...factorialMethod, highlight: [2, 3, 4, 5] },
    },
    {
      id: "predict-trust",
      mode: "predict",
      title: "Trust the smaller call.",
      body: "You do not have to trace every call to reason about recursion.",
      visual: snapshotVisual(fact5, fourReturns),
      code: { ...factorialMethod, highlight: [5] },
      question: {
        kind: "choice",
        prompt: "Suppose `factorial(4)` correctly returns 24. What must `factorial(5)` return?",
        options: [
          {
            id: "plus",
            label: "25",
            feedback: "Adding 1 was the theater rule. factorial combines with *: 5 * 24.",
          },
          { id: "right", label: "120" },
          {
            id: "same",
            label: "24",
            feedback: "That is factorial(4)'s answer. factorial(5) still has to do its own step of work.",
          },
        ],
        correctOptionId: "right",
        explanation: "Assume the smaller call is right, then do this call's one step: 5 * 24 = 120. That is how recursive code is written: handle the base case, and combine the smaller answer correctly.",
      },
    },
    {
      id: "complete-base",
      mode: "complete",
      title: "Rebuild the base case.",
      body: "factorial(1) is 1, and there is nothing smaller to ask.",
      code: { ...factorialMethod, highlight: [2], blankLine: 3 },
      question: {
        kind: "choice",
        prompt: "What should the base case return?",
        options: [
          {
            id: "zero",
            label: "return 0;",
            feedback: "Then every product is multiplied by 0, so every answer becomes 0.",
          },
          {
            id: "recurse",
            label: "return factorial(n - 1);",
            feedback: "A base case must answer without another call, or the calls never stop.",
          },
          { id: "one", label: "return 1;" },
        ],
        correctOptionId: "one",
        explanation: "The base case answers directly. Every other call builds on the 1 it returns.",
      },
    },
    {
      id: "explain-progress",
      mode: "explain",
      title: "Each call must shrink the problem.",
      body: "The recursive call has to move toward the base case.",
      code: { ...factorialMethod, highlight: [2, 5] },
      question: {
        kind: "choice",
        prompt: "Which recursive call guarantees `factorial` eventually reaches `n <= 1`?",
        options: [
          {
            id: "same",
            label: "factorial(n)",
            feedback: "The same input makes no progress: the calls would never stop.",
          },
          { id: "smaller", label: "factorial(n - 1)" },
          {
            id: "bigger",
            label: "factorial(n + 1)",
            feedback: "That moves away from the base case.",
          },
        ],
        correctOptionId: "smaller",
        explanation: "Every call on n - 1 is one step closer to n <= 1, so the chain of calls is guaranteed to end at the base case.",
      },
    },

    // --- What Java does: the call stack ---------------------------------------
    {
      id: "predict-finish",
      mode: "predict",
      title: "How does Java run this? With the call stack.",
      body: "First, three ordinary methods: `main` calls `a()`, and `a()` calls `b()`. Each unfinished call waits on the call stack you met in the Stack lesson.",
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
      body: "a() resumed, printed a and returned; then main resumed and printed main. The most recent unfinished call always returns first. Recursion uses exactly this machinery.",
      visual: {
        kind: "callStack",
        frames: [{ id: "main", call: "main()", status: "returning", detail: 'printed "main", returns' }],
        phase: "unwinding",
        output: ["b", "a", "main"],
      },
      code: { ...bridgeCode, highlight: [1] },
    },
    {
      id: "own-frame",
      mode: "show",
      title: "Each recursive call gets its own frame.",
      body: "`factorial(3)` is an ordinary call. Its frame stores its own n = 3 and where to resume when it gets an answer back. It checks `n <= 1`: false, so it moves on to line 9.",
      visual: callThree,
      code: lines([fact3Code.lines.baseCheck]),
    },
    {
      id: "predict-call",
      mode: "predict",
      title: "Calling down: the parameter shrinks.",
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
        explanation: "n - 1 is 2, so `factorial(3)` calls `factorial(2)`. Information flows down through the parameter; another frame goes on top.",
      },
      reveal: { visual: callTwo },
    },
    {
      id: "explain-waiting",
      mode: "explain",
      title: "Pending work waits in the frame.",
      body: "`factorial(3)` is paused in the middle of line 9.",
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
      body: "Picture factorial without its `if`. factorial(1) would call factorial(0), which calls factorial(-1), and so on. Every call waits on the next, so frames pile up until Java runs out of stack space and throws `StackOverflowError`.",
      visual: runaway,
      code: java(["int factorial(int n) {", "    return n * factorial(n - 1);", "}"]),
    },
    {
      id: "base-case",
      mode: "trace",
      title: "The base case stops the calls.",
      body: "With the `if` in place, factorial(1) finds `n <= 1` true and returns 1 directly, without another call. It is the first call to finish, so unwinding starts here.",
      visual: baseCase,
      code: lines([fact3Code.lines.baseReturn]),
    },
    {
      id: "predict-return",
      mode: "predict",
      title: "Unwinding: results flow back.",
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
        explanation: "factorial(2) resumes at line 9 and finally does its pending work: 2 * 1 = 2.",
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
      practice: {
        kind: "recursion-trace",
        difficulty: "intro",
        skills: ["next-call", "base-return", "return-value", "resumes"],
      },
    },
    {
      id: "explain-phases",
      mode: "explain",
      title: "Two directions.",
      body: "Calling down creates frames and leaves work pending. Unwinding finishes that work, newest frame first. Beginners often forget the unwinding half.",
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

    // --- Work before or after the call -------------------------------------------
    {
      id: "predict-countdown",
      mode: "predict",
      title: "Work before the recursive call.",
      body: "`countdown` prints n, then calls itself on n - 1.",
      visual: snapshotVisual(countdown, countdown.snapshots[0]),
      code: { ...countdownCode, highlight: [countdownCode.lines.print!, countdownCode.lines.recurse] },
      question: {
        kind: "choice",
        prompt: "What does `countdown(3)` print?",
        options: [
          { id: "down", label: "3 2 1" },
          { id: "up", label: "1 2 3", feedback: "Each call prints before it makes its call, so 3 is printed first." },
          { id: "one", label: "3", feedback: "Every call down to 1 prints; only countdown(0) stops without printing." },
        ],
        correctOptionId: "down",
        explanation: "Each frame prints on the way down, before calling the smaller problem: 3, 2, 1.",
      },
      reveal: { visual: snapshotVisual(countdown, countdown.snapshots[countdown.snapshots.length - 1]) },
    },
    {
      id: "predict-countup",
      mode: "predict",
      title: "Move the print after the call.",
      body: "`countUp` is the same method with its two lines swapped.",
      visual: snapshotVisual(countUp, countUp.snapshots[0]),
      code: { ...countUpCode, highlight: [countUpCode.lines.recurse, countUpCode.lines.print!] },
      question: {
        kind: "choice",
        prompt: "What does `countUp(3)` print?",
        options: [
          { id: "down", label: "3 2 1", feedback: "The print now waits until the smaller call has returned." },
          { id: "up", label: "1 2 3" },
          { id: "none", label: "Nothing", feedback: "Every frame still prints; it just prints later." },
        ],
        correctOptionId: "up",
        explanation: "Each frame first finishes its smaller call, then prints. Prints happen while unwinding, newest frame first: 1, 2, 3.",
      },
      reveal: { visual: snapshotVisual(countUp, countUp.snapshots[countUp.snapshots.length - 1]) },
    },
    {
      id: "explain-order",
      mode: "explain",
      title: "Why did swapping two lines reverse the output?",
      body: "Both methods make the same calls in the same order.",
      question: {
        kind: "choice",
        prompt: "What is the difference between the two?",
        options: [
          {
            id: "calls",
            label: "countUp calls itself in a different order.",
            feedback: "The calls are identical: 3, 2, 1, 0 in both.",
          },
          { id: "timing", label: "Work before the call happens while calling down; work after it happens while unwinding." },
          {
            id: "base",
            label: "countUp has a different base case.",
            feedback: "Both stop at n == 0.",
          },
        ],
        correctOptionId: "timing",
        explanation: "Code before the recursive call runs on the way down, in call order. Code after it runs on the way back up, in reverse order.",
      },
      practice: { kind: "recursion-trace", difficulty: "standard", skills: ["printed"] },
    },

    // --- Cost ---------------------------------------------------------------------
    {
      id: "complexity",
      mode: "show",
      title: "n calls, n frames.",
      body: "factorial(n) makes n calls, each doing a constant amount of work: O(n) time. At the deepest point all n calls are unfinished at once, and each holds a frame, so the call stack uses O(n) space, even though no array was created. A loop would compute the same product in O(1) extra space.",
      visual: snapshotVisual(fact5, fact5Deepest, { caption: "factorial(5) at its deepest: 5 frames at once" }),
      code: { source: fact5Code.source, language: "java", highlight: [fact5Code.lines.baseReturn] },
    },

    // --- Reconstruct, debug, practice ------------------------------------------------
    {
      id: "complete-sum",
      mode: "complete",
      title: "Rebuild the recursive step.",
      body: "`sumTo(n)` adds 1 + 2 + … + n. The base case is written; the recursive line is missing.",
      visual: snapshotVisual(sum3, sum3.snapshots[0]),
      code: {
        ...sumMethod,
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
      id: "predict-ignored",
      mode: "predict",
      title: "A bug that compiles.",
      body: "This version makes the recursive call, but look at what it does with the result.",
      code: java([
        "int sumTo(int n) {",
        "    if (n == 0) {",
        "        return 0;",
        "    }",
        "    sumTo(n - 1);",
        "    return n;",
        "}",
      ]),
      question: {
        kind: "choice",
        prompt: "What does this `sumTo(3)` return?",
        options: [
          { id: "six", label: "6", feedback: "It would be 6 if the smaller sum were used; here it is thrown away." },
          { id: "three", label: "3" },
          { id: "zero", label: "0", feedback: "The base case returns 0, but sumTo(3) returns its own n." },
        ],
        correctOptionId: "three",
        explanation: "The recursive call runs, but its returned value is ignored, so each frame just returns its own n. A recursive call only helps if you use what it returns.",
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
      practice: { kind: "recursion-trace", difficulty: "standard", skills: ["returns", "calls", "final"] },
    },
    {
      id: "solve-trust",
      mode: "solve",
      title: "Reason without tracing.",
      body: "No need to follow every frame this time: trust the smaller call.",
      visual: snapshotVisual(sum5, sumFourReturns),
      code: { ...sumMethod, highlight: [sumMethod.lines.recurse] },
      question: {
        kind: "number-list",
        prompt: `\`sumTo(4)\` returns ${sumFour}. What does \`sumTo(5)\` return?`,
        expected: [sumFive],
        explanation: `sumTo(5) adds its own n to the smaller answer: 5 + ${sumFour} = ${sumFive}.`,
      },
    },

    // --- Recognize and transfer -----------------------------------------------------
    {
      id: "recognize",
      mode: "explain",
      title: "Spot the recursion-shaped problem.",
      body: "Recursion fits when a problem contains a smaller copy of itself, a point where it stops, and some work before or after the smaller call. It is a design tool, not automatically the fastest code. Later, one call will sometimes make two calls: that is how trees and backtracking work.",
      question: {
        kind: "choice",
        prompt: "Which problem is most naturally recursive?",
        options: [
          {
            id: "loop",
            label: "Add up a list of numbers once",
            feedback: "Recursion can do it, but a simple loop does the same with no extra frames.",
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
    {
      id: "transfer-power",
      mode: "complete",
      title: "New problem: power(base, exp).",
      body: "base to the power exp is base times base to the power (exp − 1), and anything to the power 0 is 1. Rebuild the recursive step.",
      visual: {
        kind: "callStack",
        frames: [
          { id: "main", call: "main()", status: "waiting", detail: "result = power(2, 3)" },
          { id: "p0", call: "power(2, 3)", status: "running", detail: "base = 2, exp = 3" },
        ],
        entering: "p0",
        phase: "calling",
      },
      code: {
        ...java([
          "int power(int base, int exp) {",
          "    if (exp == 0) {",
          "        return 1;",
          "    }",
          "    return base * power(base, exp - 1);",
          "}",
        ]),
        highlight: [2, 3],
        blankLine: 5,
      },
      question: {
        kind: "choice",
        prompt: "Which recursive step is correct?",
        options: [
          {
            id: "same",
            label: "return base * power(base, exp);",
            feedback: "exp never shrinks, so the calls never reach exp == 0.",
          },
          {
            id: "exp",
            label: "return exp * power(base, exp - 1);",
            feedback: "That multiplies by the exponent instead of the base.",
          },
          { id: "right", label: "return base * power(base, exp - 1);" },
          {
            id: "drop",
            label: "return power(base, exp - 1);",
            feedback: "Without the multiplication every answer is just the base case's 1.",
          },
        ],
        correctOptionId: "right",
        explanation: "Smaller problem: power(base, exp - 1). Combine: multiply by base. Base case: exp == 0 returns 1. So power(2, 3) = 2 * 2 * 2 * 1 = 8.",
      },
    },
  ],
});
