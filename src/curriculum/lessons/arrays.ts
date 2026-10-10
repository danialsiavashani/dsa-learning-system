import { insertAtCode, removeAtCode } from "@/curriculum/concepts/arrays";
import {
  insertAt,
  itemsFromValues,
  removeAt,
  updateAt,
  valuesOf,
  type ArrayItem,
} from "@/lib/domain/array";
import { describeValues, listValues } from "@/lib/learning/format";
import { defineLesson } from "@/lib/learning/validate";

/**
 * The canonical Arrays lesson. Sequencing and claims follow OpenDSA's
 * array-based list modules (contiguous storage, shifting on insert/remove,
 * constant-time access vs linear-time insert/remove) and algs4's treatment of
 * Java arrays (fixed length, zero-based indices, bounds checking). Every state
 * and answer key is computed by the array domain functions.
 */

const java = (lines: string[]) => ({ source: lines.join("\n"), language: "java" as const });

const accessCode = java([
  "int[] arr = {4, 8, 2, 9, 3};",
  "int x = arr[2];",
  "int last = arr[4];",
  "int y = arr[5];",
  "arr[1] = 5;",
]);

const traverseCode = java([
  "int sum = 0;",
  "for (int i = 0; i < arr.length; i++) {",
  "    sum += arr[i];",
  "}",
]);

const insertCode = { source: insertAtCode.source, language: "java" as const };
const removeCode = { source: removeAtCode.source, language: "java" as const };

const arrayListCode = java([
  "List<Integer> list = new ArrayList<>();",
  "list.add(4);          // append at the end",
  "list.add(0, 9);       // insert at 0: shifts 4 right",
  "int first = list.get(0);",
  "list.remove(0);       // remove at 0: shifts 4 left",
]);

const maxCode = java([
  "int max = arr[0];",
  "for (int i = 1; i < arr.length; i++) {",
  "    if (arr[i] > max) {",
  "        max = arr[i];",
  "    }",
  "}",
]);

// The running example: read, update, traverse, insert, remove.
const original: ArrayItem[] = [
  { id: "a", value: 4 },
  { id: "b", value: 8 },
  { id: "c", value: 2 },
  { id: "d", value: 9 },
  { id: "e", value: 3 },
];
const updated = updateAt(original, 1, 5);
const total = valuesOf(updated).reduce<number>((sum, value) => sum + (value ?? 0), 0);
const insertSeven = insertAt(updated, 2, 7, "seven");
const removeFive = removeAt(insertSeven.after, 1);

// The independent exercise: insert, then remove, on a fresh array.
const practiceStart = itemsFromValues([3, 6, 1, 8], "p");
const practiceInserted = insertAt(practiceStart, 1, 5, "p-new");
const practiceDone = removeAt(practiceInserted.after, 3);

const movedMarks = (items: ArrayItem[]) =>
  Object.fromEntries(items.map((item) => [item.id, "moved" as const]));

