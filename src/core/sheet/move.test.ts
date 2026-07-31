import { describe, expect, it } from "vitest";
import { type CellKey, cellKey } from "../address";
import { COLS, ROWS } from "../geometry";
import { sheetOf } from "../testSheet";
import { moveColumns, moveRows, orderAfterMove } from "./move";

const first = (order: number[], count: number) => order.slice(0, count);

const at = (writes: [CellKey, string][], row: number, col: number) =>
  writes.find(([key]) => key === cellKey(row, col))?.[1];

describe("orderAfterMove", () => {
  it("moves one column to the right of another", () => {
    expect(first(orderAfterMove(0, 0, 3, COLS), 4)).toEqual([1, 2, 0, 3]);
  });

  it("moves one column to the left", () => {
    expect(first(orderAfterMove(2, 2, 0, COLS), 4)).toEqual([2, 0, 1, 3]);
  });

  it("keeps a block together", () => {
    expect(first(orderAfterMove(0, 1, 4, COLS), 5)).toEqual([2, 3, 0, 1, 4]);
  });

  it("leaves the order alone when the block is dropped on itself", () => {
    expect(orderAfterMove(2, 4, 3, COLS)).toEqual(orderAfterMove(2, 4, 2, COLS));
    expect(first(orderAfterMove(2, 4, 3, COLS), 6)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("takes a column to the far end", () => {
    const order = orderAfterMove(0, 0, COLS, COLS);
    expect(order[COLS - 1]).toBe(0);
    expect(order).toHaveLength(COLS);
  });

  it("is always a permutation of every column", () => {
    expect([...orderAfterMove(3, 5, 20, COLS)].sort((one, two) => one - two)).toEqual(
      Array.from({ length: COLS }, (_, col) => col),
    );
  });
});

describe("moveColumns", () => {
  it("carries a column's text with it", () => {
    const read = sheetOf({ A1: "left", B1: "middle", C1: "right" });
    const { writes } = moveColumns(read, 0, 0, 3);

    expect(at(writes, 0, 0)).toBe("middle");
    expect(at(writes, 0, 1)).toBe("right");
    expect(at(writes, 0, 2)).toBe("left");
  });

  it("reports where the block landed", () => {
    const read = sheetOf({});
    expect(moveColumns(read, 0, 1, 4).start).toBe(2);
    expect(moveColumns(read, 4, 4, 0).start).toBe(0);
  });

  it("writes nothing when the move is a no-op", () => {
    const read = sheetOf({ A1: "left", B1: "middle" });
    expect(moveColumns(read, 0, 0, 0).writes).toEqual([]);
  });

  it("repoints a formula that travelled with the move", () => {
    const read = sheetOf({ A1: "2", B1: "3", C1: "=A1+B1" });
    const { writes } = moveColumns(read, 2, 2, 0);

    expect(at(writes, 0, 0)).toBe("=B1+C1");
    expect(at(writes, 0, 1)).toBe("2");
    expect(at(writes, 0, 2)).toBe("3");
  });

  it("repoints a formula that stayed still but read a column that moved", () => {
    const read = sheetOf({ A1: "2", B1: "3", Z1: "=SUM(A1:A1)+B1" });
    const { writes } = moveColumns(read, 0, 0, 2);

    expect(at(writes, 0, 25)).toBe("=SUM(B1:B1)+A1");
  });

  it("leaves text that reads like a reference alone", () => {
    const read = sheetOf({ A1: "A1", B1: "b" });
    const { writes } = moveColumns(read, 0, 0, 2);

    expect(at(writes, 0, 1)).toBe("A1");
  });
});

describe("moveRows", () => {
  it("carries a row's text with it", () => {
    const read = sheetOf({ A1: "top", A2: "middle", A3: "bottom" });
    const { writes } = moveRows(read, 0, 0, 3);

    expect(at(writes, 0, 0)).toBe("middle");
    expect(at(writes, 1, 0)).toBe("bottom");
    expect(at(writes, 2, 0)).toBe("top");
  });

  it("takes the whole row across every column", () => {
    const read = sheetOf({ A1: "one", Z1: "twenty six", A2: "next" });
    const { writes } = moveRows(read, 0, 0, 2);

    expect(at(writes, 1, 0)).toBe("one");
    expect(at(writes, 1, 25)).toBe("twenty six");
    expect(at(writes, 0, 0)).toBe("next");
  });

  it("reports where the block landed", () => {
    const read = sheetOf({});
    expect(moveRows(read, 0, 1, 4).start).toBe(2);
    expect(moveRows(read, 4, 4, 0).start).toBe(0);
  });

  it("writes nothing when the move is a no-op", () => {
    const read = sheetOf({ A1: "top", A2: "next" });
    expect(moveRows(read, 0, 0, 0).writes).toEqual([]);
  });

  it("repoints a formula that stayed still but read a row that moved", () => {
    const read = sheetOf({ A1: "2", A2: "3", A5: "=A1+A2" });
    const { writes } = moveRows(read, 0, 0, 2);

    expect(at(writes, 4, 0)).toBe("=A2+A1");
  });

  it("leaves a whole column reference alone, since it names no row", () => {
    const read = sheetOf({ B1: "=SUM(A:A)" });
    const { writes } = moveRows(read, 0, 0, ROWS);

    expect(at(writes, ROWS - 1, 1)).toBe("=SUM(A:A)");
  });
});
