import { describe, expect, it } from "vitest";
import {
  COL_WIDTH,
  COLS,
  GUTTER_WIDTH,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  ROWS,
  cellAtPoint,
  fitsBelow,
  fitsRight,
  rectOf,
  scrollToShow,
} from "./geometry";
import { rangeBetween } from "./range";

const view = { scrollLeft: 0, scrollTop: 0, width: 500, height: 300 };
const cellRect = (row: number, col: number) => rectOf(rangeBetween({ row, col }, { row, col }));

describe("cellAtPoint", () => {
  it("finds the first cell just inside the header and gutter", () => {
    expect(cellAtPoint(GUTTER_WIDTH, HEADER_HEIGHT)).toEqual({ row: 0, col: 0 });
  });

  it("stays on the first cell up to its last pixel", () => {
    expect(cellAtPoint(GUTTER_WIDTH + COL_WIDTH - 1, HEADER_HEIGHT + ROW_HEIGHT - 1)).toEqual({
      row: 0,
      col: 0,
    });
  });

  it("crosses to the next cell on the boundary pixel", () => {
    expect(cellAtPoint(GUTTER_WIDTH + COL_WIDTH, HEADER_HEIGHT + ROW_HEIGHT)).toEqual({
      row: 1,
      col: 1,
    });
  });

  it("clamps a point over the header or gutter to the first cell", () => {
    expect(cellAtPoint(0, 0)).toEqual({ row: 0, col: 0 });
  });

  it("clamps a point dragged off the left or top", () => {
    expect(cellAtPoint(-500, -500)).toEqual({ row: 0, col: 0 });
  });

  it("clamps a point dragged past the last cell", () => {
    expect(cellAtPoint(100_000, 100_000)).toEqual({ row: ROWS - 1, col: COLS - 1 });
  });
});

describe("rectOf", () => {
  it("places a single cell after the header and gutter", () => {
    expect(rectOf(rangeBetween({ row: 0, col: 0 }, { row: 0, col: 0 }))).toEqual({
      left: GUTTER_WIDTH,
      top: HEADER_HEIGHT,
      width: COL_WIDTH,
      height: ROW_HEIGHT,
    });
  });

  it("covers every cell in a range, inclusive of both corners", () => {
    expect(rectOf(rangeBetween({ row: 1, col: 1 }, { row: 3, col: 2 }))).toEqual({
      left: GUTTER_WIDTH + COL_WIDTH,
      top: HEADER_HEIGHT + ROW_HEIGHT,
      width: COL_WIDTH * 2,
      height: ROW_HEIGHT * 3,
    });
  });

  it("round trips: the rect's own corner hit-tests back to the same cell", () => {
    const cell = { row: 7, col: 4 };
    const rect = rectOf(rangeBetween(cell, cell));
    expect(cellAtPoint(rect.left, rect.top)).toEqual(cell);
  });
});

describe("scrollToShow", () => {
  it("leaves the scroll alone when the cell is already visible", () => {
    expect(scrollToShow(cellRect(1, 1), view)).toEqual(view);
  });

  it("scrolls down just enough to reveal a cell below the fold", () => {
    const rect = cellRect(20, 0);
    const next = scrollToShow(rect, view);
    expect(next.scrollTop).toBe(rect.top + rect.height - view.height);
  });

  it("scrolls right just enough to reveal a cell past the edge", () => {
    const rect = cellRect(0, 20);
    const next = scrollToShow(rect, view);
    expect(next.scrollLeft).toBe(rect.left + rect.width - view.width);
  });

  it("scrolls back up so the cell clears the sticky header", () => {
    const rect = cellRect(5, 0);
    const next = scrollToShow(rect, { ...view, scrollTop: 1000 });
    expect(next.scrollTop).toBe(rect.top - HEADER_HEIGHT);
  });

  it("scrolls back left so the cell clears the sticky gutter", () => {
    const rect = cellRect(0, 5);
    const next = scrollToShow(rect, { ...view, scrollLeft: 1000 });
    expect(next.scrollLeft).toBe(rect.left - GUTTER_WIDTH);
  });

  it("puts the first cell at the origin", () => {
    const next = scrollToShow(cellRect(0, 0), { ...view, scrollLeft: 400, scrollTop: 400 });
    expect(next).toMatchObject({ scrollLeft: 0, scrollTop: 0 });
  });
});

describe("fitsRight and fitsBelow", () => {
  it("accepts a panel with room beside the cell", () => {
    expect(fitsRight(cellRect(0, 0), 200, 18, view)).toBe(true);
    expect(fitsBelow(cellRect(0, 0), 150, 18, view)).toBe(true);
  });

  it("refuses a panel that would land outside the window, not outside the sheet", () => {
    expect(fitsRight(cellRect(0, 4), 200, 18, view)).toBe(false);
    expect(fitsBelow(cellRect(8, 0), 150, 18, view)).toBe(false);
  });

  it("measures from the scrolled window, so scrolling makes room", () => {
    const scrolled = { ...view, scrollLeft: 400, scrollTop: 400 };
    expect(fitsRight(cellRect(0, 4), 200, 18, scrolled)).toBe(true);
    expect(fitsBelow(cellRect(8, 0), 150, 18, scrolled)).toBe(true);
  });
});
