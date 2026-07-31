import { useSyncExternalStore } from "react";
import type { Axis } from "../core/geometry";
import { createValueStore } from "./valueStore";

// a band being carried: which way it travels, where its near edge has been
// dragged to along that axis, and the gap it would land in
export type Carry = { axis: Axis; offset: number; gap: number };

const store = createValueStore<Carry | null>(null);

export const getMoving = store.get;
export const setMoving = store.set;

export function useMoving(): Carry | null {
  return useSyncExternalStore(store.subscribe, store.get);
}
