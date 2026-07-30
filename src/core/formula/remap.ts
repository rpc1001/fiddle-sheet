import { columnIndex, columnLabel, parseAddress } from "../address";
import { CHUNK } from "./scan";

// a formula rewritten so its references follow their columns to wherever those
// columns now are. columnOf is indexed by the old column and holds the new one.
export function remapColumns(text: string, columnOf: readonly number[]): string {
  return remapped(text, (side) => movedColumn(side, columnOf));
}

// the same for a row move. rowOf is indexed by the old row and holds the new one.
export function remapRows(text: string, rowOf: readonly number[]): string {
  return remapped(text, (side) => movedRow(side, rowOf));
}

// plain text is returned untouched: only inside a formula does a letter name a
// column, and rewriting a note that mentions A1 would be a lie about the sheet.
function remapped(text: string, side: (text: string) => string | null): string {
  if (!text.startsWith("=")) return text;

  let out = "";
  let cut = 0;

  for (const match of text.matchAll(CHUNK)) {
    const moved = movedChunk(match[0], side);
    if (moved === null) continue;

    out += text.slice(cut, match.index) + moved;
    cut = match.index + match[0].length;
  }

  return out + text.slice(cut);
}

// null for anything that is not a reference, which is how SUM survives being
// three letters that could otherwise pass for one
function movedChunk(chunk: string, side: (text: string) => string | null): string | null {
  const moved = chunk.split(":").map(side);
  if (moved.some((one) => one === null)) return null;

  return moved.join(":");
}

// a range keeps the two columns it was written with even when the move takes
// them apart, so it still spans the same data and simply covers more of the sheet
function movedColumn(side: string, columnOf: readonly number[]): string | null {
  const address = parseAddress(side);
  if (address) return `${columnLabel(columnOf[address.col]!)}${address.row + 1}`;

  const col = columnIndex(side);
  return col === null ? null : columnLabel(columnOf[col]!);
}

// a whole column reference names no row, so a row move leaves it as it is: A:A
// is still every row of A wherever those rows have gone
function movedRow(side: string, rowOf: readonly number[]): string | null {
  const address = parseAddress(side);
  if (address) return `${columnLabel(address.col)}${rowOf[address.row]! + 1}`;

  return columnIndex(side) === null ? null : side;
}
