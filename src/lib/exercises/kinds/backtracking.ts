import { z } from "zod";
import {
  backtrackCode,
  backtrackLine,
  backtrackVisual,
  narrateBacktrack,
  treeOverview,
} from "@/curriculum/concepts/backtracking";
import {
  javaList,
  listLabel,
  problemProblems,
  simulate,
  traceBacktracking,
  type BacktrackProblem,
  type BacktrackTrace,
} from "@/lib/domain/backtracking";
import {
  difficultySchema,
  EXERCISE_SKILLS,
  type ChoiceQuestion,
  type LessonStepInput,
  type NumberListQuestion,
} from "@/lib/learning/schema";
import { hashString, seededRandom, shuffle } from "../random";
import type { ExerciseKindDefinition } from "../types";

/**
 * Backtracking exercises over small permutation and subset searches. A
 * candidate proposes the problem, the skill to drill (`ask`) and, for
 * questions about one moment of the search, which occurrence (`moment`).
 * The search, every state and every answer come from the backtracking domain.
 */

export const BACKTRACK_ASKS = EXERCISE_SKILLS.backtracking;
export type BacktrackAsk = (typeof BACKTRACK_ASKS)[number];

const itemSchema = z.number().int().min(1).max(9);

export const backtrackCandidateSchema = z.object({
  kind: z.literal("backtracking"),
  concept: z.literal("backtracking.basics"),
  difficulty: difficultySchema,
  problem: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("permutations"),
      items: z.array(itemSchema).min(2).max(3),
      rule: z.object({ after: itemSchema, forbid: itemSchema }).optional(),
    }),
    z.object({ type: z.literal("subsets"), items: z.array(itemSchema).min(2).max(4) }),
  ]),
  ask: z.enum(BACKTRACK_ASKS),
  /** Which occurrence of the relevant moment (0-based), for moment questions. */
  moment: z.number().int().optional(),
  /** The generator's claim about what ends up in `result`. Verified, never trusted. */
  expected: z.object({ solutions: z.array(z.array(z.number())) }),
});

export type BacktrackCandidate = z.infer<typeof backtrackCandidateSchema>;

/**
 * Snapshot indexes where each moment question can be asked: the question
 * shows snapshot `at`; `answer` is the snapshot that reveals the truth.
 */
export function momentsFor(trace: BacktrackTrace, ask: BacktrackAsk): { at: number; answer: number }[] {
  const s = trace.snapshots;
  const idx = (kind: string) => s.flatMap((snap, i) => (snap.kind === kind ? [i] : []));
  switch (ask) {
    case "next-choice":
    case "after-choose":
      return idx("choose").map((i) => ({ at: i - 1, answer: i }));
    case "after-undo":
      // Typed answers need at least one value, so skip undos back to an empty list.
      return idx("return")
        .filter((i) => s[i + 1].current.length > 0)
        .map((i) => ({ at: i, answer: i + 1 }));
    case "next-branch":
      return idx("enter")
        .filter((i) => i >= 2 && (s[i - 2].kind === "undo" || s[i - 2].kind === "prune"))
        .map((i) => ({ at: i - 2, answer: i }));
    case "next-solution": {
      const records = idx("record");
      return records.slice(1).map((i, k) => ({ at: records[k], answer: i }));
    }
    default:
      return [];
  }
}

const MOMENT_ASKS: readonly BacktrackAsk[] = ["next-choice", "after-choose", "after-undo", "next-branch", "next-solution"];

const sameLists = (a: number[][], b: number[][]) => a.length === b.length && a.every((x, i) => listLabel(x) === listLabel(b[i]));

