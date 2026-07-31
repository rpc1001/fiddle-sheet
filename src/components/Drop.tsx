import { columnLabel } from "../core/address";
import { COL_WIDTH, ROW_HEIGHT, gapOffset, rectOf } from "../core/geometry";
import { rangeAt } from "../core/range";
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
  const label = column
    ? bandLabel(columnLabel(range.left), columnLabel(range.right))
    : bandLabel(String(range.top + 1), String(range.bottom + 1));

  return (
    <>
      <div
        className={column ? "grid-ghost" : "grid-ghost is-row"}
        style={
          column
            ? {
                left: carry.offset,
                width: (range.right - range.left + 1) * COL_WIDTH,
              }
            : {
                top: carry.offset,
                height: (range.bottom - range.top + 1) * ROW_HEIGHT,
              }
        }
      >
        <div className="grid-ghost-label">{label}</div>
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

function bandLabel(first: string, last: string): string {
  return first === last ? first : `${first}:${last}`;
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
