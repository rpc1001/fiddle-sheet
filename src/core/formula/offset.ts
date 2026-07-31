import { rewriteReferences } from "./rewrite";

// a formula copied to a cell rowStep down and colStep across, with its
// references carried the same distance. this is what makes a column of
// "=A2*B2" out of one cell: the formula says the same thing about a different
// row. a pinned side stays where it is, which is the only reason pins exist.
export function offsetFormula(text: string, rowStep: number, colStep: number): string {
  if (rowStep === 0 && colStep === 0) return text;

  return rewriteReferences(text, (side) => ({
    ...side,
    col: side.colPinned ? side.col : side.col + colStep,
    row: side.row === null || side.rowPinned ? side.row : side.row + rowStep,
  }));
}
