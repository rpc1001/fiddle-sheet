import { useSyncExternalStore } from "react";
import type { CellKey } from "../core/address";
import { type Reading, fillReadings } from "../core/fill";
import { type Range, sameRange } from "../core/range";
import { type Selection, selectionRange } from "../core/selection";
import { getSelection, setSelection, subscribeSelection } from "./selection";
import { sheet } from "./sheet";
import { createValueStore } from "./valueStore";

// how far the fill being dragged currently reaches, source included. null
// whenever the handle is not being held. outside react for the same reason as
// the selection, since it changes at pointer rate.
const dragging = createValueStore<Range | null>(null);

export const getFilling = dragging.get;
export const setFilling = dragging.set;

export function useFilling(): Range | null {
  return useSyncExternalStore(dragging.subscribe, dragging.get);
}

// a fill that has landed and could honestly have been read another way. there is
// never one reading here: one reading is not a choice, and a list with nothing to
// choose between is the thing that trains people to ignore the list.
export type Offer = {
  extent: Range;
  readings: Reading[];
  chosen: number;
  // the selection the fill was dragged from, so undo returns there whichever
  // reading is standing when it happens
  from: Selection;
  // what the sheet counted up to when this fill landed. anything else touching
  // the sheet moves it on, and this offer is then about a state that is gone.
  revision: number;
};

const offering = createValueStore<Offer | null>(null);

export const getOffer = offering.get;

export function useOffer(): Offer | null {
  return useSyncExternalStore(offering.subscribe, offering.get);
}

export function clearOffer(): void {
  if (offering.get()) offering.set(null);
}

// the fill itself. the best reading is written straight into the sheet: there is
// no pending state to keep, and every other part of the app goes on reading one
// map of cells.
export function applyFill(source: Range, extent: Range): void {
  const readings = fillReadings((key: CellKey) => sheet.getRaw(key), source, extent);
  if (readings.length === 0) return;

  const from = getSelection();
  const before = sheet.revision();
  sheet.edit(readings[0]!.writes, from, "fill");

  setSelection({
    anchor: { row: extent.top, col: extent.left },
    focus: { row: extent.bottom, col: extent.right },
  });

  // a fill that wrote nothing has no action in history to revise, and selecting
  // what it covered is all it can honestly do
  const landed = sheet.revision() !== before;
  offering.set(
    landed && readings.length > 1
      ? { extent, readings, chosen: 0, from, revision: sheet.revision() }
      : null,
  );
}

// taking a different reading is the one edit that does not end the offer, so it
// is also the one the rule below has to be told about
let revising = false;

export function chooseReading(at: number): void {
  const offer = offering.get();
  if (!offer || at === offer.chosen) return;

  revising = true;
  sheet.revise(offer.readings[at]!.writes, offer.from, "fill");
  revising = false;

  offering.set({ ...offer, chosen: at, revision: sheet.revision() });
}

// the offer and the outline that goes with it live exactly as long as the state
// they describe. one rule covers both dismissing them and keeping revise honest:
// once the sheet or the selection has moved on, the fill is no longer the thing
// in front of you.
sheet.onEdit(() => {
  if (revising) return;

  const offer = offering.get();
  if (offer && sheet.revision() !== offer.revision) offering.set(null);
});

subscribeSelection(() => {
  const offer = offering.get();
  if (!offer) return;

  if (!sameRange(selectionRange(getSelection()), offer.extent)) offering.set(null);
});
