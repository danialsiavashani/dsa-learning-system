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
 * The canonical Stack lesson. Plain data: every state is produced by the
 * stack domain functions, so item IDs carry through push and pop and the
 * visualizer can animate values in and out of the top.
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

const emptyCode = java([
  "while (!stack.isEmpty()) {",
  "    stack.pop();",
  "}",
  "Integer top = stack.peek();",
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
const [, , two] = base;

// The independent exercise: lines 2-3 build {3, 7}; the learner runs lines 4-8.
const traceStart = stackFromValues([3, 7], "t");
const traceRun = runOperations(traceStart, [
  { type: "push", value: 1 },
  { type: "pop" },
  { type: "push", value: 9 },
  { type: "push", value: 4 },
  { type: "pop" },
]);
const lastPopped = traceRun.steps[traceRun.steps.length - 1].before.at(-1);

const history = stackFromValues(["type", "bold", "delete"], "edit");
// Scanning "(a[b]{c})" just after reading "{": "[" was matched by "]" and popped.
const brackets = push(pop(push(stackFromValues(["("], "open"), "[", "open1").after).after, "{", "open2");
const calls = stackFromValues(["main()", "load()", "parse()"], "call");

export const stackLesson = defineLesson({
  id: "stack",
  title: "Stack",
  subtitle: "Watch values enter and leave from one end.",
  steps: [
    {
      id: "pile",
      mode: "show",
      title: "Values pile up, one on another.",
      body: "4 went in first, then 8, then 2. Each new value lands on the one before it, so the most recent one, 2, is on top. The top is the only place anything happens.",
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
          {
            id: "six",
            label: "6",
            feedback: "6 was the top until now. push puts 5 above it.",
          },
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
      reveal: {
        visual: { kind: "stack", items: pushFive.after, marks: { five: "focus" } },
      },
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
          {
            id: "four",
            label: "4",
            feedback: "4 has been there longest, but peek reads the top.",
          },
          {
            id: "six",
            label: "6",
            feedback: "6 is just below the top.",
          },
          { id: "five", label: "5" },
        ],
        correctOptionId: "five",
        explanation: "peek() returns the top value, 5, and leaves it where it is.",
      },
      reveal: {
        visual: {
          kind: "stack",
          items: pushFive.after,
          marks: { five: "focus" },
          callout: "peek() → 5",
        },
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
          {
            id: "four",
            label: "4",
            feedback: "4 is the oldest value. A stack hands back the newest first.",
          },
          {
            id: "six",
            label: "6",
            feedback: "6 is underneath 5, so it has to wait.",
          },
        ],
        correctOptionId: "five",
        explanation: "pop() removes the top value and returns it.",
      },
      reveal: {
        visual: {
          kind: "stack",
          items: popFive.after,
          held: { id: "five", value: 5, label: "pop() → 5" },
        },
      },
    },
    {
      id: "pop-again",
      mode: "trace",
      title: "Pop again: 6 leaves next.",
      body: `With 5 gone, 6 is on top, so the next \`pop()\` returns 6, and ${two.value} becomes the top again.`,
      visual: {
        kind: "stack",
        items: popSix.after,
        held: { id: "six", value: 6, label: "pop() → 6" },
      },
      code: { ...usageCode, highlight: [9] },
      practice: { kind: "stack-operations", difficulty: "intro" },
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
          {
            id: "recent",
            label: "The most recently pushed value is always on top.",
          },
          {
            id: "fifo",
            label: "Values leave in the order they were pushed.",
            feedback: "That would be first in, first out: a queue. A stack is the reverse.",
          },
        ],
        correctOptionId: "recent",
        explanation: "Last in, first out (LIFO): the value pushed most recently is the next to leave.",
      },
    },
    {
      id: "complexity",
      mode: "show",
      title: "Every operation touches only the top.",
      body: "push, pop and peek never look at 4 or 8. However tall the stack grows, each does the same small amount of work: push is O(1), pop is O(1), peek is O(1).",
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
          {
            id: "zero",
            label: "0",
            feedback: "Java does not invent a value. An empty Deque has no top.",
          },
          { id: "null", label: "null" },
          {
            id: "throws",
            label: "It throws `NoSuchElementException`",
            feedback: "That is what `pop()` does on an empty ArrayDeque. `peek()` returns null instead.",
          },
        ],
        correctOptionId: "null",
        explanation: "On an empty `ArrayDeque`, `peek()` returns null and `pop()` throws `NoSuchElementException`. Check `isEmpty()` before popping.",
      },
    },
    {
      id: "java",
      mode: "show",
      title: "In Java, use `ArrayDeque` as your stack.",
      body: "`Deque<Integer> stack = new ArrayDeque<>()` gives you `push`, `pop` and `peek`, all at the same end. Java also has an older `Stack` class, but it synchronizes every call (slower) and exposes index methods like `get(i)` that break the one-end rule. Java's own docs recommend `ArrayDeque`.",
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
    },
    {
      id: "solve-trace",
      mode: "solve",
      title: "Trace it yourself.",
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
      practice: { kind: "stack-operations", difficulty: "standard" },
    },
    {
      id: "recognize",
      mode: "explain",
      title: "Spot the stack-shaped problem.",
      body: "A stack fits when the most recently started, unfinished thing is the next one you need to finish.",
      visual: { kind: "stack", items: [] },
      question: {
        kind: "choice",
        prompt: "Which task is stack-shaped?",
        options: [
          {
            id: "queue",
            label: "Serving customers in the order they arrived",
            feedback: "That is first come, first served: a queue.",
          },
          {
            id: "brackets",
            label: "Checking that the brackets in `(a[b]{c})` close in the right order",
          },
          {
            id: "max",
            label: "Finding the largest number in a list",
            feedback: "Arrival order does not matter for a maximum; one pass with a variable is enough.",
          },
        ],
        correctOptionId: "brackets",
        explanation: "Each `(`, `[` or `{` stays unfinished until its closer appears, and the most recent opener must close first. Push openers; pop when a closer arrives.",
      },
      reveal: {
        visual: {
          kind: "stack",
          items: brackets.after,
          marks: { open2: "new" },
          caption: "Scanning (a[b]{c}): the next closer must be }",
        },
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
