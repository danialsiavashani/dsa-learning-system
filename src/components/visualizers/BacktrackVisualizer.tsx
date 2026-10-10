import type { CSSProperties } from "react";
import type { BacktrackVisual } from "@/lib/learning/schema";
import type { VisualizerProps } from "./registry";

/**
 * Renders a backtracking search: the decision tree on top (each node a
 * partial candidate), and below it the one shared mutable list `current` and
 * the saved `result` snapshots.
 *
 * Undo is the move this visual exists for: the removed chip is the same
 * element that sat in `current`, so it visibly lifts out of its slot, struck
 * through, while the rest of the list stays put.
 */

const SLOT = 70;
const LEVEL = 52;
const NODE_H = 24;

type State = BacktrackVisual["nodes"][number]["state"];

const nodeStyle: Record<State, { box: string; text: string; dash?: string }> = {
  unexplored: { box: "fill-white stroke-line opacity-60", text: "fill-muted" },
  explored: { box: "fill-white stroke-muted", text: "fill-ink" },
  solution: { box: "fill-fresh-soft stroke-fresh", text: "fill-ink" },
  pruned: { box: "fill-white stroke-miss", text: "fill-miss", dash: "4 3" },
  cut: { box: "fill-white stroke-line opacity-30", text: "fill-muted", dash: "2 3" },
};

function layout(visual: BacktrackVisual) {
  const children = new Map<string, string[]>();
  let root = visual.nodes[0].id;
  for (const node of visual.nodes) {
    if (node.parent === null) root = node.id;
    else children.set(node.parent, [...(children.get(node.parent) ?? []), node.id]);
  }
  const positions = new Map<string, { x: number; y: number }>();
  let leaf = 0;
  let depthMax = 0;
  const place = (id: string, depth: number): number => {
    depthMax = Math.max(depthMax, depth);
    const kids = children.get(id) ?? [];
    const x = kids.length === 0 ? (leaf++ + 0.5) * SLOT : kids.map((kid) => place(kid, depth + 1)).reduce((a, b) => a + b, 0) / kids.length;
    positions.set(id, { x, y: depth * LEVEL + NODE_H / 2 + 4 });
    return x;
  };
  place(root, 0);
  return { positions, width: Math.max(leaf, 1) * SLOT, height: depthMax * LEVEL + NODE_H + 8 };
}

const boxWidth = (label: string) => Math.max(30, label.length * 7.4 + 12);

