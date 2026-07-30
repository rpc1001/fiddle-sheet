import { describe, expect, it } from "vitest";
import { cellsIn, rangeBetween, sameSize } from "./range";

describe("rangeBetween", () => {
  it("keeps corners given top-left to bottom-right", () => {
    expect(rangeBetween({ row: 1, col: 2 }, { row: 4, col: 5 })).toEqual({
      top: 1,
      left: 2,
      bottom: 4,
      right: 5,
    });
  });

  it("normalizes corners given backwards", () => {
    expect(rangeBetween({ row: 4, col: 5 }, { row: 1, col: 2 })).toEqual(
      rangeBetween({ row: 1, col: 2 }, { row: 4, col: 5 }),
    );
  });

  it("normalizes a drag up and to the right", () => {
    expect(rangeBetween({ row: 4, col: 2 }, { row: 1, col: 5 })).toEqual({
      top: 1,
      left: 2,
      bottom: 4,
      right: 5,
    });
  });

  it("makes a single cell from one address", () => {
    expect(rangeBetween({ row: 3, col: 3 }, { row: 3, col: 3 })).toEqual({
      top: 3,
      left: 3,
      bottom: 3,
      right: 3,
    });
  });
});

describe("cellsIn", () => {
  it("yields one cell for a single-cell range", () => {
    expect([...cellsIn({ top: 2, left: 2, bottom: 2, right: 2 })]).toEqual([{ row: 2, col: 2 }]);
  });

  it("walks row by row", () => {
    expect([...cellsIn({ top: 0, left: 0, bottom: 1, right: 1 })]).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);
  });
});

describe("sameSize", () => {
  const block = { top: 1, left: 1, bottom: 3, right: 2 };

  it("is true for the same block somewhere else", () => {
    expect(sameSize(block, { top: 5, left: 4, bottom: 7, right: 5 })).toBe(true);
  });

  it("is false when either side changes length", () => {
    expect(sameSize(block, { top: 1, left: 1, bottom: 4, right: 2 })).toBe(false);
    expect(sameSize(block, { top: 1, left: 1, bottom: 3, right: 3 })).toBe(false);
  });

  it("is true for a cell moving to another cell", () => {
    expect(sameSize({ top: 0, left: 0, bottom: 0, right: 0 }, { top: 9, left: 9, bottom: 9, right: 9 })).toBe(true);
  });
});
