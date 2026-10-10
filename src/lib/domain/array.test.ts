import { describe, expect, it } from "vitest";
import {
  ArrayOperationError,
  insertAt,
  itemsFromValues,
  readAt,
  valuesOf,
} from "./array";

const items = itemsFromValues([4, 8, 2, 9, 3]);

describe("insertAt", () => {
  it("inserts in the middle and shifts everything from the index onward", () => {
    const result = insertAt(items, 2, 7, "new");

    expect(valuesOf(result.after)).toEqual([4, 8, 7, 2, 9, 3]);
    expect(valuesOf(result.shifted)).toEqual([2, 9, 3]);
    expect(valuesOf(result.unchanged)).toEqual([4, 8]);
    expect(result.index).toBe(2);
    expect(result.insertedId).toBe("new");
  });

  it("keeps the identity of every existing item", () => {
    const result = insertAt(items, 2, 7, "new");

    expect(result.after.map((item) => item.id)).toEqual([
      "i0",
      "i1",
      "new",
      "i2",
      "i3",
      "i4",
    ]);
    // Same object references: the shifted values are moved, not recreated.
    expect(result.after[3]).toBe(items[2]);
    expect(result.shifted.map((item) => item.id)).toEqual(["i2", "i3", "i4"]);
  });

  it("opens a gap that the inserted item later fills", () => {
    const result = insertAt(items, 1, 5, "new");

    expect(valuesOf(result.opened)).toEqual([4, null, 8, 2, 9, 3]);
    expect(result.opened[1].id).toBe("new");
  });

  it("shifts every item when inserting at the front", () => {
    const result = insertAt(items, 0, 1, "new");

    expect(valuesOf(result.after)).toEqual([1, 4, 8, 2, 9, 3]);
    expect(result.shifted).toHaveLength(5);
    expect(result.unchanged).toHaveLength(0);
  });

  it("shifts nothing when appending at the end", () => {
    const result = insertAt(items, 5, 6, "new");

    expect(valuesOf(result.after)).toEqual([4, 8, 2, 9, 3, 6]);
    expect(result.shifted).toEqual([]);
    expect(result.unchanged).toHaveLength(5);
  });

  it("does not mutate its input", () => {
    insertAt(items, 2, 7, "new");
    expect(valuesOf(items)).toEqual([4, 8, 2, 9, 3]);
  });

  it.each([-1, 6, 1.5, Number.NaN])("rejects index %s", (index) => {
    expect(() => insertAt(items, index, 7, "new")).toThrow(ArrayOperationError);
  });

  it("rejects an inserted id that is already in use", () => {
    expect(() => insertAt(items, 2, 7, "i0")).toThrow(ArrayOperationError);
  });
});

describe("readAt", () => {
  it("returns the item at a valid index", () => {
    expect(readAt(items, 4).value).toBe(3);
  });

  it("rejects indices outside the array", () => {
    expect(() => readAt(items, 5)).toThrow(ArrayOperationError);
    expect(() => readAt(items, -1)).toThrow(ArrayOperationError);
  });
});
