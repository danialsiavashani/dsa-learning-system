import type { CSSProperties } from "react";
import type { VisualMark } from "@/lib/learning/schema";
import type { VisualizerProps } from "./registry";

/**
 * Renders a stack as an open-topped container anchored at the bottom, with
 * the top labelled. Items are keyed by ID and positioned by height, so a held
 * value slides into the top slot on push and out of it on pop, while the
 * values underneath stay put.
 */

const markStyles: Record<VisualMark, string> = {
  focus: "scale-105 border-accent bg-accent-soft",
  moved: "border-moved bg-moved-soft",
  new: "scale-105 border-fresh bg-fresh-soft viz-drop",
  muted: "border-line bg-panel opacity-45",
};

const MIN_ROWS = 4;

/** Distance from the container floor to the bottom of row `row`. */
const rowBottom = (row: number) => `calc(var(--floor) + var(--row) * ${row})`;

export default function StackVisualizer({ visual }: VisualizerProps<"stack">) {
  const { items, marks = {}, held, callout, caption } = visual;
  const rows = Math.max(MIN_ROWS, items.length + 1);
  const topRow = items.length - 1;
  const cellText = (value: number | string) =>
    typeof value === "number" ? "text-xl font-bold" : "font-mono text-sm font-semibold";

  return (
    <figure className="flex w-full flex-col items-center">
      <div
        className="relative"
        style={
          {
            "--gutter": "min(4rem, 20cqi)",
            "--col": "min(6rem, 32cqi)",
            "--side": "min(9rem, 40cqi)",
            "--row": "2.75rem",
            "--floor": "0.375rem",
            width: "calc(var(--gutter) + var(--col) + var(--side))",
            height: `calc(${rowBottom(rows)} + 3rem)`,
          } as CSSProperties
        }
      >
        {/* The container: open at the top, anchored at the bottom. */}
        <div
          aria-hidden
          className="absolute rounded-b-xl border-2 border-t-0 border-line"
          style={{
            left: "var(--gutter)",
            width: "var(--col)",
            bottom: "1.5rem",
            height: rowBottom(rows),
          }}
        />
        <span
          aria-hidden
          className="absolute text-xs text-muted"
          style={{ left: "var(--gutter)", width: "var(--col)", bottom: 0, textAlign: "center" }}
        >
          bottom
        </span>

        {items.length > 0 ? (
          <span
            className="viz-motion absolute flex items-center justify-end gap-1 pr-2 text-xs font-semibold text-accent"
            style={{
              left: 0,
              width: "var(--gutter)",
              height: "calc(var(--row) - 0.375rem)",
              bottom: `calc(1.5rem + ${rowBottom(topRow)})`,
            }}
          >
            top <span aria-hidden>→</span>
          </span>
        ) : (
          <span
            className="absolute flex items-center justify-center text-sm text-muted"
            style={{
              left: "var(--gutter)",
              width: "var(--col)",
              height: "var(--row)",
              bottom: `calc(1.5rem + var(--floor))`,
            }}
          >
            empty
          </span>
        )}

        {callout && items.length > 0 && (
          <span
            className="viz-motion absolute flex items-center gap-1 pl-3 text-sm font-semibold whitespace-nowrap text-accent"
            style={{
              left: "calc(var(--gutter) + var(--col))",
              height: "calc(var(--row) - 0.375rem)",
              bottom: `calc(1.5rem + ${rowBottom(topRow)})`,
            }}
          >
            <span aria-hidden>←</span> {callout}
          </span>
        )}

        {/*
          Stack items and the held value share one keyed list of identical
          elements, so a value keeps its DOM node as it moves between the
          side (held) and the stack.
        */}
        {[
          ...items.map((item, index) => ({ ...item, row: index, label: undefined })),
          ...(held ? [{ ...held, row: items.length }] : []),
        ].map((cell) => {
          const isHeld = cell.label !== undefined;
          const mark = marks[cell.id];
          return (
            <div
              key={cell.id}
              className="viz-motion absolute flex flex-col items-center"
              style={{
                left: isHeld
                  ? "calc(var(--gutter) + var(--col) + (var(--side) - var(--col)) / 2 + 0.375rem)"
                  : "calc(var(--gutter) + 0.375rem)",
                width: "calc(var(--col) - 0.75rem)",
                bottom: `calc(1.5rem + ${rowBottom(cell.row)})`,
              }}
              aria-label={
                isHeld
                  ? `${cell.label}: ${cell.value}`
                  : cell.row === topRow
                    ? `top: ${cell.value}`
                    : `stack value ${cell.value}`
              }
            >
              <div
                className={[
                  "viz-motion flex w-full items-center justify-center rounded-lg border-2",
                  mark ? markStyles[mark] : isHeld ? "border-accent bg-white" : "border-line bg-panel",
                  isHeld ? "border-dashed" : "",
                ].join(" ")}
                style={{ height: "calc(var(--row) - 0.375rem)" }}
              >
                <span className={cellText(cell.value)}>{cell.value}</span>
              </div>
              {isHeld && (
                <span className="absolute top-full mt-1 font-mono text-xs font-semibold whitespace-nowrap text-accent">
                  {cell.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {caption && <figcaption className="mt-4 text-sm text-muted">{caption}</figcaption>}
    </figure>
  );
}
