import type { CodeView } from "@/lib/learning/schema";

const languageLabels: Record<CodeView["language"], string> = {
  java: "Java",
};

type CodePanelProps = {
  code: CodeView;
  /** Text revealed in the blank line once the learner has answered. */
  fill?: string;
};

export default function CodePanel({ code, fill }: CodePanelProps) {
  const lines = code.source.split("\n");
  const highlighted = new Set(code.highlight ?? []);

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-line bg-white">
      <p className="border-b border-line px-4 py-1.5 text-xs font-semibold text-muted">
        {languageLabels[code.language]}
      </p>
      <pre className="overflow-x-auto py-2 font-mono text-[0.8rem] leading-6">
        {lines.map((line, index) => {
          const number = index + 1;
          const active = highlighted.has(number);
          const blank = code.blankLine === number;
          const indent = line.match(/^\s*/)?.[0] ?? "";

          return (
            <div
              key={number}
              className={[
                "flex border-l-4 pr-3 transition-colors duration-300",
                active ? "border-accent bg-accent-soft" : "border-transparent",
              ].join(" ")}
              aria-current={active ? "step" : undefined}
            >
              <span
                aria-hidden
                className="w-8 shrink-0 pr-2.5 text-right text-muted select-none"
              >
                {number}
              </span>
              <code className="whitespace-pre">
                {blank ? (
                  <>
                    {indent}
                    {fill ? (
                      <span className="rounded bg-fresh-soft px-1 text-fresh">
                        {fill.trim()}
                      </span>
                    ) : (
                      <span
                        className="inline-block w-48 rounded border border-dashed border-muted/60 text-center text-muted"
                        aria-label="missing line"
                      >
                        ?
                      </span>
                    )}
                  </>
                ) : (
                  line || " "
                )}
              </code>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
