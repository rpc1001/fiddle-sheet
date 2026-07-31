import { describe, expect, it } from "vitest";
import { type CellKey, addressLabel, cellKey, parseAddress } from "./address";
import { jumpTarget } from "./jump";

function sheetOf(cells: Record<string, string>) {
  const byKey = new Map<CellKey, string>();
  for (const [address, text] of Object.entries(cells)) {
    const at = parseAddress(address)!;
    byKey.set(cellKey(at.row, at.col), text);
  }
  return (key: CellKey) => byKey.get(key) ?? "";
}

const column = sheetOf({ A1: "1", A2: "2", A3: "3", A7: "7", A8: "8" });

function jump(
  read: (key: CellKey) => string,
  from: string,
  rowStep: number,
  colStep: number,
): string {
  return addressLabel(jumpTarget(read, parseAddress(from)!, rowStep, colStep));
}

describe("jumpTarget", () => {
  it("runs to the last cell of the block it is in", () => {
    expect(jump(column, "A1", 1, 0)).toBe("A3");
  });

  it("crosses the gap from the end of a block to the next one", () => {
    expect(jump(column, "A3", 1, 0)).toBe("A7");
  });

  it("goes to the edge of the sheet when nothing is ahead", () => {
    expect(jump(column, "A8", 1, 0)).toBe("A100");
  });

  it("runs backwards the same way", () => {
    expect(jump(column, "A8", -1, 0)).toBe("A7");
    expect(jump(column, "A7", -1, 0)).toBe("A3");
  });

  it("stays put at the edge it is already on", () => {
    expect(jump(column, "A1", -1, 0)).toBe("A1");
  });

  it("crosses an empty sheet to the far edge", () => {
    expect(jump(sheetOf({}), "A1", 0, 1)).toBe("Z1");
  });

  it("stops on a single cell standing alone", () => {
    expect(jump(sheetOf({ C1: "x" }), "A1", 0, 1)).toBe("C1");
    expect(jump(sheetOf({ C1: "x" }), "C1", 0, 1)).toBe("Z1");
  });

  it("treats a formula cell as filled like any other", () => {
    expect(jump(sheetOf({ A1: "1", A2: "=A1" }), "A1", 1, 0)).toBe("A2");
  });
});
