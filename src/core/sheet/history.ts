import type { CellKey } from "../address";
import type { Selection } from "../selection";

export type Change = { key: CellKey; before: string; after: string };

// what was done, rather than what the cells look like afterwards. a paste, a
// fill and a clear all leave the same shape of change behind, so the moment the
// action is taken is the only one this can be known in.
export type Action = "type" | "clear" | "paste" | "fill" | "move";

// one entry per user action, however many cells it touched, so clearing a range
// takes one undo rather than one per cell. the selection is kept so undoing can
// put you back where the edit happened, and so the action can be named after the
// place it happened in.
export type Entry = { changes: Change[]; selection: Selection; action: Action };

export type History = {
  record(entry: Entry): void;
  undo(): Entry | null;
  redo(): Entry | null;
  // the entry each way would move, for anything that wants to say what it is
  // before doing it. null is also the answer to whether there is one at all.
  peekUndo(): Entry | null;
  peekRedo(): Entry | null;
};

export function createHistory(): History {
  const past: Entry[] = [];
  const future: Entry[] = [];

  return {
    record(entry) {
      past.push(entry);
      // a new edit after undoing abandons the redo branch
      future.length = 0;
    },

    undo() {
      const entry = past.pop();
      if (!entry) return null;
      future.push(entry);
      return entry;
    },

    redo() {
      const entry = future.pop();
      if (!entry) return null;
      past.push(entry);
      return entry;
    },

    peekUndo: () => past.at(-1) ?? null,
    peekRedo: () => future.at(-1) ?? null,
  };
}
