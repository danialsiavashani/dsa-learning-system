import type { TreeVisual } from "@/lib/learning/schema";
import type { VisualizerProps } from "./registry";

/**
 * Renders a binary tree as SVG (so it scales to any width), with DFS state:
 * one cursor ring travels along the edges to the active call, edges on the
 * call path are drawn in the accent colour, processed nodes are filled and
 * numbered in visit order, and unexplored nodes stay quiet. A compact call
 * stack beside the tree lists the calls in progress.
 */

const SLOT = 56;
const LEVEL = 66;
const R = 18;
const PAD_X = SLOT * 0.4;
const NULL_DX = SLOT * 0.42;
const NULL_DY = LEVEL * 0.72;

type Layout = Map<string, { x: number; y: number }>;

/** Display layout only: x from in-order position, y from depth. */
function layout(visual: TreeVisual): { positions: Layout; width: number; height: number } {
  const byId = new Map(visual.nodes.map((node) => [node.id, node]));
  const positions: Layout = new Map();
  let column = 0;
  let levels = 0;
  const place = (id: string | null, depth: number) => {
    const node = id === null ? undefined : byId.get(id);
    if (!node) return;
    place(node.left, depth + 1);
    positions.set(node.id, { x: PAD_X + (column + 0.5) * SLOT, y: (depth - 0.5) * LEVEL + 8 });
    column++;
    levels = Math.max(levels, depth);
    place(node.right, depth + 1);
  };
  place(visual.root, 1);
  return {
    positions,
    width: column * SLOT + PAD_X * 2,
    // Room below the last level for a null stub and tags.
    height: levels * LEVEL + NULL_DY,
  };
}

