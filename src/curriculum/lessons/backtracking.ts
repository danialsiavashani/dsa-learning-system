import {
  backtrackCode,
  backtrackLine,
  backtrackVisual,
  treeOverview,
} from "@/curriculum/concepts/backtracking";
import {
  javaList,
  listLabel,
  simulate,
  traceBacktracking,
  type BacktrackProblem,
  type BacktrackSnapshot,
  type BacktrackTrace,
} from "@/lib/domain/backtracking";
import { defineLesson } from "@/lib/learning/validate";

/**
 * The canonical Backtracking lesson. It follows OpenDSA's account of
 * backtracking (organize the possible solutions as a tree, extend a partial
 * solution down one branch, back up and try the alternative, prune branches
 * that cannot succeed) and its counting facts (n! orderings; factorial
 * outgrows 2^n), with Java checked against Princeton's introcs programs
 * (Permutations.java swaps, recurses, then swaps back; Queens.java prunes
 * with a consistency check; Combinations.java builds subsets).
 *
 * Recursion and tree DFS are assumed. What is new: one shared mutable list,
 * and the undo that restores it before the next choice.
 */

const perms: BacktrackProblem = { type: "permutations", items: [1, 2, 3] };
const trace = traceBacktracking(perms);
const code = backtrackCode(perms);

const pruned: BacktrackProblem = { type: "permutations", items: [1, 2, 3], rule: { after: 1, forbid: 2 } };
const prunedTrace = traceBacktracking(pruned);
const prunedCode = backtrackCode(pruned);

const subsets: BacktrackProblem = { type: "subsets", items: [1, 2, 3] };
const subsetsTrace = traceBacktracking(subsets);
const subsetsCode = backtrackCode(subsets);

function find(t: BacktrackTrace, test: (s: BacktrackSnapshot) => boolean): number {
  const index = t.snapshots.findIndex(test);
  if (index < 0) throw new Error("snapshot not found");
  return index;
}
const choose = (node: string, value: number) => find(trace, (s) => s.kind === "choose" && s.node === node && s.value === value);
const enter = (node: string) => find(trace, (s) => s.kind === "enter" && s.node === node);
const record = (node: string) => find(trace, (s) => s.kind === "record" && s.node === node);
const back = (node: string, child: string) => find(trace, (s) => s.kind === "return" && s.node === node && s.child === child);
const undo = (node: string, value: number) => find(trace, (s) => s.kind === "undo" && s.node === node && s.value === value);
const last = (t: BacktrackTrace) => t.snapshots.length - 1;

/** Visual + highlighted line for a snapshot of the main search. */
const at = (index: number) => ({
  visual: backtrackVisual(trace, trace.snapshots[index]),
  code: { ...code, highlight: backtrackLine(code, trace.snapshots[index]) },
});
const reveal = (index: number) => ({ visual: backtrackVisual(trace, trace.snapshots[index]) });

// Buggy variants, run on a real mutable list by the domain simulator.
const withoutUndo = simulate(perms, { undo: false, copy: true });
const withoutCopy = simulate(perms, { undo: true, copy: false });
const resultText = (lists: number[][]) => `[${lists.map(javaList).join(", ")}]`;

const subsetsRecorded = subsetsTrace.solutions;
const afterOneThree = subsetsRecorded[subsetsRecorded.findIndex((s) => listLabel(s) === "[1,3]") + 1];

