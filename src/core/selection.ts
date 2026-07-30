import type { Address } from "./address";
import { clampAddress } from "./geometry";
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
