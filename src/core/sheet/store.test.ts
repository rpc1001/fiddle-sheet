import { describe, expect, it, vi } from "vitest";
import { type CellKey, cellKey, parseAddress } from "../address";
import { createSheet } from "./store";

function at(address: string): CellKey {
  const parsed = parseAddress(address);
  if (!parsed) throw new Error(`bad test address: ${address}`);
  return cellKey(parsed.row, parsed.col);
}

function sheetOf(cells: Record<string, string> = {}) {
  const sheet = createSheet(Object.entries(cells).map(([address, raw]) => [at(address), raw]));
  return {
    sheet,
    display: (address: string) => sheet.getDisplay(at(address)),
    set: (address: string, raw: string) => sheet.setRaw(at(address), raw),
  };
}

describe("store", () => {
  it("shows text as itself", () => {
    expect(sheetOf({ A1: "Rent" }).display("A1")).toBe("Rent");
  });

  it("shows a formula's result, not its text", () => {
    expect(sheetOf({ A1: "2", A2: "3", A3: "=A1+A2" }).display("A3")).toBe("5");
  });

  it("keeps the formula text available separately", () => {
    const { sheet } = sheetOf({ A1: "=1+1" });
    expect(sheet.getRaw(at("A1"))).toBe("=1+1");
    expect(sheet.getDisplay(at("A1"))).toBe("2");
  });

  it("recomputes a dependent when its source changes", () => {
    const { display, set } = sheetOf({ A1: "2", A2: "=A1*10" });
    expect(display("A2")).toBe("20");

    set("A1", "5");
    expect(display("A2")).toBe("50");
  });

  it("recomputes a chain in order", () => {
    const { display, set } = sheetOf({ A1: "1", A2: "=A1+1", A3: "=A2+1", A4: "=A3+1" });
    expect(display("A4")).toBe("4");

    set("A1", "10");
    expect(display("A4")).toBe("13");
  });

  it("recomputes a sum when a cell inside the range changes", () => {
    const { display, set } = sheetOf({ A1: "1", A2: "2", A3: "3", B1: "=SUM(A1:A3)" });
    expect(display("B1")).toBe("6");

    set("A2", "20");
    expect(display("B1")).toBe("24");
  });

  it("recomputes a whole-column sum", () => {
    const { display, set } = sheetOf({ B1: "=SUM(A:A)" });
    set("A50", "7");
    expect(display("B1")).toBe("7");
  });

  it("updates when a cell is cleared", () => {
    const { display, set } = sheetOf({ A1: "5", B1: "=A1+1" });
    set("A1", "");
    expect(display("B1")).toBe("1");
  });

  it("picks up a new dependency when a formula is rewritten", () => {
    const { display, set } = sheetOf({ A1: "1", A2: "100", B1: "=A1" });
    expect(display("B1")).toBe("1");

    set("B1", "=A2");
    expect(display("B1")).toBe("100");

    set("A1", "999");
    expect(display("B1")).toBe("100");
  });

  it("carries an error down the chain and keeps the original blame", () => {
    const { sheet } = sheetOf({ A1: "Rent", B1: "=A1+1", C1: "=B1*2" });
    expect(sheet.getDisplay(at("C1"))).toBe("#VALUE!");
    expect(sheet.getValue(at("C1"))).toMatchObject({
      code: "not-a-number",
      blame: { row: 0, col: 0 },
    });
  });

  it("clears an error once the bad cell is fixed", () => {
    const { display, set } = sheetOf({ A1: "Rent", B1: "=A1+1" });
    expect(display("B1")).toBe("#VALUE!");

    set("A1", "9");
    expect(display("B1")).toBe("10");
  });

  it("marks a formula that reads itself as circular", () => {
    const { display, set } = sheetOf();
    set("A1", "=A1+1");
    expect(display("A1")).toBe("#CYCLE!");
  });

  it("marks a two-cell cycle as circular", () => {
    const { display, set } = sheetOf({ A1: "1" });
    set("A2", "=A1");
    set("A1", "=A2");
    expect(display("A1")).toBe("#CYCLE!");
    expect(display("A2")).toBe("#CYCLE!");
  });

  it("recovers when the cycle is broken", () => {
    const { display, set } = sheetOf();
    set("A1", "=A2");
    set("A2", "=A1");
    set("A2", "4");
    expect(display("A2")).toBe("4");
    expect(display("A1")).toBe("4");
  });

  it("shows unparseable input as an error", () => {
    expect(sheetOf({ A1: "=A1+" }).display("A1")).toBe("#ERROR!");
  });

  it("notifies only the cells that changed", () => {
    const { sheet, set } = sheetOf({ A1: "1", B1: "=A1+1", C1: "9" });
    const watchB = vi.fn();
    const watchC = vi.fn();
    sheet.subscribe(at("B1"), watchB);
    sheet.subscribe(at("C1"), watchC);

    set("A1", "2");

    expect(watchB).toHaveBeenCalledOnce();
    expect(watchC).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", () => {
    const { sheet, set } = sheetOf({ A1: "1" });
    const watch = vi.fn();
    const stop = sheet.subscribe(at("A1"), watch);
    stop();

    set("A1", "2");
    expect(watch).not.toHaveBeenCalled();
  });

  it("ignores a write that changes nothing", () => {
    const { sheet, set } = sheetOf({ A1: "1" });
    const watch = vi.fn();
    sheet.subscribe(at("A1"), watch);

    set("A1", "1");
    expect(watch).not.toHaveBeenCalled();
  });

  it("rounds away floating point noise", () => {
    expect(sheetOf({ A1: "=0.1+0.2" }).display("A1")).toBe("0.3");
  });
});
