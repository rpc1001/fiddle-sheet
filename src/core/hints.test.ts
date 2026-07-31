import { describe, expect, it } from "vitest";
import { hintsFor } from "./hints";

const keys = (hints: { keys: string }[]): string[] => hints.map((hint) => hint.keys);

describe("hintsFor", () => {
  it("offers a way in on an empty cell", () => {
    expect(keys(hintsFor({ kind: "selecting", multi: false, empty: true }))).toEqual(["type", "="]);
  });

  it("offers edit and clear once the cell holds something", () => {
    expect(keys(hintsFor({ kind: "selecting", multi: false, empty: false }))).toEqual(["↵", "⌫"]);
  });

  it("talks about the whole range when more than one cell is selected", () => {
    expect(keys(hintsFor({ kind: "selecting", multi: true, empty: false }))).toEqual([
      "⇧ arrows",
      "⌫",
    ]);
  });

  it("mentions clicking a cell only while a formula is open", () => {
    expect(keys(hintsFor({ kind: "editing", formula: true, list: "none" }))).toContain("click");
    expect(keys(hintsFor({ kind: "editing", formula: false, list: "none" }))).not.toContain("click");
  });

  it("leaves enter with the cell while the list is only open", () => {
    expect(keys(hintsFor({ kind: "editing", formula: true, list: "showing" }))).toEqual([
      "↑↓",
      "↵",
      "esc",
    ]);
    expect(hintsFor({ kind: "editing", formula: true, list: "showing" })[1]!.label).toBe("save");
  });

  it("hands the keys to the suggestion list once it is being used", () => {
    expect(keys(hintsFor({ kind: "editing", formula: true, list: "taking" }))).toEqual([
      "↑↓",
      "↵",
      "esc",
    ]);
  });

  it("keeps every label to a word or two", () => {
    const every = [
      hintsFor({ kind: "selecting", multi: false, empty: true }),
      hintsFor({ kind: "selecting", multi: false, empty: false }),
      hintsFor({ kind: "selecting", multi: true, empty: false }),
      hintsFor({ kind: "editing", formula: true, list: "none" }),
      hintsFor({ kind: "editing", formula: false, list: "none" }),
      hintsFor({ kind: "editing", formula: true, list: "showing" }),
      hintsFor({ kind: "editing", formula: true, list: "taking" }),
    ].flat();
    for (const hint of every) expect(hint.label.split(" ").length).toBeLessThanOrEqual(2);
  });

  it("never shows more than three", () => {
    const every = [
      hintsFor({ kind: "selecting", multi: false, empty: true }),
      hintsFor({ kind: "selecting", multi: false, empty: false }),
      hintsFor({ kind: "selecting", multi: true, empty: false }),
      hintsFor({ kind: "editing", formula: true, list: "none" }),
      hintsFor({ kind: "editing", formula: false, list: "none" }),
      hintsFor({ kind: "editing", formula: true, list: "showing" }),
      hintsFor({ kind: "editing", formula: true, list: "taking" }),
    ];
    for (const hints of every) expect(hints.length).toBeLessThanOrEqual(3);
  });
});
