import { useSyncExternalStore } from "react";
import { type Selection, selectionAt } from "../core/selection";
import { createValueStore } from "./valueStore";

const store = createValueStore<Selection>(selectionAt({ row: 0, col: 0 }));

export const getSelection = store.get;
export const setSelection = store.set;
export const subscribeSelection = store.subscribe;

export function useSelection(): Selection {
  return useSyncExternalStore(store.subscribe, store.get);
}
