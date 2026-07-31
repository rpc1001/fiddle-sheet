import { useSyncExternalStore } from "react";
import type { Address } from "../core/address";
import { createValueStore } from "./valueStore";

// a range being carried to a cell: where the pointer is, the formula it would
// write, and the cell it would be written into. the text is settled when the
// block is picked up, since a block in the air cannot change.
export type Quote = { x: number; y: number; text: string; onto: Address | null };

const store = createValueStore<Quote | null>(null);

export const getQuoting = store.get;
export const setQuoting = store.set;

export function useQuoting(): Quote | null {
  return useSyncExternalStore(store.subscribe, store.get);
}
