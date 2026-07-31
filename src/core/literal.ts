import type { CellValue } from "./formula/errors";

// what the sheet makes of text that is not a formula. the cell, the draft on its
// way to becoming the cell, and the fill reading a run of them all have to agree
// about what counts as a number, or text changes shape when it is committed.
export function isNumericText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed !== "" && !Number.isNaN(Number(trimmed));
}

export function literalValue(text: string): CellValue {
  if (text.trim() === "") return "";
  return isNumericText(text) ? Number(text) : text;
}
