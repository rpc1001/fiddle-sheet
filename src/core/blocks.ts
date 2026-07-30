import { type Address, type CellKey, addressOf, cellKey } from "./address";
import { COLS, ROWS } from "./geometry";
import type { Range } from "./range";

// loose cells -> the fewest rectangles that cover them. drawn one cell at a
// time, a highlighted range shows its own internal borders, which reads as a
// grid of tiles rather than one block.
export function blocks(cells: Iterable<Address>): Range[] {
  const remaining = new Set<CellKey>();
  for (const cell of cells) remaining.add(cellKey(cell.row, cell.col));

  const rowFilled = (row: number, left: number, right: number): boolean => {
    if (row >= ROWS) return false;
    for (let col = left; col <= right; col++) {
      if (!remaining.has(cellKey(row, col))) return false;
    }
    return true;
  };

  const found: Range[] = [];

  // a cell key counts up row by row, so sorting gives top left first and every
  // rectangle grows right then down from a corner nothing has claimed
  for (const key of [...remaining].sort((one, two) => one - two)) {
    if (!remaining.has(key)) continue;
    const { row, col } = addressOf(key);

    let right = col;
    while (right + 1 < COLS && remaining.has(cellKey(row, right + 1))) right++;

    let bottom = row;
    while (rowFilled(bottom + 1, col, right)) bottom++;

    for (let taken = row; taken <= bottom; taken++) {
      for (let across = col; across <= right; across++) remaining.delete(cellKey(taken, across));
    }

    found.push({ top: row, left: col, bottom, right });
  }

  return found;
}
