import { stepVisual, waitingVisual } from "@/curriculum/concepts/queue";
import {
  arrayOffer,
  arrayPoll,
  emptyArrayQueue,
  offer,
  peek,
  poll,
  queueFromValues,
  queueValues,
  runOperations,
  shiftingPoll,
  type ArrayQueue,
  type DequeOperation,
  type QueueItem,
} from "@/lib/domain/queue";
import { pop, stackFromValues } from "@/lib/domain/stack";
import { listValues } from "@/lib/learning/format";
import type { ArrayVisual, QueueVisualInput } from "@/lib/learning/schema";
import { defineLesson } from "@/lib/learning/validate";

/**
 * The canonical Queue + Deque lesson. It follows OpenDSA's queue module (a
 * list with restricted access: join at the back, leave from the front, in
 * arrival order, like a ticket line; enqueue/dequeue; FIFO; the naive array
 * queue that drifts or shifts, fixed by tracking front and rear and wrapping
 * around) and its linked-queue page (every operation constant time), with
 * algs4 1.3 for the FIFO policy and the stack contrast, algs4's Queue.java
 * (references to both ends) and ResizingArrayQueue.java (`first`/`last`
 * indices that wrap; amortized constant time), algs4's Deque assignment for
 * the deque as a generalisation of stack and queue, and the Java `Deque` /
 * `ArrayDeque` docs for method names, empty-case behaviour (poll/peek return
 * null; remove/element throw), the null-element ban and amortized cost.
 *
 * Stack is assumed. Every state below comes from the queue domain.
 */

const java = (lines: string[]) => ({ source: lines.join("\n"), language: "java" as const });

/** 1-based line of the first line containing `fragment`, so highlights follow the code. */
function lineOf(code: { source: string }, fragment: string): number {
  const index = code.source.split("\n").findIndex((line) => line.includes(fragment));
  if (index < 0) throw new Error(`"${fragment}" is not in the code.`);
  return index + 1;
}

const visual = (items: QueueItem[], extra: Partial<QueueVisualInput> = {}) => ({
  kind: "queue" as const,
  items,
  ...extra,
});

// --- A-E: requests arrive, join at the back, leave from the front -----------------
const line = queueFromValues([4, 8, 2], "req");
const [four, eight, two] = line;
const joinFive = offer(line, 5, "req5");
const serveFour = poll(joinFive.after);
const serveEight = poll(serveFour.after);
const peekTwo = peek(serveEight.after);

// --- F: a trace from empty ---------------------------------------------------------
const traceOps: DequeOperation[] = [
  { type: "offer", value: 4 },
  { type: "offer", value: 8 },
  { type: "offer", value: 2 },
  { type: "poll" },
  { type: "offer", value: 9 },
  { type: "poll" },
];
const traceRun = runOperations([], traceOps, "t");
const traceMid = traceRun.steps[3];
const traceEnd = traceRun.steps[5];

// --- G: the same arrivals in a stack and a queue ------------------------------------
const stackSide = stackFromValues([4, 8, 2], "s");
const queueSide = queueFromValues([4, 8, 2], "q");
const popped = pop(stackSide);
const polled = poll(queueSide);
const contrast = (stackExtra = {}, queueExtra = {}) => ({
  kind: "compare" as const,
  panes: [
    { id: "stack", label: "Stack: push 4, 8, 2", visual: { kind: "stack" as const, items: stackSide, ...stackExtra } },
    { id: "queue", label: "Queue: enqueue 4, 8, 2", visual: visual(queueSide, queueExtra) },
  ],
});

// --- H: Java ---------------------------------------------------------------------------
const queueCode = java([
  "Deque<Integer> queue = new ArrayDeque<>();",
  "queue.offer(4);",
  "queue.offer(8);",
  "queue.offer(2);",
  "int first = queue.peek();",
  "int served = queue.poll();",
  "int next = queue.poll();",
]);
const javaRun = runOperations(
  [],
  [...traceOps.slice(0, 3), { type: "peek" }, { type: "poll" }, { type: "poll" }],
  "j",
);
const [, , javaOffered, javaPeek, javaPollOne, javaPollTwo] = javaRun.steps;

const processCode = java([
  "Deque<Integer> requests = new ArrayDeque<>();",
  "requests.offer(4);",
  "requests.offer(8);",
  "requests.offer(2);",
  "while (!requests.isEmpty()) {",
  "    int next = requests.poll();",
  "    handle(next);",
  "}",
]);

const emptyCode = java(["Deque<Integer> queue = new ArrayDeque<>();", "Integer next = queue.poll();"]);

// --- I: inside an array --------------------------------------------------------------
const arrayQueueCode = java([
  "class IntQueue {",
  "    // Simplified: no checks for an empty or full array.",
  "    int[] a = new int[6];",
  "    int first = 0;   // index of the front",
  "    int last = 0;    // next free slot at the back",
  "",
  "    void offer(int x) {",
  "        a[last] = x;",
  "        last = (last + 1) % a.length;",
  "    }",
  "",
  "    int poll() {",
  "        int x = a[first];",
  "        first = (first + 1) % a.length;",
  "        return x;",
  "    }",
  "}",
]);
const filled = [4, 8, 2, 9].reduce((q, value) => arrayOffer(q, value, `v${value}`), emptyArrayQueue(6));
const tracked = arrayPoll(filled).after;
const trackedFive = arrayOffer(tracked, 5, "v5");
const beforeWrap = arrayOffer(arrayPoll(trackedFive).after, 7, "v7");

