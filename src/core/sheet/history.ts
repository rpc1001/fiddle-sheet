import type { CellKey } from "../address";
import type { Selection } from "../selection";

export type Change = { key: CellKey; before: string; after: string };

// one entry per user action, however many cells it touched, so clearing a range
// takes one undo rather than one per cell. the selection is kept so undoing can
// put you back where the edit happened.
export type Entry = { changes: Change[]; selection: Selection };

export type History = {
  record(entry: Entry): void;
  undo(): Entry | null;
  redo(): Entry | null;
  canUndo(): boolean;
  canRedo(): boolean;
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

    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}
