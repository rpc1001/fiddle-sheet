import { describe, expect, it } from "vitest";
import { offsetFormula } from "./offset";

describe("offsetFormula", () => {
  it("leaves plain text alone, even when it looks like a reference", () => {
    expect(offsetFormula("A1", 1, 0)).toBe("A1");
    expect(offsetFormula("see B2 for the total", 1, 0)).toBe("see B2 for the total");
  });

  it("carries a reference the same distance as the formula", () => {
    expect(offsetFormula("=A1*2", 1, 0)).toBe("=A2*2");
    expect(offsetFormula("=A1*2", 0, 1)).toBe("=B1*2");
    expect(offsetFormula("=A1+B1", 3, 1)).toBe("=B4+C4");
  });

  it("moves both ends of a range", () => {
    expect(offsetFormula("=SUM(A1:A5)", 1, 0)).toBe("=SUM(A2:A6)");
  });

  it("leaves function names alone", () => {
    expect(offsetFormula("=AVERAGE(A1:A4)", 0, 1)).toBe("=AVERAGE(B1:B4)");
  });

  it("holds a pinned side still", () => {
    expect(offsetFormula("=A1*$B$1", 1, 0)).toBe("=A2*$B$1");
    expect(offsetFormula("=A1*$B$1", 0, 1)).toBe("=B1*$B$1");
  });

  it("pins one axis at a time", () => {
    expect(offsetFormula("=$A1", 1, 1)).toBe("=$A2");
    expect(offsetFormula("=A$1", 1, 1)).toBe("=B$1");
  });

  it("moves a whole column reference across but not down", () => {
    expect(offsetFormula("=SUM(A:A)", 5, 1)).toBe("=SUM(B:B)");
    expect(offsetFormula("=SUM($A:$A)", 5, 1)).toBe("=SUM($A:$A)");
  });

  it("breaks a reference that would leave the sheet rather than aiming it elsewhere", () => {
    expect(offsetFormula("=A1*2", -1, 0)).toBe("=#REF*2");
    expect(offsetFormula("=A1*2", 0, -1)).toBe("=#REF*2");
  });

  it("does nothing at all when the formula has not moved", () => {
    expect(offsetFormula("=A1*$B$1", 0, 0)).toBe("=A1*$B$1");
  });
});
