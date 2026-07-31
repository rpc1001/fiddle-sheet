import { type PointerEvent, type RefObject, useRef } from "react";
import type { Address } from "../core/address";
import { droppedFormula } from "../core/drop";
import { fillExtent } from "../core/fill";
import { acceptsReference, insertReference } from "../core/formula/insert";
import {
  GUTTER_WIDTH,
  HEADER_HEIGHT,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  type Axis,
  clampBetween,
  gapAtPoint,
  rectOf,
} from "../core/geometry";
import { type Range, contains, isSingleCell, sameRange } from "../core/range";
import { columnSpan, rowSpan, sameCell, selectionRange } from "../core/selection";
import { getEditing, setInsertedDraft, startEditing } from "../state/editing";
import { applyFill, getFilling, setFilling } from "../state/filling";
import { getHover, setHover } from "../state/hover";
import { getMoving, setMoving } from "../state/moving";
import { getQuoting, setQuoting } from "../state/quoting";
import { getSelection, setSelection } from "../state/selection";
import { rangeValues } from "../state/sheet";
import { bandAt, bandPickedUp, dropBand, selectBand } from "./bands";
import type { Surface } from "./surface";

// what the pointer is in the middle of. null between drags, and the whole of
// what a move or a release has to know: every handler below reads this first.
type Drag =
  | "selection"
  | "reference"
  | "column"
  | "row"
  | "move"
  | "fill"
  | "pan"
  | "quote"
  | null;

export type Dragging = {
  onPointerDown(event: PointerEvent<HTMLDivElement>): void;
  onPointerMove(event: PointerEvent<HTMLDivElement>): void;
  onPointerLeave(): void;
  endDrag(): void;
  cancelDrag(): void;
};

export function useDragging(
  surface: Surface,
  viewport: RefObject<HTMLDivElement | null>,
): Dragging {
  const { cellUnder, zoneUnder, pointIn, alongAxis } = surface;

  const drag = useRef<Drag>(null);
  const referenceAnchor = useRef<Address | null>(null);
  const referenceFocus = useRef<Address | null>(null);
  // where in the block it was picked up, so the ghost hangs off the pointer at
  // the same place the whole way rather than jumping its near edge to it
  const grabOffset = useRef(0);
  // the cells a fill is coming from. the selection moves to what the fill
  // covered when it lands, so it cannot be asked for the source afterwards.
  const fillSource = useRef<Range | null>(null);
  // where the sheet was grabbed, kept as the point of the sheet under the
  // pointer rather than as a pointer position, so a pan is one subtraction
  const panFrom = useRef({ x: 0, y: 0 });
  const pickedBand = useRef(0);
  const pickedAxis = useRef<Axis>("column");
  // whether the band has actually been carried anywhere. the ghost appears on
  // the press, so its presence cannot be what tells a drag from a click.
  const carried = useRef(false);

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
    // the middle button grabs the sheet itself. it is the one press with no
    // meaning on the cells, and preventing its default is what stops the
    // browser from starting its own autoscroll on top of ours.
    if (event.button === 1) {
      const view = viewport.current;
      if (!view) return;

      event.preventDefault();
      panFrom.current = {
        x: event.clientX + view.scrollLeft,
        y: event.clientY + view.scrollTop,
      };
      drag.current = "pan";
      view.classList.add("is-panning");
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (event.button !== 0) return;

    // the editor and the suggestion list float over the cells but are not the
    // cells: a press on either belongs to it, not to whatever it is covering.
    // pointerdown runs before mousedown, so without this the reference is
    // already written by the time the list sees the press.
    if ((event.target as HTMLElement).closest(".grid-editor, .lens")) return;

    // the handle sits over the corner cell of the selection, so it has to be
    // asked about before the cell underneath it is
    if ((event.target as HTMLElement).closest(".grid-fill-handle")) {
      const source = selectionRange(getSelection());
      fillSource.current = source;
      setFilling(source);
      drag.current = "fill";
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    const cell = cellUnder(event);
    const zone = zoneUnder(event);

    // a block carried to a cell writes the formula that reads it. only from
    // inside the block, and only when there is something to total: the gesture
    // offers a sum, and a range of words has none, so it stays an ordinary drag.
    if (event.altKey && zone === "cell") {
      const range = selectionRange(getSelection());
      const quoted =
        !isSingleCell(range) && contains(range, cell)
          ? droppedFormula(rangeValues(range), range)
          : null;

      if (quoted) {
        event.preventDefault();
        setQuoting({ ...pointIn(event), text: quoted, onto: null });
        drag.current = "quote";
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }

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
    // the point that was under the pointer when it was grabbed stays under it.
    // the ring is left alone: nothing is being pointed at while the sheet moves.
    if (drag.current === "pan") {
      const view = viewport.current!;
      view.scrollLeft = panFrom.current.x - event.clientX;
      view.scrollTop = panFrom.current.y - event.clientY;
      return;
    }

    // over itself it lands nowhere: a range cannot be totalled into one of its
    // own cells without reading what it is about to write
    if (drag.current === "quote") {
      const carrying = getQuoting()!;
      const onto = cellUnder(event);
      const range = selectionRange(getSelection());
      setQuoting({ ...carrying, ...pointIn(event), onto: contains(range, onto) ? null : onto });
      return;
    }

    const cell = cellUnder(event);

    // the ring tracks whether or not a drag is running, so this sits ahead of
    // the guard below
    const hovered = getHover();
    if (!hovered || !sameCell(hovered, cell)) setHover(cell);

    if (!drag.current) return;

    if (drag.current === "fill" && fillSource.current) {
      const extent = fillExtent(fillSource.current, cell);
      const shown = getFilling();
      if (!shown || !sameRange(shown, extent)) setFilling(extent);
      return;
    }

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
      const offset = clampBetween(along - grabOffset.current, edge, end - extent);
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
    const reach = getFilling();
    const quote = getQuoting();

    // the formula arrives open rather than written: the range and the function
    // are both stated, and the one that was guessed is the one the caret is in
    if (drag.current === "quote" && quote?.onto) {
      startEditing(quote.onto, quote.text, "guessed");
    }

    // a handle pressed and released without travelling reaches nothing, and
    // applyFill has nothing to write
    if (drag.current === "fill" && reach && fillSource.current) {
      applyFill(fillSource.current, reach);
    }

    // a press that never moved is a click, and a click on a header or a gutter
    // selects that one band: without this a block swallows every press inside it
    // and picking a single column or row out of one becomes impossible
    if (drag.current === "move") {
      const band = pickedBand.current;
      if (carried.current && carry) dropBand(carry.axis, carry.gap);
      else selectBand(pickedAxis.current, band);
    }

    cancelDrag();
  }

  // pointercancel too: a lost capture would otherwise leave the selection
  // following a mouse that is no longer held, and a half finished move is not a
  // move, so it drops nothing
  function cancelDrag(): void {
    if (drag.current === "pan") viewport.current?.classList.remove("is-panning");
    drag.current = null;
    setMoving(null);
    setFilling(null);
    setQuoting(null);
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerLeave: () => setHover(null),
    endDrag,
    cancelDrag,
  };
}
