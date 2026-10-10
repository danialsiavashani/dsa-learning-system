import type { CSSProperties } from "react";
import type { QueueVisual, VisualMark } from "@/lib/learning/schema";
import type { VisualizerProps } from "./registry";

/**
 * Renders a queue (or deque) as an open-ended lane, front on the left. Items
 * are keyed by ID and positioned by place in line, so when the front leaves,
 * it slides out through the front end while everyone behind it moves up one
 * place; a waiting value slides in through the back. The lane is drawn wider
 * than the line so newcomers always have somewhere to join.
 *
 * This is the abstract picture of a line, not an array: positions are places
 * in the queue, so there are no indices.
 */

const markStyles: Record<VisualMark, string> = {
  focus: "scale-105 border-accent bg-accent-soft",
  moved: "border-moved bg-moved-soft",
  new: "border-fresh bg-fresh-soft",
  muted: "border-line bg-panel opacity-45",
};

/** Places drawn in the lane even when fewer values wait. */
const MIN_LANE = 4;
/** Width of the zone outside each end, in slots. */
const ZONE = 1.15;

type Cell = {
  id: string;
  value: number | string;
  /** Left edge, as a CSS length. */
  left: string;
  outside?: { end: "front" | "back"; label: string; kind: "leaving" | "waiting" };
};

export default function QueueVisualizer({ visual }: VisualizerProps<"queue">) {
  const { items, marks = {}, entering, leaving, waiting, peek, hideEnds, caption, variant } = visual;
  const lane = Math.max(MIN_LANE, items.length);
  const n = items.length;

  const inLane = (place: number) => `calc(var(--slot) * ${ZONE} + var(--slot) * ${place} + var(--pad))`;
  const outsideAt = (end: "front" | "back") =>
    end === "front"
      ? "calc(var(--slot) * 0.1)"
      : `calc(var(--slot) * ${ZONE} + var(--slot) * ${lane} + var(--slot) * 0.25 + var(--pad))`;

  const cells: Cell[] = [
    ...items.map((item, place) => ({ ...item, left: inLane(place) })),
    ...[leaving && { ...leaving, kind: "leaving" as const }, waiting && { ...waiting, kind: "waiting" as const }]
      .filter((cell) => !!cell)
      .map((cell) => ({
        id: cell.id,
        value: cell.value,
        left: outsideAt(cell.end),
        outside: { end: cell.end, label: cell.label, kind: cell.kind },
      })),
  ];

  const peekPlace = peek ? (peek.end === "front" ? 0 : n - 1) : undefined;
  const peekId = peekPlace === undefined ? undefined : items[peekPlace]?.id;
  const cellText = (value: number | string) =>
    typeof value === "number" ? "font-bold" : "font-mono font-semibold";

  return (
    <figure className="flex w-full flex-col items-center">
      <div
        className="relative"
        style={
          {
            "--slot": `min(4.25rem, calc(100cqi / ${lane + ZONE * 2 + 0.4}))`,
            "--cell": "calc(var(--slot) * 0.84)",
            "--pad": "calc(var(--slot) * 0.08)",
            "--top": "1.75rem",
            width: `calc(var(--slot) * ${lane + ZONE * 2 + 0.4})`,
            height: "calc(var(--top) + var(--cell) + var(--pad) * 2 + 2.75rem)",
          } as CSSProperties
        }
      >
        {/* The lane: open at both ends. */}
        <div
          aria-hidden
          className="absolute border-y-2 border-line"
          style={{
            left: `calc(var(--slot) * ${ZONE})`,
            width: `calc(var(--slot) * ${lane} + var(--pad) * 2)`,
            top: "var(--top)",
            height: "calc(var(--cell) + var(--pad) * 2)",
          }}
        />

        {!hideEnds && <EndHints variant={variant} lane={lane} />}

        {n === 0 && (
          <span
            className="absolute flex items-center justify-center text-sm text-muted"
            style={{
              left: `calc(var(--slot) * ${ZONE})`,
              width: `calc(var(--slot) * ${lane})`,
              top: "var(--top)",
              height: "calc(var(--cell) + var(--pad) * 2)",
            }}
          >
            empty
          </span>
        )}

        {!hideEnds && n > 0 && (
          <>
            <EndLabel left={inLane(0)} text={n === 1 ? "front · back" : "front"} />
            {/* Kept mounted when front and back coincide, so it can slide back out. */}
            <EndLabel left={inLane(n - 1)} text="back" hidden={n === 1} />
          </>
        )}

        {cells.map((cell) => {
          const mark = marks[cell.id] ?? (entering?.id === cell.id ? "new" : peekId === cell.id ? "focus" : undefined);
          const outside = cell.outside;
          const enterClass =
            entering?.id === cell.id ? (entering.end === "back" ? "viz-from-back" : "viz-from-front") : "";
          return (
            <div
              key={cell.id}
              className={["viz-motion absolute", enterClass].join(" ")}
              style={{
                left: cell.left,
                top: "calc(var(--top) + var(--pad))",
                width: "var(--cell)",
                height: "var(--cell)",
              }}
              aria-label={
                outside
                  ? `${outside.label}`
                  : n === 1
                    ? `front and back: ${cell.value}`
                    : cell.id === items[0].id
                      ? `front: ${cell.value}`
                      : cell.id === items[n - 1].id
                        ? `back: ${cell.value}`
                        : `in line: ${cell.value}`
              }
            >
              <div
                className={[
                  "viz-motion flex h-full w-full items-center justify-center rounded-lg border-2",
                  mark ? markStyles[mark] : outside ? "border-accent bg-white" : "border-line bg-panel",
                  outside ? "border-dashed" : "",
                  outside?.kind === "leaving" ? "opacity-80" : "",
                ].join(" ")}
              >
                <span
                  className={cellText(cell.value)}
                  style={{
                    fontSize:
                      typeof cell.value === "number" ? "calc(var(--cell) * 0.36)" : "calc(var(--cell) * 0.24)",
                  }}
                >
                  {cell.value}
                </span>
              </div>
              {outside && (
                <span
                  className={[
                    "absolute top-full mt-1.5 font-mono text-xs font-semibold whitespace-nowrap text-accent",
                    outside.end === "front" ? "left-0" : "right-0",
                  ].join(" ")}
                >
                  {outside.label}
                </span>
              )}
            </div>
          );
        })}

        {peek && peekPlace !== undefined && (
          <span
            className="viz-motion absolute -translate-x-1/2 text-center font-mono text-xs font-semibold whitespace-nowrap text-accent"
            style={{
              left: `calc(${inLane(peekPlace)} + var(--cell) / 2)`,
              top: "calc(var(--top) + var(--cell) + var(--pad) * 2 + 0.375rem)",
            }}
          >
            <span aria-hidden>↑ </span>
            {peek.label}
          </span>
        )}
      </div>

      {caption && <figcaption className="mt-3 text-center text-sm text-muted">{caption}</figcaption>}
    </figure>
  );
}

