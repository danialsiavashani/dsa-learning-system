import {
  pop,
  push,
  runOperations,
  stackFromValues,
  stackValues,
} from "@/lib/domain/stack";
import { listValues } from "@/lib/learning/format";
import { defineLesson } from "@/lib/learning/validate";

/**
 * The canonical Stack lesson. Sequencing and claims follow OpenDSA's stack
 * module (restricted access at one end, LIFO, choosing which end of an array
 * is the top) and its queue module for the FIFO contrast, with Java checked
 * against algs4 section 1.3 / ResizingArrayStack and the ArrayDeque docs.
 * Every state is produced by the stack domain functions.
 */

const java = (lines: string[]) => ({ source: lines.join("\n"), language: "java" as const });

const usageCode = java([
  "Deque<Integer> stack = new ArrayDeque<>();",
  "stack.push(4);",
  "stack.push(8);",
  "stack.push(2);",
  "stack.push(6);",
  "stack.push(5);",
  "int seen = stack.peek();",
  "int out = stack.pop();",
  "int next = stack.pop();",
]);

const arrayStackCode = java([
  "class IntStack {",
  "    private int[] a = new int[8];",
  "    private int n = 0;",
  "    void push(int x) { a[n++] = x; }",
  "    int pop()        { return a[--n]; }",
  "    int peek()       { return a[n - 1]; }",
  "}",
]);

const emptyCode = java([
  "while (!stack.isEmpty()) {",
  "    stack.pop();",
  "}",
  "Integer top = stack.peek();",
]);

const drainCode = java([
  "while (!stack.isEmpty()) {",
  "    int top = stack.pop();",
  "    System.out.println(top);",
  "}",
]);

const undoCode = java([
  "void undo(Deque<String> history) {",
  "    if (history.isEmpty()) return;",
  "    String lastEdit = history.pop();",
  "    revert(lastEdit);",
  "}",
]);

const traceCode = java([
  "Deque<Integer> stack = new ArrayDeque<>();",
  "stack.push(3);",
  "stack.push(7);",
  "stack.push(1);",
  "stack.pop();",
  "stack.push(9);",
  "stack.push(4);",
  "stack.pop();",
]);

const reverseCode = java([
  "Deque<Integer> stack = new ArrayDeque<>();",
  "for (int x : new int[] {1, 2, 3, 4}) {",
  "    stack.push(x);",
  "}",
  "while (!stack.isEmpty()) {",
  '    System.out.print(stack.pop() + " ");',
  "}",
]);

const callCode = java([
  "void main()  { load(); }",
  "void load()  { parse(); }",
  'void parse() { System.out.println("parsing"); }',
]);

// The main sequence: 4, 8, 2 are already there; then push 6, push 5, peek, pop, pop.
const base = stackFromValues([4, 8, 2], "base");
const pushSix = push(base, 6, "six");
const pushFive = push(pushSix.after, 5, "five");
const popFive = pop(pushFive.after);
const popSix = pop(popFive.after);
const [bottom, middle, two] = base;

// The independent trace: lines 2-3 build {3, 7}; the learner runs lines 4-8.
const traceStart = stackFromValues([3, 7], "t");
const traceRun = runOperations(traceStart, [
  { type: "push", value: 1 },
  { type: "pop" },
  { type: "push", value: 9 },
  { type: "push", value: 4 },
  { type: "pop" },
]);
const lastPopped = traceRun.steps[traceRun.steps.length - 1].before.at(-1);

// Reversal: push 1..4, then pop everything.
const reverseRun = runOperations(
  [],
  [
    ...[1, 2, 3, 4].map((value) => ({ type: "push" as const, value })),
    ...[1, 2, 3, 4].map(() => ({ type: "pop" as const })),
  ],
  "r",
);
const reversePushed = reverseRun.steps[3].after;

const pages = stackFromValues(["home", "search", "results"], "page");
const history = stackFromValues(["type", "bold", "delete"], "edit");
// Checking "([)]": "(" and "[" are pushed, then ")" arrives.
const brackets = stackFromValues(["(", "["], "open");
const calls = stackFromValues(["main()", "load()", "parse()"], "call");

