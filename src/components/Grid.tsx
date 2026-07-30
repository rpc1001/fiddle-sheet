import {
  Fragment,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
} from "react";
import { type Address, cellKey, columnLabel } from "../core/address";
import { acceptsReference, insertReference } from "../core/formula/insert";
import { COLS, ROWS, cellAtPoint, rectOf, scrollToShow } from "../core/geometry";
import { cellsIn, rangeAt } from "../core/range";
import { moved, sameCell, selectionRange } from "../core/selection";
import { getEditing, setInsertedDraft, startEditing } from "../state/editing";
import { getHover, setHover } from "../state/hover";
import { getSelection, setSelection } from "../state/selection";
import { redo, sheet, undo, useCell } from "../state/sheet";
import { Editor } from "./Editor";
import { HoverRing } from "./Hover";
import { Lens } from "./Lens";
import { SelectionOverlay } from "./Selection";
import { TraceOverlay } from "./Trace";
import { viewportBox } from "./viewport";
import "./Grid.css";

const columns = Array.from({ length: COLS }, (_, col) => col);
const rows = Array.from({ length: ROWS }, (_, row) => row);

const STEPS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

type Drag = "selection" | "reference" | null;

function Cell({ row, col }: { row: number; col: number }) {
  const { display, numeric } = useCell(row, col);

  return <div className={numeric ? "grid-cell is-numeric" : "grid-cell"}>{display}</div>;
}

function isTyping(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
}

function isChord(event: KeyboardEvent, key: string): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key;
}

export function Grid({ gridRef }: { gridRef: RefObject<HTMLDivElement | null> }) {
  const viewport = useRef<HTMLDivElement>(null);
  const bounds = useRef<DOMRect | null>(null);
  const drag = useRef<Drag>(null);
  const referenceAnchor = useRef<Address | null>(null);
  const referenceFocus = useRef<Address | null>(null);

  // react only honours autoFocus on form controls, so the grid asks for itself
  useEffect(() => gridRef.current?.focus(), [gridRef]);

  // registered once: the handler only clears a ref, so it never goes stale
  useEffect(() => {
    window.addEventListener("resize", forgetBounds);
    return () => window.removeEventListener("resize", forgetBounds);
  }, []);

  // measuring the grid forces the browser to settle any layout still pending,
  // and a travelling selection leaves some pending on every frame. only scroll
  // and resize can move it, so it is measured again after those and not per move.
  function forgetBounds(): void {
    bounds.current = null;
  }

  function cellUnder(event: { clientX: number; clientY: number }): Address {
    bounds.current ??= gridRef.current!.getBoundingClientRect();
    const box = bounds.current;
    return cellAtPoint(event.clientX - box.left, event.clientY - box.top);
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
    const cell = cellUnder(event);

    // the ring tracks whether or not a drag is running, so this sits ahead of
    // the guard below
    const hovered = getHover();
    if (!hovered || !sameCell(hovered, cell)) setHover(cell);

    if (!drag.current) return;

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

  return (
    <div className="grid-viewport" ref={viewport} onScroll={forgetBounds}>
      <div
        className="grid"
        ref={gridRef}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        <div className="grid-corner" />
        {columns.map((col) => (
          <div key={col} className="grid-header">
            {columnLabel(col)}
          </div>
        ))}
        {rows.map((row) => (
          <Fragment key={row}>
            <div className="grid-gutter">{row + 1}</div>
            {columns.map((col) => (
              <Cell key={col} row={row} col={col} />
            ))}
          </Fragment>
        ))}
        <TraceOverlay />
        <HoverRing />
        <SelectionOverlay />
        <Lens viewport={viewport} />
        <Editor viewport={viewport} onDone={focusGrid} />
      </div>
    </div>
  );
}
