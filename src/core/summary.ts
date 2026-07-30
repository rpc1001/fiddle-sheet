import type { CellValue } from "./formula/errors";

export type NumberSummary = {
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
};

export type Summary = {
  cells: number;
  filled: number;
  // null when nothing in the selection is a number, so callers cannot read a
  // sum that does not exist
  numbers: NumberSummary | null;
};

// one pass, no array: this runs again for every cell a drag crosses, and a
// selection can be the whole sheet
export function summarize(values: Iterable<CellValue>): Summary {
  let cells = 0;
  let filled = 0;
  let count = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    cells++;
    if (value === "") continue;
    filled++;
    if (typeof value !== "number") continue;

    count++;
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  if (count === 0) return { cells, filled, numbers: null };

  return { cells, filled, numbers: { count, sum, average: sum / count, min, max } };
}
