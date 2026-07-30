import { describe, expect, it } from "vitest";
import { COLS, ROWS } from "./geometry";
import { columnSpan, moved, rowSpan, selectionAt, selectionRange } from "./selection";

const at = (row: number, col: number) => selectionAt({ row, col });

describe("columnSpan and rowSpan", () => {
  it("covers every row of one column", () => {
    expect(selectionRange(columnSpan(2, 2))).toEqual({
      top: 0,
      left: 2,
      bottom: ROWS - 1,
      right: 2,
    });
  });

  it("covers every column of one row", () => {
    expect(selectionRange(rowSpan(4, 4))).toEqual({ top: 4, left: 0, bottom: 4, right: COLS - 1 });
  });

  it("spans backwards from the anchor", () => {
    expect(selectionRange(columnSpan(5, 1))).toMatchObject({ left: 1, right: 5 });
    expect(selectionRange(rowSpan(9, 3))).toMatchObject({ top: 3, bottom: 9 });
  });

  it("keeps the focus on the moving end so a drag can extend it", () => {
    expect(columnSpan(5, 1).focus.col).toBe(1);
    expect(rowSpan(9, 3).focus.row).toBe(3);
  });

  it("leaves the focus on the first cell of the band, so an arrow starts there", () => {
    expect(columnSpan(2, 2).focus).toEqual({ row: 0, col: 2 });
    expect(rowSpan(4, 4).focus).toEqual({ row: 4, col: 0 });
    expect(moved(columnSpan(2, 2), 1, 0, false)).toEqual(at(1, 2));
    expect(moved(rowSpan(4, 4), 0, 1, false)).toEqual(at(4, 1));
  });

  it("stays a full band when shift-arrow extends it sideways", () => {
    expect(selectionRange(moved(columnSpan(2, 2), 0, 1, true))).toEqual({
      top: 0,
      left: 2,
      bottom: ROWS - 1,
      right: 3,
    });
  });
});

describe("moved", () => {
  it("moves the focus and collapses the selection", () => {
    expect(moved(at(2, 2), 1, 0, false)).toEqual(at(3, 2));
  });

  it("keeps the anchor when extending", () => {
    expect(moved(at(2, 2), 1, 0, true)).toEqual({
      anchor: { row: 2, col: 2 },
      focus: { row: 3, col: 2 },
    });
  });

  it("collapses a range to the focus when moving without shift", () => {
    const extended = moved(at(2, 2), 3, 3, true);
    expect(moved(extended, 1, 0, false)).toEqual(at(6, 5));
  });

  it("stops at the top-left corner", () => {
    expect(moved(at(0, 0), -1, -1, false)).toEqual(at(0, 0));
  });

  it("stops at the bottom-right corner", () => {
    expect(moved(at(ROWS - 1, COLS - 1), 1, 1, false)).toEqual(at(ROWS - 1, COLS - 1));
  });

  it("extends up to the edge and no further", () => {
    const extended = moved(at(0, 0), -1, 0, true);
    expect(selectionRange(extended)).toEqual({ top: 0, left: 0, bottom: 0, right: 0 });
  });
});
