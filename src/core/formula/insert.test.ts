import { describe, expect, it } from "vitest";
import { addressAt as at } from "../testSheet";
import { acceptsReference, insertReference } from "./insert";

describe("acceptsReference", () => {
  it.each(["=", "=A1+", "=A1 + ", "=SUM(", "=SUM(A1,", "=A1*", "=A1:"])(
    "accepts a reference after %j",
    (text) => {
      expect(acceptsReference(text)).toBe(true);
    },
  );

  it.each([
    ["plain text", "hello"],
    ["a number", "42"],
    ["a formula ending in a reference", "=A1"],
    ["a formula ending in a number", "=1"],
    ["a closed call", "=SUM(A1:A5)"],
  ])("refuses %s", (_why, text) => {
    expect(acceptsReference(text)).toBe(false);
  });
});

describe("insertReference", () => {
  it("appends when nothing was inserted before", () => {
    expect(insertReference("=A1+", null, at("B2"), at("B2"))).toEqual({
      text: "=A1+B2",
      span: { start: 4, end: 6 },
    });
  });

  it("replaces the previous insertion rather than appending", () => {
    const first = insertReference("=A1+", null, at("B2"), at("B2"));
    expect(insertReference(first.text, first.span, at("C9"), at("C9"))).toEqual({
      text: "=A1+C9",
      span: { start: 4, end: 6 },
    });
  });

  it("replaces a cell with a range as a drag grows", () => {
    const first = insertReference("=SUM(", null, at("B2"), at("B2"));
    const grown = insertReference(first.text, first.span, at("B2"), at("B7"));
    expect(grown.text).toBe("=SUM(B2:B7");
    expect(grown.span).toEqual({ start: 5, end: 10 });
  });

  it("keeps everything typed before the insertion point", () => {
    expect(insertReference("=SUM(A1:A5)+", null, at("C3"), at("C3")).text).toBe("=SUM(A1:A5)+C3");
  });

  it("writes only the far end after a typed colon", () => {
    expect(insertReference("=SUM(A1:", null, at("B7"), at("B7")).text).toBe("=SUM(A1:B7");
  });

  it("keeps the draft parseable when a colon click turns into a drag", () => {
    const clicked = insertReference("=SUM(A1:", null, at("B7"), at("B7"));
    expect(insertReference(clicked.text, clicked.span, at("B7"), at("D9")).text).toBe("=SUM(A1:D9");
  });
});
