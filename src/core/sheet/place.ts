import { bandOf } from "../geometry";
import { bandLabel, rangeLabel } from "../range";
import { selectionRange } from "../selection";
import type { Entry } from "./history";

// where an action landed, named the way the sheet names it everywhere else
export function placeOf(entry: Entry): string {
  const range = selectionRange(entry.selection);
  const band = bandOf(range);
  return band ? bandLabel(range, band) : rangeLabel(range);
}
