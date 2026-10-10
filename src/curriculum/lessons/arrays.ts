import { insertAtCode } from "@/curriculum/concepts/arrays";
import { insertAt, valuesOf, type ArrayItem } from "@/lib/domain/array";
import { describeValues, listValues } from "@/lib/learning/format";
import { defineLesson } from "@/lib/learning/validate";

/**
 * The canonical Arrays lesson. Plain data: states and answer keys are
 * computed by the array domain functions, then the whole lesson is validated
 * by the same schema generated exercises must pass.
 */

const original: ArrayItem[] = [
  { id: "a", value: 4 },
  { id: "b", value: 8 },
  { id: "c", value: 2 },
  { id: "d", value: 9 },
  { id: "e", value: 3 },
];

const accessCode = {
  source: [
    "int[] arr = {4, 8, 2, 9, 3};",
    "int middle = arr[2];",
    "int last = arr[4];",
  ].join("\n"),
  language: "java",
} as const;

const insertCode = { source: insertAtCode.source, language: "java" } as const;

const insertSeven = insertAt(original, 2, 7, "seven");
const insertFive = insertAt(original, 1, 5, "five");

const movedMarks = (items: ArrayItem[]) =>
  Object.fromEntries(items.map((item) => [item.id, "moved" as const]));

export const arraysLesson = defineLesson({
  id: "arrays",
  title: "Arrays",
  subtitle: "Watch how array state changes one step at a time.",
  steps: [
    {
      id: "positions",
      mode: "show",
      title: "Arrays store values in ordered positions.",
      body: "Each value sits at an index. Indices start at 0, so these five values use indices 0 through 4.",
      visual: { kind: "array", items: original },
      code: { ...accessCode, highlight: [1] },
    },
    {
      id: "direct-access",
      mode: "show",
      title: "Reading index 2 goes straight to its value.",
      body: "`arr[2]` is 2. Java stores an `int[]` as one contiguous block, so the element's address is computed from the index and nothing is scanned: a read takes the same O(1) time at any index.",
      visual: {
        kind: "array",
        items: original,
        marks: { c: "focus" },
        pointers: [{ index: 2, label: "arr[2]" }],
      },
      code: { ...accessCode, highlight: [2] },
    },
    {
      id: "predict-last",
      mode: "predict",
      title: "Your turn: read the last value.",
      body: "Remember where counting starts.",
      visual: { kind: "array", items: original },
      code: { ...accessCode, highlight: [3] },
      question: {
        kind: "choice",
        prompt: "What does `arr[4]` return?",
        options: [
          {
            id: "nine",
            label: "9",
            feedback: "9 is at index 3. Counting from 0, the fifth value is at index 4.",
          },
          { id: "three", label: "3" },
          {
            id: "out-of-bounds",
            label: "It throws `ArrayIndexOutOfBoundsException`",
            feedback: "Five values occupy indices 0 through 4, so index 4 is valid. `arr[5]` would throw.",
          },
        ],
        correctOptionId: "three",
        explanation: "Five values occupy indices 0 to 4, so `arr[4]` is the last value, 3.",
      },
      reveal: {
        visual: {
          kind: "array",
          items: original,
          marks: { e: "focus" },
          pointers: [{ index: 4, label: "arr[4]" }],
        },
      },
    },
    {
      id: "predict-insert",
      mode: "predict",
      title: "Now insert 7 at index 2.",
      body: "A Java array has a fixed length, so this one was created with room to spare and `size` counts the 5 slots in use. Its values sit side by side, so 7 cannot squeeze in between two of them. Predict what has to happen first.",
      visual: {
        kind: "array",
        items: original,
        marks: { c: "focus" },
        pointers: [{ index: 2, label: "insert 7" }],
      },
      code: { ...insertCode, highlight: [insertAtCode.lines.signature] },
      question: {
        kind: "choice",
        prompt: "Which existing values must shift to the right?",
        options: [
          {
            id: "only-occupant",
            label: "Only 2",
            feedback: "Moving only 2 would land it on top of 9, so 9 must move too, and then 3.",
          },
          {
            id: "tail",
            label: describeValues(valuesOf(insertSeven.shifted)),
          },
          {
            id: "head",
            label: describeValues(valuesOf(insertSeven.unchanged)),
            feedback: "Values before index 2 are not in the way, so they keep their positions.",
          },
        ],
        correctOptionId: "tail",
        explanation: `Every value at index 2 or later moves one slot right: ${listValues(valuesOf(insertSeven.shifted))}.`,
      },
    },
    {
      id: "shift",
      mode: "trace",
      title: "Shift from the back to open a gap.",
      body: "The loop starts at `i = size - 1`, the last value: 3 moves to index 5, then 9 to index 4, then 2 to index 3. Working back to front, each value lands in a slot that is already free.",
      visual: {
        kind: "array",
        items: insertSeven.opened,
        marks: movedMarks(insertSeven.shifted),
        pointers: [{ index: 2, label: "gap" }],
      },
      code: { ...insertCode, highlight: [...insertAtCode.lines.loop] },
    },
    {
      id: "write",
      mode: "trace",
      title: "Write 7 into the gap.",
      body: "The shifted values kept their identity (the same 2, 9 and 3); only their positions changed. That shifting is why inserting near the front of an array costs O(n), and it is what `ArrayList.add(index, value)` does internally.",
      visual: {
        kind: "array",
        items: insertSeven.after,
        marks: { seven: "new" },
      },
      code: { ...insertCode, highlight: [insertAtCode.lines.write] },
      practice: { kind: "array-insertion", difficulty: "intro" },
    },
    {
      id: "explain-direction",
      mode: "explain",
      title: "Why does the loop walk backwards?",
      body: "Picture the same loop running from index 2 upwards instead.",
      visual: {
        kind: "array",
        items: insertSeven.opened,
        marks: movedMarks(insertSeven.shifted),
      },
      code: { ...insertCode, highlight: [insertAtCode.lines.loop[0]] },
      question: {
        kind: "choice",
        prompt: "What would go wrong if the loop walked forwards?",
        options: [
          {
            id: "overwrite",
            label: "Each copy would overwrite a value before it had moved.",
          },
          {
            id: "speed",
            label: "Nothing breaks; walking backwards is just faster.",
            feedback: "Both directions do the same amount of work. Direction matters for correctness, not speed.",
          },
          {
            id: "order",
            label: "The new value would be written too early.",
            feedback: "The new value is written after the loop either way. The problem is inside the loop.",
          },
        ],
        correctOptionId: "overwrite",
        explanation: "Forwards, `arr[3] = arr[2]` would overwrite 9 before 9 was copied to index 4. Backwards, every copy targets a slot whose old value has already moved.",
      },
    },
    {
      id: "complete-shift",
      mode: "complete",
      title: "Fill in the missing line.",
      body: "The loop is there, but its body is gone.",
      code: {
        ...insertCode,
        highlight: [insertAtCode.lines.loop[0]],
        blankLine: insertAtCode.lines.shift,
      },
      question: {
        kind: "choice",
        prompt: "Which line moves a value one slot to the right?",
        options: [
          {
            id: "leftwards",
            label: "arr[i] = arr[i + 1];",
            feedback: "That copies the right neighbour leftwards: the opposite of making room.",
          },
          { id: "rightwards", label: "arr[i + 1] = arr[i];" },
          {
            id: "previous",
            label: "arr[i - 1] = arr[i];",
            feedback: "That moves values left, onto their neighbours.",
          },
        ],
        correctOptionId: "rightwards",
        explanation: "The value at `i` is copied one slot right, to `i + 1`.",
      },
    },
    {
      id: "solve-insert",
      mode: "solve",
      title: "Solve one on your own.",
      body: "Start again from `{4, 8, 2, 9, 3}` (with a spare slot, so `size` is 5) and insert 5 at index 1.",
      visual: {
        kind: "array",
        items: original,
        pointers: [{ index: 1, label: "insert 5" }],
      },
      code: { ...insertCode, highlight: [insertAtCode.lines.signature] },
      question: {
        kind: "number-list",
        prompt: "Type the array after the insertion, values separated by commas.",
        expected: valuesOf(insertFive.after) as number[],
        explanation: `${listValues(valuesOf(insertFive.shifted))} each shift right, and 5 takes index 1.`,
      },
      reveal: {
        visual: {
          kind: "array",
          items: insertFive.after,
          marks: { ...movedMarks(insertFive.shifted), five: "new" },
        },
      },
      practice: { kind: "array-insertion", difficulty: "standard" },
    },
  ],
});