export const arraysLesson = defineLesson({
  id: "arrays",
  title: "Arrays",
  subtitle: "Numbered slots: instant to read, costly to rearrange.",
  sources: [
    {
      title: "OpenDSA: Lists and the Array-Based List Implementation",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/List/ListArray.rst",
      role: "concept",
    },
    {
      title: "OpenDSA: Comparison of List Implementations",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/List/ListAnalysis.rst",
      role: "concept",
    },
    {
      title: "Algorithms, 4th Edition, 1.1 Basic Programming Model (arrays)",
      url: "https://algs4.cs.princeton.edu/11model/",
      role: "implementation",
    },
    {
      title: "Java SE API: ArrayList",
      url: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayList.html",
      role: "implementation",
    },
  ],
  steps: [
    {
      id: "purpose",
      mode: "show",
      title: "One name, many numbered slots.",
      body: "Five scores in five separate variables gets clumsy fast. An array keeps them under one name, in order, and lets you reach any of them by its position, called its index. Indices start at 0.",
      visual: { kind: "array", items: original },
      code: { ...accessCode, highlight: [1] },
    },
    {
      id: "contiguous",
      mode: "show",
      title: "The slots sit side by side, with no gaps.",
      body: "An array is one unbroken row: index 0, then 1, then 2, up to the last. That fixed, gap-free layout is what makes reading by index fast, and it is also what makes squeezing a value into the middle slow, as you will see.",
      visual: { kind: "array", items: original, caption: "5 slots: indices 0 to 4" },
      code: { ...accessCode, highlight: [1] },
    },
    {
      id: "read",
      mode: "show",
      title: "Reading `arr[2]` goes straight to index 2.",
      body: "Nothing is searched: the index says exactly which slot to read. However long the array is, reading any index takes the same constant time, O(1).",
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
      title: "Read the last value.",
      body: "Remember where counting starts.",
      visual: { kind: "array", items: original },
      code: { ...accessCode, highlight: [3] },
      question: {
        kind: "choice",
        prompt: "What does `arr[4]` return?",
        options: [
          { id: "nine", label: "9", feedback: "9 is at index 3. Counting from 0, the fifth value is at index 4." },
          { id: "three", label: "3" },
          {
            id: "throws",
            label: "It throws `ArrayIndexOutOfBoundsException`",
            feedback: "Five values occupy indices 0 through 4, so index 4 is valid.",
          },
        ],
        correctOptionId: "three",
        explanation: "With 5 values the indices run 0 to 4, so the last index is always `arr.length - 1`.",
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
      id: "predict-bounds",
      mode: "predict",
      title: "One step too far.",
      body: "There is no slot at index 5.",
      visual: { kind: "array", items: original, pointers: [{ index: 5, label: "arr[5]?" }] },
      code: { ...accessCode, highlight: [4] },
      question: {
        kind: "choice",
        prompt: "What happens when Java runs `arr[5]`?",
        options: [
          { id: "zero", label: "It returns 0", feedback: "Java does not invent values past the end; it checks every index." },
          { id: "throws", label: "It throws `ArrayIndexOutOfBoundsException`" },
          { id: "wrap", label: "It wraps around to `arr[0]`", feedback: "Java arrays never wrap around." },
        ],
        correctOptionId: "throws",
        explanation: "Valid indices run from 0 to `arr.length - 1`. Java checks every access and stops with `ArrayIndexOutOfBoundsException` otherwise. Off-by-one mistakes like this are among the most common array bugs.",
      },
    },
    {
      id: "update",
      mode: "trace",
      title: "Updating replaces a value in place.",
      body: "`arr[1] = 5` overwrites the 8 at index 1. Nothing else moves, so an update is O(1), just like a read.",
      visual: { kind: "array", items: updated, marks: { b: "focus" }, pointers: [{ index: 1, label: "arr[1]" }] },
      code: { ...accessCode, highlight: [5] },
    },
    {
      id: "traverse",
      mode: "trace",
      title: "Traversal visits every slot in order.",
      body: "To total the array, a loop starts at index 0 and moves one slot at a time while `i < arr.length`. After the first pass, `sum` is 4.",
      visual: { kind: "array", items: updated, marks: { a: "focus" }, pointers: [{ index: 0, label: "i = 0" }] },
      code: { ...traverseCode, highlight: [2, 3] },
    },
    {
      id: "solve-sum",
      mode: "solve",
      title: "Finish the loop in your head.",
      body: "Keep adding until `i` reaches `arr.length`.",
      visual: { kind: "array", items: updated, marks: { a: "focus" }, pointers: [{ index: 0, label: "i = 0" }] },
      code: { ...traverseCode, highlight: [2, 3] },
      question: {
        kind: "number-list",
        prompt: "What is `sum` when the loop ends?",
        expected: [total],
        explanation: `The loop reads each of the 5 slots exactly once: ${valuesOf(updated).join(" + ")} = ${total}. Visiting every element is O(n): twice as many values means twice as much work.`,
      },
      reveal: {
        visual: {
          kind: "array",
          items: updated,
          marks: { e: "focus" },
          pointers: [{ index: 4, label: "i = 4" }],
          caption: `sum = ${total}`,
        },
      },
    },
    {
      id: "predict-insert",
      mode: "predict",
      title: "Now insert 7 at index 2.",
      body: "The slots are gap-free, so 7 cannot squeeze in between two values. A Java array also has a fixed length, so this one was created with a spare slot, and `size` counts the 5 in use.",
      visual: {
        kind: "array",
        items: updated,
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
          { id: "tail", label: describeValues(valuesOf(insertSeven.shifted)) },
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
      body: "The shifted values are the same 2, 9 and 3, only one slot further right. Inserting near the front shifts almost everything, so insertion is O(n).",
      visual: { kind: "array", items: insertSeven.after, marks: { seven: "new" } },
      code: { ...insertCode, highlight: [insertAtCode.lines.write] },
      practice: { kind: "array-insertion", difficulty: "intro" },
    },
    {
      id: "explain-direction",
      mode: "explain",
      title: "Why does the insert loop walk backwards?",
      body: "Picture the same loop running from index 2 upwards instead.",
      visual: { kind: "array", items: insertSeven.opened, marks: movedMarks(insertSeven.shifted) },
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
            feedback: "Both directions copy the same number of values. Direction matters for correctness, not speed.",
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
      visual: { kind: "array", items: insertSeven.opened, marks: movedMarks(insertSeven.shifted) },
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
      id: "predict-remove",
      mode: "predict",
      title: "Now remove the value at index 1.",
      body: "Removing leaves a hole, and an array cannot have gaps in the middle.",
      visual: {
        kind: "array",
        items: insertSeven.after,
        marks: { b: "focus" },
        pointers: [{ index: 1, label: "remove 5" }],
      },
      code: { ...removeCode, highlight: [removeAtCode.lines.signature] },
      question: {
        kind: "choice",
        prompt: "Which values must shift one slot to the left?",
        options: [
          {
            id: "with-removed",
            label: describeValues(valuesOf(removeFive.before.slice(1))),
            feedback: "5 is the value being removed; it leaves rather than shifts.",
          },
          { id: "tail", label: describeValues(valuesOf(removeFive.shifted)) },
          {
            id: "head",
            label: describeValues(valuesOf(removeFive.unchanged)),
            feedback: "4 sits before the gap, so it stays put.",
          },
        ],
        correctOptionId: "tail",
        explanation: `Every value after index 1 moves one slot left to fill the gap: ${listValues(valuesOf(removeFive.shifted))}.`,
      },
      reveal: {
        visual: {
          kind: "array",
          items: removeFive.opened,
          marks: movedMarks(removeFive.shifted),
          pointers: [{ index: 1, label: "gap" }],
        },
      },
    },
    {
      id: "close-gap",
      mode: "trace",
      title: "Shift from the front to close the gap.",
      body: "This time the loop starts at the gap and walks forwards: 7 moves to index 1, then 2, 9 and 3 each move one slot left, and `size` drops to 5. Removing near the front shifts almost everything, so removal is O(n) too.",
      visual: { kind: "array", items: removeFive.after, marks: movedMarks(removeFive.shifted) },
      code: { ...removeCode, highlight: [...removeAtCode.lines.loop] },
      practice: { kind: "array-removal", difficulty: "intro" },
    },
    {
      id: "explain-remove-direction",
      mode: "explain",
      title: "Opposite directions.",
      body: "Insertion copied right to left; removal copies left to right.",
      code: { ...removeCode, highlight: [removeAtCode.lines.shift] },
      question: {
        kind: "choice",
        prompt: "Why does the removal loop walk forwards?",
        options: [
          {
            id: "faster",
            label: "Walking forwards is faster.",
            feedback: "Both directions copy the same number of values; direction is about correctness.",
          },
          {
            id: "front-only",
            label: "Arrays can only be changed from the front.",
            feedback: "Any slot can be written directly by its index.",
          },
          {
            id: "read-first",
            label: "Each copy reads its right neighbour before that slot is overwritten.",
          },
        ],
        correctOptionId: "read-first",
        explanation: "Removal copies `arr[i + 1]` into `arr[i]`. Left to right, every value is read before its slot is reused. Right to left, the last value would be copied into every slot.",
      },
    },
    {
      id: "costs",
      mode: "show",
      title: "What each operation costs.",
      body: "Read and update touch one slot: O(1). Traversal touches all n: O(n). Inserting at index i shifts the n − i values from there on; removing shifts the n − i − 1 after it. Near the front that is about n, so both are O(n). At the very end, nothing shifts.",
      visual: { kind: "array", items: removeFive.after, caption: "cost = how many values have to move" },
    },
    {
      id: "predict-cheapest",
      mode: "predict",
      title: "Beginning, middle or end?",
      body: "Three places to insert one more value.",
      visual: {
        kind: "array",
        items: removeFive.after,
        pointers: [
          { index: 0, label: "A" },
          { index: 2, label: "B" },
          { index: 5, label: "C" },
        ],
      },
      question: {
        kind: "choice",
        prompt: "Which insertion moves the fewest values?",
        options: [
          { id: "front", label: "A: at index 0", feedback: "Inserting at the front shifts all 5 values." },
          { id: "middle", label: "B: at index 2", feedback: "3 values shift." },
          { id: "end", label: "C: at index 5, the end" },
        ],
        correctOptionId: "end",
        explanation: "Inserting at index i shifts the n − i values from i onward. At the end, n − i is 0, so nothing moves.",
      },
    },
    {
      id: "arraylist",
      mode: "show",
      title: "ArrayList does this bookkeeping for you.",
      body: "A Java array cannot grow. `ArrayList` keeps an array inside and manages it: `get` and `set` are O(1), `add(i, x)` shifts later values right, `remove(i)` shifts them left, both O(n). When its array fills up, `add` copies everything into a bigger one, but spread over many appends, adding at the end stays O(1) on average.",
      code: { ...arrayListCode, highlight: [3, 5] },
    },
    {
      id: "solve-sequence",
      mode: "solve",
      title: "Two operations on your own.",
      body: "Start from {3, 6, 1, 8}, with spare room. Insert 5 at index 1, then remove the value at index 3.",
      visual: { kind: "array", items: practiceStart },
      question: {
        kind: "number-list",
        prompt: "Type the array after both operations.",
        expected: valuesOf(practiceDone.after) as number[],
        explanation: `After the insert: {${valuesOf(practiceInserted.after).join(", ")}}. Index 3 then holds ${practiceDone.removed.value}; removing it shifts ${listValues(valuesOf(practiceDone.shifted))} left.`,
      },
      reveal: { visual: { kind: "array", items: practiceDone.after } },
      practice: { kind: "array-removal", difficulty: "standard" },
    },
    {
      id: "recognize",
      mode: "explain",
      title: "When is an array the right tool?",
      body: "Arrays shine when you know roughly how many values you need and reach them by position. They struggle when values keep arriving and leaving at the front or middle.",
      question: {
        kind: "choice",
        prompt: "Which job fits an array best?",
        options: [
          {
            id: "line",
            label: "A waiting line where people constantly leave from the front",
            feedback: "Every removal at index 0 shifts everyone left: O(n) each time. Other structures, coming later, handle this better.",
          },
          { id: "lookup", label: "Looking up the score of player #500 by position" },
          {
            id: "middle",
            label: "A list that grows unpredictably, with frequent insertions in the middle",
            feedback: "Each middle insertion shifts the values after it. Linked structures avoid that cost.",
          },
        ],
        correctOptionId: "lookup",
        explanation: "Position-based lookup is exactly what arrays do in O(1). Frequent shifting at the front or middle is where they get expensive.",
      },
    },
    {
      id: "transfer-max",
      mode: "complete",
      title: "New problem: find the largest value.",
      body: "No walkthrough this time. `max` starts as the first value; the loop header that checks the rest is missing.",
      visual: { kind: "array", items: removeFive.after, caption: "max should end as 9" },
      code: { ...maxCode, highlight: [1], blankLine: 2 },
      question: {
        kind: "choice",
        prompt: "Which loop header is correct?",
        options: [
          {
            id: "le",
            label: "for (int i = 1; i <= arr.length; i++) {",
            feedback: "On the last pass i equals arr.length, which is past the end: ArrayIndexOutOfBoundsException.",
          },
          {
            id: "short",
            label: "for (int i = 0; i < arr.length - 1; i++) {",
            feedback: "This stops before the last index, so a maximum in the last slot would be missed.",
          },
          { id: "right", label: "for (int i = 1; i < arr.length; i++) {" },
        ],
        correctOptionId: "right",
        explanation: "Index 0 is already in `max`, so the loop checks indices 1 through `arr.length - 1`: every remaining slot, and none past the end.",
      },
    },
  ],
});
