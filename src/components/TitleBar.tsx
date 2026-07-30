import { redo, sheet, undo, useSheetRevision } from "../state/sheet";
import "./TitleBar.css";

export function TitleBar({ onDone }: { onDone: () => void }) {
  useSheetRevision();

  function run(action: () => void): void {
    action();
    // hand the keyboard straight back so undo can be repeated from the keys
    onDone();
  }

  return (
    <header className="title-bar">
      <button
        type="button"
        className="bar-button"
        title="Undo"
        disabled={!sheet.canUndo()}
        onClick={() => run(undo)}
      >
        ↶
      </button>
      <button
        type="button"
        className="bar-button"
        title="Redo"
        disabled={!sheet.canRedo()}
        onClick={() => run(redo)}
      >
        ↷
      </button>
    </header>
  );
}
