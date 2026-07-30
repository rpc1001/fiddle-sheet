import { useEffect, useRef } from "react";
import { coversEveryColumn, coversEveryRow, insetOf, switchesAxis } from "../core/geometry";
import { type Range, sameSize } from "../core/range";
import { selectionRange } from "../core/selection";
import { useSelection } from "../state/selection";

// how the box gets from the last selection to this one. an arrival is for a
// change with no edge to travel along, a travel is the whole box moving at one
// distance, and everything else settles into its new size.
function motionFrom(before: Range, after: Range): string {
  if (switchesAxis(before, after)) return " is-arriving";
  return sameSize(before, after) ? " is-travelling" : "";
}

// one positioned element for the whole selection, so extending it never touches
// a cell. the only thing in the grid that re-renders during a drag.
export function SelectionOverlay() {
  const range = selectionRange(useSelection());
  const previous = useRef(range);
  const motion = motionFrom(previous.current, range);

  // after the commit, so the render above always compares against the selection
  // currently on screen and not against itself
  useEffect(() => {
    previous.current = range;
  });

  const inset = insetOf(range);
  const wholeColumns = coversEveryRow(range);
  const wholeRows = coversEveryColumn(range);

  return (
    <>
      <div
        className={`grid-selection${wholeColumns ? " is-capped-top" : ""}${
          wholeRows ? " is-capped-left" : ""
        }${motion}`}
        style={{ left: inset.left, top: inset.top, right: inset.right, bottom: inset.bottom }}
      />
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
