import { gapOffset, rectOf } from "../core/geometry";
import { bandLabel, rangeAt } from "../core/range";
import { selectionRange } from "../core/selection";
import { useMoving } from "../state/moving";
import { useQuoting } from "../state/quoting";
import { useSelection } from "../state/selection";

// what is being carried and where it would land. the ghost tracks the pointer
// with no easing of its own: it stands in for the hand, and a hand does not
// settle. the line snaps between boundaries, because a boundary is a choice.
export function DropLine() {
  const carry = useMoving();
  const range = selectionRange(useSelection());
  if (!carry) return null;

  const column = carry.axis === "column";
  const box = rectOf(range);
  const label = bandLabel(range, carry.axis);

  return (
    <>
      {/* the ghost is held against the edge the header and the gutter hold, so it
          rides in a track of its own the way the selection's rails do */}
      <div className="grid-ghost-track">
        <div className={column ? "grid-ghost-rail" : "grid-ghost-rail is-row"}>
          <div
            className={column ? "grid-ghost" : "grid-ghost is-row"}
            style={
              column
                ? { left: carry.offset, width: box.width }
                : { top: carry.offset, height: box.height }
            }
          >
            <div className="grid-ghost-label">{label}</div>
          </div>
        </div>
      </div>
      <div
        className={column ? "grid-drop" : "grid-drop is-row"}
        style={
          column ? { left: gapOffset(carry.gap, "column") } : { top: gapOffset(carry.gap, "row") }
        }
      />
    </>
  );
}

// the formula a carried block would write, hanging off the pointer, and the
// cell it would be written into. the text is the whole affordance: it says
// what is about to happen in the language the cell will hold, so the gesture
// teaches the formula rather than just performing it.
export function QuoteGhost() {
  const quote = useQuoting();
  if (!quote) return null;

  const target = quote.onto ? rectOf(rangeAt(quote.onto)) : null;

  return (
    <>
      {target && (
        <div
          className="grid-quote-target"
          style={{ left: target.left, top: target.top, width: target.width, height: target.height }}
        />
      )}
      <div className="grid-quote-ghost" style={{ left: quote.x, top: quote.y }}>
        {quote.text}
      </div>
    </>
  );
}
