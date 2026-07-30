import { type Address, addressLabel } from "./address";

export type Range = { top: number; left: number; bottom: number; right: number };

// corners in either order, so dragging up or left gives the same range
export function rangeBetween(one: Address, two: Address): Range {
  return {
    top: Math.min(one.row, two.row),
    left: Math.min(one.col, two.col),
    bottom: Math.max(one.row, two.row),
    right: Math.max(one.col, two.col),
  };
}

export function rangeAt(cell: Address): Range {
  return { top: cell.row, left: cell.col, bottom: cell.row, right: cell.col };
}

export function isSingleCell(range: Range): boolean {
  return range.top === range.bottom && range.left === range.right;
}

// the same block of cells somewhere else. every edge of one is the same distance
// from its partner, which is the only case where overshooting a move cannot also
// overshoot the size.
export function sameSize(one: Range, two: Range): boolean {
  return (
    one.bottom - one.top === two.bottom - two.top && one.right - one.left === two.right - two.left
  );
}

export function rangeLabel(range: Range): string {
  const start = addressLabel({ row: range.top, col: range.left });
  if (isSingleCell(range)) return start;
  return `${start}:${addressLabel({ row: range.bottom, col: range.right })}`;
}

export function* cellsIn(range: Range): Generator<Address> {
  for (let row = range.top; row <= range.bottom; row++) {
    for (let col = range.left; col <= range.right; col++) {
      yield { row, col };
    }
  }
}
