import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { type Address, cellKey, columnLabel } from "../core/address";
import { acceptsReference, insertReference } from "../core/formula/insert";
import { COLS, cellAtPoint, rectOf, scrollToShow, visibleRows } from "../core/geometry";
import { cellsIn, rangeAt } from "../core/range";
import { moved, sameCell, selectionRange } from "../core/selection";
import { getEditing, setInsertedDraft, startEditing } from "../state/editing";
import { getSelection, setSelection } from "../state/selection";
import { redo, sheet, undo, useCell } from "../state/sheet";
import { Editor } from "./Editor";
import { Lens } from "./Lens";
import { SelectionOverlay } from "./Selection";
import { TraceOverlay } from "./Trace";
import { viewportBox } from "./viewport";
import "./Grid.css";

const columns = Array.from({ length: COLS }, (_, col) => col);

const STEPS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

type Drag = "selection" | "reference" | null;

function Cell({ row, col, style }: { row: number; col: number; style: CSSProperties }) {
  const { display, numeric } = useCell(row, col);

  return (
    <div className={numeric ? "grid-cell is-numeric" : "grid-cell"} style={style}>
      {display}
    </div>
  );
}

// only the rows in the window are mounted, so each one says where it belongs
// rather than being placed by the order it was written in
function Row({ row }: { row: number }) {
  const style = { gridRow: row + 2 };

  return (
    <>
      <div className="grid-gutter" style={style}>
        {row + 1}
      </div>
      {columns.map((col) => (
        <Cell key={col} row={row} col={col} style={style} />
      ))}
    </>
  );
}

function isTyping(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
}

function isChord(event: KeyboardEvent, key: string): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key;
}

export function Grid({ gridRef }: { gridRef: RefObject<HTMLDivElement | null> }) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>(null);
  const referenceAnchor = useRef<Address | null>(null);
  const referenceFocus = useRef<Address | null>(null);
  // 2600 cells is 2600 subscriptions and 2600 nodes, and about thirty of them
  // are ever on screen. the window is a guess until the box has been measured.
  const [rowWindow, setRowWindow] = useState(() => visibleRows(0, globalThis.innerHeight));

  const measureWindow = useCallback(() => {
    const box = viewport.current;
    if (!box) return;

    const next = visibleRows(box.scrollTop, box.clientHeight);
    setRowWindow((current) =>
      current.first === next.first && current.last === next.last ? current : next,
    );
  }, []);

  // react only honours autoFocus on form controls, so the grid asks for itself
  useEffect(() => gridRef.current?.focus(), [gridRef]);

  useEffect(() => {
    measureWindow();
    globalThis.addEventListener("resize", measureWindow);
    return () => globalThis.removeEventListener("resize", measureWindow);
  }, [measureWindow]);

  function cellUnder(event: { clientX: number; clientY: number }): Address {
    const bounds = gridRef.current!.getBoundingClientRect();
    return cellAtPoint(event.clientX - bounds.left, event.clientY - bounds.top);
  }

  function revealFocus(): void {
    const box = viewport.current;
    if (!box) return;

    const focus = getSelection().focus;
    const next = scrollToShow(rectOf(rangeAt(focus)), viewportBox(box));

    box.scrollLeft = next.scrollLeft;
    box.scrollTop = next.scrollTop;
  }

  function focusGrid(): void {
    gridRef.current?.focus();
    revealFocus();
  }

  // writes the clicked cell or range into an open formula. returns false when the
  // click means something else, so the caller falls back to selecting.
  function writeReference(cell: Address, extend: boolean): boolean {
    const editing = getEditing();
    if (!editing) return false;
    if (!acceptsReference(editing.text) && !editing.inserted) return false;

    // the anchor is only live while the last thing written was our own
    // reference. after typing, or in a different cell, this click starts a new one.
    const previous = editing.inserted;
    const anchor = extend && previous ? (referenceAnchor.current ?? cell) : cell;
    referenceAnchor.current = anchor;
    referenceFocus.current = cell;

    const next = insertReference(editing.text, previous, anchor, cell);
    setInsertedDraft(next.text, next.span);
    return true;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;

    // the editor and the suggestion list float over the cells but are not the
    // cells: a press on either belongs to it, not to whatever it is covering.
    // pointerdown runs before mousedown, so without this the reference is
    // already written by the time the list sees the press.
    if ((event.target as HTMLElement).closest(".grid-editor, .lens")) return;

    const cell = cellUnder(event);

    if (writeReference(cell, event.shiftKey)) {
      // keep the caret in the editor: the default action would move focus here
      event.preventDefault();
      drag.current = "reference";
    } else {
      const anchor = event.shiftKey ? getSelection().anchor : cell;
      setSelection({ anchor, focus: cell });
      drag.current = "selection";
    }

    // capture so the drag survives the pointer leaving the grid
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!drag.current) return;
    const cell = cellUnder(event);

    // pointermove fires many times per cell, and rewriting the same reference
    // re-parses and re-evaluates the whole draft on each one
    if (drag.current === "reference") {
      const last = referenceFocus.current;
      if (!last || !sameCell(last, cell)) writeReference(cell, true);
      return;
    }

    const selection = getSelection();
    if (sameCell(selection.focus, cell)) return;
    setSelection({ anchor: selection.anchor, focus: cell });
  }

  // pointercancel too: a lost capture would otherwise leave the selection
  // following a mouse that is no longer held
  function endDrag(): void {
    drag.current = null;
  }

  function openEditor(cell: Address): void {
    startEditing(cell, sheet.getRaw(cellKey(cell.row, cell.col)));
  }

  function onDoubleClick(event: MouseEvent<HTMLDivElement>): void {
    if (getEditing()) return;
    openEditor(cellUnder(event));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (getEditing()) return;
    const selection = getSelection();
    const step = STEPS[event.key];

    if (step) {
      setSelection(moved(selection, step[0], step[1], event.shiftKey));
      revealFocus();
    } else if (event.key === "Tab") {
      setSelection(moved(selection, 0, event.shiftKey ? -1 : 1, false));
      revealFocus();
    } else if (event.key === "Enter") {
      openEditor(selection.focus);
    } else if (event.key === "Backspace" || event.key === "Delete") {
      const cleared = [...cellsIn(selectionRange(selection))];
      sheet.edit(
        cleared.map((cell) => [cellKey(cell.row, cell.col), ""]),
        selection,
      );
    } else if (isChord(event, "z")) {
      // shift+z is the mac habit for redo, ctrl+y the windows one
      if (event.shiftKey) redo();
      else undo();
      revealFocus();
    } else if (isChord(event, "y")) {
      redo();
      revealFocus();
    } else if (isTyping(event)) {
      // typing over a cell replaces it, so the first character is the draft
      startEditing(selection.focus, event.key);
    } else {
      return;
    }

    event.preventDefault();
  }

  const mounted = Array.from(
    { length: rowWindow.last - rowWindow.first + 1 },
    (_, at) => rowWindow.first + at,
  );

  return (
    <div className="grid-viewport" ref={viewport} onScroll={measureWindow}>
      <div
        className="grid"
        ref={gridRef}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        <div className="grid-corner" />
        {columns.map((col) => (
          <div key={col} className="grid-header">
            {columnLabel(col)}
          </div>
        ))}
        {mounted.map((row) => (
          <Row key={row} row={row} />
        ))}
        <TraceOverlay />
        <SelectionOverlay />
        <Lens viewport={viewport} />
        <Editor viewport={viewport} onDone={focusGrid} />
      </div>
    </div>
  );
}
