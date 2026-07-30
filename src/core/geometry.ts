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

export function fitsBelow(rect: Rect, height: number, gap: number, view: Viewport): boolean {
  return rect.top + rect.height + gap + height <= view.scrollTop + view.height;
}

// the rows worth mounting. a few either side of the window so a scroll has
// something to show before react catches up.
const OVERSCAN = 4;

export function visibleRows(scrollTop: number, height: number): { first: number; last: number } {
  const first = Math.floor((scrollTop - HEADER_HEIGHT) / ROW_HEIGHT) - OVERSCAN;
  const last = Math.floor((scrollTop + height - HEADER_HEIGHT) / ROW_HEIGHT) + OVERSCAN;

  return { first: clamp(first, ROWS), last: clamp(last, ROWS) };
}

export function rectOf(range: Range): Rect {
  return {
    left: GUTTER_WIDTH + range.left * COL_WIDTH,
    top: HEADER_HEIGHT + range.top * ROW_HEIGHT,
    width: (range.right - range.left + 1) * COL_WIDTH,
    height: (range.bottom - range.top + 1) * ROW_HEIGHT,
  };
}
