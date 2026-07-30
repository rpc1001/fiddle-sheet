import { rectOf } from "../core/geometry";
import { selectionRange } from "../core/selection";
import { useSelection } from "../state/selection";

// one positioned element for the whole selection, so extending it never touches
// a cell. the only thing in the grid that re-renders during a drag.
export function SelectionOverlay() {
  const range = selectionRange(useSelection());
  const rect = rectOf(range);

  return (
    <>
      <div className="grid-selection" style={rect} />
      {/* each mark fades out where the selection already reaches the header or
          the gutter, since there it would only double an edge the box has */}
      <div className="grid-rail-track">
        <div className="grid-rail is-column">
          <div
            className="grid-mark is-column"
            style={{ left: rect.left, width: rect.width, opacity: range.top === 0 ? 0 : 1 }}
          />
        </div>
      </div>
      <div className="grid-rail-track">
        <div className="grid-rail is-row">
          <div
            className="grid-mark is-row"
            style={{ top: rect.top, height: rect.height, opacity: range.left === 0 ? 0 : 1 }}
          />
        </div>
      </div>
    </>
  );
}
