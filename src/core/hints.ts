export type Hint = { keys: string; label: string };

// what the sheet is being used for right now. the hints follow from this and
// nothing else, which keeps them out of the components.
export type Doing =
  | { kind: "selecting"; multi: boolean; empty: boolean }
  | { kind: "editing"; formula: boolean; choosing: boolean };

const SAVE: Hint = { keys: "↵", label: "save" };
const CANCEL: Hint = { keys: "esc", label: "cancel" };
const CLEAR: Hint = { keys: "⌫", label: "clear" };

// one word each and never more than three: past that nobody reads any of them
export function hintsFor(doing: Doing): Hint[] {
  if (doing.kind === "editing") {
    // the list has taken the keys, so saying they still save would be a lie
    if (doing.choosing) {
      return [
        { keys: "↑↓", label: "pick" },
        { keys: "↵", label: "insert" },
        { keys: "esc", label: "close" },
      ];
    }
    if (!doing.formula) return [SAVE, CANCEL];
    return [{ keys: "click", label: "add cell" }, SAVE, CANCEL];
  }

  if (doing.multi) {
    return [{ keys: "⇧ arrows", label: "resize" }, CLEAR];
  }

  if (doing.empty) {
    return [
      { keys: "type", label: "enter" },
      { keys: "=", label: "formula" },
    ];
  }

  return [{ keys: "↵", label: "edit" }, CLEAR];
}
