import { type Address, type CellKey, cellKey } from "./address";
import { offsetFormula } from "./formula/offset";
import { COLS, ROWS, clampBetween } from "./geometry";
import { type Range, cellsIn } from "./range";
import type { Read } from "./sheet/store";

// what was taken, kept as raw text rather than as displayed values: a copied
// formula has to arrive as a formula. the origin range is here because a paste
// carries references the distance the cells themselves moved, and that distance
// cannot be worked out from the text.
export type Clip = { origin: Range; cut: boolean; rows: string[][] };

export function copyClip(read: Read, origin: Range, cut: boolean): Clip {
  const rows: string[][] = [];
  for (let row = origin.top; row <= origin.bottom; row++) {
    const line: string[] = [];
    for (let col = origin.left; col <= origin.right; col++) line.push(read(cellKey(row, col)));
    rows.push(line);
  }
  return { origin, cut, rows };
}

// tab separated, the one format every spreadsheet reads and writes. a cell
// holding a tab or a newline would break the grid apart on the way back in, so
// it is quoted the way csv quotes, which is what sheets and excel both expect.
export function clipText(clip: Clip): string {
  return clip.rows.map((line) => line.map(escapeCell).join("\t")).join("\n");
}

function escapeCell(text: string): string {
  if (!/[\t\n"]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

// text from anywhere back into a grid. anything that is not a rectangle is made
// one by padding the short lines, since the paste has to write a block.
export function parseClip(text: string): string[][] {
  const rows = splitRows(text);
  const width = Math.max(...rows.map((line) => line.length));
  return rows.map((line) => [...line, ...Array(width - line.length).fill("")]);
}

// a quoted cell may hold the separators, so the split has to walk the text
// rather than cut it. quotes are only special at the start of a cell, which is
// what lets an unquoted 5" arrive as 5".
function splitRows(text: string): string[][] {
  const rows: string[][] = [[]];
  let cell = "";
  let quoted = false;
  let fresh = true;

  const endCell = () => {
    rows[rows.length - 1]!.push(cell);
    cell = "";
    fresh = true;
  };

  for (let at = 0; at < text.length; at++) {
    const char = text[at]!;

    if (quoted) {
      if (char !== '"') cell += char;
      else if (text[at + 1] === '"') {
        cell += '"';
        at++;
      } else quoted = false;
      continue;
    }

    if (char === '"' && fresh) quoted = true;
    else if (char === "\t") endCell();
    else if (char === "\n") {
      endCell();
      rows.push([]);
    } else if (char !== "\r") {
      cell += char;
      fresh = false;
    }
  }

  endCell();

  // a trailing newline ends the last row rather than starting an empty one
  const last = rows[rows.length - 1]!;
  if (rows.length > 1 && last.length === 1 && last[0] === "") rows.pop();

  return rows;
}

// where a block of this size lands when dropped at target. it is pushed back
// inside the sheet rather than truncated: losing the far edge of a paste is
// worse than landing a row short of where it was aimed.
export function pastedRange(target: Address, height: number, width: number): Range {
  const top = clampBetween(target.row, 0, ROWS - height);
  const left = clampBetween(target.col, 0, COLS - width);
  return {
    top,
    left,
    bottom: Math.min(ROWS, top + height) - 1,
    right: Math.min(COLS, left + width) - 1,
  };
}

// the cells a paste writes, and the block it filled. the landing is returned
// rather than left to the caller to work out again: a clip pushed back inside the
// sheet does not land where it was aimed, and only this knows where it went.
export type Paste = { writes: [CellKey, string][]; landing: Range };

// a clip of ours carries its formulas the distance it moved; text from outside has
// no origin to have moved from and lands as typed. a cut also blanks whatever it
// left behind, in the same list, so the whole move is one edit and one undo.
export function pasteWrites(clip: Clip | null, rows: string[][], target: Address): Paste {
  const landing = pastedRange(target, rows.length, rows[0]?.length ?? 0);
  const rowStep = landing.top - (clip?.origin.top ?? landing.top);
  const colStep = landing.left - (clip?.origin.left ?? landing.left);

  const writes: [CellKey, string][] = [];
  const written = new Set<CellKey>();

  for (let row = landing.top; row <= landing.bottom; row++) {
    for (let col = landing.left; col <= landing.right; col++) {
      const text = rows[row - landing.top]![col - landing.left]!;
      const key = cellKey(row, col);
      writes.push([key, clip ? offsetFormula(text, rowStep, colStep) : text]);
      written.add(key);
    }
  }

  if (clip?.cut) {
    for (const cell of cellsIn(clip.origin)) {
      const key = cellKey(cell.row, cell.col);
      if (!written.has(key)) writes.push([key, ""]);
    }
  }

  return { writes, landing };
}
