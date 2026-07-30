import type { Viewport } from "../core/geometry";
import { SHEET_HEIGHT, SHEET_WIDTH } from "../core/geometry";

// the scrolling box the sheet sits in. read at render time rather than held in
// state: everything that uses it is already re-rendering for another reason,
// and subscribing to scroll would redraw the lens on every frame of one.
export function viewportBox(element: HTMLElement | null): Viewport {
  if (!element) {
    return { scrollLeft: 0, scrollTop: 0, width: SHEET_WIDTH, height: SHEET_HEIGHT };
  }

  return {
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop,
    width: element.clientWidth,
    height: element.clientHeight,
  };
}