export const backtrackingLesson = defineLesson({
  id: "backtracking",
  title: "Backtracking",
  subtitle: "Choose, explore, undo, try the next choice.",
  sources: [
    {
      title: "OpenDSA: Coping with NP-Complete Problems (backtracking, branch-and-bound)",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/NP/NPCoping.rst",
      role: "concept",
    },
    {
      title: "OpenDSA: Miscellaneous Notation (factorial and permutations)",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/Background/MiscMath.rst",
      role: "concept",
    },
    {
      title: "OpenDSA: Set Notation (powerset)",
      url: "https://opendsa-server.cs.vt.edu/ODSA/RST/en/Background/SetDef.rst",
      role: "concept",
    },
    {
      title: "Princeton introcs: Permutations.java",
      url: "https://introcs.cs.princeton.edu/23recursion/Permutations.java.html",
      role: "implementation",
    },
    {
      title: "Princeton introcs: Combinations.java (subsets)",
      url: "https://introcs.cs.princeton.edu/23recursion/Combinations.java.html",
      role: "implementation",
    },
    {
      title: "Princeton introcs: Queens.java (pruning)",
      url: "https://introcs.cs.princeton.edu/23recursion/Queens.java.html",
      role: "implementation",
    },
    {
      title: "Java SE API: ArrayList (copy constructor)",
      url: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayList.html",
      role: "implementation",
    },
  ],
  steps: [
    // --- From DFS to a search over choices -------------------------------------------
    {
      id: "many-answers",
      mode: "show",
      title: "Some problems have many answers, built one choice at a time.",
      body: "List every ordering of 1, 2 and 3. There is no single value to compute. Each ordering is a sequence of choices: pick a first value (3 ways), then a second (2 left), then the last. That is 3 × 2 × 1 = 6 orderings.",
      visual: treeOverview(trace),
    },
    {
      id: "decision-tree",
      mode: "show",
      title: "The choices form a tree.",
      body: "Each node is a partial ordering; each edge adds one value. The root [] has three children because the first value can be 1, 2 or 3. The six complete orderings are the leaves. Exploring this tree depth-first is the tree DFS you already know, except the search builds the tree as it goes.",
      visual: treeOverview(trace, { caption: "16 partial orderings, 6 complete" }),
    },
    {
      id: "shared-list",
      mode: "show",
      title: "One shared list, `current`, holds the partial answer.",
      body: "The method does not build a new list for every node. It keeps one list, `current`, and changes it as it moves: `add` on the way down a branch, `remove` on the way back up. Every frame of the recursion sees and changes this same list.",
      ...at(0),
      code: { ...code, highlight: [2, code.lines.add, code.lines.undo] },
    },

    // --- Choose, explore -------------------------------------------------------------------
    {
      id: "predict-choose",
      mode: "predict",
      title: "Choose: change the state.",
      body: "The root frame's loop starts with x = 1. 1 is not in `current`, so line 11 runs.",
      ...at(0),
      code: { ...code, highlight: [code.lines.add] },
      question: {
        kind: "choice",
        prompt: "What is `current` right after `current.add(1)`?",
        options: [
          { id: "empty", label: "[]", feedback: "add changes the list immediately; nothing waits for the recursive call." },
          { id: "one", label: "[1]" },
          { id: "all", label: "[1, 2, 3]", feedback: "Only one value is chosen per step; 2 and 3 come later, one level at a time." },
        ],
        correctOptionId: "one",
        explanation: "add appends 1 to the shared list, so current is [1] before the recursive call even starts.",
      },
      reveal: reveal(choose("b", 1)),
    },
    {
      id: "explore",
      mode: "trace",
      title: "Explore: the recursive call follows that branch.",
      body: "`backtrack(nums)` starts a new frame for the [1] node. It sees the same `current`, now [1]. Its size is not 3 yet, so it runs the loop for the second value.",
      ...at(enter("b.1")),
    },
    {
      id: "predict-second",
      mode: "predict",
      title: "Second level: choose again.",
      body: "The [1] frame's loop starts over at x = 1.",
      ...at(enter("b.1")),
      question: {
        kind: "choice",
        prompt: "Which value does this frame add next?",
        options: [
          { id: "one", label: "1", feedback: "`current.contains(1)` is true, so 1 is skipped." },
          { id: "two", label: "2" },
          { id: "three", label: "3", feedback: "The loop tries values in order, and 2 comes before 3." },
        ],
        correctOptionId: "two",
        explanation: "1 is already used, so the loop moves on and adds 2: current becomes [1, 2].",
      },
      reveal: reveal(choose("b.1", 2)),
    },
    {
      id: "third",
      mode: "trace",
      title: "Deeper still: only 3 is left.",
      body: "The [1, 2] frame skips 1 and 2, adds 3, and calls `backtrack` once more. current is [1, 2, 3].",
      ...at(enter("b.1.2.3")),
    },

    // --- Base case ----------------------------------------------------------------------------
    {
      id: "record",
      mode: "trace",
      title: "Complete: save a copy.",
      body: "`current.size() == nums.length`, so this is a full ordering. The base case saves a copy of it into `result` and returns. Reaching a base case finishes one candidate; it is not what makes this backtracking.",
      ...at(record("b.1.2.3")),
    },
    {
      id: "explain-copy",
      mode: "explain",
      title: "Why save a copy?",
      body: "The base case writes `result.add(new ArrayList<>(current));`, not `result.add(current);`.",
      ...at(record("b.1.2.3")),
      question: {
        kind: "choice",
        prompt: "Why does it store `new ArrayList<>(current)`?",
        options: [
          {
            id: "type",
            label: "A list cannot be added to another list.",
            feedback: "A List<Integer> can be added to a List<List<Integer>>. The problem is what happens to it afterwards.",
          },
          { id: "snapshot", label: "`current` keeps changing as the search goes on, so result needs its own frozen copy." },
          {
            id: "speed",
            label: "Copying is faster.",
            feedback: "Copying costs a little extra time. It is done for correctness.",
          },
        ],
        correctOptionId: "snapshot",
        explanation: "`new ArrayList<>(current)` builds a separate list with the same values. The search keeps adding and removing from `current`; the saved copy never changes.",
      },
    },

    // --- Return, then undo ---------------------------------------------------------------------
    {
      id: "predict-return",
      mode: "predict",
      title: "Return to the [1, 2] frame.",
      body: "The base case returns. Control goes back to the line after `backtrack(nums)` in the [1, 2] frame.",
      ...at(record("b.1.2.3")),
      question: {
        kind: "choice",
        prompt: "What does `current` contain the moment control is back in the [1, 2] frame?",
        options: [
          {
            id: "restored",
            label: "[1, 2]",
            feedback: "That is what this frame needs, but nothing has removed 3 yet. Returning does not touch the list.",
          },
          { id: "still", label: "[1, 2, 3]" },
          { id: "empty", label: "[]", feedback: "Returning does not clear anything." },
        ],
        correctOptionId: "still",
        explanation: "Returning from a call does not undo changes to a shared list. current still ends with 3: the parent frame is not back to its own state yet.",
      },
      reveal: reveal(back("b.1.2", "b.1.2.3")),
    },
    {
      id: "undo",
      mode: "trace",
      title: "Undo: remove the last choice.",
      body: "`current.remove(current.size() - 1)` takes 3 back off. current is [1, 2] again, exactly as it was before this frame chose 3. This restoring step is the back in backtracking: only now is it safe to try another choice.",
      ...at(undo("b.1.2", 3)),
    },
    {
      id: "predict-remove",
      mode: "predict",
      title: "Up one more level.",
      body: "The [1, 2] frame has no unused values left, so its loop ends and it returns to the [1] frame.",
      ...at(back("b.1", "b.1.2")),
      question: {
        kind: "choice",
        prompt: "Which value does `current.remove(current.size() - 1)` take out now?",
        options: [
          { id: "two", label: "2" },
          { id: "one", label: "1", feedback: "remove(size - 1) takes the last element: the most recent choice, not the first." },
          { id: "three", label: "3", feedback: "3 was already removed by the frame below." },
        ],
        correctOptionId: "two",
        explanation: "Each frame removes the value it added. The [1] frame added 2, so it removes 2, and current is back to [1].",
      },
      reveal: reveal(undo("b.1", 2)),
    },
    {
      id: "explain-why-remove",
      mode: "explain",
      title: "Why remove the last item?",
      body: "Every frame ends each loop pass the same way.",
      ...at(undo("b.1", 2)),
      question: {
        kind: "choice",
        prompt: "Why does each frame remove exactly the last item after its recursive call?",
        options: [
          {
            id: "free",
            label: "To free memory once a branch is finished.",
            feedback: "Memory is not the point. The list must look exactly as this frame left it before its next choice.",
          },
          { id: "restore", label: "It undoes this frame's own choice, so its next choice starts from the same state." },
          {
            id: "base",
            label: "Because the base case requires it.",
            feedback: "The base case only saves a copy. The undo belongs to the frame that made the choice.",
          },
        ],
        correctOptionId: "restore",
        explanation: "Deeper frames clean up after themselves before returning, so the last item is always this frame's own choice. Princeton's string version of this program builds a new string for each call and needs no undo; one shared list needs one.",
      },
    },

    // --- Another branch ----------------------------------------------------------------------------
    {
      id: "predict-branch",
      mode: "predict",
      title: "The next branch.",
      body: "current is [1] and the [1] frame's loop continues.",
      ...at(undo("b.1", 2)),
      question: {
        kind: "choice",
        prompt: "Which branch is explored next?",
        options: [
          { id: "root-two", label: "[2]", feedback: "The [1] frame still has 3 to try before control goes back to the root." },
          { id: "one-three", label: "[1, 3]" },
          { id: "one-two", label: "[1, 2]", feedback: "That branch is finished; the loop moves on to 3." },
        ],
        correctOptionId: "one-three",
        explanation: "The loop's next unused value is 3, so the frame adds 3 and explores [1, 3].",
      },
      reveal: reveal(enter("b.1.3")),
    },
    {
      id: "finish-one",
      mode: "trace",
      title: "The [1] subtree is finished.",
      body: "Same rhythm: add 2, record [1, 3, 2], remove 2, remove 3, remove 1. current is back to [] and the root frame moves on to 2.",
      ...at(undo("b", 1)),
    },
    {
      id: "predict-no-undo",
      mode: "predict",
      title: "What if the undo line were missing?",
      body: "Delete `current.remove(current.size() - 1);` and run the search again.",
      visual: treeOverview(trace),
      code: { ...code, highlight: [code.lines.undo] },
      question: {
        kind: "choice",
        prompt: "Without the undo line, what would `result` contain at the end?",
        options: [
          {
            id: "all",
            label: "All six orderings",
            feedback: "Without the remove, current never shrinks, so later branches never get started.",
          },
          { id: "one", label: resultText(withoutUndo.results) },
          {
            id: "copies",
            label: "Six copies of [1, 2, 3]",
            feedback: "[1, 2, 3] is recorded once. Every later choice finds its value already in current and skips it.",
          },
        ],
        correctOptionId: "one",
        explanation: `After [1, 2, 3] is saved, current stays [1, 2, 3]. Every remaining loop pass finds its value already in current and skips it, so result ends as ${resultText(withoutUndo.results)}.`,
      },
      reveal: {
        visual: backtrackVisual(trace, trace.snapshots[record("b.1.2.3")], {
          caption: "without undo: current stays [1, 2, 3], so nothing else is ever built",
        }),
      },
    },
    {
      id: "complete-undo",
      mode: "complete",
      title: "Restore the undo line.",
      body: "Choose, explore, … the third line of the pattern is missing.",
      visual: treeOverview(trace),
      code: { ...code, highlight: [code.lines.add, code.lines.recurse], blankLine: code.lines.undo },
      question: {
        kind: "choice",
        prompt: "Which line belongs after the recursive call?",
        options: [
          { id: "clear", label: "current.clear();", feedback: "That wipes every choice, including the ones the calling frames still need." },
          { id: "right", label: "current.remove(current.size() - 1);" },
          { id: "first", label: "current.remove(0);", feedback: "That removes the first choice, not this frame's most recent one." },
          { id: "return", label: "return;", feedback: "That leaves the loop early and still never removes the value." },
        ],
        correctOptionId: "right",
        explanation: "Undo exactly the choice this frame made: the last item. Then the loop can try its next value.",
      },
      practice: { kind: "backtracking", difficulty: "intro", skills: ["after-undo", "undo-line", "no-undo-bug"] },
    },
    {
      id: "full-search",
      mode: "trace",
      title: "Choose, explore, undo, next choice: the whole tree.",
      body: "Repeating that rhythm at every level walks the entire decision tree depth-first and records all 6 orderings. Every branch starts from a correctly restored `current`.",
      ...at(last(trace)),
      practice: { kind: "backtracking", difficulty: "intro", skills: ["next-choice", "next-branch", "after-choose"] },
    },
    {
      id: "explain-contrast",
      mode: "explain",
      title: "Backtracking vs ordinary recursion.",
      body: "factorial made one smaller call and used its result. This method does something different at every level.",
      question: {
        kind: "choice",
        prompt: "What makes this backtracking rather than ordinary recursion?",
        options: [
          { id: "base", label: "It has a base case.", feedback: "factorial has a base case too. A base case alone is not backtracking." },
          { id: "self", label: "It calls itself.", feedback: "Every recursive method does that." },
          { id: "choices", label: "Each level tries several choices, undoing each one before trying the next." },
        ],
        correctOptionId: "choices",
        explanation: "Backtracking explores alternatives: change the shared state, explore, restore it, and explore the next alternative. Not every recursive method does that.",
      },
    },

    // --- Saving copies --------------------------------------------------------------------------------
    {
      id: "predict-aliasing",
      mode: "predict",
      title: "What if the base case saved `current` itself?",
      body: "Change line 6 to `result.add(current);` and run the full search.",
      visual: treeOverview(trace),
      code: { ...code, highlight: [code.lines.record] },
      question: {
        kind: "choice",
        prompt: "What would `result` print at the end?",
        options: [
          { id: "six", label: "The six orderings", feedback: "Each entry is the same list object, and that list keeps changing." },
          { id: "empty", label: resultText(withoutCopy.results) },
          { id: "last", label: "[[3, 2, 1]]", feedback: "Six entries are added, not one; they just all point at one list." },
        ],
        correctOptionId: "empty",
        explanation: `result would hold six references to the one shared list. After the final undo that list is empty, so every entry prints as []: ${resultText(withoutCopy.results)}.`,
      },
      reveal: {
        visual: backtrackVisual(trace, trace.snapshots[last(trace)], {
          results: withoutCopy.results.map((r, i) => ({ id: `alias-${i}`, label: listLabel(r) })),
          caption: "result.add(current): six references to one list, now empty",
        }),
      },
    },
    {
      id: "complete-snapshot",
      mode: "complete",
      title: "Restore the line that saves a candidate.",
      body: "The base case is missing its first line.",
      visual: treeOverview(trace),
      code: { ...code, highlight: [code.lines.enter], blankLine: code.lines.record },
      question: {
        kind: "choice",
        prompt: "Which line saves a complete ordering correctly?",
        options: [
          { id: "alias", label: "result.add(current);", feedback: "That stores the shared list itself; later undos would empty every entry." },
          { id: "reset", label: "current = new ArrayList<>();", feedback: "That throws the candidate away instead of saving it." },
          { id: "right", label: "result.add(new ArrayList<>(current));" },
        ],
        correctOptionId: "right",
        explanation: "Save a snapshot: a new ArrayList with the same values, which later changes to `current` cannot reach.",
      },
      practice: { kind: "backtracking", difficulty: "standard", skills: ["snapshot-line", "no-undo-bug"] },
    },

    // --- Pruning ------------------------------------------------------------------------------------------
    {
      id: "pruning",
      mode: "show",
      title: "Pruning: skip a branch that cannot work.",
      body: "New rule: 2 may never come right after 1. When the [1] frame considers 2, `breaksRule(2)` is true, so it does not add 2 at all, and the whole [1, 2] branch is never explored. Stopping early on a partial choice that cannot lead to a valid answer is pruning.",
      visual: backtrackVisual(prunedTrace, prunedTrace.snapshots[last(prunedTrace)]),
      code: { ...prunedCode, highlight: [prunedCode.lines.prune!] },
    },
    {
      id: "solve-pruned",
      mode: "solve",
      title: "How much survives the rule?",
      body: "Same orderings of 1, 2 and 3, with the rule that 2 never comes right after 1.",
      visual: treeOverview(prunedTrace),
      code: { ...prunedCode, highlight: [prunedCode.lines.prune!] },
      question: {
        kind: "number-list",
        prompt: "How many orderings end up in `result`?",
        expected: [prunedTrace.solutions.length],
        explanation: `${prunedTrace.solutions.map(javaList).join(", ")}: the [1, 2] branch is cut off early, and [3, 1, 2] is rejected at its last step.`,
      },
      reveal: { visual: backtrackVisual(prunedTrace, prunedTrace.snapshots[last(prunedTrace)]) },
      practice: { kind: "backtracking", difficulty: "standard", skills: ["count", "next-solution"] },
    },

    // --- Cost ---------------------------------------------------------------------------------------------------
    {
      id: "cost",
      mode: "show",
      title: "The cost is the size of the tree.",
      body: "Backtracking has no single running time: it does work for every node it explores. All orderings of n distinct values means n! leaves: 3! = 6 here, but 4! = 24 and 10! = 3,628,800, and factorial grows faster than 2^n. Pruning helps by skipping whole branches, but the tree is the cost.",
      ...at(last(trace)),
    },

    // --- Recognize and transfer --------------------------------------------------------------------------------
    {
      id: "recognize",
      mode: "explain",
      title: "When is backtracking the right tool?",
      body: "Signals: the problem asks for all combinations, orderings or arrangements; each step chooses among alternatives; rules eliminate some choices; and a choice may need to be undone to try another.",
      question: {
        kind: "choice",
        prompt: "Which task is backtracking-shaped?",
        options: [
          { id: "max", label: "Find the largest number in an array", feedback: "One pass with a variable does it: there are no choices to undo." },
          {
            id: "toppings",
            label: "List every pizza with 3 of 6 toppings, skipping combinations that break a rule",
          },
          { id: "sum", label: "Add up the values in a list", feedback: "A simple loop is the better fit; there is only one way to sum." },
        ],
        correctOptionId: "toppings",
        explanation: "Listing combinations means trying alternatives at each step and backing out of each one; the rule prunes branches. The other two need a single linear scan.",
      },
    },
    {
      id: "transfer-subsets",
      mode: "complete",
      title: "New problem: every subset.",
      body: "Every node of this tree is a subset, so the method records on entry. A frame may only add values after the last one it chose, so no subset appears twice. Rebuild the recursive call.",
      visual: treeOverview(subsetsTrace, { caption: `${subsetsRecorded.length} subsets of [1, 2, 3]` }),
      code: { ...subsetsCode, highlight: [subsetsCode.lines.add, subsetsCode.lines.undo], blankLine: subsetsCode.lines.recurse },
      question: {
        kind: "choice",
        prompt: "Which call explores the branch that includes `nums[i]`?",
        options: [
          { id: "same", label: "backtrack(nums, i);", feedback: "Starting at i again lets nums[i] be picked over and over: the calls never end." },
          { id: "right", label: "backtrack(nums, i + 1);" },
          {
            id: "start",
            label: "backtrack(nums, start + 1);",
            feedback: "The next start must follow the value just chosen, not this frame's start, or subsets repeat.",
          },
          { id: "zero", label: "backtrack(nums, 0);", feedback: "Starting over at 0 re-picks earlier values: duplicates and no end." },
        ],
        correctOptionId: "right",
        explanation: "After choosing nums[i], the deeper frame may only consider values after it, so it starts at i + 1. Choose, explore, undo is unchanged.",
      },
    },
    {
      id: "solve-subsets",
      mode: "solve",
      title: "Trace the subset search.",
      body: "Records happen on entry: [], [1], [1, 2], [1, 2, 3], [1, 3], …",
      visual: treeOverview(subsetsTrace),
      code: { ...subsetsCode, highlight: [subsetsCode.lines.record] },
      question: {
        kind: "number-list",
        prompt: "Which subset is recorded right after [1, 3]? Type its values.",
        expected: afterOneThree,
        explanation: `After [1, 3], the [1] frame has nothing left; undo back to the root, which chooses 2 next: ${javaList(afterOneThree)}.`,
      },
      reveal: {
        visual: backtrackVisual(
          subsetsTrace,
          subsetsTrace.snapshots[find(subsetsTrace, (s) => s.kind === "record" && listLabel(s.current) === listLabel(afterOneThree))],
        ),
      },
      practice: { kind: "backtracking", difficulty: "challenge", skills: ["next-branch", "next-solution", "after-undo"] },
    },
  ],
});
