import { type CellKey, cellKey } from "../core/address";

type Block = (string | number)[][];

// laid out as the sheet reads rather than as a list of addresses, so a row of
// the table is a row here. "" leaves the cell alone; 0 is a value and is kept.
function place(top: number, left: number, cells: Block): [CellKey, string][] {
  return cells.flatMap((row, down) =>
    row.flatMap((value, across): [CellKey, string][] =>
      value === "" ? [] : [[cellKey(top + down, left + across), String(value)]],
    ),
  );
}

// the sheet opens unfinished on purpose: A2, E2, F2 and G2 each start a column
// the fill completes, and row 20 is a total with nothing in it yet.
//
// D9 holds a word where the column holds numbers, and it is wrong on purpose.
// SUM skips text inside a range, so the summary stays right, while E9 and F9
// read it directly and both come back blaming D9.
const TABLE: Block = [
  ["#", "Site", "Budget", "Actual", "Diff", "Share %", "Invoice"],
  [1, "Rent", 2400, 2400, "=C2-D2", "=D2/$J$3*100", "INV 1001"],
  ["", "Groceries", 640, 712],
  ["", "Utilities", 180, 164],
  ["", "Transport", 120, 98],
  ["", "Dining", 260, 331],
  ["", "Health", 95, 95],
  ["", "Software", 210, 248],
  ["", "Travel", 450, "pending"],
  ["", "Hardware", 380, 366],
  ["", "Training", 150, 0],
  ["", "Marketing", 520, 604],
  ["", "Insurance", 240, 240],
  ["", "Legal", 300, 175],
  ["", "Shipping", 130, 142],
  ["", "Supplies", 85, 97],
  ["", "Phone", 60, 58],
  ["", "Storage", 75, 75],
];

// J3 is what the share column divides by, which is why F2 pins it: filled down,
// every row reads the same total. COUNT takes the whole column instead, so it is
// already right about rows nobody has typed yet.
const SUMMARY: Block = [
  ["Summary"],
  ["Budget", "=SUM(C2:C18)"],
  ["Actual", "=SUM(D2:D18)"],
  ["Left", "=J2-J3"],
  ["Typical", "=AVERAGE(D2:D18)"],
  ["Lines", "=COUNT(A:A)"],
];

// a label with nothing beside it: the totals are what the block carried onto a
// cell writes, and the summary reads C2:C18, so landing one here changes nothing
const TOTAL: Block = [["Total"]];

// one of every error the engine can raise, kept off the table so the document
// itself stays right. the gap above them is what a held arrow jumps.
const ERRORS: Block = [
  ["Errors, on purpose"],
  ["divides by zero", "=C11/D11"],
  ["no such function", "=TOTAL(C2:C18)"],
  ["depends on itself", "=C27+1"],
  ["text, not a number", "=B24*2"],
  ["nothing to average", "=AVERAGE(Z50:Z60)"],
];

// two cells state a run, so the fill counts it out and does not offer to copy
// instead. the halves are there to land on a step the arithmetic has to round.
const SERIES: Block = [["Fill me"], [5, 0.5], [10, 1]];

export const seed: [CellKey, string][] = [
  ...place(0, 0, TABLE),
  ...place(0, 8, SUMMARY),
  ...place(19, 1, TOTAL),
  ...place(23, 1, ERRORS),
  ...place(23, 4, SERIES),
];
