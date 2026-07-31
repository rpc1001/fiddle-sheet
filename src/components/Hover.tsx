import { type RefObject, useEffect } from "react";
import { type Address, cellKey } from "../core/address";
import { cellRect } from "../core/geometry";
import { useHover } from "../state/hover";

// the header and the gutter are a hundred and twenty six elements that change
// for nothing else in the sheet's life. lighting the two under the pointer by
// writing a class on them costs two lookups a cell; doing it through react would
// rebuild a whole row and a whole column of them on every move. nothing renders
// these nodes again, so the class has no react state to disagree with.
function useLitLabels(grid: RefObject<HTMLDivElement | null>, cell: Address | null): void {
  useEffect(() => {
    const root = grid.current;
    if (!root || !cell) return;

    const labels = [
      root.querySelector(`.grid-header[data-col="${cell.col}"]`),
      root.querySelector(`.grid-gutter[data-row="${cell.row}"]`),
    ];

    for (const label of labels) label?.classList.add("is-lit");
    return () => {
      for (const label of labels) label?.classList.remove("is-lit");
    };
  }, [grid, cell]);
}

// a hairline ring chasing the pointer. its own component, not part of the
// selection overlay, so pointer movement never re-renders the selection.
export function HoverRing({ grid }: { grid: RefObject<HTMLDivElement | null> }) {
  const cell = useHover();
  useLitLabels(grid, cell);
  if (!cell) return null;

  const { left, top } = cellRect(cell);

  return (
    <div className="grid-hover" style={{ left, top }}>
      {/* keyed per cell, so arriving somewhere new remounts the ring and replays
          the landing while the box around it carries on gliding */}
      <div key={cellKey(cell.row, cell.col)} className="grid-hover-face" />
    </div>
  );
}
