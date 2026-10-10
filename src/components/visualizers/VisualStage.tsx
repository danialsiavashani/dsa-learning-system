import type { ComponentType } from "react";
import type { VisualState } from "@/lib/learning/schema";
import { visualizers, type VisualizerProps, type VisualKind } from "./registry";

type VisualStageProps = {
  visual: VisualState | undefined;
  /** Snap to the state without transitions (used by Replay's rewind). */
  instant?: boolean;
};

export default function VisualStage({ visual, instant = false }: VisualStageProps) {
  if (!visual) {
    return (
      <div className="flex min-h-[320px] items-center justify-center lg:h-full lg:min-h-0">
        <p className="text-muted">No visual for this step.</p>
      </div>
    );
  }

  const Visualizer = visualizers[visual.kind] as ComponentType<
    VisualizerProps<VisualKind>
  >;

  return (
    <div
      className={[
        "@container flex min-h-[320px] items-center justify-center lg:h-full lg:min-h-0",
        instant ? "viz-instant" : "",
      ].join(" ")}
    >
      <Visualizer visual={visual} />
    </div>
  );
}