export default function BacktrackVisualizer({ visual }: VisualizerProps<"backtrack">) {
  const { nodes, path = [], current, added, removed, results = [], caption } = visual;
  const { positions, width, height } = layout(visual);
  const onPath = new Set(path);
  const active = path[path.length - 1];
  const activePos = active ? positions.get(active) : undefined;
  const activeLabel = nodes.find((node) => node.id === active)?.label ?? "";
  const isPathEdge = (parent: string, child: string) => {
    const i = path.indexOf(parent);
    return i >= 0 && path[i + 1] === child;
  };

  // Current chips and the chip being removed share one keyed list, so the
  // removed chip keeps its element and slides out of the slot it occupied.
  const chips = [
    ...current.map((chip, index) => ({ ...chip, index, leaving: false })),
    ...(removed ? [{ ...removed, index: current.length, leaving: true }] : []),
  ];
  const slots = Math.max(current.length + (removed ? 1 : 0), 3);

  return (
    <figure className="flex w-full flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-[34rem]"
        style={{ maxHeight: "14rem" }}
        role="img"
        aria-label="Decision tree"
      >
        {nodes.map((node) => {
          if (node.parent === null) return null;
          const a = positions.get(node.parent)!;
          const b = positions.get(node.id)!;
          const hot = isPathEdge(node.parent, node.id);
          return (
            <line
              key={`edge-${node.id}`}
              x1={a.x}
              y1={a.y + NODE_H / 2}
              x2={b.x}
              y2={b.y - NODE_H / 2}
              className={[
                "transition-[stroke,opacity] duration-300",
                hot ? "stroke-accent" : "stroke-line",
                node.state === "cut" ? "opacity-30" : "",
              ].join(" ")}
              strokeWidth={hot ? 3 : 1.5}
              strokeDasharray={node.state === "pruned" || node.state === "cut" ? "4 3" : undefined}
            />
          );
        })}

        {nodes.map((node) => {
          const { x, y } = positions.get(node.id)!;
          const w = boxWidth(node.label);
          const style = nodeStyle[node.state];
          const hot = onPath.has(node.id);
          return (
            <g key={node.id} aria-label={`${node.label}: ${node.state}${node.id === active ? ", active" : ""}`}>
              <rect
                x={x - w / 2}
                y={y - NODE_H / 2}
                width={w}
                height={NODE_H}
                rx={6}
                className={`transition-[fill,stroke,opacity] duration-300 ${hot ? "fill-accent-soft stroke-accent" : style.box}`}
                strokeWidth={hot ? 2 : 1.5}
                strokeDasharray={style.dash}
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                className={`font-mono ${hot ? "fill-ink" : style.text}`}
              >
                {node.label}
              </text>
              {node.state === "pruned" && (
                <text x={x + w / 2 + 3} y={y + 4} fontSize={12} fontWeight={700} className="fill-miss">
                  ✕
                </text>
              )}
            </g>
          );
        })}

        {/* The frame in control: one ring that travels through the tree. */}
        {activePos && (
          <g className="viz-motion" style={{ transform: `translate(${activePos.x}px, ${activePos.y}px)` }}>
            <rect
              x={-boxWidth(activeLabel) / 2 - 4}
              y={-NODE_H / 2 - 4}
              width={boxWidth(activeLabel) + 8}
              height={NODE_H + 8}
              rx={9}
              className="fill-none stroke-accent"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      <div className="flex w-full max-w-[30rem] items-end gap-3">
        <span className="mb-2 w-14 shrink-0 text-right text-xs font-semibold text-muted">current</span>
        <div
          className="relative"
          style={
            {
              "--chip": "2.5rem",
              "--gap": "0.4rem",
              width: `calc(${slots} * (var(--chip) + var(--gap)))`,
              height: "calc(var(--chip) + 1.9rem)",
            } as CSSProperties
          }
          aria-label={`current = [${current.map((c) => c.value).join(", ")}]`}
        >
          {chips.map((chip) => (
            <div
              key={chip.id}
              className={[
                "viz-motion absolute flex items-center justify-center rounded-lg border-2 font-mono text-lg font-bold",
                chip.leaving
                  ? "border-miss bg-white text-miss line-through opacity-80"
                  : chip.id === added
                    ? "viz-drop border-fresh bg-fresh-soft text-ink"
                    : "border-accent bg-accent-soft text-ink",
              ].join(" ")}
              style={{
                width: "var(--chip)",
                height: "var(--chip)",
                left: `calc(${chip.index} * (var(--chip) + var(--gap)))`,
                top: chip.leaving ? "0rem" : "1.9rem",
              }}
              aria-label={chip.leaving ? `removed ${chip.value}` : `current item ${chip.value}`}
            >
              {chip.value}
              {chip.leaving && (
                <span className="absolute -top-4 text-[0.65rem] font-semibold whitespace-nowrap text-miss no-underline">
                  removed
                </span>
              )}
            </div>
          ))}
          {current.length === 0 && !removed && (
            <span className="absolute font-mono text-sm text-muted" style={{ top: "2.5rem" }}>
              [ ] empty
            </span>
          )}
        </div>
      </div>

      <div className="flex w-full max-w-[30rem] items-start gap-3">
        <span className="mt-1 w-14 shrink-0 text-right text-xs font-semibold text-muted">result</span>
        <ul className="flex min-h-7 flex-wrap gap-1.5" aria-label="result">
          {results.length === 0 && <li className="font-mono text-sm text-muted">[ ]</li>}
          {results.map((result) => (
            <li
              key={result.id}
              className={[
                "rounded-md border px-1.5 py-0.5 font-mono text-xs font-semibold",
                result.fresh ? "viz-drop border-fresh bg-fresh-soft" : "border-line bg-white",
              ].join(" ")}
            >
              {result.label}
            </li>
          ))}
        </ul>
      </div>

      {caption && <figcaption className="text-center text-sm text-muted">{caption}</figcaption>}
    </figure>
  );
}
