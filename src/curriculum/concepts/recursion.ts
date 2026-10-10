import {
  recursiveFunctions,
  type CallFrame,
  type RecursionTrace,
  type RecursiveFunctionId,
  type TraceSnapshot,
} from "@/lib/domain/recursion";
import type { CallStackVisual } from "@/lib/learning/schema";

/**
 * Shared recursion material: the Java for each supported method, and how a
 * domain trace snapshot is shown (call-stack visual, highlighted line,
 * narration). The canonical lesson and generated exercises both use it.
 */

type JavaMethod = {
  body: string[];
  /** Lines relative to the method's first line (1 = signature). */
  lines: { baseCheck: number; baseReturn: number; recurse: number; print?: number };
  /** The base-case condition as written, e.g. "n <= 1". */
  condition: string;
};

const methods: Record<RecursiveFunctionId, JavaMethod> = {
  factorial: {
    body: [
      "int factorial(int n) {",
      "    if (n <= 1) {",
      "        return 1;",
      "    }",
      "    return n * factorial(n - 1);",
      "}",
    ],
    lines: { baseCheck: 2, baseReturn: 3, recurse: 5 },
    condition: "n <= 1",
  },
  sumTo: {
    body: [
      "int sumTo(int n) {",
      "    if (n == 0) {",
      "        return 0;",
      "    }",
      "    return n + sumTo(n - 1);",
      "}",
    ],
    lines: { baseCheck: 2, baseReturn: 3, recurse: 5 },
    condition: "n == 0",
  },
  countdown: {
    body: [
      "void countdown(int n) {",
      "    if (n == 0) {",
      "        return;",
      "    }",
      "    System.out.println(n);",
      "    countdown(n - 1);",
      "}",
    ],
    lines: { baseCheck: 2, baseReturn: 3, print: 5, recurse: 6 },
    condition: "n == 0",
  },
  countUp: {
    body: [
      "void countUp(int n) {",
      "    if (n == 0) {",
      "        return;",
      "    }",
      "    countUp(n - 1);",
      "    System.out.println(n);",
      "}",
    ],
    lines: { baseCheck: 2, baseReturn: 3, recurse: 5, print: 6 },
    condition: "n == 0",
  },
};

/** Lines of `main` that precede the method. */
const MAIN_LINES = 4;

export function callOf(fn: RecursiveFunctionId, n: number) {
  return `${fn}(${n})`;
}

/** The Java program: a small `main` that makes the first call, then the method. */
export function recursionCode(fn: RecursiveFunctionId, input: number) {
  const { returnsValue } = recursiveFunctions[fn];
  const method = methods[fn];
  const call = returnsValue ? `int result = ${callOf(fn, input)};` : `${callOf(fn, input)};`;
  const at = (line: number) => MAIN_LINES + line;
  return {
    source: ["void main() {", `    ${call}`, "}", "", ...method.body].join("\n"),
    language: "java" as const,
    lines: {
      caller: 2,
      signature: at(1),
      baseCheck: at(method.lines.baseCheck),
      baseReturn: at(method.lines.baseReturn),
      recurse: at(method.lines.recurse),
      print: method.lines.print === undefined ? undefined : at(method.lines.print),
    },
  };
}

/** The method on its own (no main), e.g. for fill-in-the-blank. */
export function methodCode(fn: RecursiveFunctionId) {
  return { source: methods[fn].body.join("\n"), language: "java" as const, lines: methods[fn].lines };
}

export function baseCondition(fn: RecursiveFunctionId) {
  return methods[fn].condition;
}

/** The pending work a waiting frame will finish once its call returns. */
export function pendingWork(fn: RecursiveFunctionId, n: number): string {
  switch (fn) {
    case "factorial":
      return `${n} * ${callOf(fn, n - 1)}`;
    case "sumTo":
      return `${n} + ${callOf(fn, n - 1)}`;
    case "countdown":
      return callOf(fn, n - 1);
    case "countUp":
      return `${callOf(fn, n - 1)}, print ${n}`;
  }
}

function frameDetail(fn: RecursiveFunctionId, frame: CallFrame): string {
  switch (frame.status) {
    case "running":
      return `n = ${frame.n}`;
    case "waiting":
      return pendingWork(fn, frame.n);
    case "base":
      return frame.returnValue === null || frame.returnValue === undefined
        ? `${methods[fn].condition}: return`
        : `${methods[fn].condition}: return ${frame.returnValue}`;
    case "returning":
      if (fn === "factorial") return `${frame.n} * ${frame.received} = ${frame.returnValue}`;
      if (fn === "sumTo") return `${frame.n} + ${frame.received} = ${frame.returnValue}`;
      return fn === "countUp" ? `prints ${frame.n}, returns` : "nothing left: returns";
  }
}