function EndLabel({ left, text, hidden = false }: { left: string; text: string; hidden?: boolean }) {
  return (
    <span
      aria-hidden
      className={[
        "viz-motion absolute top-0 flex -translate-x-1/2 flex-col items-center text-xs font-semibold whitespace-nowrap text-accent",
        hidden ? "opacity-0" : "",
      ].join(" ")}
      style={{ left: `calc(${left} + var(--cell) / 2)` }}
    >
      <span>{text}</span>
      <span className="leading-none">▾</span>
    </span>
  );
}

/** Which way values travel at each end: a queue has one way in and one way out. */
function EndHints({ variant, lane }: { variant: QueueVisual["variant"]; lane: number }) {
  const hint = "absolute top-0 flex items-start justify-center text-xs whitespace-nowrap text-muted";
  const zone = (left: string): CSSProperties => ({ left, width: `calc(var(--slot) * ${ZONE})`, height: "var(--top)" });
  const deque = variant === "deque";
  return (
    <>
      <span className={hint} style={zone("0px")}>
        {deque ? "in ⇄ out" : "← out"}
      </span>
      <span className={hint} style={zone(`calc(var(--slot) * ${ZONE + lane} + var(--pad) * 2)`)}>
        {deque ? "in ⇄ out" : "← in"}
      </span>
    </>
  );
}
