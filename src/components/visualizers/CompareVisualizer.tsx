import QueueVisualizer from "./QueueVisualizer";
import type { VisualizerProps } from "./registry";
import StackVisualizer from "./StackVisualizer";

/**
 * Two structures side by side (stacked on narrow screens), each drawn by its
 * own visualizer. Panes are keyed by ID, so each keeps its values' identities
 * and animates independently between states.
 */
export default function CompareVisualizer({ visual }: VisualizerProps<"compare">) {
  return (
    <figure className="flex w-full flex-col items-center">
      <div className="grid w-full grid-cols-1 items-end gap-x-6 gap-y-8 @md:grid-cols-2">
        {visual.panes.map((pane) => (
          <div key={pane.id} className="@container flex flex-col items-center">
            <p className="mb-3 text-sm font-semibold text-ink">{pane.label}</p>
            {pane.visual.kind === "stack" ? (
              <StackVisualizer visual={pane.visual} />
            ) : (
              <QueueVisualizer visual={pane.visual} />
            )}
          </div>
        ))}
      </div>
      {visual.caption && <figcaption className="mt-5 text-center text-sm text-muted">{visual.caption}</figcaption>}
    </figure>
  );
}
