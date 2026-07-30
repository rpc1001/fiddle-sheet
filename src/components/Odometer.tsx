import { useState } from "react";
import { type Address, columnLabel } from "../core/address";

type Axis = "x" | "y";

function offset(axis: Axis, percent: number): string {
  return axis === "x" ? `translateX(${percent}%)` : `translateY(${percent}%)`;
}

// one glyph in a clipped box. when it changes the old one leaves and the new one
// arrives, on the axis and in the direction the selection actually moved.
function Reel({ glyph, axis, dir }: { glyph: string; axis: Axis; dir: number }) {
  const [shown, setShown] = useState({ glyph, leaving: "", turn: 0, dir });
  if (shown.glyph !== glyph) {
    setShown({ glyph, leaving: shown.glyph, turn: shown.turn + 1, dir });
  }

  const style = {
    "--reel-from": offset(axis, shown.dir * 100),
    "--reel-to": offset(axis, shown.dir * -100),
  } as React.CSSProperties;

  return (
    <span className="status-reel" style={style}>
      {shown.leaving !== "" && (
        <span key={`out-${shown.turn}`} className="status-reel-out">
          {shown.leaving}
        </span>
      )}
      <span
        key={`in-${shown.turn}`}
        className={shown.turn === 0 ? "status-reel-in" : "status-reel-in is-rolling"}
      >
        {shown.glyph}
      </span>
    </span>
  );
}

// the column rolls sideways and the row rolls vertically, so the address moves
// the way the selection did. the direction has to be read at the moment the
// address changes, which is why the last one is held rather than recomputed.
export function Odometer({ address }: { address: Address }) {
  const [seen, setSeen] = useState({ address, dx: 0, dy: 0 });
  if (seen.address.row !== address.row || seen.address.col !== address.col) {
    setSeen({
      address,
      dx: Math.sign(address.col - seen.address.col),
      dy: Math.sign(address.row - seen.address.row),
    });
  }

  return (
    <span className="status-address">
      <Reel glyph={columnLabel(seen.address.col)} axis="x" dir={seen.dx} />
      <span className="status-address-row">
        {String(seen.address.row + 1)
          .split("")
          .map((digit, place) => (
            <Reel key={place} glyph={digit} axis="y" dir={seen.dy} />
          ))}
      </span>
    </span>
  );
}
