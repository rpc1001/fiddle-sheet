import { describe, expect, it } from "vitest";
import { droppedFormula } from "./drop";
import type { Range } from "./range";

const range: Range = { top: 0, left: 0, bottom: 4, right: 0 };

describe("droppedFormula", () => {
  it("totals a range of numbers, named the way it reads on the sheet", () => {
    expect(droppedFormula([1, 2, 3], range)).toBe("=SUM(A1:A5)");
  });

  it("counts the numbers among text as numbers", () => {
    expect(droppedFormula(["apples", 2, ""], range)).toBe("=SUM(A1:A5)");
  });

  it("refuses a range with nothing to total", () => {
    expect(droppedFormula(["apples", "pears"], range)).toBeNull();
    expect(droppedFormula(["", ""], range)).toBeNull();
  });

  it("names a single cell as one address", () => {
    expect(droppedFormula([7], { top: 2, left: 1, bottom: 2, right: 1 })).toBe("=SUM(B3)");
  });
});