function verify(candidate: BacktrackCandidate) {
  const problem = candidate.problem as BacktrackProblem;
  const problems = problemProblems(problem);
  if (problems.length > 0) return { ok: false as const, problems };

  const trace = traceBacktracking(problem);
  const { ask, moment } = candidate;
  if (MOMENT_ASKS.includes(ask)) {
    const count = momentsFor(trace, ask).length;
    if (moment === undefined) problems.push(`ask "${ask}" needs a moment.`);
    else if (moment < 0 || moment >= count) problems.push(`moment must be between 0 and ${count - 1} for "${ask}".`);
  } else if (moment !== undefined) {
    problems.push(`ask "${ask}" does not use a moment.`);
  }
  if (trace.solutions.length === 0) problems.push("The rule leaves no valid candidates at all.");
  // Without undo, a subset search builds long, confusing lists; the bug reads clearly on orderings.
  if (ask === "no-undo-bug" && problem.type !== "permutations") {
    problems.push('ask "no-undo-bug" is only used with permutations.');
  }
  if (!sameLists(candidate.expected.solutions, trace.solutions)) {
    problems.push(
      `expected.solutions ${candidate.expected.solutions.map(listLabel).join(" ")} does not match what is recorded: ${trace.solutions.map(listLabel).join(" ")}.`,
    );
  }
  return problems.length > 0 ? { ok: false as const, problems } : { ok: true as const, value: trace };
}

// ---------------------------------------------------------------------------
// Steps

type Draft = { label: string; feedback?: string };

function choice(prompt: string, correct: string, wrong: Draft[], explanation: string, seed: string): ChoiceQuestion {
  const seen = new Set([correct]);
  const distractors = wrong.filter((draft) => {
    if (seen.has(draft.label)) return false;
    seen.add(draft.label);
    return true;
  });
  const right: Draft = { label: correct };
  const ordered = shuffle([right, ...distractors.slice(0, 3)], seededRandom(hashString(seed)));
  const options = ordered.map((draft, i) => ({ id: `option-${i + 1}`, label: draft.label, feedback: draft.feedback }));
  return { kind: "choice", prompt, options, correctOptionId: options[ordered.indexOf(right)].id, explanation };
}

const resultLabel = (lists: number[][]) => `[${lists.map(listLabel).join(",")}]`;

