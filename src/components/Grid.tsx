import { Fragment, type RefObject, useEffect, useRef } from "react";
import { columnLabel } from "../core/address";
import { COLS, ROWS } from "../core/geometry";
import { useCell } from "../state/sheet";
import { DropLine, QuoteGhost } from "./Drop";
import { Editor } from "./Editor";
import { HoverRing } from "./Hover";
import { Lens } from "./Lens";
import { SelectionOverlay } from "./Selection";
import { TraceOverlay } from "./Trace";
import { useDragging } from "./dragging";
import { useKeys } from "./keys";
import { useSurface } from "./surface";
import "./Grid.css";

const columns = Array.from({ length: COLS }, (_, col) => col);
const rows = Array.from({ length: ROWS }, (_, row) => row);

function Cell({ row, col }: { row: number; col: number }) {
  const { display, numeric } = useCell(row, col);

  return <div className={numeric ? "grid-cell is-numeric" : "grid-cell"}>{display}</div>;
}

export function Grid({ gridRef }: { gridRef: RefObject<HTMLDivElement | null> }) {
  const viewport = useRef<HTMLDivElement>(null);

  const surface = useSurface(gridRef, viewport);
  const drag = useDragging(surface, viewport);
  const keys = useKeys(surface);

  // react only honours autoFocus on form controls, so the grid asks for itself
  useEffect(() => gridRef.current?.focus(), [gridRef]);

  // the editor hands the keyboard back on its way out, and the cell it was in
  // has to be on screen to receive it
  function focusGrid(): void {
    gridRef.current?.focus();
    surface.revealFocus();
  }

  return (
    <div className="grid-viewport" ref={viewport} onScroll={surface.forgetBounds}>
      <div
        className="grid"
        ref={gridRef}
        tabIndex={0}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.endDrag}
        onPointerCancel={drag.cancelDrag}
        onPointerLeave={drag.onPointerLeave}
        onDoubleClick={keys.onDoubleClick}
        onKeyDown={keys.onKeyDown}
        onCopy={keys.onCopy}
        onCut={keys.onCut}
        onPaste={keys.onPaste}
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
        <QuoteGhost />
        <HoverRing grid={gridRef} />
        <SelectionOverlay />
        <Lens viewport={viewport} />
        <Editor viewport={viewport} onDone={focusGrid} />
      </div>
    </div>
  );
}
