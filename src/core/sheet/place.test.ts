import { describe, expect, it } from "vitest";
import { COLS, ROWS } from "../geometry";
import { columnSpan, rowSpan, selectionAt } from "../selection";
import type { Entry } from "./history";
import { placeOf } from "./place";

function placeIn(selection: Entry["selection"]): string {
  return placeOf({ changes: [], selection, action: "type" });
}

describe("placeOf", () => {
  it("names the cell an action happened in", () => {
    expect(placeIn(selectionAt({ row: 3, col: 2 }))).toBe("C4");
  });

  it("names a block by its corners", () => {
    expect(placeIn({ anchor: { row: 1, col: 1 }, focus: { row: 4, col: 3 } })).toBe("B2:D5");
  });

  it("names a block the same way whichever corner it was dragged from", () => {
    const forwards = { anchor: { row: 1, col: 1 }, focus: { row: 4, col: 3 } };
    const backwards = { anchor: { row: 4, col: 3 }, focus: { row: 1, col: 1 } };
    expect(placeIn(backwards)).toBe(placeIn(forwards));
  });

  it("names a band of columns by the bands, not by its corners", () => {
    expect(placeIn(columnSpan(1, 2))).toBe("B:C");
  });

  it("names one column by the header it carries, the way the ghost does", () => {
    expect(placeIn(columnSpan(2, 2))).toBe("C");
  });

  it("names one row the same way", () => {
    expect(placeIn(rowSpan(4, 4))).toBe("5");
  });

  it("names a band of rows by its numbers", () => {
    expect(placeIn(rowSpan(2, 4))).toBe("3:5");
  });

  it("reads select all as every column, which is what names every cell", () => {
    expect(placeIn({ anchor: { row: 0, col: 0 }, focus: { row: ROWS - 1, col: COLS - 1 } })).toBe(
      "A:Z",
    );
  });
});
