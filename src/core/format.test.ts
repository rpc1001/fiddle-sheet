import { describe, expect, it } from "vitest";
import { formatNumber } from "./format";

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(2400)).toBe("2,400");
  });

  it("leaves a whole number whole", () => {
    expect(formatNumber(470)).toBe("470");
  });

  it("stops at two decimals", () => {
    expect(formatNumber(509.63333333)).toBe("509.63");
  });

  it("drops the float noise", () => {
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
  });

  it("keeps a small number visible rather than rounding it to zero", () => {
    expect(formatNumber(0.00042)).toBe("0.00042");
  });

  it("keeps the sign", () => {
    expect(formatNumber(-16.5)).toBe("-16.5");
  });
});
