import type { ComponentType } from "react";
import type { VisualState } from "@/lib/learning/schema";
import AnimatedArray from "./AnimatedArray";
import BacktrackVisualizer from "./BacktrackVisualizer";
import CallStackVisualizer from "./CallStackVisualizer";
import StackVisualizer from "./StackVisualizer";
import TreeVisualizer from "./TreeVisualizer";

export type VisualKind = VisualState["kind"];

export type VisualizerProps<K extends VisualKind> = {
  visual: Extract<VisualState, { kind: K }>;
};

/**
 * One visualizer per visual-state kind. Adding a structure (stack, tree, ...)
 * means adding its schema variant and an entry here; TypeScript flags a
 * missing entry.
 */
export const visualizers: { [K in VisualKind]: ComponentType<VisualizerProps<K>> } = {
  array: AnimatedArray,
  stack: StackVisualizer,
  callStack: CallStackVisualizer,
  tree: TreeVisualizer,
  backtrack: BacktrackVisualizer,
};
