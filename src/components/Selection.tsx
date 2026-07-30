import { rectOf } from "../core/geometry";
import { selectionRange } from "../core/selection";
import { useSelection } from "../state/selection";

// one positioned element for the whole selection, so extending it never touches
// a cell. the only thing in the grid that re-renders during a drag.
export function SelectionOverlay() {
  const rect = rectOf(selectionRange(useSelection()));

  return <div className="grid-selection" style={rect} />;
}
