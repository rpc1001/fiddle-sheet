import { type Address, type CellKey, cellKey } from "./address";
import { fillReadings } from "./fill";
import { offsetFormula } from "./formula/rewrite";
import { type Range, cellsIn, isSingleCell } from "./range";
import type { Read } from "./sheet/store";

// one draft written to every cell of the selection, each copy's formula moved
// as far as the copy itself moved. the same rule a fill uses, so a formula
// spread over a block says the same thing about its own row that it said here.
export function spreadWrites(text: string, from: Address, range: Range): [CellKey, string][] {
  const writes: [CellKey, string][] = [];
  for (const cell of cellsIn(range)) {
    writes.push([
      cellKey(cell.row, cell.col),
      offsetFormula(text, cell.row - from.row, cell.col - from.col),
    ]);
  }
  return writes;
}

// every cell of a block emptied. one call, so clearing is one undoable action
// however many cells it covers.
export function clearWrites(range: Range): [CellKey, string][] {
  const writes: [CellKey, string][] = [];
  for (const cell of cellsIn(range)) writes.push([cellKey(cell.row, cell.col), ""]);
  return writes;
}

// the selection's first row taken down it, or its first column taken across: the
// fill handle's drag without the drag, so it asks the same function what the cells
// mean. it asks for the copy, since reading "1" as the start of a run is a guess
// only the hand dragging it can make.
export function fillWrites(read: Read, range: Range, axis: "down" | "right"): [CellKey, string][] {
  // one cell selected states a target and no source, so the source is the cell
  // it is being filled from: the one above, or the one to its left. a block
  // states both, and its own first row or column is what runs through it.
  const back = isSingleCell(range) ? 1 : 0;
  const from = axis === "down" ? range.top - back : range.left - back;
  if (from < 0) return [];

  const source =
    axis === "down"
      ? { ...range, top: from, bottom: from }
      : { ...range, left: from, right: from };
  const extent = axis === "down" ? { ...range, top: from } : { ...range, left: from };

  const copy = fillReadings(read, source, extent).find((reading) => reading.name === "copy");
  return copy ? copy.writes : [];
}
