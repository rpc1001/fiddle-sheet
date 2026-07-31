import { useSyncExternalStore } from "react";
import type { Address } from "../core/address";
import { createValueStore } from "./valueStore";

// the cell under the pointer, null while it is off the sheet
const store = createValueStore<Address | null>(null);

export const getHover = store.get;
export const setHover = store.set;

export function useHover(): Address | null {
  return useSyncExternalStore(store.subscribe, store.get);
}
