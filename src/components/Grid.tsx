import {
  Fragment,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
} from "react";
import { type Address, type CellKey, cellKey, columnLabel } from "../core/address";
import { acceptsReference, insertReference } from "../core/formula/insert";
import {
  COLS,
  GUTTER_WIDTH,
  HEADER_HEIGHT,
  ROWS,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  type Axis,
  type Zone,
  coversEveryColumn,
  coversEveryRow,
  cellAtPoint,
  gapAtPoint,
  rectOf,
  scrollToShow,
  zoneAtPoint,
} from "../core/geometry";
import { cellsIn, rangeAt } from "../core/range";
import { moveColumns, moveRows } from "../core/sheet/move";
import {
  type Selection,
  columnSpan,
  moved,
  rowSpan,
  sameCell,
  selectionRange,
} from "../core/selection";
import { getEditing, setInsertedDraft, startEditing } from "../state/editing";
import { getHover, setHover } from "../state/hover";
import { getMoving, setMoving } from "../state/moving";
import { getSelection, setSelection } from "../state/selection";
import { redo, sheet, undo, useCell } from "../state/sheet";
import { DropLine } from "./Drop";
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

type Drag = "selection" | "reference" | "column" | "row" | "move" | null;

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
  // where in the block it was picked up, so the ghost hangs off the pointer at
  // the same place the whole way rather than jumping its near edge to it
  const grabOffset = useRef(0);
  const pickedBand = useRef(0);
  const pickedAxis = useRef<Axis>("column");
  // whether the band has actually been carried anywhere. the ghost appears on
  // the press, so its presence cannot be what tells a drag from a click.
  const carried = useRef(false);

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

  // the grid's own top left scrolls away under the header and the gutter, so the
  // scroll offset has to come back off before the bands can be tested
  function zoneUnder(event: { clientX: number; clientY: number }): Zone {
    bounds.current ??= gridRef.current!.getBoundingClientRect();
    const box = bounds.current;
    const view = viewport.current;
    return zoneAtPoint(
      event.clientX - box.left - (view?.scrollLeft ?? 0),
      event.clientY - box.top - (view?.scrollTop ?? 0),
    );
  }

  // how far into the sheet the pointer is along the axis being carried. the grid
  // is the scrolling content, so its own rect already accounts for the scroll.
  function alongAxis(event: PointerEvent<HTMLDivElement>, axis: Axis): number {
    bounds.current ??= gridRef.current!.getBoundingClientRect();
    return axis === "column"
      ? event.clientX - bounds.current.left
      : event.clientY - bounds.current.top;
  }

  // a press on the header, the gutter or the corner selects whole columns or
  // whole rows. shift keeps the band anchored where it started.
  function bandAt(zone: Zone, cell: Address, extend: boolean): Selection {
    const anchor = getSelection().anchor;
    if (zone === "corner") return columnSpan(0, COLS - 1);
    if (zone === "header") return columnSpan(extend ? anchor.col : cell.col, cell.col);
    return rowSpan(extend ? anchor.row : cell.row, cell.row);
  }

  // a press on a header or a gutter already inside the band picks the band up
  // rather than selecting it again, which is the only press with nothing else to
  // mean. null when the press means something else.
  function bandPickedUp(zone: Zone, cell: Address): Axis | null {
    const range = selectionRange(getSelection());

    if (zone === "header" && coversEveryRow(range)) {
      return cell.col >= range.left && cell.col <= range.right ? "column" : null;
    }
    if (zone === "gutter" && coversEveryColumn(range)) {
      return cell.row >= range.top && cell.row <= range.bottom ? "row" : null;
    }
    return null;
  }

  // the bands keep the order they are dropped in, and the selection follows them
  // so the block is still the thing under the pointer afterwards. empty bands
  // write nothing and still move: the block went somewhere either way.
  function dropBand(axis: Axis, gap: number): void {
    const before = getSelection();
    const range = selectionRange(before);
    const read = (key: CellKey) => sheet.getRaw(key);

    const move =
      axis === "column"
        ? moveColumns(read, range.left, range.right, gap)
        : moveRows(read, range.top, range.bottom, gap);

    // the history entry keeps the band where it was picked up, so undoing puts
    // both the cells and the selection back where they started
    if (move.writes.length > 0) sheet.edit(move.writes, before);

    const span = axis === "column" ? range.right - range.left : range.bottom - range.top;
    setSelection(
      axis === "column"
        ? columnSpan(move.start + span, move.start)
        : rowSpan(move.start + span, move.start),
    );
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
    const zone = zoneUnder(event);

    const axis = event.shiftKey ? null : bandPickedUp(zone, cell);

    if (axis) {
      const rect = rectOf(selectionRange(getSelection()));
      const near = axis === "column" ? rect.left : rect.top;
      grabOffset.current = alongAxis(event, axis) - near;
      pickedBand.current = axis === "column" ? cell.col : cell.row;
      pickedAxis.current = axis;
      carried.current = false;
      drag.current = "move";
      // lifted where it already sits, so the press itself shows the band come
      // off the sheet rather than nothing at all until the pointer moves
      setMoving({ axis, offset: near, gap: pickedBand.current });
    } else if (zone !== "cell") {
      setSelection(bandAt(zone, cell, event.shiftKey));
      drag.current = zone === "corner" ? null : zone === "header" ? "column" : "row";
    } else if (writeReference(cell, event.shiftKey)) {
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

    // the line only appears once the pointer has picked a boundary, so a press
    // and release on a band that never moved leaves the sheet alone
    if (drag.current === "move") {
      const axis = pickedAxis.current;
      const rect = rectOf(selectionRange(getSelection()));
      const [edge, extent, end] =
        axis === "column"
          ? [GUTTER_WIDTH, rect.width, SHEET_WIDTH]
          : [HEADER_HEIGHT, rect.height, SHEET_HEIGHT];

      const along = alongAxis(event, axis);
      const offset = Math.max(edge, Math.min(along - grabOffset.current, end - extent));
      carried.current = true;
      // the block lands where its own near edge is nearest, so the ghost and the
      // line agree about what is being aimed at
      setMoving({ axis, offset, gap: gapAtPoint(offset, axis) });
      return;
    }

    // pointermove fires many times per cell, and rewriting the same reference
    // re-parses and re-evaluates the whole draft on each one
    if (drag.current === "reference") {
      const last = referenceFocus.current;
      if (!last || !sameCell(last, cell)) writeReference(cell, true);
      return;
    }

    const selection = getSelection();

    if (drag.current === "column" || drag.current === "row") {
      const band =
        drag.current === "column"
          ? columnSpan(selection.anchor.col, cell.col)
          : rowSpan(selection.anchor.row, cell.row);
      if (!sameCell(selection.focus, band.focus)) setSelection(band);
      return;
    }

    if (sameCell(selection.focus, cell)) return;
    setSelection({ anchor: selection.anchor, focus: cell });
  }

  function endDrag(): void {
    const carry = getMoving();

    // a press that never moved is a click, and a click on a header or a gutter
    // selects that one band: without this a block swallows every press inside it
    // and picking a single column or row out of one becomes impossible
    if (drag.current === "move") {
      const band = pickedBand.current;
      if (carried.current && carry) dropBand(carry.axis, carry.gap);
      else if (pickedAxis.current === "column") setSelection(columnSpan(band, band));
      else setSelection(rowSpan(band, band));
    }

    cancelDrag();
  }

  // pointercancel too: a lost capture would otherwise leave the selection
  // following a mouse that is no longer held, and a half finished move is not a
  // move, so it drops nothing
  function cancelDrag(): void {
    drag.current = null;
    setMoving(null);
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
        onPointerCancel={cancelDrag}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        <div className="grid-corner" />
        {columns.map((col) => (
          <div key={col} className="grid-header" data-col={col}>
            {columnLabel(col)}
          </div>
        ))}
        {rows.map((row) => (
          <Fragment key={row}>
            <div className="grid-gutter" data-row={row}>
              {row + 1}
            </div>
            {columns.map((col) => (
              <Cell key={col} row={row} col={col} />
            ))}
          </Fragment>
        ))}
        <TraceOverlay />
        <DropLine />
        <HoverRing grid={gridRef} />
        <SelectionOverlay />
        <Lens viewport={viewport} />
        <Editor viewport={viewport} onDone={focusGrid} />
      </div>
    </div>
  );
}
