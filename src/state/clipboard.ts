import { useSyncExternalStore } from "react";
import { type Clip, clipText } from "../core/clipboard";
import { createValueStore } from "./valueStore";

// what is being held, and only ours: the system clipboard is the one that
// crosses apps. this is here for the two things the text alone cannot say,
// which is where the cells came from and whether they were cut.
const store = createValueStore<Clip | null>(null);

export const getClip = store.get;

export function useClip(): Clip | null {
  return useSyncExternalStore(store.subscribe, store.get);
}

export function holdClip(clip: Clip): void {
  store.set(clip);
}

export function dropClip(): void {
  if (store.get()) store.set(null);
}

// the clip only speaks for text that is still on the system clipboard. anything
// else in there came from another app, and pasting it must not carry our
// origin, our offsets or our cut with it.
export function clipFor(text: string): Clip | null {
  const held = store.get();
  return held && clipText(held) === text ? held : null;
}