export const stackLesson = defineLesson({
  id: "stack",
  title: "Stack",
  subtitle: "Watch values enter and leave from one end.",
  sources: [
    {
      title: "OpenDSA: Stacks (array-based)",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/List/StackArray.rst",
      role: "concept",
    },
    {
      title: "OpenDSA: Queues (for the FIFO contrast)",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/List/Queue.rst",
      role: "concept",
    },
    {
      title: "Algorithms, 4th Edition, 1.3 Bags, Queues, and Stacks",
      url: "https://algs4.cs.princeton.edu/13stacks/",
      role: "pedagogy",
    },
    {
      title: "algs4 ResizingArrayStack.java",
      url: "https://algs4.cs.princeton.edu/13stacks/ResizingArrayStack.java.html",
      role: "implementation",
    },
    {
      title: "Java SE API: ArrayDeque",
      url: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html",
      role: "implementation",
    },
  ],
  steps: [
    {
      id: "purpose",
      mode: "show",
      title: "Sometimes only the most recent thing matters.",
      body: "A browser's Back button returns to the page you visited last, then the one before that. Many problems work like this: the newest unfinished item is the one you need next. A stack is the structure built for exactly that.",
      visual: { kind: "stack", items: pages, marks: { page2: "focus" } },
    },
    {
      id: "pile",
      mode: "show",
      title: "Values pile up, one on another.",
      body: "4 went in first, then 8, then 2. Each new value lands on the one before it, so the most recent one, 2, is on top. The top is the only value you can reach.",
      visual: { kind: "stack", items: base },
      code: { ...usageCode, highlight: [1, 2, 3, 4] },
    },
    {
      id: "push",
      mode: "trace",
      title: "`push` adds a value on top.",
      body: "`stack.push(6)` places 6 above 2. Nothing underneath moves.",
      visual: { kind: "stack", items: pushSix.after, marks: { six: "new" } },
      code: { ...usageCode, highlight: [5] },
    },
    {
      id: "predict-push",
      mode: "predict",
      title: "Where will 5 go?",
      body: "5 is waiting beside the stack.",
      visual: {
        kind: "stack",
        items: pushSix.after,
        held: { id: "five", value: 5, label: "push(5)" },
      },
      code: { ...usageCode, highlight: [6] },
      question: {
        kind: "choice",
        prompt: "After `stack.push(5)`, which value is on top?",
        options: [
          { id: "six", label: "6", feedback: "6 was the top until now. push puts 5 above it." },
          { id: "five", label: "5" },
          {
            id: "four",
            label: "4",
            feedback: "4 is the bottom, the first value pushed. New values never go underneath.",
          },
        ],
        correctOptionId: "five",
        explanation: "push always adds at the top, so the newest value is on top.",
      },
      reveal: { visual: { kind: "stack", items: pushFive.after, marks: { five: "focus" } } },
    },
    {
      id: "predict-peek",
      mode: "predict",
      title: "Look without taking.",
      body: "`peek` reads the top of the stack.",
      visual: { kind: "stack", items: pushFive.after },
      code: { ...usageCode, highlight: [7] },
      question: {
        kind: "choice",
        prompt: "What does `stack.peek()` return?",
        options: [
          { id: "four", label: "4", feedback: "4 has been there longest, but peek reads the top." },
          { id: "six", label: "6", feedback: "6 is just below the top." },
          { id: "five", label: "5" },
        ],
        correctOptionId: "five",
        explanation: "peek() returns the top value, 5, and leaves it where it is.",
      },
      reveal: {
        visual: { kind: "stack", items: pushFive.after, marks: { five: "focus" }, callout: "peek() → 5" },
      },
    },
    {
      id: "predict-pop",
      mode: "predict",
      title: "Now take one off.",
      body: "`pop` removes a value and hands it back.",
      visual: { kind: "stack", items: pushFive.after },
      code: { ...usageCode, highlight: [8] },
      question: {
        kind: "choice",
        prompt: "Which value does `stack.pop()` return?",
        options: [
          { id: "five", label: "5" },
          { id: "four", label: "4", feedback: "4 is the oldest value. A stack hands back the newest first." },
          { id: "six", label: "6", feedback: "6 is underneath 5, so it has to wait." },
        ],
        correctOptionId: "five",
        explanation: "pop() removes the top value and returns it.",
      },
      reveal: {
        visual: { kind: "stack", items: popFive.after, held: { id: "five", value: 5, label: "pop() → 5" } },
      },
    },
    {
      id: "pop-again",
      mode: "trace",
      title: "Pop again: 6 leaves next.",
      body: `With 5 gone, 6 is on top, so the next \`pop()\` returns 6, and ${two.value} becomes the top again.`,
      visual: { kind: "stack", items: popSix.after, held: { id: "six", value: 6, label: "pop() → 6" } },
      code: { ...usageCode, highlight: [9] },
      practice: { kind: "stack-operations", difficulty: "intro", skills: ["top", "popped", "peek"] },
    },
    {
      id: "explain-lifo",
      mode: "explain",
      title: "Why did 5 come out before 6?",
      body: "6 was pushed first, yet 5 left first.",
      question: {
        kind: "choice",
        prompt: "What decides which value pop() returns?",
        options: [
          {
            id: "size",
            label: "pop() removes the largest value.",
            feedback: "6 is larger than 5, yet 5 left first. Arrival order decides, not size.",
          },
          { id: "recent", label: "The most recently pushed value is always on top." },
          {
            id: "fifo",
            label: "Values leave in the order they were pushed.",
            feedback: "That would be first in, first out, which is a queue. A stack is the reverse.",
          },
        ],
        correctOptionId: "recent",
        explanation: "Last in, first out (LIFO): values leave in the reverse order they arrived.",
      },
    },
    {
      id: "solve-trace",
      mode: "solve",
      title: "Trace a sequence yourself.",
      body: "Lines 1–3 built the stack you see. Run lines 4–8 in your head.",
      visual: { kind: "stack", items: traceStart },
      code: { ...traceCode, highlight: [4, 5, 6, 7, 8] },
      question: {
        kind: "number-list",
        prompt: "Type the stack from bottom to top after line 8.",
        expected: stackValues(traceRun.final),
        explanation: `pop() took ${listValues(traceRun.popped)}, the newest value each time, leaving {${stackValues(traceRun.final).join(", ")}}.`,
      },
      reveal: {
        visual: {
          kind: "stack",
          items: traceRun.final,
          held: lastPopped && {
            id: lastPopped.id,
            value: lastPopped.value,
            label: `pop() → ${lastPopped.value}`,
          },
        },
      },
      practice: { kind: "stack-operations", difficulty: "standard", skills: ["final", "popped"] },
    },
    {
      id: "one-end",
      mode: "show",
      title: "Only one end, on purpose.",
      body: "A stack hides everything below the top. With only push, pop and peek, nobody can reach in and break the last-in, first-out order, and each operation stays simple and fast. A general list lets you touch any position: more flexible, but that flexibility is not needed here.",
      visual: {
        kind: "stack",
        items: popSix.after,
        marks: { [bottom.id]: "muted", [middle.id]: "muted", [two.id]: "focus" },
      },
    },
    {
      id: "inside",
      mode: "show",
      title: "Inside a stack: an array and a count.",
      body: "One way to build a stack, the approach behind algs4's array stack: values live in an array with the bottom at index 0, and `n` counts them. The top is `a[n - 1]`; the next free slot is `a[n]`.",
      visual: {
        kind: "array",
        items: base,
        pointers: [
          { index: 2, label: "top" },
          { index: 3, label: "n = 3" },
        ],
      },
      code: { ...arrayStackCode, highlight: [2, 3] },
    },
    {
      id: "explain-top-end",
      mode: "explain",
      title: "Why keep the top at the end?",
      body: "The top could have been index 0 instead.",
      code: { ...arrayStackCode, highlight: [4, 5] },
      question: {
        kind: "choice",
        prompt: "Why does this stack keep its top at the end of the array?",
        options: [
          {
            id: "grow",
            label: "Arrays can only be written at the end.",
            feedback: "Any slot can be written by index. The point is avoiding shifts.",
          },
          { id: "no-shift", label: "Pushing and popping at the end never shifts other values." },
          {
            id: "sorted",
            label: "It keeps the values sorted.",
            feedback: "A stack keeps arrival order, not sorted order.",
          },
        ],
        correctOptionId: "no-shift",
        explanation: "With the top at index 0, every push would shift all values right and every pop would shift them left, O(n), just like inserting at the front of an array. At the end, nothing else moves.",
      },
    },
    {
      id: "array-push",
      mode: "trace",
      title: "`push` writes `a[n]`, then `n` grows.",
      body: "`a[n++] = x` stores 6 in the free slot `a[3]`, then increases `n` to 4. One write and no shifting: O(1).",
      visual: {
        kind: "array",
        items: pushSix.after,
        marks: { six: "new" },
        pointers: [
          { index: 3, label: "top" },
          { index: 4, label: "n = 4" },
        ],
      },
      code: { ...arrayStackCode, highlight: [4] },
    },
    {
      id: "predict-array-pop",
      mode: "predict",
      title: "Pop from the array.",
      body: "`pop()` runs `return a[--n];` with n = 4.",
      visual: {
        kind: "array",
        items: pushSix.after,
        pointers: [
          { index: 3, label: "top" },
          { index: 4, label: "n = 4" },
        ],
      },
      code: { ...arrayStackCode, highlight: [5] },
      question: {
        kind: "choice",
        prompt: "What does `pop()` return, and what is `n` afterwards?",
        options: [
          { id: "right", label: "6, and n becomes 3" },
          { id: "bottom", label: "4, and n becomes 3", feedback: "`a[0]` is the bottom; pop reads the top, `a[n - 1]`." },
          {
            id: "stays",
            label: "6, and n stays 4",
            feedback: "`--n` lowers n before reading, so slot 3 becomes free.",
          },
        ],
        correctOptionId: "right",
        explanation: "`--n` drops n to 3, then `a[3]`, the 6, is returned. The 6 is still in the array, but it sits past n, so it is free space now; the next push overwrites it.",
      },
      reveal: {
        visual: {
          kind: "array",
          items: pushSix.after,
          marks: { six: "muted" },
          pointers: [
            { index: 2, label: "top" },
            { index: 3, label: "n = 3" },
          ],
          caption: "a[3] still holds 6, but it is past n: free space",
        },
      },
    },
    {
      id: "complexity",
      mode: "show",
      title: "push, pop and peek are all O(1).",
      body: "Each operation reads or writes one slot at the top, however many values lie below. `ArrayDeque` sometimes copies its array into a bigger one when it fills up, but spread over many pushes that averages out to constant time.",
      visual: { kind: "stack", items: popSix.after, marks: { [two.id]: "focus" } },
      code: { ...usageCode, highlight: [6, 7, 8] },
    },
    {
      id: "predict-empty",
      mode: "predict",
      title: "Empty it, then peek.",
      body: `The loop pops ${listValues([...stackValues(popSix.after)].reverse())} until \`isEmpty()\` is true. Now there is no top.`,
      visual: { kind: "stack", items: [] },
      code: { ...emptyCode, highlight: [4] },
      question: {
        kind: "choice",
        prompt: "What does `stack.peek()` return on an empty stack?",
        options: [
          { id: "zero", label: "0", feedback: "Java does not invent a value. An empty Deque has no top." },
          { id: "null", label: "null" },
          {
            id: "throws",
            label: "It throws `NoSuchElementException`",
            feedback: "That is what `pop()` does on an empty ArrayDeque. `peek()` returns null instead.",
          },
        ],
        correctOptionId: "null",
        explanation: "On an empty `ArrayDeque`, `peek()` returns null and `pop()` throws `NoSuchElementException`.",
      },
    },
    {
      id: "complete-drain",
      mode: "complete",
      title: "Pop only while something is there.",
      body: "This code prints and removes every value. The loop condition is missing.",
      visual: { kind: "stack", items: base },
      code: { ...drainCode, highlight: [2], blankLine: 1 },
      question: {
        kind: "choice",
        prompt: "Which loop header is safe?",
        options: [
          {
            id: "count",
            label: "for (int i = 0; i < 5; i++) {",
            feedback: "It assumes exactly 5 values. With fewer, pop() on an empty stack throws NoSuchElementException.",
          },
          { id: "empty", label: "while (!stack.isEmpty()) {" },
          {
            id: "peek",
            label: "while (stack.peek() != 0) {",
            feedback: "On an empty stack peek() returns null, and comparing null with 0 throws NullPointerException. It would also stop early at a real 0.",
          },
        ],
        correctOptionId: "empty",
        explanation: "Check `isEmpty()` before every pop. The stack itself says when it is done.",
      },
    },
    {
      id: "java",
      mode: "show",
      title: "In Java, use `ArrayDeque` as your stack.",
      body: "`Deque<Integer> stack = new ArrayDeque<>()` gives you `push`, `pop` and `peek`, all at the same end. Java also has an older `Stack` class, but it adds index-based methods that break the one-end rule, and its own documentation points to `Deque` instead.",
      visual: { kind: "stack", items: base },
      code: { ...usageCode, highlight: [1] },
    },
    {
      id: "complete-undo",
      mode: "complete",
      title: "Undo is a stack.",
      body: "Every edit is pushed onto `history`. Undo must reverse the most recent edit.",
      visual: { kind: "stack", items: history, marks: { edit2: "focus" } },
      code: { ...undoCode, highlight: [1], blankLine: 3 },
      question: {
        kind: "choice",
        prompt: "Which line belongs in the gap?",
        options: [
          {
            id: "peek",
            label: "String lastEdit = history.peek();",
            feedback: "peek reads the last edit but leaves it on the stack, so the next undo would revert the same edit again.",
          },
          {
            id: "remove-last",
            label: "String lastEdit = history.removeLast();",
            feedback: "On a Deque used as a stack, push and pop work at the front; removeLast takes the oldest edit from the bottom.",
          },
          { id: "pop", label: "String lastEdit = history.pop();" },
        ],
        correctOptionId: "pop",
        explanation: "pop() removes the most recent edit so it can be reverted, leaving the previous edit on top for the next undo.",
      },
      practice: { kind: "stack-operations", difficulty: "standard", skills: ["operation"] },
    },
    {
      id: "solve-reverse",
      mode: "solve",
      title: "New problem: what does this print?",
      body: "Four values go in, then everything comes back out.",
      visual: { kind: "stack", items: [] },
      code: { ...reverseCode, highlight: [3, 6] },
      question: {
        kind: "number-list",
        prompt: "Type the numbers printed, in order.",
        expected: reverseRun.popped,
        explanation: `The last value pushed is the first popped, so the output is the input reversed: ${reverseRun.popped.join(" ")}.`,
      },
      reveal: {
        visual: {
          kind: "stack",
          items: reversePushed,
          marks: { [reversePushed[reversePushed.length - 1].id]: "focus" },
          caption: `after the pushes; pops come off the top: ${reverseRun.popped.join(", ")}`,
        },
      },
    },
    {
      id: "predict-brackets",
      mode: "predict",
      title: "Do these brackets match?",
      body: "Checking `([)]` left to right, each opener is pushed. Now `)` arrives.",
      visual: {
        kind: "stack",
        items: brackets,
        marks: { open1: "focus" },
        caption: "next character: )",
      },
      question: {
        kind: "choice",
        prompt: "Is `([)]` balanced?",
        options: [
          {
            id: "count",
            label: "Yes: two openers and two closers",
            feedback: "Counting is not enough. Each closer must match the most recent unmatched opener.",
          },
          {
            id: "inside",
            label: "Yes: `(` is in the stack",
            feedback: "It is there, but underneath `[`. Only the top can be matched.",
          },
          { id: "no", label: "No: when `)` arrives, the top is `[`" },
        ],
        correctOptionId: "no",
        explanation: "The most recent opener must close first. `)` meets `[` on top, so the brackets are not balanced. Push openers; on a closer, pop and compare.",
      },
    },
    {
      id: "recognize",
      mode: "explain",
      title: "Stack or something else?",
      body: "A stack hands back the newest item (LIFO). A queue, which comes later, hands back the oldest (FIFO), like a line at a ticket counter.",
      question: {
        kind: "choice",
        prompt: "Which situation calls for a stack?",
        options: [
          {
            id: "printing",
            label: "Printing documents in the order they were sent",
            feedback: "First come, first served is a queue: the oldest job leaves first.",
          },
          { id: "undo", label: "Undoing edits, newest first" },
          {
            id: "position",
            label: "Looking up the 3rd item by position",
            feedback: "A stack hides everything but the top. An array fits position lookups.",
          },
        ],
        correctOptionId: "undo",
        explanation: "Undo must reverse the most recent unfinished change first: last in, first out.",
      },
    },
    {
      id: "calls",
      mode: "show",
      title: "Method calls stack up too.",
      body: "`main` calls `load`, which calls `parse`. Java keeps each unfinished call on the call stack, with `parse`, the most recent, on top. When `parse` finishes, it is popped and `load` carries on. The most recent unfinished call returns first, which is the key to recursion, coming next.",
      visual: { kind: "stack", items: calls, marks: { call2: "focus" } },
      code: { ...callCode, highlight: [3] },
    },
  ],
});
