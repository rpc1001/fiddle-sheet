import { describe, expect, it, vi } from "vitest";
import { type CellKey, cellKey, parseAddress } from "../address";
import { selectionAt } from "../selection";
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
    set(address: string, raw: string) {
      const parsed = parseAddress(address)!;
      sheet.edit([[at(address), raw]], selectionAt(parsed), "type");
    },
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

describe("undo and redo", () => {
  it("has nothing to undo on a fresh sheet", () => {
    const { sheet } = sheetOf({ A1: "1" });
    expect(sheet.peekUndo()).toBeNull();
    expect(sheet.peekRedo()).toBeNull();
  });

  it("does not count seeding as an edit", () => {
    const { sheet, display } = sheetOf({ A1: "1" });
    sheet.undo();
    expect(display("A1")).toBe("1");
  });

  it("puts back the previous text", () => {
    const { sheet, display, set } = sheetOf({ A1: "1" });
    set("A1", "2");
    sheet.undo();
    expect(display("A1")).toBe("1");
  });

  it("puts back an empty cell", () => {
    const { sheet, display, set } = sheetOf();
    set("A1", "typed");
    sheet.undo();
    expect(display("A1")).toBe("");
  });

  it("redoes what was undone", () => {
    const { sheet, display, set } = sheetOf({ A1: "1" });
    set("A1", "2");
    sheet.undo();
    sheet.redo();
    expect(display("A1")).toBe("2");
  });

  it("walks back through several edits one at a time", () => {
    const { sheet, display, set } = sheetOf();
    set("A1", "one");
    set("A1", "two");
    set("A1", "three");

    sheet.undo();
    expect(display("A1")).toBe("two");
    sheet.undo();
    expect(display("A1")).toBe("one");
    sheet.undo();
    expect(display("A1")).toBe("");
  });

  it("treats a multi-cell edit as one action", () => {
    const { sheet, display } = sheetOf({ A1: "1", A2: "2", A3: "3" });
    sheet.edit(
      [
        [at("A1"), ""],
        [at("A2"), ""],
        [at("A3"), ""],
      ],
      selectionAt({ row: 0, col: 0 }),
      "clear",
    );
    expect(display("A1")).toBe("");

    sheet.undo();
    expect([display("A1"), display("A2"), display("A3")]).toEqual(["1", "2", "3"]);
  });

  it("recomputes dependents on undo", () => {
    const { sheet, display, set } = sheetOf({ A1: "1", B1: "=A1*10" });
    set("A1", "5");
    expect(display("B1")).toBe("50");

    sheet.undo();
    expect(display("B1")).toBe("10");
  });

  it("restores a formula, not its result", () => {
    const { sheet, display, set } = sheetOf({ A1: "2", B1: "=A1*3" });
    set("B1", "99");
    sheet.undo();
    expect(sheet.getRaw(at("B1"))).toBe("=A1*3");
    expect(display("B1")).toBe("6");
  });

  it("abandons the redo branch after a new edit", () => {
    const { sheet, display, set } = sheetOf();
    set("A1", "one");
    sheet.undo();
    set("A1", "other");

    expect(sheet.peekRedo()).toBeNull();
    sheet.redo();
    expect(display("A1")).toBe("other");
  });

  it("ignores an edit that changes nothing", () => {
    const { sheet, set } = sheetOf({ A1: "1" });
    set("A1", "1");
    expect(sheet.peekUndo()).toBeNull();
  });

  it("reports what is available as the stack moves", () => {
    const { sheet, set } = sheetOf();
    set("A1", "x");
    expect([sheet.peekUndo(), sheet.peekRedo()].map(Boolean)).toEqual([true, false]);

    sheet.undo();
    expect([sheet.peekUndo(), sheet.peekRedo()].map(Boolean)).toEqual([false, true]);
  });

  it("hands back the selection the edit was made in", () => {
    const { sheet, set } = sheetOf();
    set("C4", "x");

    expect(sheet.undo()).toEqual(selectionAt({ row: 3, col: 2 }));
    expect(sheet.redo()).toEqual(selectionAt({ row: 3, col: 2 }));
  });

  it("hands back nothing when there is nothing to undo", () => {
    const { sheet } = sheetOf();
    expect(sheet.undo()).toBeNull();
    expect(sheet.redo()).toBeNull();
  });

  it("tells watchers once per action", () => {
    const { sheet, set } = sheetOf();
    const watch = vi.fn();
    sheet.onEdit(watch);

    set("A1", "x");
    sheet.undo();
    sheet.redo();
    expect(watch).toHaveBeenCalledTimes(3);
  });

  it("reports the recomputation order, starting at the cell that changed", () => {
    const { sheet, set } = sheetOf({ A2: "=A1+1", A3: "=A2+1" });
    const seen: CellKey[][] = [];
    sheet.onRecalc(({ order }) => seen.push(order));

    set("A1", "1");
    expect(seen).toEqual([[at("A1"), at("A2"), at("A3")]]);
  });

  it("reports the cells a new formula started reading", () => {
    const { sheet, set } = sheetOf({ A1: "2", A2: "3" });
    const seen: CellKey[][] = [];
    sheet.onRecalc(({ connected }) => seen.push(connected));

    set("A3", "=A1+A2");
    expect(seen).toEqual([[at("A1"), at("A2")]]);
  });

  it("reports nothing connected when a formula keeps the same precedents", () => {
    const { sheet, set } = sheetOf({ A1: "2", A3: "=A1*2" });
    const seen: CellKey[][] = [];
    sheet.onRecalc(({ connected }) => seen.push(connected));

    set("A3", "=A1*3");
    expect(seen).toEqual([[]]);
  });

  describe("revise", () => {
    const here = selectionAt({ row: 0, col: 0 });

    it("leaves one action in history rather than a correction on top of a guess", () => {
      const { sheet, display } = sheetOf({ A1: "5" });

      sheet.edit(
        [
          [at("A2"), "6"],
          [at("A3"), "7"],
        ],
        here,
        "fill",
      );
      sheet.revise(
        [
          [at("A2"), "5"],
          [at("A3"), "5"],
        ],
        here,
        "fill",
      );

      expect(display("A2")).toBe("5");
      sheet.undo();
      expect(display("A2")).toBe("");
      expect(display("A3")).toBe("");
      expect(sheet.peekUndo()).toBeNull();
    });

    it("puts back a cell the first reading wrote and the second does not", () => {
      const { sheet, display } = sheetOf({ A1: "5" });

      sheet.edit(
        [
          [at("A2"), "6"],
          [at("A3"), "7"],
        ],
        here,
        "fill",
      );
      sheet.revise([[at("A2"), "9"]], here, "fill");

      expect(display("A2")).toBe("9");
      expect(display("A3")).toBe("");
    });

    it("recomputes dependents of both the reading it drops and the one it takes", () => {
      const { sheet, display } = sheetOf({ A1: "5", B1: "=A2*2" });

      sheet.edit([[at("A2"), "6"]], here, "fill");
      expect(display("B1")).toBe("12");

      sheet.revise([[at("A2"), "10"]], here, "fill");
      expect(display("B1")).toBe("20");
    });

    it("does nothing when there is no action to revise", () => {
      const { sheet, display } = sheetOf({ A1: "5" });

      sheet.revise([[at("A2"), "9"]], here, "fill");
      expect(display("A2")).toBe("");
    });
  });

  it("reports a cell once even when an edit reaches it twice", () => {
    const { sheet } = sheetOf({ C1: "=A1+B1" });
    const seen: CellKey[][] = [];
    sheet.onRecalc(({ order }) => seen.push(order));

    sheet.edit(
      [
        [at("A1"), "1"],
        [at("B1"), "2"],
      ],
      selectionAt({ row: 0, col: 0 }),
      "type",
    );

    expect(seen[0]!.filter((key) => key === at("C1"))).toHaveLength(1);
  });
});
