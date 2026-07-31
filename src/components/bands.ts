import type { Address } from "../core/address";
import {
  COLS,
  type Axis,
  type Zone,
  coversEveryColumn,
  coversEveryRow,
} from "../core/geometry";
import { moveColumns, moveRows } from "../core/sheet/move";
import { type Selection, columnSpan, rowSpan, selectionRange } from "../core/selection";
import { getSelection, setSelection } from "../state/selection";
import { sheet } from "../state/sheet";

// a press on the header, the gutter or the corner selects whole columns or
// whole rows. shift keeps the band anchored where it started.
export function bandAt(zone: Zone, cell: Address, extend: boolean): Selection {
  const anchor = getSelection().anchor;
  if (zone === "corner") return columnSpan(0, COLS - 1);
  if (zone === "header") return columnSpan(extend ? anchor.col : cell.col, cell.col);
  return rowSpan(extend ? anchor.row : cell.row, cell.row);
}

// a press on a header or a gutter already inside the band picks the band up
// rather than selecting it again, which is the only press with nothing else to
// mean. null when the press means something else.
export function bandPickedUp(zone: Zone, cell: Address): Axis | null {
  const range = selectionRange(getSelection());

  if (zone === "header" && coversEveryRow(range)) {
    return cell.col >= range.left && cell.col <= range.right ? "column" : null;
  }
  if (zone === "gutter" && coversEveryColumn(range)) {
    return cell.row >= range.top && cell.row <= range.bottom ? "row" : null;
  }
  return null;
}

// the bands keep the order they are dropped in, and the selection follows them
// so the block is still the thing under the pointer afterwards. empty bands
// write nothing and still move: the block went somewhere either way.
export function dropBand(axis: Axis, gap: number): void {
  const before = getSelection();
  const range = selectionRange(before);

  const move =
    axis === "column"
      ? moveColumns(sheet.getRaw, range.left, range.right, gap)
      : moveRows(sheet.getRaw, range.top, range.bottom, gap);

  // the history entry keeps the band where it was picked up, so undoing puts
  // both the cells and the selection back where they started
  if (move.writes.length > 0) sheet.edit(move.writes, before, "move");

  const span = axis === "column" ? range.right - range.left : range.bottom - range.top;
  setSelection(
    axis === "column"
      ? columnSpan(move.start + span, move.start)
      : rowSpan(move.start + span, move.start),
  );
}

// the band a press lands on, when the press is only selecting one. a press that
// never travelled is a click, and a click inside a carried block still means
// that one column or row.
export function selectBand(axis: Axis, band: number): void {
  setSelection(axis === "column" ? columnSpan(band, band) : rowSpan(band, band));
}
