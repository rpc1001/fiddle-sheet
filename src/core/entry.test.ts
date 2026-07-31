import { describe, expect, it } from "vitest";
import { clearWrites, fillWrites, spreadWrites } from "./entry";
import { addressAt, rangeOf, sheetOf, written } from "./testSheet";

describe("spreadWrites", () => {
  it("writes the draft to every cell of the block", () => {
    expect(written(spreadWrites("x", addressAt("A1"), rangeOf("A1:B2")))).toEqual({
      A1: "x",
      B1: "x",
      A2: "x",
      B2: "x",
    });
  });

  it("carries a formula to each cell the way a fill would", () => {
    expect(written(spreadWrites("=B1*2", addressAt("A1"), rangeOf("A1:A3")))).toEqual({
      A1: "=B1*2",
      A2: "=B2*2",
      A3: "=B3*2",
    });
  });

  it("leaves a pinned reference alone", () => {
    expect(written(spreadWrites("=$B$1", addressAt("A1"), rangeOf("A1:A2")))).toEqual({
      A1: "=$B$1",
      A2: "=$B$1",
    });
  });
});

describe("fillWrites", () => {
  const read = sheetOf({ A1: "1", B1: "=A1*2" });

  it("takes the first row down the selection", () => {
    expect(written(fillWrites(read, rangeOf("A1:A3"), "down"))).toEqual({ A2: "1", A3: "1" });
  });

  it("carries formulas down with it", () => {
    expect(written(fillWrites(read, rangeOf("B1:B3"), "down"))).toEqual({
      B2: "=A2*2",
      B3: "=A3*2",
    });
  });

  it("takes the first column across", () => {
    expect(written(fillWrites(read, rangeOf("A1:C1"), "right"))).toEqual({ B1: "1", C1: "1" });
  });

  it("copies rather than counts: a key press states no run", () => {
    const run = sheetOf({ A1: "1" });
    expect(written(fillWrites(run, rangeOf("A1:A3"), "down"))).toEqual({ A2: "1", A3: "1" });
  });

  it("writes nothing when there is nowhere to fill", () => {
    expect(fillWrites(read, rangeOf("A1"), "down")).toEqual([]);
  });
});

describe("fillWrites from a single cell", () => {
  const read = sheetOf({ A1: "1", A2: "=A1*2", B1: "left" });

  it("takes the cell above when only the target is selected", () => {
    expect(written(fillWrites(read, rangeOf("A2"), "down"))).toEqual({ A2: "1" });
  });

  it("takes the cell to the left the same way", () => {
    expect(written(fillWrites(read, rangeOf("C1"), "right"))).toEqual({ C1: "left" });
  });

  it("carries the formula it copies down", () => {
    expect(written(fillWrites(read, rangeOf("A3"), "down"))).toEqual({ A3: "=A2*2" });
  });

  it("has nothing above the first row to fill from", () => {
    expect(fillWrites(read, rangeOf("A1"), "down")).toEqual([]);
    expect(fillWrites(read, rangeOf("A1"), "right")).toEqual([]);
  });
});

describe("clearWrites", () => {
  it("empties every cell of the block, filled or not", () => {
    expect(written(clearWrites(rangeOf("A1:B2")))).toEqual({
      A1: "",
      B1: "",
      A2: "",
      B2: "",
    });
  });
});