export default function TreeVisualizer({ visual }: VisualizerProps<"tree">) {
  const { nodes, path, visited, nullAt, marks = {}, tags = {}, caption } = visual;
  const { positions, width, height } = layout(visual);
  const traversing = path !== undefined || visited !== undefined;
  const onPath = new Set(path ?? []);
  const visitIndex = new Map((visited ?? []).map((id, i) => [id, i + 1]));
  const active = nullAt ? undefined : path?.[path.length - 1];
  const valueOf = new Map(nodes.map((node) => [node.id, node.value]));

  const nullStub = nullAt
    ? (() => {
        const parent = positions.get(nullAt.parent)!;
        return { x: parent.x + (nullAt.side === "left" ? -NULL_DX : NULL_DX), y: parent.y + NULL_DY, parent };
      })()
    : undefined;
  const cursor = nullStub ?? (active ? positions.get(active) : undefined);

  const isPathEdge = (from: string, to: string) => {
    const i = (path ?? []).indexOf(from);
    return i >= 0 && path?.[i + 1] === to;
  };

  const frames = [
    ...(path ?? []).map((id) => ({ key: id, label: `dfs(${valueOf.get(id)})` })),
    ...(nullAt ? [{ key: "null-frame", label: "dfs(null)" }] : []),
  ];

  return (
    <figure className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full flex-col items-center gap-4 @md:flex-row @md:items-end @md:justify-center">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-[34rem] @md:flex-1"
          style={{ maxHeight: "20rem" }}
          role="img"
          aria-label={`Binary tree with ${nodes.length} nodes`}
        >
          {/* Edges */}
          {nodes.flatMap((node) =>
            (["left", "right"] as const).flatMap((side) => {
              const child = node[side];
              if (child === null) return [];
              const a = positions.get(node.id)!;
              const b = positions.get(child)!;
              const hot = isPathEdge(node.id, child);
              const muted = marks[child] === "muted" || marks[node.id] === "muted";
              return [
                <line
                  key={`${node.id}-${child}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={[
                    "transition-[stroke,stroke-width,opacity] duration-300",
                    hot ? "stroke-accent" : "stroke-line",
                    muted ? "opacity-30" : "",
                  ].join(" ")}
                  strokeWidth={hot ? 3.5 : 2}
                />,
              ];
            }),
          )}

          {/* The base case: an empty slot being called. */}
          {nullStub && (
            <g aria-label={`dfs(null): no ${nullAt?.side} child`}>
              <line
                x1={nullStub.parent.x}
                y1={nullStub.parent.y}
                x2={nullStub.x}
                y2={nullStub.y - 9}
                className="stroke-accent"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
              <rect
                x={nullStub.x - 17}
                y={nullStub.y - 9}
                width={34}
                height={18}
                rx={5}
                className="fill-white stroke-accent"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <text x={nullStub.x} y={nullStub.y + 4} textAnchor="middle" className="fill-accent font-mono" fontSize={10}>
                null
              </text>
            </g>
          )}

          {/* Nodes */}
          {nodes.map((node) => {
            const { x, y } = positions.get(node.id)!;
            const order = visitIndex.get(node.id);
            const mark = marks[node.id];
            const isActive = node.id === active;
            const quiet = traversing && !order && !onPath.has(node.id);
            const fill = order
              ? "fill-fresh-soft"
              : isActive || mark === "focus"
                ? "fill-accent-soft"
                : "fill-white";
            const stroke =
              isActive || onPath.has(node.id) || mark === "focus"
                ? "stroke-accent"
                : order
                  ? "stroke-fresh"
                  : "stroke-line";
            return (
              <g
                key={node.id}
                className={["transition-opacity duration-300", mark === "muted" ? "opacity-30" : ""].join(" ")}
                aria-label={`node ${node.value}${isActive ? ", active call" : onPath.has(node.id) ? ", waiting call" : ""}${order ? `, visited #${order}` : ""}`}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={R}
                  className={`transition-[fill,stroke] duration-300 ${fill} ${stroke}`}
                  strokeWidth={onPath.has(node.id) || isActive ? 2.5 : 2}
                />
                <text
                  x={x}
                  y={y + 5}
                  textAnchor="middle"
                  fontSize={15}
                  fontWeight={700}
                  className={`transition-[fill] duration-300 ${quiet ? "fill-muted" : "fill-ink"}`}
                >
                  {node.value}
                </text>
                {order !== undefined && (
                  <g>
                    <circle cx={x + R * 0.8} cy={y - R * 0.8} r={8} className="fill-fresh" />
                    <text x={x + R * 0.8} y={y - R * 0.8 + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} className="fill-white">
                      {order}
                    </text>
                  </g>
                )}
                {tags[node.id] && (
                  <text x={x} y={y + R + 14} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-accent">
                    {tags[node.id]}
                  </text>
                )}
              </g>
            );
          })}

          {/* The active call: one ring that travels between nodes. */}
          {cursor && (
            <g className="viz-motion" style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}>
              <circle r={nullStub ? 15 : R + 5} className="fill-none stroke-accent" strokeWidth={2.5} />
            </g>
          )}
        </svg>

        {path !== undefined && (
          <div className="flex w-full flex-col items-center @md:w-28" aria-label="call stack">
            <ol className="flex w-full max-w-[18rem] flex-col-reverse gap-1 @md:max-w-none">
              {frames.length === 0 && (
                <li className="rounded-md border border-dashed border-line px-2 py-1 text-center font-mono text-xs text-muted">
                  empty
                </li>
              )}
              {frames.map((frame, i) => (
                <li
                  key={frame.key}
                  className={[
                    "rounded-md border px-2 py-1 text-center font-mono text-xs font-semibold transition-colors duration-300",
                    i === frames.length - 1
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line bg-panel text-muted",
                  ].join(" ")}
                >
                  {frame.label}
                </li>
              ))}
            </ol>
            <span className="mt-1 text-xs text-muted">call stack</span>
          </div>
        )}
      </div>

      {visited !== undefined && (
        <p className="text-sm text-muted" aria-label="visit order">
          visited:{" "}
          <span className="font-mono font-semibold text-ink">
            {visited.map((id) => valueOf.get(id)).join(" ") || "—"}
          </span>
        </p>
      )}
      {caption && <figcaption className="text-center text-sm text-muted">{caption}</figcaption>}
    </figure>
  );
}
