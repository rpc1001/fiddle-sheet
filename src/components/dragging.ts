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

// what the pointer is in the middle of, carrying whatever that gesture needs to
// finish. null between drags, and the whole of what a move or a release has to
// know: every handler below reads this first. each variant owns its own data, so
// there is no state a kind can be in without the values that kind runs on.
type Drag =
  | { kind: "selection" }
  | { kind: "reference" }
  | { kind: "column" }
  | { kind: "row" }
  // grab is where in the block it was picked up, so the ghost hangs off the
  // pointer at the same place the whole way. carried says it has actually
  // travelled: the ghost appears on the press, so its presence cannot tell a
  // drag from a click.
  | { kind: "move"; axis: Axis; band: number; grab: number; carried: boolean }
  // the fill's source. the selection moves to what the fill covered when it
  // lands, so it cannot be asked for the source afterwards.
  | { kind: "fill"; source: Range }
  // the point of the sheet under the pointer when it was grabbed, rather than a
  // pointer position, so a pan is one subtraction
  | { kind: "pan"; from: { x: number; y: number } }
  | { kind: "quote" }
  | null;

// the reference a formula is pointing at. this outlives the drag on purpose: a
// shift click extends the last reference written, and what keeps that live is the
// draft's own inserted span, not whether the pointer is still down.
type Reference = { anchor: Address; focus: Address };

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
  const reference = useRef<Reference | null>(null);

  // writes the clicked cell or range into an open formula. from is the anchor to
  // extend out of, or null to start a new reference at cell. returns the
  // reference now written, or null when the click means something else, so the
  // caller falls back to selecting.
  function writeReference(cell: Address, from: Address | null): Reference | null {
    const editing = getEditing();
    if (!editing) return null;
    if (!acceptsReference(editing.text) && !editing.inserted) return null;

    // only extend while the last thing written was our own reference. after
    // typing, or in a different cell, this click starts a new one.
    const previous = editing.inserted;
    const anchor = from && previous ? from : cell;

    const next = insertReference(editing.text, previous, anchor, cell);
    setInsertedDraft(next.text, next.span);
    return { anchor, focus: cell };
  }

  // the anchor a shift press extends from, when there is one to extend
  function anchorFor(extend: boolean): Address | null {
    return extend ? (reference.current?.anchor ?? null) : null;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    // the middle button grabs the sheet itself. it is the one press with no
    // meaning on the cells, and preventing its default is what stops the
    // browser from starting its own autoscroll on top of ours.
    if (event.button === 1) {
      const view = viewport.current;
      if (!view) return;

      event.preventDefault();
      drag.current = {
        kind: "pan",
        from: { x: event.clientX + view.scrollLeft, y: event.clientY + view.scrollTop },
      };
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
      setFilling(source);
      drag.current = { kind: "fill", source };
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
        drag.current = { kind: "quote" };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }

    const axis = event.shiftKey ? null : bandPickedUp(zone, cell);

    if (axis) {
      const rect = rectOf(selectionRange(getSelection()));
      const near = axis === "column" ? rect.left : rect.top;
      const band = axis === "column" ? cell.col : cell.row;

      drag.current = { kind: "move", axis, band, grab: alongAxis(event, axis) - near, carried: false };
      // lifted where it already sits, so the press itself shows the band come
      // off the sheet rather than nothing at all until the pointer moves
      setMoving({ axis, offset: near, gap: band });
    } else if (zone !== "cell") {
      setSelection(bandAt(zone, cell, event.shiftKey));
      drag.current = zone === "corner" ? null : { kind: zone === "header" ? "column" : "row" };
    } else {
      const written = writeReference(cell, anchorFor(event.shiftKey));

      if (written) {
        reference.current = written;
        // keep the caret in the editor: the default action would move focus here
        event.preventDefault();
        drag.current = { kind: "reference" };
      } else {
        const anchor = event.shiftKey ? getSelection().anchor : cell;
        setSelection({ anchor, focus: cell });
        drag.current = { kind: "selection" };
      }
    }

    // capture so the drag survives the pointer leaving the grid
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    // the point that was under the pointer when it was grabbed stays under it.
    // the ring is left alone: nothing is being pointed at while the sheet moves.
    if (drag.current?.kind === "pan") {
      const view = viewport.current;
      if (!view) return;
      view.scrollLeft = drag.current.from.x - event.clientX;
      view.scrollTop = drag.current.from.y - event.clientY;
      return;
    }

    // over itself it lands nowhere: a range cannot be totalled into one of its
    // own cells without reading what it is about to write
    if (drag.current?.kind === "quote") {
      const carrying = getQuoting();
      if (!carrying) return;

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

    if (drag.current.kind === "fill") {
      const extent = fillExtent(drag.current.source, cell);
      const shown = getFilling();
      if (!shown || !sameRange(shown, extent)) setFilling(extent);
      return;
    }

    // the line only appears once the pointer has picked a boundary, so a press
    // and release on a band that never moved leaves the sheet alone
    if (drag.current.kind === "move") {
      const { axis, grab } = drag.current;
      const rect = rectOf(selectionRange(getSelection()));
      const [edge, extent, end] =
        axis === "column"
          ? [GUTTER_WIDTH, rect.width, SHEET_WIDTH]
          : [HEADER_HEIGHT, rect.height, SHEET_HEIGHT];

      const offset = clampBetween(alongAxis(event, axis) - grab, edge, end - extent);
      drag.current = { ...drag.current, carried: true };
      // the block lands where its own near edge is nearest, so the ghost and the
      // line agree about what is being aimed at
      setMoving({ axis, offset, gap: gapAtPoint(offset, axis) });
      return;
    }

    // pointermove fires many times per cell, and rewriting the same reference
    // re-parses and re-evaluates the whole draft on each one
    if (drag.current.kind === "reference") {
      const last = reference.current;
      if (!last || !sameCell(last.focus, cell)) {
        reference.current = writeReference(cell, anchorFor(true)) ?? last;
      }
      return;
    }

    const selection = getSelection();

    if (drag.current.kind === "column" || drag.current.kind === "row") {
      const band =
        drag.current.kind === "column"
          ? columnSpan(selection.anchor.col, cell.col)
          : rowSpan(selection.anchor.row, cell.row);
      if (!sameCell(selection.focus, band.focus)) setSelection(band);
      return;
    }

    if (sameCell(selection.focus, cell)) return;
    setSelection({ anchor: selection.anchor, focus: cell });
  }

  function endDrag(): void {
    const current = drag.current;

    // the formula arrives open rather than written: the range and the function
    // are both stated, and the one that was guessed is the one the caret is in
    if (current?.kind === "quote") {
      const quote = getQuoting();
      if (quote?.onto) startEditing(quote.onto, quote.text, "guessed");
    }

    // a handle pressed and released without travelling reaches nothing
    if (current?.kind === "fill") {
      const reach = getFilling();
      if (reach) applyFill(current.source, reach);
    }

    // a press that never moved is a click, and a click on a header or a gutter
    // selects that one band: without this a block swallows every press inside it
    // and picking a single column or row out of one becomes impossible
    if (current?.kind === "move") {
      const carry = getMoving();
      if (current.carried && carry) dropBand(carry.axis, carry.gap);
      else selectBand(current.axis, current.band);
    }

    cancelDrag();
  }

  // pointercancel too: a lost capture would otherwise leave the selection
  // following a mouse that is no longer held, and a half finished move is not a
  // move, so it drops nothing
  function cancelDrag(): void {
    if (drag.current?.kind === "pan") viewport.current?.classList.remove("is-panning");
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
