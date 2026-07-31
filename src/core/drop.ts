import type { CellValue } from "./formula/errors";
import { type Range, rangeLabel } from "./range";
import { summarize } from "./summary";

// the formula a range writes into the cell it is dropped on. the hardest part
// of a first spreadsheet is not selecting or typing, it is knowing that SUM
// exists and that the range is spelled A1:A5. dropping states both.
//
// null when the range holds no numbers: every function here is about numbers,
// so there is nothing honest to write, and a confident =COUNT() reading 0 is
// worse than the gesture doing nothing.
export function droppedFormula(values: Iterable<CellValue>, range: Range): string | null {
  return summarize(values).numbers ? `=SUM(${rangeLabel(range)})` : null;
}
