import {
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useRef,
} from "react";
import { cellKey } from "../core/address";
import { SHEET_WIDTH, clampAddress, rectOf } from "../core/geometry";
import { rangeAt } from "../core/range";
import { selectionAt } from "../core/selection";
import { balanceBrackets } from "../core/formula/scan";
import { acceptSuggestion } from "../core/formula/suggest";
import {
  type Editing,
  dismissSuggestions,
  moveHighlight,
  offered,
  setDraft,
  stopEditing,
  useEditing,
} from "../state/editing";
import { setSelection } from "../state/selection";
import { sheet } from "../state/sheet";
import { viewportBox } from "./viewport";

type Open = NonNullable<Editing>;

export function Editor({
  viewport,
  onDone,
}: {
  viewport: RefObject<HTMLDivElement | null>;
  onDone: () => void;
}) {
  const editing = useEditing();
  if (!editing) return null;

  // keyed on the cell so a new cell gets a fresh input rather than a reused one
  const { row, col } = editing.cell;
  return <Draft key={cellKey(row, col)} editing={editing} viewport={viewport} onDone={onDone} />;
}

// a formula or a number reads as mono, the same as the cell underneath, so
// opening the editor does not reshape the text
function isMonospaced(text: string): boolean {
  return text.startsWith("=") || (text !== "" && !Number.isNaN(Number(text)));
}

function Draft({
  editing,
  viewport,
  onDone,
}: {
  editing: Open;
  viewport: RefObject<HTMLDivElement | null>;
  onDone: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const { cell, text, inserted } = editing;

  // a click on the grid wrote a reference into the draft: put the caret after it
  useEffect(() => {
    if (!inserted) return;
    input.current?.setSelectionRange(inserted.end, inserted.end);
  }, [inserted]);

  // focusing the grid on the way out fires blur before react unmounts the input,
  // so without this the same commit would run twice
  function commit(rowStep: number, colStep: number): void {
    if (done.current) return;
    done.current = true;

    sheet.edit([[cellKey(cell.row, cell.col), balanceBrackets(text)]], selectionAt(cell));
    stopEditing();
    if (rowStep !== 0 || colStep !== 0) {
      setSelection(selectionAt(clampAddress(cell.row + rowStep, cell.col + colStep)));
    }
    onDone();
  }

  function cancel(): void {
    done.current = true;
    stopEditing();
    onDone();
  }

  // the suggestion list borrows the keys it needs and hands the rest back, so
  // the field behaves like a field the moment the list is not there
  const { suggestion, highlight } = offered(editing);
  const names = suggestion?.kind === "functions" ? suggestion.matches : null;

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (names && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      moveHighlight(event.key === "ArrowDown" ? 1 : -1, names.length);
    } else if (names && (event.key === "Enter" || event.key === "Tab")) {
      event.preventDefault();
      setDraft(acceptSuggestion(text, names[highlight]!.name));
    } else if (event.key === "Enter") {
      commit(1, 0);
    } else if (event.key === "Tab") {
      event.preventDefault();
      commit(0, event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape") {
      if (names) dismissSuggestions();
      else cancel();
    } else {
      // arrows and the rest belong to the text field while it is open
      return;
    }
    event.stopPropagation();
  }

  const box = rectOf(rangeAt(cell));
  const view = viewportBox(viewport.current);
  const style = {
    left: box.left,
    top: box.top,
    height: box.height,
    minWidth: box.width,
    // a long formula grows to the right, but never past the last column and
    // never past the edge of the window, where it could not be read
    maxWidth: Math.min(SHEET_WIDTH, view.scrollLeft + view.width) - box.left,
  } as CSSProperties;

  const shape = isMonospaced(text) ? " is-monospaced" : "";

  return (
    <div className={`grid-editor${shape}`} style={style}>
      {/* the field grows because this hidden copy of the text sets the width */}
      <span className="grid-editor-mirror">{text}</span>
      <input
        ref={input}
        className="grid-editor-field"
        value={text}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(0, 0)}
      />
    </div>
  );
}
