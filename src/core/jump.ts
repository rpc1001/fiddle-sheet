import { type Address, cellKey } from "./address";
import { COLS, ROWS } from "./geometry";
import type { Read } from "./sheet/store";

function filled(read: Read, row: number, col: number): boolean {
  return read(cellKey(row, col)) !== "";
}

function inSheet(row: number, col: number): boolean {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

// the far side of the run the cursor is in. three cases: inside a run, stop at
// its last cell; at its end, skip the gap to the next thing worth stopping at;
// with nothing ahead, go to the edge of the sheet, which is how you reach row 100.
export function jumpTarget(read: Read, from: Address, rowStep: number, colStep: number): Address {
  let { row, col } = from;
  if (!inSheet(row + rowStep, col + colStep)) return from;

  // a run is only a run from the cell after this one: standing on the last
  // filled cell of a block has to cross the gap rather than stay put
  const crossing = !filled(read, row + rowStep, col + colStep);

  while (inSheet(row + rowStep, col + colStep)) {
    const nextFilled = filled(read, row + rowStep, col + colStep);
    // crossing started on empty and ends on the first filled cell; running
    // started on filled and ends on the last one, so both stop where the run
    // the scan is in stops being that run
    if (nextFilled === crossing) {
      // crossing a gap stops on the cell that ended it, running a block stops
      // on the last cell before one
      return crossing ? { row: row + rowStep, col: col + colStep } : { row, col };
    }
    row += rowStep;
    col += colStep;
  }

  return { row, col };
}
