import { describe, expect, it } from "vitest";
import type { CellValue } from "./errors";
import { explainError, hasReference, substitute } from "./explain";
import { parse } from "./parse";

const values: Record<string, CellValue> = {
  "0,1": 12,
  "1,1": 4,
  "2,1": "twelve",
};

const readCell = (row: number, col: number): CellValue => values[`${row},${col}`] ?? "";

const shown = (formula: string): string => substitute(parse(formula), readCell);

describe("substitute", () => {
  it("swaps references for the values behind them", () => {
    expect(shown("B1*B2")).toBe("12 × 4");
  });

  it("quotes text and names an empty cell rather than showing a gap", () => {
    expect(shown("B3+B9")).toBe('"twelve" + (empty)');
  });

  it("keeps brackets that still change the meaning", () => {
    expect(shown("(B1+B2)*2")).toBe("(12 + 4) × 2");
  });

  // the same signs the operator buttons offer, so one subtraction is not typeset
  // two ways an inch apart
  it("spells every operator the way it reads on paper", () => {
    expect(shown("B1-B2")).toBe("12 − 4");
    expect(shown("B1/B2")).toBe("12 ÷ 4");
  });

  it("leaves a range as its label, since listing every cell is unreadable", () => {
    expect(shown("SUM(B1:B3)")).toBe("SUM(B1:B3)");
  });
});

describe("hasReference", () => {
  it("is false for arithmetic on plain numbers", () => {
    expect(hasReference(parse("2*3"))).toBe(false);
  });

  it("is true once a cell or a range is named", () => {
    expect(hasReference(parse("SUM(B1:B3)/2"))).toBe(true);
  });
});

describe("explainError", () => {
  it("names the cell to go and fix", () => {
    const message = explainError({
      code: "not-a-number",
      blame: { row: 3, col: 1 },
      detail: "twelve",
    });
    expect(message).toBe("B4 is text, not a number");
  });

  it("uses the detail as the sentence when nothing owns the blame", () => {
    expect(
      explainError({ code: "not-a-number", blame: null, detail: "wrap the range in SUM" }),
    ).toBe("wrap the range in SUM");
  });

  it("passes an unknown function name through", () => {
    expect(explainError({ code: "unknown-function", blame: null, detail: "MEDIAN" })).toBe(
      "no function called MEDIAN",
    );
  });
});
