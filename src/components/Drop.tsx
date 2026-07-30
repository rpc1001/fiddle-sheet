import { columnLabel } from "../core/address";
import { COL_WIDTH, ROW_HEIGHT, gapOffset } from "../core/geometry";
import { selectionRange } from "../core/selection";
import { useMoving } from "../state/moving";
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