/** The call-stack visual for one snapshot, with a waiting `main` at the bottom. */
export function snapshotVisual(
  trace: RecursionTrace,
  snapshot: TraceSnapshot,
  options: { caption?: string } = {},
): CallStackVisual {
  const { fn, input } = trace;
  const { returnsValue, prints } = recursiveFunctions[fn];
  const done = snapshot.kind === "done";
  const top = snapshot.frames[snapshot.frames.length - 1];

  const main = {
    id: "main",
    call: "main()",
    status: done ? ("running" as const) : ("waiting" as const),
    detail: done
      ? returnsValue
        ? `result = ${snapshot.value}`
        : "back in main"
      : returnsValue
        ? `result = ${callOf(fn, input)}`
        : `${callOf(fn, input)};`,
  };
  const frames = snapshot.frames.map((frame) => ({
    id: frame.id,
    call: callOf(fn, frame.n),
    status: frame.status,
    detail: frameDetail(fn, frame),
  }));

  const hasValue = snapshot.value !== undefined && snapshot.value !== null;
  return {
    kind: "callStack",
    frames: [main, ...frames],
    carry: hasValue
      ? {
          id: "result",
          value: String(snapshot.value),
          frameId: done ? "main" : top.id,
          label: done ? "result" : "returns",
        }
      : undefined,
    entering: snapshot.kind === "call" ? top.id : undefined,
    phase: snapshot.kind === "call" ? "calling" : done ? undefined : "unwinding",
    output: prints ? snapshot.output.map(String) : undefined,
    caption: options.caption,
  };
}

/** The Java line that is executing at this snapshot. */
export function snapshotLine(trace: RecursionTrace, snapshot: TraceSnapshot): number {
  const lines = recursionCode(trace.fn, trace.input).lines;
  switch (snapshot.kind) {
    case "call":
      return lines.baseCheck;
    case "base":
      return lines.baseReturn;
    case "return":
      return trace.fn === "countUp" && lines.print ? lines.print : lines.recurse;
    case "done":
      return lines.caller;
  }
}

/** Narration for a snapshot: a title and a sentence explaining why it happened. */
export function narrate(trace: RecursionTrace, index: number): { title: string; body: string } {
  const { fn } = trace;
  const { returnsValue } = recursiveFunctions[fn];
  const snapshot = trace.snapshots[index];
  const frames = snapshot.frames;
  const top = frames[frames.length - 1];

  switch (snapshot.kind) {
    case "call": {
      const parent = frames[frames.length - 2];
      if (!parent) {
        return {
          title: `main calls \`${callOf(fn, top.n)}\`.`,
          body: `A new frame appears with its own n = ${top.n}. It checks \`${baseCondition(fn)}\` first.`,
        };
      }
      const waits =
        fn === "countdown"
          ? `\`${callOf(fn, parent.n)}\` printed ${parent.n} and now waits.`
          : fn === "countUp"
            ? `\`${callOf(fn, parent.n)}\` waits; its print comes after the call returns.`
            : `\`${callOf(fn, parent.n)}\` waits at \`${pendingWork(fn, parent.n)}\`: it cannot finish until this call returns.`;
      return { title: `\`${callOf(fn, top.n)}\` is called.`, body: `${waits} The new frame has n = ${top.n}.` };
    }
    case "base":
      return {
        title: `\`${callOf(fn, top.n)}\` is the base case.`,
        body: returnsValue
          ? `\`${baseCondition(fn)}\` is true, so it returns ${snapshot.value} without another call. Unwinding starts here.`
          : `\`${baseCondition(fn)}\` is true, so it returns without another call. Unwinding starts here.`,
      };
    case "return":
      return returnsValue
        ? {
            title: `\`${callOf(fn, top.n)}\` resumes: ${frameDetail(fn, top)}.`,
            body: `Its call returned ${top.received}, so the pending work can finish. It returns ${top.returnValue}.`,
          }
        : {
            title:
              fn === "countUp"
                ? `\`${callOf(fn, top.n)}\` resumes and prints ${top.n}.`
                : `\`${callOf(fn, top.n)}\` resumes and returns.`,
            body:
              fn === "countUp"
                ? "The print comes after the recursive call, so it happens on the way back up."
                : "Its print already happened on the way down; nothing is left to do.",
          };
    case "done":
      return returnsValue
        ? {
            title: `main receives ${trace.result}.`,
            body: `Calls went ${trace.calls.join(" → ")}; returns came back ${trace.returns.join(" → ")}.`,
          }
        : {
            title: "Back in main.",
            body: `Printed, in order: ${trace.output.join(" ")}.`,
          };
  }
}
