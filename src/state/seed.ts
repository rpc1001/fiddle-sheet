import { type CellKey, cellKey } from "../core/address";

// the sheet opens unfinished on purpose: the number in A2 and the formulas in
// E2 and F2 are each the first cell of a column that the fill handle completes.
const rows: [number, number, string][] = [
  [0, 0, "#"],
  [0, 1, "Category"],
  [0, 2, "Budget"],
  [0, 3, "Actual"],
  [0, 4, "Diff"],
  [0, 5, "Share %"],

  [1, 0, "1"],
  [1, 1, "Rent"],
  [1, 2, "2400"],
  [1, 3, "2400"],
  [1, 4, "=C2-D2"],
  [1, 5, "=D2/$I$3*100"],

  [2, 1, "Groceries"],
  [2, 2, "640"],
  [2, 3, "712"],

  [3, 1, "Utilities"],
  [3, 2, "180"],
  [3, 3, "164"],

  [4, 1, "Transport"],
  [4, 2, "120"],
  [4, 3, "98"],

  [5, 1, "Dining"],
  [5, 2, "260"],
  [5, 3, "331"],

  [6, 1, "Health"],
  [6, 2, "95"],
  [6, 3, "95"],

  // whole-column references, so the summary is already right about rows that
  // have not been typed yet
  [0, 7, "Summary"],
  [1, 7, "Budget"],
  [1, 8, "=SUM(C:C)"],
  [2, 7, "Actual"],
  [2, 8, "=SUM(D:D)"],
  [3, 7, "Left"],
  [3, 8, "=I2-I3"],
  [4, 7, "Typical"],
  [4, 8, "=AVERAGE(D:D)"],
  [5, 7, "Lines"],
  [5, 8, "=COUNT(D:D)"],
];

export const seed: [CellKey, string][] = rows.map(([row, col, raw]) => [cellKey(row, col), raw]);
