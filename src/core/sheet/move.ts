import { type CellKey, cellKey } from "../address";
import { remapColumns, remapRows } from "../formula/remap";
import { COLS, ROWS } from "../geometry";
import type { Read } from "./store";

// the bands in their new order, each listed by where it came from. the block is
// lifted out and dropped back so that it starts at the gap named by target, where
// target is a gap in the original numbering: 0 is before the first band and count
// is after the last. a target inside the block lands it where it was.
export function orderAfterMove(
  first: number,
  last: number,
  target: number,
  count: number,
): number[] {
  const block: number[] = [];
  const rest: number[] = [];

  for (let band = 0; band < count; band++) {
    if (band >= first && band <= last) block.push(band);
    else rest.push(band);
  }

  const at = rest.filter((band) => band < target).length;
  return [...rest.slice(0, at), ...block, ...rest.slice(at)];
}

export type BandMove = {
  // in the shape sheet.edit takes, so a move is one undoable action like any
  // other edit and needs nothing new from the store
  writes: [CellKey, string][];
  // where the block ended up, for the selection to follow it
  start: number;
};

// every cell that ends up holding something other than what it holds now: the
// text carried along by the moved columns, and the formulas anywhere on the
// sheet that pointed at them and now have to point somewhere else.
export function moveColumns(
  read: Read,
  left: number,
  right: number,
  target: number,
): BandMove {
  const order = orderAfterMove(left, right, target, COLS);
  const columnOf = placesOf(order);

  const writes: [CellKey, string][] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let to = 0; to < COLS; to++) {
      const text = remapColumns(read(cellKey(row, order[to]!)), columnOf);
      if (text !== read(cellKey(row, to))) writes.push([cellKey(row, to), text]);
    }
  }

  return { writes, start: columnOf[left]! };
}

// the same move down the other axis: a row carries its cells and the formulas
// that read them exactly as a column does
export function moveRows(
  read: Read,
  top: number,
  bottom: number,
  target: number,
): BandMove {
  const order = orderAfterMove(top, bottom, target, ROWS);
  const rowOf = placesOf(order);

  const writes: [CellKey, string][] = [];

  for (let to = 0; to < ROWS; to++) {
    for (let col = 0; col < COLS; col++) {
      const text = remapRows(read(cellKey(order[to]!, col)), rowOf);
      if (text !== read(cellKey(to, col))) writes.push([cellKey(to, col), text]);
    }
  }

  return { writes, start: rowOf[top]! };
}

// order reads new place to old, and a formula needs old to new
function placesOf(order: readonly number[]): number[] {
  const places: number[] = [];
  order.forEach((from, to) => {
    places[from] = to;
  });
  return places;
}
