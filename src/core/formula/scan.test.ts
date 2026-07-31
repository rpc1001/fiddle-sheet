import { describe, expect, it } from "vitest";
import { rangeLabel } from "../range";
import { balanceBrackets, canTakeOperator, draftReferences, expandColumns } from "./scan";

const labels = (text: string): string[] => draftReferences(text).map(rangeLabel);

describe("draftReferences", () => {
  it("finds a single cell", () => {
    expect(labels("=A1")).toEqual(["A1"]);
  });

  it("finds both sides of an operation", () => {
    expect(labels("=A1+B2")).toEqual(["A1", "B2"]);
  });

  it("reads a range that has not been closed yet", () => {
    expect(labels("=SUM(B2:B7")).toEqual(["B2:B7"]);
  });

  it("takes a whole column as every row of it", () => {
    expect(labels("=SUM(A:A)")).toEqual(["A1:A100"]);
  });

  it("ignores the function name", () => {
    expect(labels("=AVERAGE(B1:B10)")).toEqual(["B1:B10"]);
  });

  it("ignores a cell that is off the sheet", () => {
    expect(labels("=A101+A1")).toEqual(["A1"]);
  });

  it("finds nothing in plain text", () => {
    expect(labels("Groceries")).toEqual([]);
  });

  it("finds nothing in a bare number", () => {
    expect(labels("=12+30")).toEqual([]);
  });
});

describe("canTakeOperator", () => {
  it("is true after a reference", () => {
    expect(canTakeOperator("=B2")).toBe(true);
  });

  it("is true after a finished function", () => {
    expect(canTakeOperator("=SUM(B2:B7)")).toBe(true);
  });

  it("is true after a number", () => {
    expect(canTakeOperator("=B2*10")).toBe(true);
  });

  it("is false when an operator is already waiting for its other side", () => {
    expect(canTakeOperator("=B2+")).toBe(false);
  });

  it("is false when a function name is still being typed", () => {
    expect(canTakeOperator("=SU")).toBe(false);
  });

  it("is false for plain text", () => {
    expect(canTakeOperator("Rent 2")).toBe(false);
  });
});

describe("balanceBrackets", () => {
  it("closes what was left open", () => {
    expect(balanceBrackets("=SUM(B2:B7")).toBe("=SUM(B2:B7)");
  });

  it("closes every level of it", () => {
    expect(balanceBrackets("=SUM(AVERAGE(B1:B3")).toBe("=SUM(AVERAGE(B1:B3))");
  });

  it("leaves a finished formula alone", () => {
    expect(balanceBrackets("=SUM(B2:B7)")).toBe("=SUM(B2:B7)");
  });

  it("does not add brackets to a stray closing one", () => {
    expect(balanceBrackets("=B1)")).toBe("=B1)");
  });

  it("leaves plain text alone, brackets and all", () => {
    expect(balanceBrackets("Rent (monthly")).toBe("Rent (monthly");
  });
});

describe("expandColumns", () => {
  it("reads a lone column letter as the whole column", () => {
    expect(expandColumns("=SUM(C)")).toBe("=SUM(C:C)");
    expect(expandColumns("=SUM(C")).toBe("=SUM(C:C");
  });

  it("leaves a cell reference alone", () => {
    expect(expandColumns("=C1+C2")).toBe("=C1+C2");
  });

  it("leaves a range that already names both ends alone", () => {
    expect(expandColumns("=SUM(A:A)")).toBe("=SUM(A:A)");
    expect(expandColumns("=SUM(A1:C5)")).toBe("=SUM(A1:C5)");
  });

  it("leaves function names alone, known or not", () => {
    expect(expandColumns("=SUM(B1:B3)")).toBe("=SUM(B1:B3)");
    expect(expandColumns("=S(B1)")).toBe("=S(B1)");
  });

  it("keeps a pin while doubling the letter", () => {
    expect(expandColumns("=SUM($C)")).toBe("=SUM($C:$C)");
  });

  it("expands every column named in the formula", () => {
    expect(expandColumns("=SUM(B)-SUM(C)")).toBe("=SUM(B:B)-SUM(C:C)");
  });

  it("leaves a letter that is not a column on this sheet", () => {
    expect(expandColumns("=SUM(1)")).toBe("=SUM(1)");
  });

  it("leaves plain text alone", () => {
    expect(expandColumns("C")).toBe("C");
    expect(expandColumns("see C for the total")).toBe("see C for the total");
  });
});
