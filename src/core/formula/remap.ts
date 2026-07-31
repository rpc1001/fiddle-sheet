import { type Side, rewriteReferences } from "./rewrite";

// a formula rewritten so its references follow their columns to wherever those
// columns now are. columnOf is indexed by the old column and holds the new one.
export function remapColumns(text: string, columnOf: readonly number[]): string {
  return rewriteReferences(text, (side) => ({ ...side, col: columnOf[side.col]! }));
}

// the same for a row move. rowOf is indexed by the old row and holds the new one.
// a whole-column reference names no row, so a row move leaves it as it is: A:A
// is still every row of A wherever those rows have gone.
export function remapRows(text: string, rowOf: readonly number[]): string {
  return rewriteReferences(text, (side) => ({ ...side, row: movedRow(side, rowOf) }));
}

function movedRow(side: Side, rowOf: readonly number[]): number | null {
  return side.row === null ? null : rowOf[side.row]!;
}
