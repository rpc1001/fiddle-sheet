import { cellKey } from "../core/address";
import { type Doing, hintsFor } from "../core/hints";
import { isSingleCell, rangeLabel } from "../core/range";
import { selectionRange } from "../core/selection";
import { offered, useEditing } from "../state/editing";
import { useSelection } from "../state/selection";
import { sheet, useSheetRevision } from "../state/sheet";
import { chordLabel } from "./platform";
import "./StatusBar.css";

function behindClass(behind: string): string {
  if (behind === "") return "status-behind is-empty";
  return behind.startsWith("=") ? "status-behind is-formula" : "status-behind";
}

export function StatusBar() {
  const selection = useSelection();
  const editing = useEditing();
  // the raw text can change under a still selection, so watch edits too
  useSheetRevision();

  const range = selectionRange(selection);
  const focus = selection.focus;
  // while editing this shows the draft, not what is still stored underneath it
  const behind = editing?.text ?? sheet.getRaw(cellKey(focus.row, focus.col));

  const doing: Doing = editing
    ? {
        kind: "editing",
        formula: editing.text.startsWith("="),
        choosing: offered(editing).suggestion?.kind === "functions",
      }
    : {
        kind: "selecting",
        multi: !isSingleCell(range),
        empty: behind === "",
      };

  // only while the key would actually do something, so the pill never teaches a
  // shortcut that is currently dead
  const history = [
    { keys: chordLabel("Z"), label: "undo", live: sheet.canUndo() },
    { keys: chordLabel("Y"), label: "redo", live: sheet.canRedo() },
  ].filter((hint) => hint.live);

  return (
    <div className="status-bar">
      <span className="status-ref">{rangeLabel(range)}</span>
      <span className={behindClass(behind)}>{behind || "empty"}</span>
      <span className="status-divider" />
      <span className="status-hints">
        {hintsFor(doing).map((hint) => (
          <span key={hint.keys} className="status-hint">
            <kbd className="status-keys">{hint.keys}</kbd>
            {hint.label}
          </span>
        ))}
      </span>
      {history.length > 0 && <span className="status-divider" />}
      {history.map((hint) => (
        <span key={hint.label} className="status-hint">
          <kbd className="status-keys">{hint.keys}</kbd>
          {hint.label}
        </span>
      ))}
    </div>
  );
}
