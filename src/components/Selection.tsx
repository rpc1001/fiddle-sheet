import { useEffect, useRef } from "react";
import type { Address } from "../core/address";
import { coversEveryColumn, coversEveryRow, insetOf, switchesAxis } from "../core/geometry";
import { type Range, isSingleCell, sameSize } from "../core/range";
import { sameCell, selectionRange } from "../core/selection";
import { useClip } from "../state/clipboard";
import { useEditingCell } from "../state/editing";
import { useFilling, useOffer } from "../state/filling";
import { useSelection } from "../state/selection";

// how the box gets from the last selection to this one. an arrival is for a
// change with no edge to travel along, a travel is the whole box moving at one
// distance, and everything else settles into its new size.
function motionFrom(before: Range, after: Range): string {
  if (switchesAxis(before, after)) return " is-arriving";
  return sameSize(before, after) ? " is-travelling" : "";
}

// the editor draws the same rectangle at the same cell, so the box steps aside
// for it. only when it is standing in for the whole selection: typing over a
// range opens on one cell of it, and the rest of the range is still selected.
function handedOver(range: Range, open: Address | null): boolean {
  if (!open || !isSingleCell(range)) return false;
  return sameCell({ row: range.top, col: range.left }, open);
}

// one positioned element for the whole selection, so extending it never touches
// a cell. a drag re-renders this and the handful of panels that describe the
// selection, and no cell at all.
export function SelectionOverlay() {
  const range = selectionRange(useSelection());
  const editing = handedOver(range, useEditingCell());
  const filling = useFilling();
  const filled = useOffer() !== null;
  const clip = useClip();
  const previous = useRef(range);
  const motion = motionFrom(previous.current, range);

  // after the commit, so the render above always compares against the selection
  // currently on screen and not against itself
  useEffect(() => {
    previous.current = range;
  });

  const inset = insetOf(range);
  // a lid on the header says "these columns, all the way down", which is worth
  // saying about C and D and says nothing about all of them. the whole sheet is
  // not a band of anything, so it is drawn as what it is: every cell selected.
  const everything = coversEveryRow(range) && coversEveryColumn(range);
  const wholeColumns = coversEveryRow(range) && !everything;
  const wholeRows = coversEveryColumn(range) && !everything;

  return (
    <>
      {/* how far the fill would reach if it were let go now. it is drawn as its
          own box rather than by stretching the selection, because the selection
          is the thing being filled from and has to stay where it is to say so. */}
      {filling && <div className="grid-fill-extent" style={insetOf(filling)} />}
      {/* what is on the clipboard, still where it was taken from. it outlives
          the selection moving away, which is the whole point of it: the answer
          to "what am I about to paste" has to be on the sheet, not in memory. */}
      {clip && (
        <div className={`grid-clip${clip.cut ? " is-cut" : ""}`} style={insetOf(clip.origin)} />
      )}
      <div
        className={`grid-selection${wholeColumns ? " is-capped-top" : ""}${
          wholeRows ? " is-capped-left" : ""
        }${motion}${editing ? " is-editing" : ""}${filled ? " is-filled" : ""}`}
        style={inset}
      >
        {/* the corner is the only part of the box that is a control. it is inside
            the box so it travels with it on the box's own transition. */}
        <div className="grid-fill-handle" />
      </div>
      {/* the mark has to be its own element because it stays in the header while
          the box scrolls away, and it cannot be folded into the box: the box has
          to pass under the gutter as it scrolls sideways, and a lid has to sit
          over the header, which is one order and one element too few. it takes
          its edges from the same inset as the box, so the two halves of a band
          travel as one. it fades out where the box already reaches the header,
          where it would only double an edge. */}
      <div className="grid-rail-track">
        <div className="grid-rail is-column">
          <div
            className={`grid-mark is-column${wholeColumns ? " is-band" : ""}${motion}`}
            style={{
              left: inset.left,
              right: inset.right,
              opacity: range.top === 0 && !wholeColumns ? 0 : 1,
            }}
          />
        </div>
      </div>
      <div className="grid-rail-track">
        <div className="grid-rail is-row">
          <div
            className={`grid-mark is-row${wholeRows ? " is-band" : ""}${motion}`}
            style={{
              top: inset.top,
              bottom: inset.bottom,
              opacity: range.left === 0 && !wholeRows ? 0 : 1,
            }}
          />
        </div>
      </div>
    </>
  );
}
