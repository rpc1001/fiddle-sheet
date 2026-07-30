import type { Address } from "./address";
import type { Range } from "./range";

export const ROWS = 100;
export const COLS = 26;

export const ROW_HEIGHT = 30;
export const COL_WIDTH = 96;

export const HEADER_HEIGHT = 30;
export const GUTTER_WIDTH = 44;

export const SHEET_WIDTH = GUTTER_WIDTH + COLS * COL_WIDTH;
export const SHEET_HEIGHT = HEADER_HEIGHT + ROWS * ROW_HEIGHT;

export type Rect = { left: number; top: number; width: number; height: number };

function clamp(value: number, limit: number): number {
  return Math.max(0, Math.min(limit - 1, value));
}

export function clampAddress(row: number, col: number): Address {
  return { row: clamp(row, ROWS), col: clamp(col, COLS) };
}

// x and y are relative to the top left of the grid, header and gutter included.
// a point outside the cells clamps to the nearest one, so a drag off the edge
// keeps extending instead of stopping.
export function cellAtPoint(x: number, y: number): Address {
  return {
    row: clamp(Math.floor((y - HEADER_HEIGHT) / ROW_HEIGHT), ROWS),
    col: clamp(Math.floor((x - GUTTER_WIDTH) / COL_WIDTH), COLS),
  };
}

export function coversEveryRow(range: Range): boolean {
  return range.top === 0 && range.bottom === ROWS - 1;
}

export function coversEveryColumn(range: Range): boolean {
  return range.left === 0 && range.right === COLS - 1;
}

export type Zone ="corner" | "header" | "gutter" | "cell";

// x and y are relative to the visible window, not to the sheet: the header and
// the gutter are stuck over its near edges and the cells scroll under them, so
// the sheet's own coordinates cannot say which band a press landed in.
export function zoneAtPoint(x: number, y: number): Zone {
  if (y < HEADER_HEIGHT) return x < GUTTER_WIDTH ? "corner" : "header";
  return x < GUTTER_WIDTH ? "gutter" : "cell";
}

export type Viewport = { scrollLeft: number; scrollTop: number; width: number; height: number };

// the smallest scroll change that brings a rect fully into view. the header and
// gutter are stuck over the near edges, so the visible area starts behind them.
export function scrollToShow(rect: Rect, view: Viewport): Viewport {
  let { scrollLeft, scrollTop } = view;

  if (rect.left - GUTTER_WIDTH < scrollLeft) scrollLeft = rect.left - GUTTER_WIDTH;
  else if (rect.left + rect.width > scrollLeft + view.width) {
    scrollLeft = rect.left + rect.width - view.width;
  }

  if (rect.top - HEADER_HEIGHT < scrollTop) scrollTop = rect.top - HEADER_HEIGHT;
  else if (rect.top + rect.height > scrollTop + view.height) {
    scrollTop = rect.top + rect.height - view.height;
  }

  return { ...view, scrollLeft, scrollTop };
}

// a panel of this size, placed after the rect with a gap, still inside the
// visible window. the sheet scrolls, so the sheet's own edges are the wrong test.
export function fitsRight(rect: Rect, width: number, gap: number, view: Viewport): boolean {
  return rect.left + rect.width + gap + width <= view.scrollLeft + view.width;
}

export function fitsLeft(rect: Rect, width: number, gap: number, view: Viewport): boolean {
  return rect.left - gap - width >= view.scrollLeft + GUTTER_WIDTH;
}

export function fitsBelow(rect: Rect, height: number, gap: number, view: Viewport): boolean {
  return rect.top + rect.height + gap + height <= view.scrollTop + view.height;
}

export function fitsAbove(rect: Rect, height: number, gap: number, view: Viewport): boolean {
  return rect.top - gap - height >= view.scrollTop + HEADER_HEIGHT;
}

// where a panel of this size can start if it wants to start there: as asked,
// unless that would hang it off one edge of the window or the other
export function keepAcross(x: number, width: number, gap: number, view: Viewport): number {
  const last = view.scrollLeft + view.width - gap - width;
  return Math.max(view.scrollLeft + GUTTER_WIDTH, Math.min(x, last));
}

export function keepDown(y: number, height: number, gap: number, view: Viewport): number {
  const last = view.scrollTop + view.height - gap - height;
  return Math.max(view.scrollTop + HEADER_HEIGHT, Math.min(y, last));
}

// the part of a rect that is on screen, and the only part a panel beside it can
// aim at: a whole column is taller than the window and a whole row is wider, so
// the rect's own middle and its own edges are somewhere nobody is looking
export function visiblePart(rect: Rect, view: Viewport): Rect {
  const left = Math.max(rect.left, view.scrollLeft + GUTTER_WIDTH);
  const top = Math.max(rect.top, view.scrollTop + HEADER_HEIGHT);

  return {
    left,
    top,
    width: Math.min(rect.left + rect.width, view.scrollLeft + view.width) - left,
    height: Math.min(rect.top + rect.height, view.scrollTop + view.height) - top,
  };
}

export function rectOf(range: Range): Rect {
  return {
    left: GUTTER_WIDTH + range.left * COL_WIDTH,
    top: HEADER_HEIGHT + range.top * ROW_HEIGHT,
    width: (range.right - range.left + 1) * COL_WIDTH,
    height: (range.bottom - range.top + 1) * ROW_HEIGHT,
  };
}

export type Inset = { left: number; top: number; right: number; bottom: number };

// the same box as rectOf, given as the distance from each edge of the sheet
// instead of a corner and a size. an edge that is already where it belongs can
// then stay there while the far one travels, which a width cannot express: a
// width is measured from the near edge, so pinning one moves the other.
export function insetOf(range: Range): Inset {
  const rect = rectOf(range);

  return {
    left: rect.left,
    top: rect.top,
    right: SHEET_WIDTH - (rect.left + rect.width),
    bottom: SHEET_HEIGHT - (rect.top + rect.height),
  };
}

// a band of columns and a band of rows have no edge in common to travel along,
// so a box morphing from one to the other sweeps a block of the sheet that was
// never selected on its way through
export function switchesAxis(from: Range, to: Range): boolean {
  return (
    coversEveryRow(from) !== coversEveryRow(to) &&
    coversEveryColumn(from) !== coversEveryColumn(to)
  );
}
