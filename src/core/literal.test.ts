import { describe, expect, it } from "vitest";
import { isNumericText, literalValue } from "./literal";

describe("isNumericText", () => {
  it("reads a number, spaced or not", () => {
    expect(isNumericText("12")).toBe(true);
    expect(isNumericText(" 12 ")).toBe(true);
    expect(isNumericText("-1.5")).toBe(true);
  });

  it("reads a word as text", () => {
    expect(isNumericText("twelve")).toBe(false);
    expect(isNumericText("12 apples")).toBe(false);
  });

  // Number("") and Number(" ") are both 0, so an emptiness test has to come
  // first or a blank cell reads as a number and gets aligned like one
  it("reads nothing as nothing", () => {
    expect(isNumericText("")).toBe(false);
    expect(isNumericText("   ")).toBe(false);
  });
});

describe("literalValue", () => {
  it("stores a number as a number", () => {
    expect(literalValue("12")).toBe(12);
    expect(literalValue(" 12 ")).toBe(12);
  });

  it("stores anything else as the text it was", () => {
    expect(literalValue("twelve")).toBe("twelve");
  });

  it("stores blank text as empty, whatever the whitespace", () => {
    expect(literalValue("")).toBe("");
    expect(literalValue("   ")).toBe("");
  });
});
