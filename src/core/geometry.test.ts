import { describe, expect, it } from "vitest";
import {
  COL_WIDTH,
  COLS,
  GUTTER_WIDTH,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  ROWS,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  cellAtPoint,
  gapAtPoint,
  gapOffset,
  fitsAbove,
  fitsBelow,
  fitsLeft,
  fitsRight,
  insetOf,
  keepAcross,
  keepDown,
  rectOf,
  switchesAxis,
  scrollToShow,
  visiblePart,
  zoneAtPoint,
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

describe("zoneAtPoint", () => {
  it("names each band by its own corner", () => {
    expect(zoneAtPoint(0, 0)).toBe("corner");
    expect(zoneAtPoint(GUTTER_WIDTH, 0)).toBe("header");
    expect(zoneAtPoint(0, HEADER_HEIGHT)).toBe("gutter");
    expect(zoneAtPoint(GUTTER_WIDTH, HEADER_HEIGHT)).toBe("cell");
  });

  it("keeps the last pixel of the header and the gutter out of the cells", () => {
    expect(zoneAtPoint(GUTTER_WIDTH - 1, HEADER_HEIGHT - 1)).toBe("corner");
    expect(zoneAtPoint(500, HEADER_HEIGHT - 1)).toBe("header");
    expect(zoneAtPoint(GUTTER_WIDTH - 1, 500)).toBe("gutter");
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

describe("visiblePart", () => {
  const column = rectOf(rangeBetween({ row: 0, col: 1 }, { row: ROWS - 1, col: 1 }));

  it("leaves a rect that is already on screen alone", () => {
    expect(visiblePart(cellRect(1, 1), view)).toEqual(cellRect(1, 1));
  });

  it("clips a whole column to the rows in the window", () => {
    const part = visiblePart(column, view);
    expect(part).toMatchObject({ left: column.left, top: HEADER_HEIGHT, width: COL_WIDTH });
    expect(part.height).toBe(view.height - HEADER_HEIGHT);
  });

  it("follows the window as it scrolls down the same column", () => {
    const part = visiblePart(column, { ...view, scrollTop: 600 });
    expect(part.top).toBe(600 + HEADER_HEIGHT);
    expect(part.height).toBe(view.height - HEADER_HEIGHT);
  });

  it("keeps a whole row clear of the gutter", () => {
    const row = rectOf(rangeBetween({ row: 2, col: 0 }, { row: 2, col: COLS - 1 }));
    const part = visiblePart(row, { ...view, scrollLeft: 400 });
    expect(part.left).toBe(400 + GUTTER_WIDTH);
    expect(part.width).toBe(view.width - GUTTER_WIDTH);
  });
});

describe("fitsRight, fitsLeft and fitsBelow", () => {
  it("accepts a panel with room on the far side of the gutter", () => {
    expect(fitsLeft(cellRect(0, 6), 200, 18, view)).toBe(true);
  });

  it("refuses a panel that would slide under the gutter", () => {
    expect(fitsLeft(cellRect(0, 1), 200, 18, view)).toBe(false);
  });

  it("accepts a panel with room beside the cell", () => {
    expect(fitsRight(cellRect(0, 0), 200, 18, view)).toBe(true);
    expect(fitsBelow(cellRect(0, 0), 150, 18, view)).toBe(true);
  });

  it("refuses a panel that would land outside the window, not outside the sheet", () => {
    expect(fitsRight(cellRect(0, 4), 200, 18, view)).toBe(false);
    expect(fitsBelow(cellRect(8, 0), 150, 18, view)).toBe(false);
  });

  it("refuses a panel that would slide under the header", () => {
    expect(fitsAbove(cellRect(0, 0), 150, 18, view)).toBe(false);
    expect(fitsAbove(cellRect(1, 0), 150, 18, view)).toBe(false);
  });

  it("accepts a panel with room above the cell", () => {
    expect(fitsAbove(cellRect(7, 0), 150, 18, view)).toBe(true);
  });

  it("measures from the scrolled window, so scrolling makes room", () => {
    const scrolled = { ...view, scrollLeft: 400, scrollTop: 400 };
    expect(fitsRight(cellRect(0, 4), 200, 18, scrolled)).toBe(true);
    expect(fitsBelow(cellRect(8, 0), 150, 18, scrolled)).toBe(true);
  });
});

describe("insetOf", () => {
  const whole = { top: 0, left: 0, bottom: ROWS - 1, right: COLS - 1 };

  it("gives the same box as rectOf, measured from the far edges", () => {
    const range = rangeBetween({ row: 1, col: 2 }, { row: 4, col: 5 });
    const rect = rectOf(range);
    const inset = insetOf(range);

    expect(inset.left).toBe(rect.left);
    expect(inset.top).toBe(rect.top);
    expect(SHEET_WIDTH - inset.right - inset.left).toBe(rect.width);
    expect(SHEET_HEIGHT - inset.bottom - inset.top).toBe(rect.height);
  });

  it("puts a band flush against the edges it fills", () => {
    const column = { top: 0, left: 2, bottom: ROWS - 1, right: 2 };

    expect(insetOf(column).top).toBe(HEADER_HEIGHT);
    expect(insetOf(column).bottom).toBe(0);
    expect(insetOf(whole)).toEqual({ left: GUTTER_WIDTH, top: HEADER_HEIGHT, right: 0, bottom: 0 });
  });
});

describe("switchesAxis", () => {
  const cell = { top: 3, left: 3, bottom: 3, right: 3 };
  const column = { top: 0, left: 2, bottom: ROWS - 1, right: 2 };
  const row = { top: 5, left: 0, bottom: 5, right: COLS - 1 };
  const sheet = { top: 0, left: 0, bottom: ROWS - 1, right: COLS - 1 };

  it("is true only between bands of different axes", () => {
    expect(switchesAxis(column, row)).toBe(true);
    expect(switchesAxis(row, column)).toBe(true);
  });

  it("is false when an axis carries over, so the box still has an edge to travel", () => {
    expect(switchesAxis(cell, column)).toBe(false);
    expect(switchesAxis(cell, row)).toBe(false);
    expect(switchesAxis(column, sheet)).toBe(false);
    expect(switchesAxis(column, column)).toBe(false);
  });

  it("counts the whole sheet as a band on both axes", () => {
    expect(switchesAxis(sheet, cell)).toBe(true);
  });
});

describe("keepAcross and keepDown", () => {
  it("starts the panel where it was asked to", () => {
    expect(keepAcross(200, 236, 18, view)).toBe(200);
    expect(keepDown(100, 108, 18, view)).toBe(100);
  });

  it("pulls it back when it would hang off the far edge", () => {
    expect(keepAcross(400, 236, 18, view)).toBe(view.width - 18 - 236);
    expect(keepDown(280, 108, 18, view)).toBe(view.height - 18 - 108);
  });

  it("never starts it under the gutter or the header", () => {
    expect(keepAcross(0, 236, 18, view)).toBe(GUTTER_WIDTH);
    expect(keepDown(0, 108, 18, view)).toBe(HEADER_HEIGHT);
  });

  it("measures from the scrolled window", () => {
    expect(keepAcross(1000, 236, 18, { ...view, scrollLeft: 300 })).toBe(300 + view.width - 18 - 236);
    expect(keepDown(1000, 108, 18, { ...view, scrollTop: 300 })).toBe(300 + view.height - 18 - 108);
  });
});

describe("column gaps", () => {
  it("numbers the boundaries from before the first column to after the last", () => {
    expect(gapOffset(0, "column")).toBe(GUTTER_WIDTH);
    expect(gapOffset(1, "column")).toBe(GUTTER_WIDTH + COL_WIDTH);
    expect(gapOffset(COLS, "column")).toBe(GUTTER_WIDTH + COLS * COL_WIDTH);
  });

  it("takes the nearest boundary to a point, not the column it is over", () => {
    expect(gapAtPoint(GUTTER_WIDTH + COL_WIDTH * 0.4, "column")).toBe(0);
    expect(gapAtPoint(GUTTER_WIDTH + COL_WIDTH * 0.6, "column")).toBe(1);
    expect(gapAtPoint(GUTTER_WIDTH + COL_WIDTH * 1.5, "column")).toBe(2);
  });

  it("clamps to the sheet, so a drag off either edge still drops somewhere", () => {
    expect(gapAtPoint(-500, "column")).toBe(0);
    expect(gapAtPoint(GUTTER_WIDTH + COLS * COL_WIDTH + 500, "column")).toBe(COLS);
  });
});

describe("row gaps", () => {
  it("runs down from the header the way columns run across from the gutter", () => {
    expect(gapOffset(0, "row")).toBe(HEADER_HEIGHT);
    expect(gapOffset(1, "row")).toBe(HEADER_HEIGHT + ROW_HEIGHT);
    expect(gapOffset(ROWS, "row")).toBe(HEADER_HEIGHT + ROWS * ROW_HEIGHT);
  });

  it("takes the nearest boundary to a point", () => {
    expect(gapAtPoint(HEADER_HEIGHT + ROW_HEIGHT * 0.4, "row")).toBe(0);
    expect(gapAtPoint(HEADER_HEIGHT + ROW_HEIGHT * 0.6, "row")).toBe(1);
  });

  it("clamps to the sheet", () => {
    expect(gapAtPoint(-500, "row")).toBe(0);
    expect(gapAtPoint(HEADER_HEIGHT + ROWS * ROW_HEIGHT + 500, "row")).toBe(ROWS);
  });
});
