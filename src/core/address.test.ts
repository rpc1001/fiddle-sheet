import { describe, expect, it } from "vitest";
import { addressLabel, addressOf, cellKey, parseAddress } from "./address";
import { COLS, ROWS } from "./geometry";

describe("cell keys", () => {
  it("survives the round trip", () => {
    for (const address of [
      { row: 0, col: 0 },
      { row: 0, col: COLS - 1 },
      { row: ROWS - 1, col: 0 },
      { row: 42, col: 7 },
    ]) {
      expect(addressOf(cellKey(address.row, address.col))).toEqual(address);
    }
  });

  it("gives every cell its own key", () => {
    const keys = new Set<number>();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) keys.add(cellKey(row, col));
    }
    expect(keys.size).toBe(ROWS * COLS);
  });
});

describe("labels", () => {
  it("reads back what it wrote", () => {
    expect(parseAddress(addressLabel({ row: 6, col: 1 }))).toEqual({ row: 6, col: 1 });
  });

  it("refuses an address outside the sheet", () => {
    expect(parseAddress(`A${ROWS + 1}`)).toBeNull();
  });
});
