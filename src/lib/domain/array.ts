/**
 * Deterministic array operations. These pure functions are the source of
 * truth for every array lesson and generated exercise: visualizers render
 * their output, validators compare claims against it, and answer keys are
 * derived from it.
 *
 * Items carry stable IDs so the same logical value can be tracked (and
 * animated) across states. A `null` value is an empty slot.
 */

export type ArrayItem = {
  id: string;
  value: number | null;
};

export type InsertionResult = {
  before: ArrayItem[];
  /** State after the values from `index` onward moved right, leaving a gap. */
  opened: ArrayItem[];
  after: ArrayItem[];
  index: number;
  value: number;
  insertedId: string;
  /** Items that move one position to the right, in their original order. */
  shifted: ArrayItem[];
  /** Items whose position does not change. */
  unchanged: ArrayItem[];
};

export class ArrayOperationError extends Error {}

/** Builds items with positional IDs: [4, 8] -> [{ id: "i0", 4 }, { id: "i1", 8 }]. */
export function itemsFromValues(values: number[], idPrefix = "i"): ArrayItem[] {
  return values.map((value, position) => ({
    id: `${idPrefix}${position}`,
    value,
  }));
}

export function valuesOf(items: ArrayItem[]): (number | null)[] {
  return items.map((item) => item.value);
}

export function readAt(items: ArrayItem[], index: number): ArrayItem {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    throw new ArrayOperationError(
      `Index ${index} is outside 0..${items.length - 1}.`,
    );
  }
  return items[index];
}

/** Replaces the value at `index` in place: same item, same position, new value. */
export function updateAt(items: ArrayItem[], index: number, value: number): ArrayItem[] {
  const target = readAt(items, index);
  return items.map((item) => (item === target ? { ...item, value } : item));
}

export type RemovalResult = {
  before: ArrayItem[];
  /** State after the value at `index` is taken out, leaving a gap in its slot. */
  opened: ArrayItem[];
  after: ArrayItem[];
  index: number;
  removed: ArrayItem;
  /** Items that move one position to the left, in their original order. */
  shifted: ArrayItem[];
  /** Items whose position does not change. */
  unchanged: ArrayItem[];
};

/**
 * Removes the item at `index` (0 <= index < length), shifting every later
 * item one position left to close the gap. Removing the last item shifts
 * nothing.
 */
export function removeAt(items: ArrayItem[], index: number): RemovalResult {
  const removed = readAt(items, index);
  return {
    before: items,
    opened: items.map((item) => (item === removed ? { id: item.id, value: null } : item)),
    after: items.filter((item) => item !== removed),
    index,
    removed,
    shifted: items.slice(index + 1),
    unchanged: items.slice(0, index),
  };
}

/**
 * Inserts `value` at `index` (0 <= index <= length), shifting every item at
 * or after `index` one position right. Inserting at `length` appends and
 * shifts nothing.
 */
export function insertAt(
  items: ArrayItem[],
  index: number,
  value: number,
  insertedId: string,
): InsertionResult {
  if (!Number.isInteger(index) || index < 0 || index > items.length) {
    throw new ArrayOperationError(
      `Insertion index ${index} is outside 0..${items.length}.`,
    );
  }
  if (items.some((item) => item.id === insertedId)) {
    throw new ArrayOperationError(`ID "${insertedId}" is already in use.`);
  }

  const leading = items.slice(0, index);
  const shifted = items.slice(index);
  const inserted: ArrayItem = { id: insertedId, value };

  return {
    before: items,
    opened: [...leading, { id: insertedId, value: null }, ...shifted],
    after: [...leading, inserted, ...shifted],
    index,
    value,
    insertedId,
    shifted,
    unchanged: leading,
  };
}
