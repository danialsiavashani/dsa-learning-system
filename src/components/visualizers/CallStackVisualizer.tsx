import type { CSSProperties } from "react";
import type { CallStackVisual } from "@/lib/learning/schema";
import type { VisualizerProps } from "./registry";

/**
 * Renders a call stack: one card per frame, bottom → top, keyed by frame ID.
 * A new call drops onto the top while the frame beneath turns to waiting;
 * on the way back, the returned value (`carry`) slides down from the frame
 * that returned to the frame that resumes, and the finished frame is gone.
 */

type Status = CallStackVisual["frames"][number]["status"];

const statusStyles: Record<Status, { card: string; pill: string; label: string }> = {
  running: {
    card: "border-accent bg-accent-soft shadow-sm",
    pill: "bg-accent text-white",
    label: "running",
  },
  waiting: {
    card: "border-line bg-panel text-muted",
    pill: "bg-line/60 text-muted",
    label: "waiting",
  },
  base: {
    card: "border-fresh bg-fresh-soft shadow-sm",
    pill: "bg-fresh text-white",
    label: "base case",
  },
  returning: {
    card: "border-accent bg-white shadow-sm",
    pill: "bg-ink text-canvas",
    label: "returning",
  },
};

const phaseLabels = {
  calling: "Calling down: frames pile up ↑",
  unwinding: "Unwinding: results return ↓",
};

const MIN_ROWS = 3;
/** Room under the frames for the "call stack" label. */
const FLOOR = "1.5rem";
const rowBottom = (row: number) => `calc(${FLOOR} + var(--row) * ${row})`;

export default function CallStackVisualizer({ visual }: VisualizerProps<"callStack">) {
  const { frames, carry, entering, phase, output, caption } = visual;
  const rows = Math.max(MIN_ROWS, frames.length);
  const rowOf = (id: string) => frames.findIndex((frame) => frame.id === id);

  return (
    <figure
      className="flex w-full flex-col items-center gap-3"
      style={
        {
          "--card": "min(18rem, 66cqi)",
          "--side": "min(6rem, 28cqi)",
          "--row": "3.25rem",
        } as CSSProperties
      }
    >
      <p
        className="h-6 rounded-full px-3 text-xs leading-6 font-semibold text-muted"
        aria-live="polite"
      >
        {phase ? phaseLabels[phase] : ""}
      </p>

      <div
        className="relative"
        style={{
          width: "calc(var(--card) + var(--side))",
          height: `calc(${rowBottom(rows)})`,
        }}
      >
        <div
          aria-hidden
          className="absolute border-t-2 border-line"
          style={{ left: 0, width: "var(--card)", bottom: `calc(${FLOOR} - 0.25rem)` }}
        />
        <span
          aria-hidden
          className="absolute text-xs text-muted"
          style={{ left: 0, width: "var(--card)", bottom: 0, textAlign: "center" }}
        >
          call stack
        </span>

        {frames.map((frame, index) => {
          const style = statusStyles[frame.status];
          return (
            <div
              key={frame.id}
              className={[
                "viz-motion absolute flex flex-col justify-center rounded-lg border-2 px-3",
                style.card,
                entering === frame.id ? "viz-drop" : "",
              ].join(" ")}
              style={{
                left: 0,
                width: "var(--card)",
                height: "calc(var(--row) - 0.4rem)",
                bottom: rowBottom(index),
              }}
              aria-label={`${frame.call}: ${style.label}${frame.detail ? `, ${frame.detail}` : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-sm font-bold text-ink">
                  {frame.call}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] leading-none font-semibold ${style.pill}`}
                >
                  {style.label}
                </span>
              </div>
              {frame.detail && (
                <span className="mt-1 truncate font-mono text-xs">{frame.detail}</span>
              )}
            </div>
          );
        })}

        {carry && rowOf(carry.frameId) >= 0 && (
          <div
            key={carry.id}
            className="viz-motion absolute flex flex-col items-start"
            style={{
              left: "calc(var(--card) + 0.6rem)",
              bottom: `calc(${rowBottom(rowOf(carry.frameId))} + 0.35rem)`,
            }}
            aria-label={`${carry.label ?? "value"}: ${carry.value}`}
          >
            {carry.label && (
              <span className="text-[0.65rem] font-semibold text-muted">{carry.label}</span>
            )}
            <span className="rounded-lg border-2 border-accent bg-white px-2 py-0.5 font-mono text-base font-bold text-accent">
              {carry.value}
            </span>
          </div>
        )}
      </div>

      {output && (
        <div
          className="flex min-h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-sm"
          style={{ width: "calc(var(--card) + var(--side))" }}
          aria-label={`printed: ${output.join(" ") || "nothing yet"}`}
        >
          <span className="text-xs font-semibold text-muted">printed</span>
          <span className="text-ink">{output.join(" ") || "—"}</span>
        </div>
      )}

      {caption && <figcaption className="text-center text-sm text-muted">{caption}</figcaption>}
    </figure>
  );
}
