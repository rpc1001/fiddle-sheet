import { describe, expect, it } from "vitest";
import { blocks } from "./blocks";
import { cellsIn } from "./range";

describe("blocks", () => {
  it("returns nothing for nothing", () => {
    expect(blocks([])).toEqual([]);
  });

  it("keeps a single cell as its own rectangle", () => {
    expect(blocks([{ row: 2, col: 3 }])).toEqual([{ top: 2, left: 3, bottom: 2, right: 3 }]);
  });

  it("merges a column of cells into one", () => {
    const column = { top: 1, left: 1, bottom: 6, right: 1 };
    expect(blocks(cellsIn(column))).toEqual([column]);
  });

  it("merges a rectangle back into itself", () => {
    const box = { top: 0, left: 0, bottom: 3, right: 2 };
    expect(blocks(cellsIn(box))).toEqual([box]);
  });

  it("splits cells that do not touch", () => {
    expect(blocks([{ row: 0, col: 0 }, { row: 5, col: 5 }])).toHaveLength(2);
  });

  it("covers an l shape without overlapping itself", () => {
    const shape = [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ];

    const found = blocks(shape);
    const covered = found.flatMap((range) => [...cellsIn(range)]);

    expect(covered).toHaveLength(shape.length);
    expect(covered).toEqual(expect.arrayContaining(shape));
  });

  it("does not run a rectangle off the end of a row", () => {
    const wrapping = [
      { row: 0, col: 25 },
      { row: 1, col: 0 },
    ];
    expect(blocks(wrapping)).toHaveLength(2);
  });
});
