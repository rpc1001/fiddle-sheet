import { useSyncExternalStore } from "react";
import type { Address } from "../core/address";
import type { Span } from "../core/formula/insert";
import { type Suggestion, suggest } from "../core/formula/suggest";
import { createValueStore } from "./valueStore";

// the draft lives here rather than inside the editor because clicking a cell
// while a formula is open rewrites it, and that click lands on the grid
export type Editing = {
  cell: Address;
  text: string;
  // what the last clicked reference wrote, so the next click can replace it
  inserted: Span | null;
  // which function in the suggestion list the keyboard is on
  highlight: number;
  // escape closes the list before it cancels the edit
  dismissed: boolean;
} | null;

const store = createValueStore<Editing>(null);

// the editor, the panel and the status bar all ask the same draft the same
// question in the same render, and the answer only moves when the text does
let last: { text: string; suggestion: Suggestion } | null = null;

function suggestionFor(text: string): Suggestion {
  if (last?.text !== text) last = { text, suggestion: suggest(text) };
  return last.suggestion;
}

export const getEditing = store.get;

export function startEditing(cell: Address, text: string): void {
  store.set({ cell, text, inserted: null, highlight: 0, dismissed: false });
}

// typing invalidates the insertion point: whatever is at the end is now yours.
// it also reopens the list, since the name being typed has changed.
export function setDraft(text: string): void {
  const editing = store.get();
  if (editing) store.set({ ...editing, text, inserted: null, highlight: 0, dismissed: false });
}

export function setInsertedDraft(text: string, inserted: Span): void {
  const editing = store.get();
  if (editing) store.set({ ...editing, text, inserted });
}

export function setHighlight(highlight: number): void {
  const editing = store.get();
  if (editing) store.set({ ...editing, highlight });
}

export function moveHighlight(step: number, count: number): void {
  const editing = store.get();
  if (!editing || count === 0) return;
  store.set({ ...editing, highlight: (editing.highlight + step + count) % count });
}

export function dismissSuggestions(): void {
  const editing = store.get();
  if (editing) store.set({ ...editing, dismissed: true });
}

export function stopEditing(): void {
  store.set(null);
}

export function useEditing(): Editing {
  return useSyncExternalStore(store.subscribe, store.get);
}

// what the draft is offering right now, with the highlight already wrapped to
// the list it lands in. the editor takes keys on this, the panel draws it and
// the status bar names it, so all three have to be reading the same answer.
export function offered(editing: Editing): { suggestion: Suggestion; highlight: number } {
  if (!editing || editing.dismissed) return { suggestion: null, highlight: 0 };

  const suggestion = suggestionFor(editing.text);
  const count = suggestion?.kind === "functions" ? suggestion.matches.length : 0;
  return { suggestion, highlight: count > 0 ? editing.highlight % count : 0 };
}
