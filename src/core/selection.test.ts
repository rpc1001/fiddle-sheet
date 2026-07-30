import { describe, expect, it } from "vitest";
import { COLS, ROWS } from "./geometry";
import { moved, selectionAt, selectionRange } from "./selection";

const at = (row: number, col: number) => selectionAt({ row, col });

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
