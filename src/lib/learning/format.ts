/** "2", "2 and 9", "2, 9, and 3". */
export function listValues(values: readonly (number | null)[]): string {
  if (values.length <= 1) return values.join("");
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

/** Answer-option phrasing: "None of them", "Only 2", "2, 9, and 3". */
export function describeValues(values: readonly (number | null)[]): string {
  if (values.length === 0) return "None of them";
  if (values.length === 1) return `Only ${values[0]}`;
  return listValues(values);
}
