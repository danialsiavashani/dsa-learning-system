/**
 * Shared array concept material: Java code that both the canonical lesson and
 * the generated insertion exercises reference, with named line numbers so
 * steps highlight by meaning rather than by magic number.
 *
 * Java arrays have a fixed length, so insertion works on an int[] with spare
 * capacity and a separate `size` counting the slots in use (the same model
 * ArrayList uses internally).
 */

export const insertAtCode = {
  source: [
    "void insertAt(int[] arr, int size, int index, int value) {",
    "    // Needs a free slot: size < arr.length",
    "    for (int i = size - 1; i >= index; i--) {",
    "        arr[i + 1] = arr[i];",
    "    }",
    "    arr[index] = value;",
    "}",
  ].join("\n"),
  lines: {
    signature: 1,
    loop: [3, 4, 5],
    shift: 4,
    write: 6,
  },
} as const;
