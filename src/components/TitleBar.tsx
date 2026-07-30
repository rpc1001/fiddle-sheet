import { redo, sheet, undo, useSheetRevision } from "../state/sheet";
import "./TitleBar.css";

// the grid keeps the keyboard: without this the button would take focus and the
// same shortcut would stop working straight after you clicked it
function keepFocus(event: { preventDefault(): void }): void {
  event.preventDefault();
}

export function TitleBar() {
  useSheetRevision();

  return (
    <header className="title-bar">
      <h1 className="title-name">better-sheet</h1>
      <div className="title-actions">
        <button
          type="button"
          className="bar-button"
          title="Undo"
          disabled={!sheet.canUndo()}
          onMouseDown={keepFocus}
          onClick={undo}
        >
          ↶
        </button>
        <button
          type="button"
          className="bar-button"
          title="Redo"
          disabled={!sheet.canRedo()}
          onMouseDown={keepFocus}
          onClick={redo}
        >
          ↷
        </button>
      </div>
    </header>
  );
}
