import { COLS, ROWS } from "./geometry";

const A = "A".charCodeAt(0);

export function columnLabel(col: number): string {
  return String.fromCharCode(A + col);
}

// rows are stored from zero and read from one, everywhere they are shown
export function rowLabel(row: number): string {
  return String(row + 1);
}

// a leading "$" pins the column against a fill and says nothing about which
// column it is, so every reader that only wants the letter can ignore it
export function columnIndex(label: string): number | null {
  const letter = label.startsWith("$") ? label.slice(1) : label;
  if (letter.length !== 1) return null;
  const col = letter.toUpperCase().charCodeAt(0) - A;
  return col >= 0 && col < COLS ? col : null;
}

export type Address = { row: number; col: number };

export function addressLabel(address: Address): string {
  return `${columnLabel(address.col)}${rowLabel(address.row)}`;
}

// one number per cell, so the store and the dependency graph can key plain maps
export type CellKey = number;

export function cellKey(row: number, col: number): CellKey {
  return row * COLS + col;
}

export function addressOf(key: CellKey): Address {
  return { row: Math.floor(key / COLS), col: key % COLS };
}

// "B7" -> { row: 6, col: 1 }. null for anything out of the sheet's bounds.
// "$B$7" is the same cell: the pins belong to fill, not to the address.
export function parseAddress(text: string): Address | null {
  const match = /^\$?([A-Za-z])\$?([0-9]+)$/.exec(text);
  if (!match) return null;

  const col = columnIndex(match[1]!);
  if (col === null) return null;

  const row = Number(match[2]) - 1;
  return row >= 0 && row < ROWS ? { row, col } : null;
}
