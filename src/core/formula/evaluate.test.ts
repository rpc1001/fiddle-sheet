import { describe, expect, it } from "vitest";
import { type CellKey, cellKey } from "../address";
import { at } from "../testSheet";
import type { CellValue } from "./errors";
import { type ReadCell, evaluate } from "./evaluate";
import { FUNCTIONS } from "./functions";
import { parse } from "./parse";

// a fake sheet holding the values the real store would hand the evaluator, so
// numbers are written as numbers: { A1: 10, B2: "Rent" }
function sheetOf(cells: Record<string, CellValue>): ReadCell {
  const byKey = new Map<CellKey, CellValue>();
  for (const [address, value] of Object.entries(cells)) byKey.set(at(address), value);
  return (row, col) => byKey.get(cellKey(row, col)) ?? "";
}

function run(formula: string, cells: Record<string, CellValue> = {}) {
  return evaluate(parse(formula), sheetOf(cells));
}

describe("evaluate", () => {
  it("adds two cells", () => {
    expect(run("A1+B1", { A1: 10, B1: 32 })).toBe(42);
  });

  it("multiplies a cell by a number", () => {
    expect(run("A1*10", { A1: 4 })).toBe(40);
  });

  it("respects precedence", () => {
    expect(run("1+2*3")).toBe(7);
  });

  it("treats an empty cell as zero", () => {
    expect(run("A1+5")).toBe(5);
  });

  it("negates", () => {
    expect(run("-A1", { A1: 7 })).toBe(-7);
  });

  it("sums a range", () => {
    expect(run("SUM(A1:A3)", { A1: 1, A2: 2, A3: 3 })).toBe(6);
  });

  it("skips text and blanks inside a range", () => {
    expect(run("SUM(A1:A4)", { A1: "Budget", A2: 10, A4: 5 })).toBe(15);
  });

  it("averages only the numbers present", () => {
    expect(run("AVERAGE(A1:A4)", { A1: 10, A2: 20, A4: 30 })).toBe(20);
  });

  it("counts only numbers", () => {
    expect(run("COUNT(A1:B2)", { A1: 1, A2: "text", B1: 2 })).toBe(2);
  });

  it("takes several arguments", () => {
    expect(run("SUM(A1:A2,10)", { A1: 1, A2: 2 })).toBe(13);
  });

  it("nests a call inside arithmetic", () => {
    expect(run("SUM(A1:A2)/2", { A1: 10, A2: 30 })).toBe(20);
  });

  it("sums a whole column", () => {
    expect(run("SUM(A:A)", { A1: 1, A50: 2, A100: 3 })).toBe(6);
  });

  it("blames the cell holding text when arithmetic needs a number", () => {
    expect(run("A1+B1", { A1: "Rent", B1: 10 })).toEqual({
      code: "not-a-number",
      blame: { row: 0, col: 0 },
      detail: "Rent",
    });
  });

  it("reports division by zero", () => {
    expect(run("A1/0", { A1: 10 })).toMatchObject({ code: "divide-by-zero" });
  });

  it("blames the divisor cell when it holds the zero", () => {
    expect(run("A1/B1", { A1: 10, B1: 0 })).toMatchObject({
      code: "divide-by-zero",
      blame: { row: 0, col: 1 },
    });
  });

  it("reports dividing by an empty cell, and blames it", () => {
    expect(run("A1/B1", { A1: 10 })).toMatchObject({
      code: "divide-by-zero",
      blame: { row: 0, col: 1 },
    });
  });

  // a literal zero is written in this cell, so there is nowhere else to point
  it("blames nothing when the divisor is not a cell", () => {
    expect(run("A1/0", { A1: 10 })).toMatchObject({ blame: null });
  });

  it("blames the cell an error was read from when the error names none", () => {
    const broken = { code: "unknown-function", blame: null, detail: "TOTAL" } as const;
    expect(run("A1+1", { A1: broken })).toMatchObject({
      code: "unknown-function",
      blame: { row: 0, col: 0 },
    });
  });

  it("keeps the original blame when an error passes through a formula", () => {
    const broken = { code: "not-a-number", blame: { row: 9, col: 3 }, detail: "pending" } as const;
    expect(run("A1+1", { A1: broken })).toMatchObject({ blame: { row: 9, col: 3 } });
  });

  it("blames the cell inside a range that carried the error", () => {
    const broken = { code: "divide-by-zero", blame: null, detail: "dividing by zero" } as const;
    expect(run("SUM(A1:A3)", { A2: broken })).toMatchObject({
      code: "divide-by-zero",
      blame: { row: 1, col: 0 },
    });
  });

  it("reports an unknown function", () => {
    expect(run("TOTAL(A1:A2)")).toMatchObject({ code: "unknown-function", detail: "TOTAL" });
  });

  it("reports averaging nothing", () => {
    expect(run("AVERAGE(A1:A4)")).toMatchObject({ code: "divide-by-zero" });
  });

  it("rejects a range with no function around it", () => {
    expect(run("A1:A5")).toMatchObject({ code: "not-a-number" });
  });

  // the list the editor suggests from is written by hand, so it has to be
  // checked against what the evaluator will actually accept
  it("knows every function the editor offers", () => {
    for (const entry of FUNCTIONS) {
      expect(run(`${entry.name}(A1:A2)`, { A1: 1, A2: 3 })).not.toMatchObject({
        code: "unknown-function",
      });
    }
  });
});
