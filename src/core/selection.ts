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

// a whole block selected, anchored at the corner a drag would have started from,
// so the keyboard picks up where the block ends
export function selectionOver(range: Range): Selection {
  return {
    anchor: { row: range.top, col: range.left },
    focus: { row: range.bottom, col: range.right },
  };
}

// a band is an ordinary selection stretched to the far edge of the sheet, which
// is also what A:A means to the formula engine. the anchor sits at the far end so
// the focus lands on the band's first cell, where the keyboard picks up.
export function columnSpan(anchorCol: number, focusCol: number): Selection {
  return { anchor: { row: ROWS - 1, col: anchorCol }, focus: { row: 0, col: focusCol } };
}

export function rowSpan(anchorRow: number, focusRow: number): Selection {
  return { anchor: { row: anchorRow, col: COLS - 1 }, focus: { row: focusRow, col: 0 } };
}

// the selection down to the one cell the keyboard is on. the focus is what it
// keeps, not the anchor: the focus is where the next arrow starts from, so
// collapsing to it is the only version that leaves you where you were.
export function collapsed(selection: Selection): Selection {
  return selectionAt(selection.focus);
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
  return reachedTo(selection, clampAddress(from.row + rowStep, from.col + colStep), extend);
}

// the same choice for a focus that was worked out some other way than by
// stepping: a jump to the end of a run, a row's first column, a page down
export function reachedTo(selection: Selection, focus: Address, extend: boolean): Selection {
  return extend ? { anchor: selection.anchor, focus } : selectionAt(focus);
}
