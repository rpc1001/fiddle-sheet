import type { Address } from "./address";
import { COLS, ROWS, clampAddress } from "./geometry";
import { type Range, rangeBetween } from "./range";

// anchor is where the selection started and stays put; focus is the end that
// moves. keeping both means shift-extending knows which corner to pivot on.
export type Selection = { anchor: Address; focus: Address };

export function selectionAt(cell: Address): Selection {
  return { anchor: cell, focus: cell };
}

export function selectionRange(selection: Selection): Range {
  return rangeBetween(selection.anchor, selection.focus);
}

// a band of whole columns or whole rows is an ordinary selection stretched to
// the far edge of the sheet, which is also what A:A means to the formula engine.
// the anchor sits at the far end and the focus at the near one: the focus is
// where the keyboard picks up, and after selecting a column that is its first
// cell, not the hundredth.
export function columnSpan(anchorCol: number, focusCol: number): Selection {
  return { anchor: { row: ROWS - 1, col: anchorCol }, focus: { row: 0, col: focusCol } };
}

export function rowSpan(anchorRow: number, focusRow: number): Selection {
  return { anchor: { row: anchorRow, col: COLS - 1 }, focus: { row: focusRow, col: 0 } };
}

export function sameCell(one: Address, two: Address): boolean {
  return one.row === two.row && one.col === two.col;
}

// moving collapses the selection to one cell; extending keeps the anchor and
// drags the focus, which is what shift-arrow does
export function moved(
  selection: Selection,
  rowStep: number,
  colStep: number,
  extend: boolean,
): Selection {
  const from = selection.focus;
  const focus = clampAddress(from.row + rowStep, from.col + colStep);
  return extend ? { anchor: selection.anchor, focus } : selectionAt(focus);
}
