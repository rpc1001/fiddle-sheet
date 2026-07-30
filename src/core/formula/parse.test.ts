import { describe, expect, it } from "vitest";
import { ParseError, parse } from "./parse";

describe("parse", () => {
  it("reads a number", () => {
    expect(parse("42")).toEqual({ kind: "number", value: 42 });
  });

  it("reads a cell reference as a zero-based address", () => {
    expect(parse("B7")).toEqual({ kind: "ref", row: 6, col: 1 });
  });

  it("accepts lowercase references", () => {
    expect(parse("b7")).toEqual({ kind: "ref", row: 6, col: 1 });
  });

  it("adds two references", () => {
    expect(parse("A1+B1")).toEqual({
      kind: "binary",
      op: "+",
      left: { kind: "ref", row: 0, col: 0 },
      right: { kind: "ref", row: 0, col: 1 },
    });
  });

  it("gives multiplication higher precedence than addition", () => {
    expect(parse("1+2*3")).toEqual({
      kind: "binary",
      op: "+",
      left: { kind: "number", value: 1 },
      right: {
        kind: "binary",
        op: "*",
        left: { kind: "number", value: 2 },
        right: { kind: "number", value: 3 },
      },
    });
  });

  it("lets parentheses override precedence", () => {
    expect(parse("(1+2)*3")).toEqual({
      kind: "binary",
      op: "*",
      left: {
        kind: "binary",
        op: "+",
        left: { kind: "number", value: 1 },
        right: { kind: "number", value: 2 },
      },
      right: { kind: "number", value: 3 },
    });
  });

  it("subtracts left to right", () => {
    expect(parse("10-3-2")).toEqual({
      kind: "binary",
      op: "-",
      left: {
        kind: "binary",
        op: "-",
        left: { kind: "number", value: 10 },
        right: { kind: "number", value: 3 },
      },
      right: { kind: "number", value: 2 },
    });
  });

  it("reads a negative number as a negation", () => {
    expect(parse("-A1")).toEqual({
      kind: "negate",
      operand: { kind: "ref", row: 0, col: 0 },
    });
  });

  it("reads a range", () => {
    expect(parse("A1:C5")).toEqual({
      kind: "range",
      range: { top: 0, left: 0, bottom: 4, right: 2 },
    });
  });

  it("normalizes a range given backwards", () => {
    expect(parse("C5:A1")).toEqual({
      kind: "range",
      range: { top: 0, left: 0, bottom: 4, right: 2 },
    });
  });

  it("expands a whole-column range to every row", () => {
    expect(parse("A:A")).toEqual({
      kind: "range",
      range: { top: 0, left: 0, bottom: 99, right: 0 },
    });
  });

  it("expands a multi-column range to every row", () => {
    expect(parse("B:D")).toEqual({
      kind: "range",
      range: { top: 0, left: 1, bottom: 99, right: 3 },
    });
  });

  it("reads a function call over a range", () => {
    expect(parse("SUM(A1:A5)")).toEqual({
      kind: "call",
      name: "SUM",
      args: [{ kind: "range", range: { top: 0, left: 0, bottom: 4, right: 0 } }],
    });
  });

  it("uppercases function names", () => {
    expect(parse("sum(A1)")).toMatchObject({ kind: "call", name: "SUM" });
  });

  it("reads several arguments", () => {
    expect(parse("COUNT(A1,B2,3)")).toMatchObject({
      kind: "call",
      name: "COUNT",
      args: [{ kind: "ref" }, { kind: "ref" }, { kind: "number", value: 3 }],
    });
  });

  it("reads a call with no arguments", () => {
    expect(parse("SUM()")).toEqual({ kind: "call", name: "SUM", args: [] });
  });

  it("nests calls inside arithmetic", () => {
    expect(parse("SUM(A1:A5)/2")).toMatchObject({
      kind: "binary",
      op: "/",
      left: { kind: "call", name: "SUM" },
      right: { kind: "number", value: 2 },
    });
  });

  it("ignores spaces", () => {
    expect(parse(" A1 + 2 ")).toEqual(parse("A1+2"));
  });

  it.each([
    ["A1+", "a missing right operand"],
    ["(A1", "an unclosed paren"],
    ["A1 B2", "two references with no operator"],
    ["A101", "a row past the end of the sheet"],
    ["A0", "row zero"],
    ["SUM(A1:A5))", "an extra closing paren"],
    ["#", "a character with no meaning"],
    ["A1:", "a range with no end"],
    ["A1:B", "a range mixing a cell and a bare column"],
  ])("rejects %j (%s)", (source) => {
    expect(() => parse(source)).toThrow(ParseError);
  });
});
