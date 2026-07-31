import {
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cellKey } from "../core/address";
import { spreadWrites } from "../core/entry";
import { SHEET_WIDTH, clampAddress, rectOf } from "../core/geometry";
import { rangeAt } from "../core/range";
import { selectionAt, selectionRange } from "../core/selection";
import { balanceBrackets, expandColumns } from "../core/formula/scan";
import { acceptSuggestion } from "../core/formula/suggest";
import {
  type Editing,
  dismissSuggestions,
  enterList,
  moveHighlight,
  offered,
  setDraft,
  stopEditing,
  useEditing,
} from "../state/editing";
import { getSelection, setSelection } from "../state/selection";
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

function isNumeric(text: string): boolean {
  return text !== "" && !Number.isNaN(Number(text));
}

// a formula or a number reads as mono, the same as the cell underneath, so
// opening the editor does not reshape the text
function isMonospaced(text: string): boolean {
  return text.startsWith("=") || isNumeric(text);
}

// the second click of a double click says the first one was not browsing: the
// box is on its way to a cell that is about to be opened, so the rest of the
// trip runs at this much of its own speed. the curve is unchanged, it is the
// same move told to get on with it.
const HURRY = 3;

// a double click sets the selection on the first press and opens the editor on
// the second, which is well inside the box's travel. the thing that arrives has
// to be the thing that opens, so the draft holds until the box is still and
// takes over where it lands. the box itself is asked, not a clock: it is the one
// that knows, and a cell already selected has nothing running to wait for.
function useHurriedLanding(viewport: RefObject<HTMLDivElement | null>): boolean {
  const [held, setHeld] = useState(true);

  useLayoutEffect(() => {
    const box = viewport.current?.querySelector(".grid-selection");
    // the hand over that hides the box is an animation on the same element, and
    // it is not part of the trip
    const flight = (box?.getAnimations() ?? []).filter((move) => move instanceof CSSTransition);

    if (flight.length === 0) {
      setHeld(false);
      return;
    }

    for (const move of flight) move.updatePlaybackRate(HURRY);

    let live = true;
    const land = () => {
      if (live) setHeld(false);
    };
    // a cancelled travel rejects, and a box that stopped travelling has landed
    // as far as this is concerned
    Promise.all(flight.map((move) => move.finished)).then(land, land);

    return () => {
      live = false;
    };
  }, [viewport]);

  return held;
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
  const held = useHurriedLanding(viewport);

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

    const written = balanceBrackets(expandColumns(text));
    sheet.edit([[cellKey(cell.row, cell.col), written]], selectionAt(cell));
    stopEditing();
    if (rowStep !== 0 || colStep !== 0) {
      setSelection(selectionAt(clampAddress(cell.row + rowStep, cell.col + colStep)));
    }
    onDone();
  }

  // the draft into every selected cell at once. the selection is what says how
  // far it goes, so this is only a commit with a wider target, and it lands as
  // one edit: filling a block and taking it back should cost one press each.
  function spread(): void {
    if (done.current) return;
    done.current = true;

    const selection = getSelection();
    const written = balanceBrackets(expandColumns(text));
    sheet.edit(spreadWrites(written, cell, selectionRange(selection)), selection);
    stopEditing();
    onDone();
  }

  function cancel(): void {
    done.current = true;
    stopEditing();
    onDone();
  }

  // the suggestion list borrows the keys it needs and hands the rest back, so
  // the field behaves like a field the moment the list is not there
  const { suggestion, highlight, taking } = offered(editing);
  const names = suggestion?.kind === "functions" ? suggestion.matches : null;

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    // the arrows reach the list whether or not it has been asked for, since
    // going into it is how it gets asked for
    if (names && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const down = event.key === "ArrowDown";
      if (taking) moveHighlight(down ? 1 : -1, names.length);
      else enterList(down ? 0 : names.length - 1);
    } else if (taking && names && (event.key === "Enter" || event.key === "Tab")) {
      event.preventDefault();
      setDraft(acceptSuggestion(text, names[highlight]!.name));
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      spread();
    } else if (event.key === "Enter") {
      commit(event.shiftKey ? -1 : 1, 0);
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

  const shape = `${isMonospaced(text) ? " is-monospaced" : ""}${
    isNumeric(text) ? " is-numeric" : ""
  }`;

  return (
    <div className={`grid-editor${shape}${held ? " is-held" : ""}`} style={style}>
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
