import { useCallback, useSyncExternalStore } from "react";
import { cellKey } from "../core/address";
import type { CellValue } from "../core/formula/errors";
import { type Range, sameRange } from "../core/range";
import { createSheet } from "../core/sheet/store";
import { type Summary, summarize } from "../core/summary";
import { setSelection } from "./selection";
import { seed } from "./seed";

export const sheet = createSheet(seed);

// lazily, and straight off the indices: a wide selection is re-read on every
// cell the pointer crosses, so an Address per cell is an allocation per cell
export function* rangeValues(range: Range): Generator<CellValue> {
  for (let row = range.top; row <= range.bottom; row++) {
    for (let col = range.left; col <= range.right; col++) yield sheet.getValue(cellKey(row, col));
  }
}

// what a block of cells adds up to. three components ask in the same render and
// a drag asks again for every cell it crosses, so the one answer is held: it can
// only move when the range or the sheet does.
let last: { range: Range; revision: number; summary: Summary } | null = null;

export function summaryOf(range: Range): Summary {
  const revision = sheet.revision();

  if (!last || last.revision !== revision || !sameRange(last.range, range)) {
    last = { range, revision, summary: summarize(rangeValues(range)) };
  }

  return last.summary;
}

export type CellView = {
  display: string;
  numeric: boolean;
};

export function useCell(row: number, col: number): CellView {
  const key = cellKey(row, col);
  const subscribe = useCallback((listener: () => void) => sheet.subscribe(key, listener), [key]);
  const getSnapshot = useCallback(() => sheet.getDisplay(key), [key]);
  const display = useSyncExternalStore(subscribe, getSnapshot);

  // read alongside the subscription rather than through it: a snapshot has to be
  // a stable value, and this reads the same store the display just came from
  return { display, numeric: typeof sheet.getValue(key) === "number" };
}

// re-renders on any edit, undo or redo. the counter is only there because a
// snapshot has to be a stable value; callers read what they need off the sheet.
export function useSheetRevision(): number {
  return useSyncExternalStore(sheet.onEdit, sheet.revision);
}

// undo and redo move the selection back to where the edit happened, so the
// change you just reversed is the thing you are looking at
export function undo(): void {
  const restore = sheet.undo();
  if (restore) setSelection(restore);
}

export function redo(): void {
  const restore = sheet.redo();
  if (restore) setSelection(restore);
}