const arrayVisual = (queue: ArrayQueue, extra: Partial<ArrayVisual> = {}) => ({
  kind: "array" as const,
  items: queue.slots,
  pointers: [
    { index: queue.first, label: "first" },
    { index: queue.last, label: "last" },
  ],
  ...extra,
});
// The naive version: front pinned at index 0, so the survivors slide left.
const pinned = filled.slots.filter((slot) => slot.value !== null) as QueueItem<number>[];
const shifted = shiftingPoll(pinned);
const naiveVisual = (items: { id: string; value: number | null }[], extra: Partial<ArrayVisual> = {}) => ({
  kind: "array" as const,
  items: [...items, ...filled.slots.slice(items.length)],
  pointers: [{ index: 0, label: "front" }],
  ...extra,
});

// --- J: a deque: newest edits at the front, oldest at the back ---------------------
const historyCode = java([
  "Deque<Integer> history = new ArrayDeque<>();",
  "history.addFirst(1);",
  "history.addFirst(2);",
  "history.addFirst(3);",
  "history.addFirst(4);",
  "int forgotten = history.pollLast();",
  "int undone = history.pollFirst();",
]);
const historyRun = runOperations(
  [],
  [
    ...[1, 2, 3, 4].map((value) => ({ type: "addFirst" as const, value })),
    { type: "pollLast" },
    { type: "pollFirst" },
  ],
  "e",
);
const [, , threeEdits, fourEdits, forgetOne, undoFour] = historyRun.steps;

const dequeCode = java([
  "Deque<Integer> deque = new ArrayDeque<>();",
  "deque.addLast(5);",
  "deque.addLast(9);",
  "deque.addFirst(2);",
  "deque.addLast(7);",
  "deque.pollFirst();",
  "deque.addFirst(6);",
  "deque.pollLast();",
]);
const dequeStart = queueFromValues([5, 9], "d");
const dequeRun = runOperations(
  dequeStart,
  [
    { type: "addFirst", value: 2 },
    { type: "addLast", value: 7 },
    { type: "pollFirst" },
    { type: "addFirst", value: 6 },
    { type: "pollLast" },
  ],
  "dn",
);
const dequeLast = dequeRun.steps[dequeRun.steps.length - 1];

const saveCode = java([
  "void save(Deque<Integer> history, int edit) {",
  "    history.addFirst(edit);",
  "    if (history.size() > 3) {",
  "        history.pollLast();",
  "    }",
  "}",
]);

// --- K: transfer -------------------------------------------------------------------
const turnsCode = java([
  "Deque<Integer> turns = new ArrayDeque<>();",
  "for (int p : new int[] {1, 2, 3}) turns.offer(p);",
  "for (int round = 0; round < 4; round++) {",
  "    int player = turns.poll();",
  "    turns.offer(player);",
  "}",
]);
const turnsStart = queueFromValues([1, 2, 3], "p");
// Each round the front player leaves and rejoins at the back, keeping its identity.
const turnsEnd = Array.from({ length: 4 }).reduce<QueueItem<number>[]>((turns) => {
  const out = poll(turns);
  if (out.outcome.type !== "remove") throw new Error("A turn needs a player.");
  return offer(out.after, out.outcome.item.value, out.outcome.item.id).after;
}, turnsStart);

const rooms = queueFromValues(["hall", "shop", "café"], "room");

