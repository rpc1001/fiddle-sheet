import { describe, expect, it } from "vitest";
import { type CellKey, cellKey, parseAddress } from "./address";
import { type Clip, clipText, copyClip, parseClip, pasteWrites, pastedRange } from "./clipboard";
import type { Range } from "./range";

function sheetOf(cells: Record<string, string>) {
  const byKey = new Map<CellKey, string>();
  for (const [address, text] of Object.entries(cells)) {
    const at = parseAddress(address)!;
    byKey.set(cellKey(at.row, at.col), text);
  }
  return (key: CellKey) => byKey.get(key) ?? "";
}

function written(writes: [CellKey, string][]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, text] of writes) {
    const row = Math.floor(key / 26);
    const col = key % 26;
    out[`${String.fromCharCode(65 + col)}${row + 1}`] = text;
  }
  return out;
}

function rangeOf(text: string): Range {
  const [from, to] = text.split(":");
  const one = parseAddress(from!)!;
  const two = parseAddress(to ?? from!)!;
  return { top: one.row, left: one.col, bottom: two.row, right: two.col };
}

function clipOf(cells: Record<string, string>, origin: string, cut = false): Clip {
  return copyClip(sheetOf(cells), rangeOf(origin), cut);
}

describe("copyClip", () => {
  it("takes the raw text, not the value", () => {
    const clip = clipOf({ A1: "=1+1", B1: "two" }, "A1:B1");
    expect(clip.rows).toEqual([["=1+1", "two"]]);
  });

  it("keeps empty cells in place so the block stays a rectangle", () => {
    expect(clipOf({ A1: "1", B2: "4" }, "A1:B2").rows).toEqual([
      ["1", ""],
      ["", "4"],
    ]);
  });
});

describe("clipText", () => {
  it("writes tab separated rows", () => {
    expect(clipText(clipOf({ A1: "1", B1: "2", A2: "3", B2: "4" }, "A1:B2"))).toBe("1\t2\n3\t4");
  });

  it("quotes a cell holding a separator", () => {
    expect(clipText(clipOf({ A1: "a\tb" }, "A1"))).toBe('"a\tb"');
  });
});

describe("parseClip", () => {
  it("reads back what it wrote", () => {
    const clip = clipOf({ A1: "1", B1: "a\tb", A2: "line\none", B2: 'say "hi"' }, "A1:B2");
    expect(parseClip(clipText(clip))).toEqual(clip.rows);
  });

  it("pads short rows so the paste is a block", () => {
    expect(parseClip("1\t2\n3")).toEqual([
      ["1", "2"],
      ["3", ""],
    ]);
  });

  it("takes a trailing newline as the end of the last row", () => {
    expect(parseClip("1\t2\n")).toEqual([["1", "2"]]);
  });

  it("ignores the carriage returns excel pairs with its newlines", () => {
    expect(parseClip("1\r\n2")).toEqual([["1"], ["2"]]);
  });

  it("leaves a quote inside a cell alone", () => {
    expect(parseClip('5" pipe')).toEqual([['5" pipe']]);
  });
});

describe("pastedRange", () => {
  it("lands where it was aimed", () => {
    expect(pastedRange({ row: 2, col: 1 }, 2, 3)).toEqual(rangeOf("B3:D4"));
  });

  it("pushes back inside the sheet rather than lose the far edge", () => {
    expect(pastedRange({ row: 0, col: 24 }, 1, 4)).toEqual(rangeOf("W1:Z1"));
  });

  it("clips a block too big for the sheet", () => {
    expect(pastedRange({ row: 0, col: 0 }, 1, 30)).toEqual(rangeOf("A1:Z1"));
  });
});

describe("pasteWrites", () => {
  it("carries a formula the distance the cell moved", () => {
    const clip = clipOf({ A1: "=B1*2" }, "A1");
    expect(written(pasteWrites(clip, clip.rows, { row: 1, col: 0 }))).toEqual({ A2: "=B2*2" });
  });

  it("leaves a pinned side where it is", () => {
    const clip = clipOf({ A1: "=$B$1*2" }, "A1");
    expect(written(pasteWrites(clip, clip.rows, { row: 1, col: 0 }))).toEqual({ A2: "=$B$1*2" });
  });

  it("takes text from outside as typed, with nothing to offset it by", () => {
    expect(written(pasteWrites(null, [["=B1*2"]], { row: 1, col: 0 }))).toEqual({ A2: "=B1*2" });
  });

  it("blanks what a cut left behind", () => {
    const clip = clipOf({ A1: "1", A2: "2" }, "A1:A2", true);
    expect(written(pasteWrites(clip, clip.rows, { row: 0, col: 1 }))).toEqual({
      B1: "1",
      B2: "2",
      A1: "",
      A2: "",
    });
  });

  it("does not blank the part of a cut it overlaps", () => {
    const clip = clipOf({ A1: "1", A2: "2" }, "A1:A2", true);
    expect(written(pasteWrites(clip, clip.rows, { row: 1, col: 0 }))).toEqual({
      A2: "1",
      A3: "2",
      A1: "",
    });
  });
});
