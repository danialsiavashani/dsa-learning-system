import type { CSSProperties } from "react";
import type { VisualMark } from "@/lib/learning/schema";
import type { VisualizerProps } from "./registry";

/**
 * Renders an array state. Cells are keyed by item ID and absolutely
 * positioned by index, so when an item's index changes between states it
 * slides to its new slot instead of being re-created.
 *
 * Sizing is relative to the stage width (container query units), so long
 * arrays shrink to fit narrow screens.
 */

const markStyles: Record<VisualMark, string> = {
  focus: "scale-110 border-accent bg-accent-soft",
  moved: "border-moved bg-moved-soft",
  new: "scale-110 border-fresh bg-fresh-soft",
  muted: "border-line bg-panel opacity-45",
};

const legendLabels: Partial<Record<VisualMark, string>> = {
  moved: "moved",
  new: "new",
};

const legendSwatches: Partial<Record<VisualMark, string>> = {
  moved: "border-moved bg-moved-soft",
  new: "border-fresh bg-fresh-soft",
};

const slotLeft = (index: number) => `calc(var(--slot) * ${index})`;

export default function AnimatedArray({ visual }: VisualizerProps<"array">) {
  const { items, marks = {}, pointers = [], caption } = visual;
  const slots = Math.max(items.length, ...pointers.map((p) => p.index + 1), 1);
  const legend = (Object.keys(legendLabels) as VisualMark[]).filter((mark) =>
    Object.values(marks).includes(mark),
  );

  return (
    <figure className="flex w-full flex-col items-center">
      <div
        className="relative"
        style={
          {
            "--slot": `min(4.75rem, calc(100cqi / ${slots}))`,
            "--cell": "calc(var(--slot) * 0.84)",
            width: `calc(var(--slot) * ${slots} - var(--slot) * 0.16)`,
            height: "calc(var(--cell) + 2.75rem)",
          } as CSSProperties
        }
      >
        {pointers.map((pointer, position) => (
          <div
            // Keyed by position so a pointer slides when its index changes.
            key={`pointer-${position}`}
            className="viz-motion absolute top-0 flex -translate-x-1/2 flex-col items-center text-xs font-semibold whitespace-nowrap text-accent"
            style={{ left: `calc(${slotLeft(pointer.index)} + var(--cell) / 2)` }}
          >
            <span>{pointer.label}</span>
            <span aria-hidden className="leading-none">
              ▾
            </span>
          </div>
        ))}

        {items.map((item, index) => {
          const mark = marks[item.id];
          const empty = item.value === null;

          return (
            <div
              key={item.id}
              className={[
                "viz-motion absolute flex flex-col items-center justify-center rounded-xl border-2",
                empty
                  ? "border-dashed border-line bg-transparent"
                  : mark
                    ? markStyles[mark]
                    : "border-line bg-panel",
                mark === "new" ? "viz-enter" : "",
              ].join(" ")}
              style={{
                left: slotLeft(index),
                top: "2.75rem",
                width: "var(--cell)",
                height: "var(--cell)",
              }}
              aria-label={
                empty ? `index ${index}: empty` : `index ${index}: ${item.value}`
              }
            >
              <span
                className="font-bold leading-none"
                style={{ fontSize: "calc(var(--cell) * 0.32)" }}
              >
                {empty ? "" : item.value}
              </span>
              <span
                className="mt-1 leading-none text-muted"
                style={{ fontSize: "max(0.625rem, calc(var(--cell) * 0.17))" }}
              >
                {index}
              </span>
            </div>
          );
        })}
      </div>

      {(legend.length > 0 || caption) && (
        <figcaption className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted">
          {legend.map((mark) => (
            <span key={mark} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={`inline-block h-3 w-3 rounded border-2 ${legendSwatches[mark]}`}
              />
              {legendLabels[mark]}
            </span>
          ))}
          {caption && <span>{caption}</span>}
        </figcaption>
      )}
    </figure>
  );
}