function compile(candidate: BacktrackCandidate, trace: BacktrackTrace) {
  const problem = candidate.problem as BacktrackProblem;
  const seed = fingerprintOf(candidate);
  const code = backtrackCode(problem);
  const s = trace.snapshots;
  const byId = new Map(trace.tree.map((node) => [node.id, node]));
  const label = (id: string | undefined) => listLabel(byId.get(id ?? "")?.candidate ?? []);
  const at = (i: number) => ({
    visual: backtrackVisual(trace, s[i]),
    code: { source: code.source, language: code.language, highlight: backtrackLine(code, s[i]) },
  });
  const after = (from: number, count = 4): LessonStepInput[] =>
    s.slice(from + 1, from + 1 + count).map((_, k) => ({
      id: `step-${from + 1 + k}`,
      mode: "trace",
      ...narrateBacktrack(trace, from + 1 + k),
      ...at(from + 1 + k),
    }));
  const finalStep = (): LessonStepInput => ({ id: "done", mode: "trace", ...narrateBacktrack(trace, s.length - 1), ...at(s.length - 1) });
  const intro = problem.type === "subsets" ? `every subset of ${javaList(problem.items)}` : `every ordering of ${javaList(problem.items)}`;
  const ruleNote = problem.type === "permutations" && problem.rule ? ` ${problem.rule.forbid} may never come right after ${problem.rule.after}.` : "";

  let question: Omit<LessonStepInput, "id"> & { question: ChoiceQuestion | NumberListQuestion };
  let rest: LessonStepInput[];
  const moment = MOMENT_ASKS.includes(candidate.ask) ? momentsFor(trace, candidate.ask)[candidate.moment!] : undefined;

  switch (candidate.ask) {
    case "next-choice": {
      const { at: q, answer } = moment!;
      const frame = s[answer].node;
      const value = s[answer].value!;
      const current = s[answer - 1].current;
      const tried = s
        .slice(0, answer)
        .filter((snap) => snap.node === frame && (snap.kind === "undo" || snap.kind === "prune"))
        .map((snap) => snap.value!);
      const wrong: Draft[] = [
        ...current.map((v) => ({ label: String(v), feedback: `${v} is already in current, so this frame cannot pick it.` })),
        ...tried.map((v) => ({ label: String(v), feedback: `${v} was already tried from this frame and undone.` })),
        ...problem.items.filter((v) => v !== value).map((v) => ({ label: String(v), feedback: "The loop tries values in order; another one comes first." })),
      ];
      question = {
        mode: "predict",
        title: "Which value is added next?",
        body: `The ${javaList(byId.get(frame)!.candidate)} frame is choosing. current is ${javaList(current)}.${ruleNote}`,
        ...at(q),
        question: choice("Which value does this frame add next?", String(value), wrong, narrateBacktrack(trace, answer).title, seed),
        reveal: { visual: backtrackVisual(trace, s[answer]) },
      } as typeof question;
      rest = after(answer);
      break;
    }
    case "after-choose": {
      const { at: q, answer } = moment!;
      const value = s[answer].value!;
      question = {
        mode: "predict",
        title: "Choose: what is in current now?",
        body: `current is ${javaList(s[q].current)}. The frame picks ${value}.`,
        ...at(q),
        question: {
          kind: "number-list",
          prompt: `Type \`current\` after \`current.add(${value})\`.`,
          expected: s[answer].current,
          explanation: `add appends to the end of the same list: ${javaList(s[answer].current)}.`,
        },
        reveal: { visual: backtrackVisual(trace, s[answer]) },
      } as typeof question;
      rest = after(answer);
      break;
    }
    case "after-undo": {
      const { at: q, answer } = moment!;
      question = {
        mode: "predict",
        title: "Undo: what does current go back to?",
        body: `Control is back in the ${javaList(byId.get(s[q].node)!.candidate)} frame, and current is still ${javaList(s[q].current)}.`,
        ...at(q),
        question: {
          kind: "number-list",
          prompt: "Type `current` after `current.remove(current.size() - 1)`.",
          expected: s[answer].current,
          explanation: `remove(size - 1) takes off the most recent choice, ${s[answer].value}, restoring this frame's state: ${javaList(s[answer].current)}.`,
        },
        reveal: { visual: backtrackVisual(trace, s[answer]) },
      } as typeof question;
      rest = after(answer);
      break;
    }
    case "next-branch": {
      const { at: q, answer } = moment!;
      const next = s[answer].node;
      const undone = s[q].child;
      const unexplored = trace.tree.filter(
        (node) => node.status === "valid" && !s[q].explored.includes(node.id) && node.id !== next,
      );
      const wrong: Draft[] = [
        { label: label(undone), feedback: "That branch was just finished and undone." },
        ...unexplored.map((node) => ({ label: listLabel(node.candidate), feedback: "That branch comes later in the search." })),
        { label: label(s[q].node), feedback: "Going back to a frame is not a new branch; the frame picks its next choice." },
      ];
      question = {
        mode: "predict",
        title: "Which branch comes next?",
        body: `current is back to ${javaList(s[q].current)}.${ruleNote}`,
        ...at(q),
        question: choice("Which branch does the search explore next?", label(next), wrong, `Next, the search explores ${label(next)}.`, seed),
        reveal: { visual: backtrackVisual(trace, s[answer]) },
      } as typeof question;
      rest = after(answer);
      break;
    }
    case "next-solution": {
      const { at: q, answer } = moment!;
      const recorded = s[q].results;
      const correct = listLabel(s[answer].current);
      const wrong: Draft[] = [
        ...trace.solutions
          .filter((sol) => !recorded.some((r) => listLabel(r) === listLabel(sol)))
          .map((sol) => ({ label: listLabel(sol), feedback: "That one is recorded later." })),
        ...recorded.map((sol) => ({ label: listLabel(sol), feedback: "Already recorded; each candidate is saved once." })),
      ];
      question = {
        mode: "predict",
        title: "Which candidate is recorded next?",
        body: `${listLabel(s[q].current)} has just been recorded.${ruleNote}`,
        ...at(q),
        question: choice("Which candidate is saved into result next?", correct, wrong, `After undoing back up, the search reaches ${correct} next.`, seed),
        reveal: { visual: backtrackVisual(trace, s[answer]) },
      } as typeof question;
      rest = after(answer);
      break;
    }
    case "count":
      question = {
        mode: "solve",
        title: "How many candidates?",
        body: `The method collects ${intro}.${ruleNote}`,
        visual: treeOverview(trace),
        code: { source: code.source, language: code.language, highlight: [code.lines.record] },
        question: {
          kind: "number-list",
          prompt: "How many candidates end up in `result`?",
          expected: [trace.solutions.length],
          explanation: `result holds ${trace.solutions.length}: ${trace.solutions.map(javaList).join(", ")}.`,
        },
      };
      rest = [finalStep()];
      break;
    case "undo-line":
    case "snapshot-line": {
      const undo = candidate.ask === "undo-line";
      const blank = undo ? code.lines.undo : code.lines.record;
      const correct = undo ? "current.remove(current.size() - 1);" : "result.add(new ArrayList<>(current));";
      const wrong: Draft[] = undo
        ? [
            { label: "current.clear();", feedback: "That wipes every choice, including the ones the calling frames still need." },
            { label: "current.remove(0);", feedback: "That removes the first choice, not the most recent one." },
            { label: "return;", feedback: "That leaves the loop early and still never removes the value." },
          ]
        : [
            { label: "result.add(current);", feedback: "That stores the shared list itself; later undos would empty every entry." },
            { label: "current = new ArrayList<>();", feedback: "That throws the candidate away instead of saving it." },
            { label: "result.add(current.get(0));", feedback: "That saves one number, not the whole candidate." },
          ];
      question = {
        mode: "complete",
        title: undo ? "Restore the undo line." : "Restore the line that saves a candidate.",
        body: `The method collects ${intro}.${ruleNote}`,
        visual: treeOverview(trace),
        code: { source: code.source, language: code.language, highlight: [], blankLine: blank },
        question: choice(
          "Which line is missing?",
          correct,
          wrong,
          undo
            ? "After each recursive call, the frame removes its own last choice so `current` is back to this frame's state for the next choice."
            : "The base case saves a copy, because `current` keeps changing as the search continues.",
          seed,
        ),
      } as typeof question;
      rest = [finalStep()];
      break;
    }
    case "no-undo-bug": {
      const buggy = simulate(problem, { undo: false, copy: true }).results;
      const wrong: Draft[] = [
        { label: resultLabel(trace.solutions), feedback: "That is the correct output; without the undo the search goes wrong." },
        { label: "[]", feedback: "Something is still recorded: the first complete candidate is reached as usual." },
        { label: resultLabel(trace.solutions.slice(0, 1)), feedback: "Close, but trace what current holds after the first candidate." },
      ];
      question = {
        mode: "predict",
        title: "What if the undo line is deleted?",
        body: `The method collects ${intro}, but \`current.remove(current.size() - 1);\` is gone.${ruleNote}`,
        visual: treeOverview(trace),
        code: { source: code.source, language: code.language, highlight: [code.lines.undo] },
        question: choice(
          "Without the undo line, what would `result` contain?",
          resultLabel(buggy),
          wrong,
          "Returning does not remove anything, so every choice stays in current and later branches start from the wrong state.",
          seed,
        ),
      } as typeof question;
      rest = [finalStep()];
      break;
    }
  }

  const steps: LessonStepInput[] = [{ id: "question", ...question } as LessonStepInput, ...rest];
  steps[steps.length - 1] = {
    ...steps[steps.length - 1],
    practice: { kind: "backtracking", difficulty: candidate.difficulty, skills: [candidate.ask] },
  } as LessonStepInput;

  return {
    difficulty: candidate.difficulty,
    title: problem.type === "subsets" ? `Subsets of ${javaList(problem.items)}` : `Orderings of ${javaList(problem.items)}`,
    subtitle: "A freshly generated backtracking search.",
    steps,
  };
}

function fingerprintOf(candidate: BacktrackCandidate): string {
  const p = candidate.problem;
  const rule = p.type === "permutations" && p.rule ? `!${p.rule.after}>${p.rule.forbid}` : "";
  return `backtracking:${p.type}:${p.items.join(",")}${rule}|${candidate.ask}|${candidate.moment ?? ""}`;
}

export const backtrackingKind: ExerciseKindDefinition<BacktrackCandidate, BacktrackTrace> = {
  id: "backtracking",
  concept: "backtracking.basics",
  label: "Backtracking",
  schema: backtrackCandidateSchema,
  fingerprint: fingerprintOf,
  skill: (candidate) => candidate.ask,
  verify,
  compile,
};
