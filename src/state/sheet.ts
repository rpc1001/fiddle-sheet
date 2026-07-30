import { useCallback, useSyncExternalStore } from "react";
import { cellKey } from "../core/address";
import { createSheet } from "../core/sheet/store";
import { seed } from "./seed";

export const sheet = createSheet(seed);

export type CellView = {
  display: string;
  numeric: boolean;
};

export function useCell(row: number, col: number): CellView {
  const key = cellKey(row, col);
  const subscribe = useCallback((listener: () => void) => sheet.subscribe(key, listener), [key]);
  const getSnapshot = useCallback(() => sheet.getDisplay(key), [key]);
  const display = useSyncExternalStore(subscribe, getSnapshot);

  // read alongside the subscription rather than through it: a snapshot has to be
  // a stable value, and this reads the same store the display just came from
  return { display, numeric: typeof sheet.getValue(key) === "number" };
}
