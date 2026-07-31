import { describe, expect, it } from "vitest";
import { COLS, ROWS } from "../geometry";
import { remapColumns, remapRows } from "./remap";

// A and B swap, everything else stays
const swapped = Array.from({ length: COLS }, (_, col) => {
  if (col === 0) return 1;
  if (col === 1) return 0;
  return col;
});

describe("remapColumns", () => {
  it("leaves plain text alone, even when it looks like a reference", () => {
    expect(remapColumns("A1", swapped)).toBe("A1");
    expect(remapColumns("see B2 for the total", swapped)).toBe("see B2 for the total");
  });

  it("moves a cell reference to its column's new letter", () => {
    expect(remapColumns("=A1+C1", swapped)).toBe("=B1+C1");
  });

  it("keeps the row it was written with", () => {
    expect(remapColumns("=A17", swapped)).toBe("=B17");
  });

  it("moves both ends of a range", () => {
    expect(remapColumns("=SUM(A1:A5)", swapped)).toBe("=SUM(B1:B5)");
  });

  it("moves a whole column reference", () => {
    expect(remapColumns("=SUM(A:A)", swapped)).toBe("=SUM(B:B)");
  });

  it("leaves function names alone", () => {
    expect(remapColumns("=AVERAGE(C1:C4)", swapped)).toBe("=AVERAGE(C1:C4)");
    expect(remapColumns("=COUNT(A1:B2)", swapped)).toBe("=COUNT(B1:A2)");
  });

  it("keeps a range's own endpoints when a move takes them apart", () => {
    // B leaves the middle of A:C, so the range still spans the data it was
    // written for and now covers one more column to do it
    const lifted = Array.from({ length: COLS }, (_, col) => {
      if (col === 0) return 0;
      if (col === 1) return COLS - 1;
      return col - 1;
    });
    expect(remapColumns("=SUM(A1:C1)", lifted)).toBe("=SUM(A1:B1)");
  });

  it("rewrites every reference in a long formula", () => {
    expect(remapColumns("=A1+SUM(A2:A9)*B1", swapped)).toBe("=B1+SUM(B2:B9)*A1");
  });

  it("returns a formula with no references unchanged", () => {
    expect(remapColumns("=2*3", swapped)).toBe("=2*3");
  });
});

// rows 1 and 2 swap, everything else stays
const swappedRows = Array.from({ length: ROWS }, (_, row) => {
  if (row === 0) return 1;
  if (row === 1) return 0;
  return row;
});

describe("remapRows", () => {
  it("leaves plain text alone", () => {
    expect(remapRows("A1", swappedRows)).toBe("A1");
    expect(remapRows("see A2 for the total", swappedRows)).toBe("see A2 for the total");
  });

  it("moves a cell reference to its row's new number", () => {
    expect(remapRows("=A1+A3", swappedRows)).toBe("=A2+A3");
  });

  it("keeps the column it was written with", () => {
    expect(remapRows("=Q1", swappedRows)).toBe("=Q2");
  });

  it("moves both ends of a range", () => {
    expect(remapRows("=SUM(A1:C1)", swappedRows)).toBe("=SUM(A2:C2)");
  });

  it("leaves a whole column reference alone, since it names no row", () => {
    expect(remapRows("=SUM(A:A)", swappedRows)).toBe("=SUM(A:A)");
  });

  it("leaves function names alone", () => {
    expect(remapRows("=AVERAGE(C1:C4)", swappedRows)).toBe("=AVERAGE(C2:C4)");
  });

  it("returns a formula with no references unchanged", () => {
    expect(remapRows("=2*3", swappedRows)).toBe("=2*3");
  });

  // a pin says what a fill may not move, and a band move is not a fill: the
  // reference still has to follow its row, and still has to stay pinned after
  it("keeps a pin while moving what it names", () => {
    expect(remapRows("=$A$1", swappedRows)).toBe("=$A$2");
    expect(remapColumns("=$A$1", swapped)).toBe("=$B$1");
  });
});
