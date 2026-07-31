import { columnIndex, columnLabel, parseAddress, rowLabel } from "../address";
import { COLS, ROWS } from "../geometry";
import { CHUNK } from "./scan";

// one end of a reference, taken apart far enough to move it: "$B7" is column B
// pinned against a fill, row 7 free to travel. row is null for a whole-column
// side, which names no row and so has none to pin.
export type Side = {
  col: number;
  row: number | null;
  colPinned: boolean;
  rowPinned: boolean;
};

function parseSide(text: string): Side | null {
  const colPinned = text.startsWith("$");
  const rowPinned = /\$\d+$/.test(text);

  const address = parseAddress(text);
  if (address) return { col: address.col, row: address.row, colPinned, rowPinned };

  const col = columnIndex(text);
  return col === null ? null : { col, row: null, colPinned, rowPinned: false };
}

// a side that has been moved off the sheet cannot be written down, and #REF is
// both what a spreadsheet calls that and something the parser will refuse, so
// the cell ends up visibly broken rather than quietly pointing somewhere else
function sideText(side: Side): string {
  if (side.col < 0 || side.col >= COLS) return "#REF";
  if (side.row !== null && (side.row < 0 || side.row >= ROWS)) return "#REF";

  const column = (side.colPinned ? "$" : "") + columnLabel(side.col);
  if (side.row === null) return column;

  return column + (side.rowPinned ? "$" : "") + rowLabel(side.row);
}

// every reference in a formula, put through move and written back. plain text is
// returned untouched: only inside a formula does a letter name a column, and
// rewriting a note that mentions A1 would be a lie about the sheet.
export function rewriteReferences(text: string, move: (side: Side) => Side): string {
  if (!text.startsWith("=")) return text;

  let out = "";
  let cut = 0;

  for (const match of text.matchAll(CHUNK)) {
    const moved = movedChunk(match[0], move);
    if (moved === null) continue;

    out += text.slice(cut, match.index) + moved;
    cut = match.index + match[0].length;
  }

  return out + text.slice(cut);
}

// null for anything that is not a reference, which is how SUM survives being
// three letters that could otherwise pass for one
function movedChunk(chunk: string, move: (side: Side) => Side): string | null {
  const sides = chunk.split(":").map(parseSide);
  if (sides.some((side) => side === null)) return null;

  return sides.map((side) => sideText(move(side!))).join(":");
}
