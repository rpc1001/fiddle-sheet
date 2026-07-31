import { columnLabel } from "../address";
import { bandOf } from "../geometry";
import { rangeLabel } from "../range";
import { selectionRange } from "../selection";
import type { Entry } from "./history";

// where an action landed. a band is named by the bands it covers rather than by
// the corners it happens to have, which is how the sheet names one everywhere
// else.
export function placeOf(entry: Entry): string {
  const range = selectionRange(entry.selection);
  const band = bandOf(range);
  if (band === "column") return `${columnLabel(range.left)}:${columnLabel(range.right)}`;
  if (band === "row") return `${range.top + 1}:${range.bottom + 1}`;
  return rangeLabel(range);
}