export const queueLesson = defineLesson({
  id: "queue",
  title: "Queue / Deque",
  subtitle: "Wait your turn: the earliest arrival is handled first.",
  sources: [
    {
      title: "OpenDSA: Queues (array-based and circular queues)",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/List/Queue.rst",
      role: "concept",
    },
    {
      title: "OpenDSA: Implementing the Linked Queue (cost comparison)",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/List/QueueLinked.rst",
      role: "concept",
    },
    {
      title: "Algorithms, 4th Edition, 1.3 Bags, Queues, and Stacks",
      url: "https://algs4.cs.princeton.edu/13stacks/",
      role: "pedagogy",
    },
    {
      title: "algs4 Queue.java (linked list, first and last)",
      url: "https://algs4.cs.princeton.edu/13stacks/Queue.java.html",
      role: "implementation",
    },
    {
      title: "algs4 ResizingArrayQueue.java (first/last indices, wrap-around)",
      url: "https://algs4.cs.princeton.edu/13stacks/ResizingArrayQueue.java.html",
      role: "implementation",
    },
    {
      title: "Princeton COS 226: Deques and Randomized Queues (deque API)",
      url: "https://coursera.cs.princeton.edu/algs4/assignments/queues/specification.php",
      role: "concept",
    },
    {
      title: "Java SE API: Deque (queue and stack method equivalents)",
      url: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Deque.html",
      role: "implementation",
    },
    {
      title: "Java SE API: ArrayDeque",
      url: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html",
      role: "implementation",
    },
  ],
  steps: [
    // --- A. Arrival order -------------------------------------------------------------
    {
      id: "arrivals",
      mode: "show",
      title: "Requests wait their turn.",
      body: `A help desk handles one request at a time. While it is busy, request ${four.value} arrives, then ${eight.value}, then ${two.value}. Nobody may cut in, so they wait in the order they came.`,
      visual: visual(line, { hideEnds: true, caption: `${four.value} arrived first, ${two.value} arrived last` }),
    },
    {
      id: "predict-first",
      mode: "predict",
      title: "The desk is free. Who goes next?",
      body: "Think about fairness: who has been waiting the longest?",
      visual: visual(line, { hideEnds: true }),
      question: {
        kind: "choice",
        prompt: "Which request should be handled first?",
        options: [
          {
            id: "two",
            label: String(two.value),
            feedback: `${two.value} arrived last. Serving it first would let it cut ahead of ${four.value} and ${eight.value}.`,
          },
          { id: "four", label: String(four.value) },
          {
            id: "eight",
            label: String(eight.value),
            feedback: `${eight.value} arrived after ${four.value}, so ${four.value} has waited longer.`,
          },
        ],
        correctOptionId: "four",
        explanation: `${four.value} has waited longest. With no cutting in, the earliest arrival is handled first.`,
      },
      reveal: { visual: visual(line, { marks: { [four.id]: "focus" } }) },
    },
    {
      id: "front-back",
      mode: "show",
      title: "A line has a front and a back.",
      body: `Like people waiting for movie tickets, the line has two ends with different jobs. The front holds whoever has waited longest: ${four.value}, the next to be served. The back is where a newcomer joins: right now ${two.value} is last. Values are served only at the front and join only at the back. That is a queue.`,
      visual: visual(line),
    },

    // --- B. Enqueue --------------------------------------------------------------------
    {
      id: "predict-join",
      mode: "predict",
      title: "Request 5 arrives.",
      body: "It has to wait like everyone else.",
      visual: waitingVisual(line, { type: "offer", value: 5 }, "req5", "queue", {
        waiting: { id: "req5", value: 5, end: "back", label: "arrives" },
      }),
      question: {
        kind: "choice",
        prompt: "Where does 5 wait?",
        options: [
          {
            id: "front",
            label: `At the front, ahead of ${four.value}`,
            feedback: "Joining at the front would let 5 cut ahead of everyone already waiting.",
          },
          {
            id: "size",
            label: `Next to ${four.value}, the closest value in size`,
            feedback: "A queue never looks at the values themselves, only at the order they arrived.",
          },
          { id: "back", label: `At the back, behind ${two.value}` },
        ],
        correctOptionId: "back",
        explanation: `A newcomer always joins at the back. Adding at the back is called enqueue.`,
      },
      reveal: { visual: stepVisual(joinFive, "queue") },
    },
    {
      id: "predict-ends",
      mode: "predict",
      title: "Which end changed?",
      body: "Joining at the back is called enqueue. Compare the line before and after enqueue 5.",
      visual: stepVisual(joinFive, "queue"),
      question: {
        kind: "choice",
        prompt: "After enqueue 5, which end has a new value?",
        options: [
          {
            id: "front",
            label: "Only the front: 5 is first now",
            feedback: `The front is still ${four.value}. Joining never changes who is served next.`,
          },
          { id: "back", label: `Only the back: it moved from ${two.value} to 5` },
          {
            id: "both",
            label: "Both ends",
            feedback: `Look at the front label: it still points at ${four.value}.`,
          },
        ],
        correctOptionId: "back",
        explanation: `Enqueue only touches the back. The front is still ${four.value}, so the next one served has not changed.`,
      },
    },

    // --- C. Dequeue --------------------------------------------------------------------
    {
      id: "predict-serve",
      mode: "predict",
      title: "Serve the next request.",
      body: "Removing from the front is called dequeue.",
      visual: visual(joinFive.after),
      question: {
        kind: "choice",
        prompt: "Which value does dequeue remove?",
        options: [
          {
            id: "five",
            label: "5",
            feedback: "5 joined last. Taking the newest first is how a stack works, not a queue.",
          },
          { id: "four", label: String(four.value) },
          {
            id: "two",
            label: String(two.value),
            feedback: `${two.value} is the smallest value, but size does not matter here. Arrival order does.`,
          },
        ],
        correctOptionId: "four",
        explanation: `Dequeue removes the front: ${four.value}, the value that has waited longest.`,
      },
      reveal: {
        visual: stepVisual(serveFour, "queue", {
          leaving: { ...four, end: "front", label: `dequeue → ${four.value}` },
        }),
        body: `Everyone behind ${four.value} moves up one place, but nobody changes order: ${listValues(queueValues(serveFour.after))} are still in the order they arrived.`,
      },
    },
    {
      id: "predict-front-after",
      mode: "predict",
      title: "Dequeue again.",
      body: `${eight.value} is at the front now.`,
      visual: visual(serveFour.after),
      question: {
        kind: "choice",
        prompt: "After one more dequeue, which value is at the front?",
        options: [
          { id: "eight", label: String(eight.value), feedback: `${eight.value} is the one that leaves.` },
          { id: "five", label: "5", feedback: "5 is still at the back: it arrived last, so it waits longest." },
          { id: "two", label: String(two.value) },
        ],
        correctOptionId: "two",
        explanation: `${eight.value} leaves, and ${two.value}, the next oldest arrival, moves up to the front.`,
      },
      reveal: {
        visual: stepVisual(serveEight, "queue", {
          leaving: { ...eight, end: "front", label: `dequeue → ${eight.value}` },
        }),
      },
    },
    {
      id: "explain-order",
      mode: "explain",
      title: `Why did ${four.value} leave before ${eight.value}?`,
      body: `So far ${four.value} left, then ${eight.value}. ${two.value} and 5 are still waiting.`,
      visual: visual(serveEight.after, { caption: `left so far: ${four.value}, then ${eight.value}` }),
      question: {
        kind: "choice",
        prompt: `What decided that ${four.value} would leave before ${eight.value}?`,
        options: [
          {
            id: "size",
            label: `${four.value} is smaller than ${eight.value}.`,
            feedback: `${two.value} is smaller than both, and it is still waiting.`,
          },
          {
            id: "recent",
            label: `${four.value} was added most recently.`,
            feedback: `${eight.value} was added after ${four.value}. Newest-first is a stack's rule.`,
          },
          { id: "arrival", label: `${four.value} arrived before ${eight.value}, and a queue serves in arrival order.` },
        ],
        correctOptionId: "arrival",
        explanation: "Values join at the back and leave at the front, so they come out in exactly the order they went in.",
      },
    },

    // --- D. Peek ----------------------------------------------------------------------
    {
      id: "predict-peek",
      mode: "predict",
      title: "Look without serving.",
      body: "Sometimes you only need to know who is next. peek reads the front without removing it.",
      visual: visual(serveEight.after),
      question: {
        kind: "choice",
        prompt: "What does peek return, and what is the queue afterwards?",
        options: [
          {
            id: "removes",
            label: `${two.value}, and the queue becomes 5`,
            feedback: "That is dequeue. peek only reads; nothing leaves.",
          },
          { id: "reads", label: `${two.value}, and the queue is still ${two.value}, 5` },
          {
            id: "back",
            label: `5, and the queue is still ${two.value}, 5`,
            feedback: "5 is at the back. peek reads the front.",
          },
        ],
        correctOptionId: "reads",
        explanation: `peek returns the front value, ${two.value}, and leaves the queue as it was.`,
      },
      reveal: {
        visual: stepVisual(peekTwo, "queue", { peek: { end: "front", label: `peek → ${two.value}` } }),
        body: `Peek twice and you get ${two.value} twice: reading changes nothing.`,
      },
    },

    // --- E. FIFO ----------------------------------------------------------------------
    {
      id: "fifo",
      mode: "show",
      title: "First in, first out.",
      body: "Everything you watched follows one rule: values leave in the same order they arrived. This is called FIFO, first in, first out. A queue is a list that allows only two changes, enqueue at the back and dequeue from the front, and that restriction is exactly what guarantees the order.",
      visual: visual(serveEight.after, {
        caption: `arrived ${listValues([four.value, eight.value, two.value, 5])}; left ${four.value}, then ${eight.value}`,
      }),
    },

    // --- F. Repeated trace ------------------------------------------------------------
    {
      id: "trace-start",
      mode: "predict",
      title: "Trace from an empty queue.",
      body: "Run four operations in order: enqueue 4, enqueue 8, enqueue 2, dequeue.",
      visual: visual([]),
      question: {
        kind: "choice",
        prompt: "After those four operations, which value is at the front?",
        options: [
          { id: "four", label: "4", feedback: "4 was enqueued first, so the dequeue removed it." },
          { id: "two", label: "2", feedback: "2 joined last: it is at the back." },
          { id: "eight", label: "8" },
        ],
        correctOptionId: "eight",
        explanation: `4, 8 and 2 join in that order; the dequeue removes 4, so 8 is the front of {${queueValues(traceMid.after).join(", ")}}.`,
      },
      reveal: { visual: stepVisual(traceMid, "queue", { leaving: { ...traceRun.steps[0].after[0], end: "front", label: "dequeue → 4" } }) },
    },
    {
      id: "trace-finish",
      mode: "solve",
      title: "Finish the trace.",
      body: `Continue from {${queueValues(traceMid.after).join(", ")}}: enqueue 9, then dequeue.`,
      visual: visual(traceMid.after),
      question: {
        kind: "number-list",
        prompt: "Type the queue from front to back.",
        expected: queueValues(traceEnd.after),
        explanation: `9 joins behind 2, then the dequeue removes ${traceRun.removed[1]}, the front. Left: {${queueValues(traceEnd.after).join(", ")}}.`,
      },
      reveal: {
        visual: stepVisual(traceEnd, "queue", {
          leaving: { ...traceMid.after[0], end: "front", label: `dequeue → ${traceRun.removed[1]}` },
        }),
      },
      practice: { kind: "queue-operations", difficulty: "standard", skills: ["final", "front", "back"] },
    },

    // --- G. Stack contrast ------------------------------------------------------------
    {
      id: "contrast",
      mode: "show",
      title: "Same arrivals, two different rules.",
      body: "Push 4, 8 and 2 onto a stack, and enqueue 4, 8 and 2 into a queue. Both hold the same values, which arrived in the same order.",
      visual: contrast(),
    },
    {
      id: "predict-contrast",
      mode: "predict",
      title: "Take one value out of each.",
      body: "Pop the stack. Dequeue the queue.",
      visual: contrast(),
      question: {
        kind: "choice",
        prompt: "Which values come out?",
        options: [
          { id: "both-four", label: "Both give 4", feedback: "The stack's top is 2, the most recent push." },
          { id: "right", label: "The stack gives 2; the queue gives 4" },
          { id: "both-two", label: "Both give 2", feedback: "The queue's front is 4, the earliest arrival." },
          { id: "swapped", label: "The stack gives 4; the queue gives 2", feedback: "That swaps the two rules." },
        ],
        correctOptionId: "right",
        explanation: "The stack hands back the newest value (last in, first out); the queue hands back the oldest (first in, first out).",
      },
      reveal: {
        visual: {
          kind: "compare",
          panes: [
            {
              id: "stack",
              label: "Stack: pop",
              visual: {
                kind: "stack",
                items: popped.after,
                held: popped.outcome.type === "pop" ? { ...popped.outcome.item, label: "pop → 2" } : undefined,
              },
            },
            { id: "queue", label: "Queue: dequeue", visual: stepVisual(polled, "queue", { leaving: { ...queueSide[0], end: "front", label: "dequeue → 4" } }) },
          ],
        },
      },
    },
    {
      id: "explain-ends",
      mode: "explain",
      title: "Where does the difference come from?",
      body: "Both structures store values in arrival order. The difference is where they take values out.",
      question: {
        kind: "choice",
        prompt: "Why do the stack and the queue hand back different values?",
        options: [
          {
            id: "sort",
            label: "The queue keeps its values sorted.",
            feedback: "Neither one sorts. 4, 8, 2 is not in sorted order in either.",
          },
          { id: "ends", label: "A stack adds and removes at the same end; a queue adds at one end and removes at the other." },
          {
            id: "size",
            label: "A stack can hold fewer values.",
            feedback: "Capacity has nothing to do with it; both hold all three.",
          },
        ],
        correctOptionId: "ends",
        explanation: "Same end: the newest comes out first (LIFO). Opposite ends: the oldest comes out first (FIFO). So the question to ask about a problem is which order it needs.",
      },
      practice: { kind: "queue-operations", difficulty: "standard", skills: ["stack-or-queue"] },
    },

    // --- H. Java ------------------------------------------------------------------------
    {
      id: "java",
      mode: "show",
      title: "In Java, `ArrayDeque` is a queue too.",
      body: "The `ArrayDeque` you used as a stack also works as a queue; only the methods change. `offer` enqueues at the back, `poll` dequeues from the front, and `peek` reads the front. Java's documentation calls the front the head and the back the tail.",
      visual: visual([]),
      code: { ...queueCode, highlight: [1] },
    },
    {
      id: "java-offer",
      mode: "trace",
      title: "`offer` adds at the back.",
      body: "Three offers: 4 joins the empty queue, 8 joins behind it, 2 joins behind 8. Each one goes to the back.",
      visual: stepVisual(javaOffered, "queue"),
      code: { ...queueCode, highlight: [2, 3, 4] },
    },
    {
      id: "predict-java-peek",
      mode: "predict",
      title: "Read the front.",
      body: "`peek()` looks without removing.",
      visual: visual(javaOffered.after),
      code: { ...queueCode, highlight: [5] },
      question: {
        kind: "choice",
        prompt: "What is `first`?",
        options: [
          { id: "two", label: "2", feedback: "2 is at the back, the most recent offer. peek reads the front." },
          { id: "four", label: "4" },
          { id: "eight", label: "8", feedback: "8 is second in line." },
        ],
        correctOptionId: "four",
        explanation: "peek() returns the head, 4, and the queue is unchanged.",
      },
      reveal: { visual: stepVisual(javaPeek, "queue") },
    },
    {
      id: "predict-java-poll",
      mode: "predict",
      title: "Serve one.",
      body: "`poll()` removes the front and returns it.",
      visual: visual(javaPeek.after),
      code: { ...queueCode, highlight: [6] },
      question: {
        kind: "choice",
        prompt: "What is `served`, and what is at the front afterwards?",
        options: [
          { id: "right", label: "4, and then 8 is at the front" },
          {
            id: "back",
            label: "2, and then 4 is at the front",
            feedback: "2 is the tail. poll takes the head.",
          },
          {
            id: "stays",
            label: "4, and 4 is still at the front",
            feedback: "poll removes. Only peek leaves the value in place.",
          },
        ],
        correctOptionId: "right",
        explanation: "poll() removes the head, 4, and returns it. 8 is the new head.",
      },
      reveal: { visual: stepVisual(javaPollOne, "queue") },
    },
    {
      id: "java-poll-again",
      mode: "trace",
      title: "`poll` again returns 8.",
      body: `Next in line was 8, so \`next\` is 8. Only ${listValues(queueValues(javaPollTwo.after))} is left waiting.`,
      visual: stepVisual(javaPollTwo, "queue"),
      code: { ...queueCode, highlight: [7] },
      practice: { kind: "queue-operations", difficulty: "intro", skills: ["dequeued", "peek"] },
    },
    {
      id: "complete-process",
      mode: "complete",
      title: "Handle every request in arrival order.",
      body: "The loop runs until no request is waiting. Each pass must take the next request out of the queue.",
      visual: visual(javaOffered.after),
      code: { ...processCode, highlight: [5], blankLine: lineOf(processCode, "requests.poll()") },
      question: {
        kind: "choice",
        prompt: "Which line belongs in the gap?",
        options: [
          {
            id: "peek",
            label: "int next = requests.peek();",
            feedback: "peek never removes anything, so the queue never empties and the loop never ends.",
          },
          { id: "poll", label: "int next = requests.poll();" },
          {
            id: "last",
            label: "int next = requests.pollLast();",
            feedback: "pollLast takes the newest request from the back: 2, then 8, then 4. That is stack order.",
          },
        ],
        correctOptionId: "poll",
        explanation: "poll() takes the front each time, so the requests are handled 4, 8, 2, the order they arrived. `isEmpty()` stops the loop before poll could meet an empty queue.",
      },
      practice: { kind: "queue-operations", difficulty: "standard", skills: ["operation"] },
    },
    {
      id: "predict-empty",
      mode: "predict",
      title: "What if nobody is waiting?",
      body: "The queue is empty, and the code polls anyway.",
      visual: visual([]),
      code: { ...emptyCode, highlight: [2] },
      question: {
        kind: "choice",
        prompt: "On an empty `ArrayDeque`, what does `queue.poll()` return?",
        options: [
          { id: "zero", label: "0", feedback: "Java does not invent a value. An empty queue has no front." },
          { id: "null", label: "null" },
          {
            id: "throws",
            label: "It throws `NoSuchElementException`",
            feedback: "That is what `remove()`, the throwing version of poll, does.",
          },
        ],
        correctOptionId: "null",
        explanation: "`poll()` and `peek()` return null on an empty queue; `remove()` and `element()` throw `NoSuchElementException` instead. That is why the result goes in an `Integer`: an `int` cannot hold null. Because null means empty, `ArrayDeque` refuses null values: `offer(null)` throws `NullPointerException`.",
      },
      reveal: { visual: visual([], { caption: "poll() → null: nothing is waiting" }) },
    },

    // --- I. Inside an array -------------------------------------------------------------
    {
      id: "naive-array",
      mode: "show",
      title: "Inside: what if the front stays at index 0?",
      body: "Store the queue in an array, like the Arrays lesson, with the front always at index 0. offer just writes the next free slot. But dequeue has a problem.",
      visual: naiveVisual(pinned),
    },
    {
      id: "predict-shift",
      mode: "predict",
      title: "Dequeue with the front pinned at 0.",
      body: "4 leaves, and index 0 must hold the new front.",
      visual: naiveVisual(pinned),
      question: {
        kind: "choice",
        prompt: "How many values have to move?",
        options: [
          { id: "none", label: "0", feedback: "Then index 0 would be empty, not the new front." },
          { id: "one", label: "1", feedback: "Moving only 8 would leave a gap where 8 was." },
          { id: "all", label: `${shifted.moved.length}: every value behind 4 slides left` },
        ],
        correctOptionId: "all",
        explanation: `With n values waiting, each dequeue moves n − 1 of them: O(n) work, exactly like removing from the front of an array.`,
      },
      reveal: {
        visual: naiveVisual(
          [...shifted.after, { id: "freed", value: null }],
          {
            marks: Object.fromEntries(shifted.moved.map((id) => [id, "moved" as const])),
            caption: `${shifted.moved.length} values moved for one dequeue`,
          },
        ),
      },
    },
    {
      id: "track-front",
      mode: "trace",
      title: "Better: move the front, not the values.",
      body: "Keep two indices instead. `first` is the front; `last` is the next free slot at the back. `poll` reads `a[first]` and moves `first` one slot right. The slot 4 used is simply free now, and nothing else moves. This is how algs4's array queue works.",
      visual: arrayVisual(tracked),
      code: { ...arrayQueueCode, highlight: [lineOf(arrayQueueCode, "int x = a[first]"), lineOf(arrayQueueCode, "first = (first")] },
    },
    {
      id: "predict-array-offer",
      mode: "predict",
      title: "Now `offer(5)`.",
      body: "`offer` writes at `last`, then moves `last` on.",
      visual: arrayVisual(tracked),
      code: { ...arrayQueueCode, highlight: [lineOf(arrayQueueCode, "a[last] = x"), lineOf(arrayQueueCode, "last = (last")] },
      question: {
        kind: "choice",
        prompt: "Which index does 5 go into?",
        options: [
          {
            id: "zero",
            label: "0, the free slot at the start",
            feedback: "Slot 0 is free, but writing there would put 5 ahead of 8. New values go where last points.",
          },
          { id: "last", label: `${tracked.last}, where last points` },
          { id: "nine", label: "3", feedback: "Index 3 holds 9, the current back." },
        ],
        correctOptionId: "last",
        explanation: `5 goes into a[${tracked.last}] and last moves to ${trackedFive.last}. One write: no value moves.`,
      },
      reveal: { visual: arrayVisual(trackedFive, { marks: { v5: "new" } }) },
    },
    {
      id: "wrap",
      mode: "show",
      title: "At the end of the array, wrap around.",
      body: "After another poll and `offer(7)`, `last` runs off the end of the array while slot 0 sits free. `(last + 1) % a.length` sends it back to 0, so the array is used as a circle: the next value goes into slot 0. `first` wraps the same way. algs4's version also grows the array when every slot is full.",
      visual: arrayVisual(beforeWrap, { caption: `last wrapped to 0; front → back: ${listValues([2, 9, 5, 7])}` }),
      code: { ...arrayQueueCode, highlight: [lineOf(arrayQueueCode, "last = (last")] },
    },
    {
      id: "complexity",
      mode: "show",
      title: "`offer`, `poll` and `peek` are O(1).",
      body: "Each one works at a known end: write one slot and move `last`, or read one slot and move `first`. Nothing is scanned or shifted, however long the line. algs4's linked-list queue keeps a reference to both ends and is constant time in the worst case. `ArrayDeque` runs in amortized constant time: now and then it copies everything into a bigger array, and that cost averages out over many offers.",
      visual: visual(queueFromValues([2, 9, 5, 7], "c"), { marks: { c0: "focus", c3: "focus" } }),
    },

    // --- J. Deque -----------------------------------------------------------------------
    {
      id: "both-ends",
      mode: "show",
      title: "Sometimes both ends matter.",
      body: "An editor keeps only its 3 most recent edits for undo, newest at the front. Undo needs the newest edit, at the front. But when a 4th edit arrives, the oldest edit must be forgotten, from the back. A queue only removes at one end, and so does a stack. This needs removals at both ends.",
      visual: waitingVisual(threeEdits.after, { type: "addFirst", value: 4 }, "e3", "deque", {
        waiting: { id: "e3", value: 4, end: "front", label: "new edit 4" },
        caption: "newest at the front, oldest at the back",
      }),
    },
    {
      id: "deque",
      mode: "trace",
      title: "A deque: a double-ended queue.",
      body: "A deque (said \"deck\") can add, remove and peek at both ends. A queue is a deque that only adds at the back and removes at the front; a stack only uses one end. `ArrayDeque` is a deque, which is why it could be both. Its explicit methods name the end: First is the front, Last is the back. `addFirst(4)` puts the new edit at the front.",
      visual: stepVisual(fourEdits, "deque"),
      code: { ...historyCode, highlight: [2, 3, 4, 5] },
    },
    {
      id: "predict-poll-last",
      mode: "predict",
      title: "Four edits; only three may stay.",
      body: "`pollLast()` removes from the back.",
      visual: visual(fourEdits.after, { variant: "deque" }),
      code: { ...historyCode, highlight: [6] },
      question: {
        kind: "choice",
        prompt: "Which edit is `forgotten`?",
        options: [
          { id: "four", label: "4", feedback: "4 is the newest edit, at the front. pollLast works at the back." },
          { id: "three", label: "3", feedback: "3 is next to the front." },
          { id: "one", label: "1" },
        ],
        correctOptionId: "one",
        explanation: "1 is the oldest edit, at the back, so pollLast() removes it. The three newest edits remain.",
      },
      reveal: { visual: stepVisual(forgetOne, "deque") },
    },
    {
      id: "predict-undo",
      mode: "predict",
      title: "Now undo.",
      body: "Undo reverses the newest edit. `pollFirst()` removes from the front.",
      visual: visual(forgetOne.after, { variant: "deque" }),
      code: { ...historyCode, highlight: [7] },
      question: {
        kind: "choice",
        prompt: "Which edit is `undone`?",
        options: [
          { id: "two", label: "2", feedback: "2 is at the back now: the oldest edit still kept." },
          { id: "four", label: "4" },
          { id: "one", label: "1", feedback: "1 was already forgotten by pollLast." },
        ],
        correctOptionId: "four",
        explanation: "4 is the newest edit, at the front. pollFirst() removes it.",
      },
      reveal: {
        visual: stepVisual(undoFour, "deque"),
        body: "Two removals at two different ends: that is what a deque is for. Like the queue methods, adding or removing at either end of an `ArrayDeque` is O(1), amortized.",
      },
    },
    {
      id: "deque-trace",
      mode: "solve",
      title: "Trace a deque.",
      body: `Lines 1–3 built {${queueValues(dequeStart).join(", ")}}. Run lines 4–8 in your head.`,
      visual: visual(dequeStart, { variant: "deque" }),
      code: { ...dequeCode, highlight: [4, 5, 6, 7, 8] },
      question: {
        kind: "number-list",
        prompt: "Type the deque from front to back after line 8.",
        expected: queueValues(dequeRun.final),
        explanation: `2 joins at the front and 7 at the back; pollFirst removes 2; 6 joins at the front; pollLast removes 7. Front to back: {${queueValues(dequeRun.final).join(", ")}}.`,
      },
      reveal: { visual: stepVisual(dequeLast, "deque") },
      practice: { kind: "deque-operations", difficulty: "standard", skills: ["after-add", "removed", "final"] },
    },
    {
      id: "complete-save",
      mode: "complete",
      title: "Keep only the 3 newest edits.",
      body: "`save` records a new edit. When the history grows past 3, one edit must go.",
      visual: visual(fourEdits.after, { variant: "deque", marks: { e0: "focus" } }),
      code: { ...saveCode, highlight: [2, 3], blankLine: lineOf(saveCode, "pollLast") },
      question: {
        kind: "choice",
        prompt: "Which line belongs in the gap?",
        options: [
          {
            id: "first",
            label: "history.pollFirst();",
            feedback: "That throws away the edit you just saved: the newest is at the front.",
          },
          { id: "last", label: "history.pollLast();" },
          {
            id: "peek",
            label: "history.peekLast();",
            feedback: "peekLast only reads the oldest edit; the history would keep growing.",
          },
        ],
        correctOptionId: "last",
        explanation: "New edits enter at the front, so the oldest one is at the back. pollLast() forgets it, keeping the 3 newest.",
      },
      practice: { kind: "deque-operations", difficulty: "standard", skills: ["end-operation"] },
    },

    // --- K. Transfer and recognition -----------------------------------------------------
    {
      id: "solve-turns",
      mode: "solve",
      title: "New problem: taking turns.",
      body: "Three players take turns. Each round, the player at the front plays, then goes to the back to wait again. Work out the line after 4 rounds.",
      visual: visual(turnsStart),
      code: { ...turnsCode, highlight: [4, 5] },
      question: {
        kind: "number-list",
        prompt: "Type the queue from front to back after the loop.",
        expected: queueValues(turnsEnd),
        explanation: `Every 3 rounds the line is back where it started, so 4 rounds look like 1: {${queueValues(turnsEnd).join(", ")}}. Taking turns like this is called round-robin.`,
      },
      reveal: { visual: visual(turnsEnd, { caption: "after 4 rounds" }) },
    },
    {
      id: "recognize-calls",
      mode: "explain",
      title: "Which ordering does this need?",
      body: "Callers to a help line wait on hold while every agent is busy. When an agent becomes free, one caller is connected.",
      visual: visual(queueFromValues([31, 17, 25], "call"), {
        hideEnds: true,
        caption: "callers on hold; 31 called first",
      }),
      question: {
        kind: "choice",
        prompt: "What should hold the callers on hold?",
        options: [
          {
            id: "stack",
            label: "A stack: the most recent caller first",
            feedback: "The newest caller would jump ahead of everyone who has been holding longer.",
          },
          { id: "queue", label: "A queue: the longest-waiting caller first" },
          {
            id: "deque",
            label: "A deque: both ends",
            feedback: "Only one end is ever removed from, so a plain queue states the rule exactly.",
          },
        ],
        correctOptionId: "queue",
        explanation: "Waiting in arrival order, first come first served: a queue.",
      },
      practice: { kind: "deque-operations", difficulty: "standard", skills: ["queue-or-deque"] },
    },
    {
      id: "recognize-discovered",
      mode: "explain",
      title: "Things discovered now, handled later.",
      body: "You explore a museum. Whenever you enter a room, you note the doorways you discover, to visit later. You want to visit rooms in the order you discovered them, so rooms near the entrance are all seen before rooms farther away.",
      visual: visual(rooms, { caption: "rooms discovered, waiting to be visited" }),
      question: {
        kind: "choice",
        prompt: "What should hold the discovered rooms?",
        options: [
          { id: "queue", label: "A queue: the first room discovered is visited first" },
          {
            id: "stack",
            label: "A stack: the latest room discovered is visited first",
            feedback: "That always dives into the newest doorway, going deep before finishing what is near: the depth-first order of the Trees lesson.",
          },
          {
            id: "array",
            label: "An array sorted by room name",
            feedback: "Names say nothing about distance. The order of discovery is what matters.",
          },
        ],
        correctOptionId: "queue",
        explanation: "Discovered items that must wait their turn, earliest first: a queue. Hold on to this idea; it comes back in the next milestone.",
      },
    },
    {
      id: "recognize-loop",
      mode: "explain",
      title: "Not everything needs a queue.",
      body: "The scores are already stored in an `int[] scores`. You need their total.",
      visual: { kind: "array", items: queueFromValues([72, 85, 90, 64], "score"), caption: "int[] scores" },
      question: {
        kind: "choice",
        prompt: "What is the right tool?",
        options: [
          {
            id: "queue",
            label: "Offer every score into a queue, then poll them all",
            feedback: "It works, but it adds a step for nothing: nobody is waiting. A queue earns its place when items arrive over time.",
          },
          { id: "loop", label: "A plain loop over the array" },
          {
            id: "deque",
            label: "A deque, so both ends are available",
            feedback: "Neither end matters: every score is used once, in any order.",
          },
        ],
        correctOptionId: "loop",
        explanation: "The values are all there already and order does not matter for a sum. A loop over the array is simplest.",
      },
    },
    {
      id: "next",
      mode: "show",
      title: "Two orders in your toolbox.",
      body: "Newest first: a stack. Oldest first: a queue. Both ends: a deque. The queue's real power appears when handling one item discovers more items that must wait their turn, like the museum rooms. That is how the next milestone explores a tree level by level. Deques return later too, in patterns that slide a window across an array.",
      visual: {
        kind: "compare",
        panes: [
          { id: "stack", label: "Stack: newest first", visual: { kind: "stack", items: stackSide, marks: { s2: "focus" } } },
          { id: "queue", label: "Queue: oldest first", visual: visual(queueSide, { marks: { q0: "focus" } }) },
        ],
      },
    },
  ],
});
