import { useEffect, useSyncExternalStore } from "react";
import type { CellKey } from "../core/address";
import { sheet } from "./sheet";
import { createValueStore } from "./valueStore";

export type Ripple = {
  // the recalculation travelling to the cells that read what changed
  downstream: CellKey[];
  // cells this edit started reading, flashed once as the connection is made
  connected: CellKey[];
  // changes on every edit so a repeat of the same run still restarts the animation
  run: number;
};

const EMPTY: Ripple = { downstream: [], connected: [], run: 0 };

const store = createValueStore<Ripple>(EMPTY);

// one pulse per recomputed cell, but a wide edit must not turn into a long
// wait, so the whole run is capped and the gap shrinks to fit
const RIPPLE_STEP_MS = 55;
const RIPPLE_RUN_MS = 700;
// how long one pulse lasts. the stylesheet is told this rather than repeating it,
// because the timer that clears the run is measured from the same number.
export const PULSE_MS = 420;

export function rippleDelay(index: number, length: number): number {
  const step = Math.min(RIPPLE_STEP_MS, RIPPLE_RUN_MS / Math.max(length, 1));
  return index * step;
}

sheet.onRecalc(({ order, connected }) => {
  // a cell that only recomputed itself has no chain to follow, so nothing plays
  const downstream = order.length > 1 ? order : [];
  if (downstream.length === 0 && connected.length === 0) {
    store.set(EMPTY);
    return;
  }

  store.set({ downstream, connected, run: store.get().run + 1 });
});

export function useRipple(): Ripple {
  const ripple = useSyncExternalStore(store.subscribe, store.get);

  // the pulses are one-shot, so the run has to be cleared or a later render
  // would replay it
  useEffect(() => {
    const length = Math.max(ripple.downstream.length, ripple.connected.length);
    if (length === 0) return;

    const timer = setTimeout(() => store.set(EMPTY), rippleDelay(length, length) + PULSE_MS);
    return () => clearTimeout(timer);
  }, [ripple]);

  return ripple;
}
