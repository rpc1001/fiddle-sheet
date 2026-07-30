import { describe, expect, it } from "vitest";
import { summarize } from "./summary";

const error = { code: "divide-by-zero", blame: null, detail: "" } as const;

describe("summarize", () => {
  it("counts every cell it is given, filled or not", () => {
    const summary = summarize(["", 2, "text", ""]);
    expect(summary.cells).toBe(4);
    expect(summary.filled).toBe(2);
  });

  it("reports nothing when no value is a number", () => {
    expect(summarize(["", "text"]).numbers).toBeNull();
  });

  it("ignores text and empty cells in the arithmetic", () => {
    expect(summarize(["Budget", 10, "", 30]).numbers).toEqual({
      count: 2,
      sum: 40,
      average: 20,
      min: 10,
      max: 30,
    });
  });

  it("counts an error cell as filled without letting it reach the numbers", () => {
    const summary = summarize([error, 4]);
    expect(summary.filled).toBe(2);
    expect(summary.numbers?.count).toBe(1);
  });
});
