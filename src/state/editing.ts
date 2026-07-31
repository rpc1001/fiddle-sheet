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
  // whether the keyboard has been into the list. a list that opened on its own
  // and has not been touched does not get to take enter off the cell.
  picked: boolean;
  // escape closes the list before it cancels the edit
  dismissed: boolean;
  // a guessed draft was written for the user rather than by them, so its
  // function is only a guess and the other readings of the same range are worth
  // offering. a typed one says what it means already.
  origin: DraftOrigin;
} | null;

export type DraftOrigin = "typed" | "guessed";

const store = createValueStore<Editing>(null);

// the editor, the panel and the status bar all ask the same draft the same
// question in the same render, and the answer only moves when the text does
let last: { text: string; suggestion: Suggestion } | null = null;

function suggestionFor(text: string): Suggestion {
  if (last?.text !== text) last = { text, suggestion: suggest(text) };
  return last.suggestion;
}

export const getEditing = store.get;

// the open editor's field. the panel is drawn in a different tree from the
// editor, so it cannot be handed the element as a prop, and the draft is
// already shared through this file for the same reason.
let field: HTMLInputElement | null = null;

export function setDraftField(element: HTMLInputElement | null): void {
  field = element;
}

// leaving the field is what saves a draft, so anything offering to save asks
// for that rather than being a second way to save that could fall out of step
export function leaveDraftField(): void {
  field?.blur();
}

export function startEditing(cell: Address, text: string, origin: DraftOrigin = "typed"): void {
  store.set({
    cell,
    text,
    inserted: null,
    highlight: 0,
    picked: false,
    dismissed: false,
    origin,
  });
}

// typing invalidates the insertion point and reopens the list, since the name
// being typed has changed. it also makes the draft the user's: a guess is only
// offered until they touch it, and the swap list is the one caller that says
// otherwise, since it rewrites the very draft it is offering.
export function setDraft(text: string, origin: DraftOrigin = "typed"): void {
  const editing = store.get();
  if (editing) {
    store.set({
      ...editing,
      text,
      inserted: null,
      highlight: 0,
      picked: false,
      dismissed: false,
      origin,
    });
  }
}

// a reference written by clicking the grid: the same act as typing one, so it
// takes the draft over from a guess the same way
export function setInsertedDraft(text: string, inserted: Span): void {
  const editing = store.get();
  if (editing) store.set({ ...editing, text, inserted, origin: "typed" });
}

export function moveHighlight(step: number, count: number): void {
  const editing = store.get();
  if (!editing || count === 0) return;
  store.set({ ...editing, highlight: (editing.highlight + step + count) % count });
}

// the first arrow into a list that opened by itself takes the end it came in
// from rather than stepping off it: the top entry is already under the highlight,
// and moving would skip the very thing being pointed at
export function enterList(highlight: number): void {
  const editing = store.get();
  if (editing) store.set({ ...editing, highlight, picked: true });
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

// which cell is open and nothing else. the draft changes on every keystroke and
// the cell does not, so anything that only needs to know where the editor is
// asks this and stops re-rendering with the text.
export function useEditingCell(): Address | null {
  return useSyncExternalStore(store.subscribe, () => store.get()?.cell ?? null);
}

// what the draft is offering right now, highlight already wrapped to the list it
// lands in. the editor takes keys on this, the panel draws it and the status bar
// names it, so all three read one answer. taking is whether enter belongs to the
// list: a list narrowing a typed name has been asked for, one that opened by
// itself has not, until the arrows go into it.
export function offered(editing: Editing): {
  suggestion: Suggestion;
  highlight: number;
  taking: boolean;
} {
  if (!editing || editing.dismissed) return { suggestion: null, highlight: 0, taking: false };

  const suggestion = suggestionFor(editing.text);
  const list = suggestion?.kind === "functions" ? suggestion : null;
  const count = list?.matches.length ?? 0;

  return {
    suggestion,
    highlight: count > 0 ? editing.highlight % count : 0,
    taking: list !== null && (list.typed || editing.picked),
  };
}
