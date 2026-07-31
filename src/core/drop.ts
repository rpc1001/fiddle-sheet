import type { CellValue } from "./formula/errors";
import { type Range, rangeLabel } from "./range";
import { summarize } from "./summary";

// the formula a range writes into the cell it is dropped on. null when the range
// holds no numbers: every function here is about numbers, so there is nothing
// honest to write.
export function droppedFormula(values: Iterable<CellValue>, range: Range): string | null {
  return summarize(values).numbers ? `=SUM(${rangeLabel(range)})` : null;
}
