import { describe, expect, it } from "vitest";
import { type CellKey, cellKey } from "./address";
import { fillDirection, fillExtent, fillReadings } from "./fill";
import type { Range } from "./range";

function sheetOf(cells: Record<string, string>) {
  const byKey = new Map<CellKey, string>();
  for (const [address, text] of Object.entries(cells)) {
    const col = address.charCodeAt(0) - 65;
    byKey.set(cellKey(Number(address.slice(1)) - 1, col), text);
  }
  return (key: CellKey) => byKey.get(key) ?? "";
}

// the written cells as { A3: "3" }, which is how the sheet reads back
function written(writes: [CellKey, string][]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, text] of writes) {
    const row = Math.floor(key / 26);
    const col = key % 26;
    out[`${String.fromCharCode(65 + col)}${row + 1}`] = text;
  }
  return out;
}

const A1: Range = { top: 0, left: 0, bottom: 0, right: 0 };
const A1_A2: Range = { top: 0, left: 0, bottom: 1, right: 0 };

describe("fillExtent", () => {
  it("does not move for a pointer still inside the source", () => {
    expect(fillExtent(A1, { row: 0, col: 0 })).toEqual(A1);
  });

  it("grows down to the pointer", () => {
    expect(fillExtent(A1, { row: 4, col: 0 })).toEqual({ top: 0, left: 0, bottom: 4, right: 0 });
  });

  it("grows up, keeping the source at the far end", () => {
    const source: Range = { top: 5, left: 0, bottom: 5, right: 0 };
    expect(fillExtent(source, { row: 2, col: 0 })).toEqual({ top: 2, left: 0, bottom: 5, right: 0 });
  });

  it("commits to the axis the pointer travelled further along", () => {
    expect(fillExtent(A1, { row: 5, col: 2 })).toEqual({ top: 0, left: 0, bottom: 5, right: 0 });
    expect(fillExtent(A1, { row: 2, col: 5 })).toEqual({ top: 0, left: 0, bottom: 0, right: 5 });
  });
});

describe("fillDirection", () => {
  it("names the side that grew", () => {
    expect(fillDirection(A1, { top: 0, left: 0, bottom: 3, right: 0 })).toBe("down");
    expect(fillDirection(A1, { top: 0, left: 0, bottom: 0, right: 3 })).toBe("right");
    expect(fillDirection(A1, A1)).toBe(null);
  });
});

describe("fillReadings", () => {
  it("offers counting first and copying second for a single number", () => {
    const readings = fillReadings(sheetOf({ A1: "5" }), A1, {
      top: 0,
      left: 0,
      bottom: 3,
      right: 0,
    });

    expect(readings.map((one) => one.name)).toEqual(["count", "copy"]);
    expect(written(readings[0]!.writes)).toEqual({ A2: "6", A3: "7", A4: "8" });
    expect(written(readings[1]!.writes)).toEqual({ A2: "5", A3: "5", A4: "5" });
  });

  it("takes the step from two cells and stops asking", () => {
    const readings = fillReadings(sheetOf({ A1: "2", A2: "4" }), A1_A2, {
      top: 0,
      left: 0,
      bottom: 4,
      right: 0,
    });

    expect(readings.map((one) => one.name)).toEqual(["count"]);
    expect(written(readings[0]!.writes)).toEqual({ A3: "6", A4: "8", A5: "10" });
  });

  it("counts backwards when the drag goes up", () => {
    const source: Range = { top: 3, left: 0, bottom: 3, right: 0 };
    const readings = fillReadings(sheetOf({ A4: "10" }), source, {
      top: 1,
      left: 0,
      bottom: 3,
      right: 0,
    });

    expect(written(readings[0]!.writes)).toEqual({ A3: "9", A2: "8" });
  });

  it("counts the number on the end of a name", () => {
    const readings = fillReadings(sheetOf({ A1: "item 1" }), A1, {
      top: 0,
      left: 0,
      bottom: 2,
      right: 0,
    });

    expect(written(readings[0]!.writes)).toEqual({ A2: "item 2", A3: "item 3" });
  });

  it("only copies plain text, and does not offer a count nobody could mean", () => {
    const readings = fillReadings(sheetOf({ A1: "total" }), A1, {
      top: 0,
      left: 0,
      bottom: 2,
      right: 0,
    });

    expect(readings.map((one) => one.name)).toEqual(["copy"]);
    expect(written(readings[0]!.writes)).toEqual({ A2: "total", A3: "total" });
  });

  it("repeats a block that states no run", () => {
    const readings = fillReadings(sheetOf({ A1: "yes", A2: "no" }), A1_A2, {
      top: 0,
      left: 0,
      bottom: 5,
      right: 0,
    });

    expect(written(readings[0]!.writes)).toEqual({ A3: "yes", A4: "no", A5: "yes", A6: "no" });
  });

  it("moves a filled formula with its row and holds a pinned cell still", () => {
    const readings = fillReadings(sheetOf({ C1: "=A1*$B$1" }), { top: 0, left: 2, bottom: 0, right: 2 }, {
      top: 0,
      left: 2,
      bottom: 2,
      right: 2,
    });

    expect(readings.map((one) => one.name)).toEqual(["copy"]);
    expect(written(readings[0]!.writes)).toEqual({ C2: "=A2*$B$1", C3: "=A3*$B$1" });
  });

  it("fills every column of a wide source independently", () => {
    const source: Range = { top: 0, left: 0, bottom: 0, right: 1 };
    const readings = fillReadings(sheetOf({ A1: "1", B1: "10" }), source, {
      top: 0,
      left: 0,
      bottom: 1,
      right: 1,
    });

    expect(written(readings[0]!.writes)).toEqual({ A2: "2", B2: "11" });
  });

  it("falls back to the reading every column agrees on", () => {
    const source: Range = { top: 0, left: 0, bottom: 0, right: 1 };
    const readings = fillReadings(sheetOf({ A1: "1", B1: "total" }), source, {
      top: 0,
      left: 0,
      bottom: 1,
      right: 1,
    });

    expect(readings.map((one) => one.name)).toEqual(["copy"]);
    expect(written(readings[0]!.writes)).toEqual({ A2: "1", B2: "total" });
  });

  it("keeps a decimal step off the floating point rocks", () => {
    const readings = fillReadings(sheetOf({ A1: "0.1", A2: "0.2" }), A1_A2, {
      top: 0,
      left: 0,
      bottom: 3,
      right: 0,
    });

    expect(written(readings[0]!.writes)).toEqual({ A3: "0.3", A4: "0.4" });
  });

  it("has nothing to write when the drag covers nothing new", () => {
    expect(fillReadings(sheetOf({ A1: "5" }), A1, A1)).toEqual([]);
  });
});
