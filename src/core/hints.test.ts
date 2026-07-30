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
    expect(keys(hintsFor({ kind: "editing", formula: true, choosing: false }))).toContain("click");
    expect(keys(hintsFor({ kind: "editing", formula: false, choosing: false }))).not.toContain("click");
  });

  it("hands the keys to the suggestion list while it is open", () => {
    expect(keys(hintsFor({ kind: "editing", formula: true, choosing: true }))).toEqual([
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
      hintsFor({ kind: "editing", formula: true, choosing: false }),
      hintsFor({ kind: "editing", formula: false, choosing: false }),
    ].flat();
    for (const hint of every) expect(hint.label.split(" ").length).toBeLessThanOrEqual(2);
  });

  it("never shows more than three", () => {
    const every = [
      hintsFor({ kind: "selecting", multi: false, empty: true }),
      hintsFor({ kind: "selecting", multi: false, empty: false }),
      hintsFor({ kind: "selecting", multi: true, empty: false }),
      hintsFor({ kind: "editing", formula: true, choosing: false }),
      hintsFor({ kind: "editing", formula: false, choosing: false }),
    ];
    for (const hints of every) expect(hints.length).toBeLessThanOrEqual(3);
  });
});
