import { type RefObject, useEffect, useRef } from "react";
import type { Address } from "../core/address";
import {
  type Axis,
  type Zone,
  cellAtPoint,
  rectOf,
  scrollToShow,
  zoneAtPoint,
} from "../core/geometry";
import { rangeAt } from "../core/range";
import { getSelection } from "../state/selection";
import { viewportBox } from "./viewport";

// anything that knows where it is on the screen. the handlers are handed react
// pointer events, mouse events and clipboard events, and this is the only part
// of any of them that a coordinate question needs.
type At = { clientX: number; clientY: number };

// where the pointer is on the sheet, and how to bring a cell to where it can be
// seen. one place, because both halves are the same question asked in opposite
// directions and both need the same measurement of the grid.
export type Surface = {
  pointIn(event: At): { x: number; y: number };
  cellUnder(event: At): Address;
  zoneUnder(event: At): Zone;
  alongAxis(event: At, axis: Axis): number;
  forgetBounds(): void;
  revealFocus(): void;
};

export function useSurface(
  grid: RefObject<HTMLDivElement | null>,
  viewport: RefObject<HTMLDivElement | null>,
): Surface {
  const bounds = useRef<DOMRect | null>(null);

  // measuring the grid forces the browser to settle any layout still pending,
  // and a travelling selection leaves some pending on every frame. only scroll
  // and resize can move it, so it is measured again after those and not per move.
  function forgetBounds(): void {
    bounds.current = null;
  }

  // registered once: the handler only clears a ref, so it never goes stale
  useEffect(() => {
    window.addEventListener("resize", forgetBounds);
    return () => window.removeEventListener("resize", forgetBounds);
  }, []);

  function box(): DOMRect {
    bounds.current ??= grid.current!.getBoundingClientRect();
    return bounds.current;
  }

  // a point in the sheet's own coordinates, which is what the overlays are
  // positioned in. the grid is the scrolling content, so its rect has the
  // scroll in it already.
  function pointIn(event: At): { x: number; y: number } {
    const rect = box();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function cellUnder(event: At): Address {
    const point = pointIn(event);
    return cellAtPoint(point.x, point.y);
  }

  // the grid's own top left scrolls away under the header and the gutter, so the
  // scroll offset has to come back off before the bands can be tested
  function zoneUnder(event: At): Zone {
    const point = pointIn(event);
    const view = viewport.current;
    return zoneAtPoint(point.x - (view?.scrollLeft ?? 0), point.y - (view?.scrollTop ?? 0));
  }

  // how far into the sheet the pointer is along the axis being carried
  function alongAxis(event: At, axis: Axis): number {
    const point = pointIn(event);
    return axis === "column" ? point.x : point.y;
  }

  function revealFocus(): void {
    const view = viewport.current;
    if (!view) return;

    const focus = getSelection().focus;
    const next = scrollToShow(rectOf(rangeAt(focus)), viewportBox(view));

    view.scrollLeft = next.scrollLeft;
    view.scrollTop = next.scrollTop;
  }

  return { pointIn, cellUnder, zoneUnder, alongAxis, forgetBounds, revealFocus };
}
