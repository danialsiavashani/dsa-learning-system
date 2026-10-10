import {
  describeOperation,
  OPERATION_SEMANTICS,
  type DequeOperation,
  type DequeStep,
  type QueueItem,
  type QueueValue,
} from "@/lib/domain/queue";
import type { QueueVisualInput } from "@/lib/learning/schema";

/**
 * Shared queue/deque material: how a domain step is shown (who enters, who
 * leaves, which end is read) and how an operation reads in Java. The lesson
 * and the generated exercises both use it, so they draw every state the same
 * way.
 */

export type QueueVariant = "queue" | "deque";

/** "queue.offer(4)" or "deque.pollLast()". */
export function javaCall(operation: DequeOperation<QueueValue>, receiver: string): string {
  return `${receiver}.${describeOperation(operation)}`;
}

/**
 * The visual after one step. Additions slide in through their end, removals
 * are shown just outside the end they left by, and reads highlight an end.
 */
export function stepVisual<V extends QueueValue>(
  step: DequeStep<V>,
  variant: QueueVariant,
  extra: Partial<QueueVisualInput> = {},
): QueueVisualInput {
  const base = { kind: "queue" as const, variant, items: step.after };
  const call = describeOperation(step.operation);
  const { outcome } = step;
  switch (outcome.type) {
    case "add":
      return { ...base, entering: { id: outcome.item.id, end: outcome.end }, ...extra };
    case "remove":
      return {
        ...base,
        leaving: { ...outcome.item, end: outcome.end, label: `${call} → ${outcome.item.value}` },
        ...extra,
      };
    case "examine":
      return { ...base, peek: { end: outcome.end, label: `${call} → ${outcome.item.value}` }, ...extra };
    case "empty":
      return { ...base, caption: `${call} → null: nothing is waiting`, ...extra };
  }
}

/** A value about to be added, shown just outside the end it will enter by. */
export function waitingVisual<V extends QueueValue>(
  items: QueueItem<V>[],
  operation: DequeOperation<V> & { value: V },
  id: string,
  variant: QueueVariant,
  extra: Partial<QueueVisualInput> = {},
): QueueVisualInput {
  return {
    kind: "queue",
    variant,
    items,
    waiting: { id, value: operation.value, end: OPERATION_SEMANTICS[operation.type].end, label: describeOperation(operation) },
    ...extra,
  };
}

/** "{4, 8, 2} (front → back)" or "an empty queue". */
export function describeLine(values: readonly QueueValue[], noun: QueueVariant = "queue"): string {
  return values.length === 0 ? `an empty ${noun}` : `{${values.join(", ")}} (front → back)`;
}
