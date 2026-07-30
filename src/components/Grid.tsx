import { Fragment } from "react";
import { columnLabel } from "../core/address";
import { COLS, ROWS } from "../core/geometry";
import { useCell } from "../state/sheet";
import "./Grid.css";

const columns = Array.from({ length: COLS }, (_, col) => col);
const rows = Array.from({ length: ROWS }, (_, row) => row);

function Cell({ row, col }: { row: number; col: number }) {
  const { display, numeric } = useCell(row, col);

  return <div className={numeric ? "grid-cell is-numeric" : "grid-cell"}>{display}</div>;
}

export function Grid() {
  return (
    <div className="grid">
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
    </div>
  );
}
