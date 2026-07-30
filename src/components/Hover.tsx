import { rectOf } from "../core/geometry";
import { rangeAt } from "../core/range";
import { useHover } from "../state/hover";

// a hairline ring chasing the pointer. its own component, not part of the
// selection overlay, so pointer movement never re-renders the selection.
export function HoverRing() {
  const cell = useHover();
  if (!cell) return null;

  const { left, top } = rectOf(rangeAt(cell));

  return <div className="grid-hover" style={{ left, top }} />;
}
