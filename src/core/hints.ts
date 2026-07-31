export type Hint = { keys: string; label: string };

// closed, open but not asked for, and holding the keys. the middle state is why
// this is not a boolean: the arrows reach a list that enter does not.
export type List = "none" | "showing" | "taking";

export type Doing =
  | { kind: "selecting"; multi: boolean; empty: boolean; numbers: boolean }
  | { kind: "editing"; formula: boolean; list: List };

const SAVE: Hint = { keys: "↵", label: "save" };
const CANCEL: Hint = { keys: "esc", label: "cancel" };
const CLEAR: Hint = { keys: "⌫", label: "clear" };

// one word each and never more than three: past that nobody reads any of them
export function hintsFor(doing: Doing): Hint[] {
  if (doing.kind === "editing") {
    // the list has taken the keys, so saying they still save would be a lie
    if (doing.list === "taking") {
      return [
        { keys: "↑↓", label: "pick" },
        { keys: "↵", label: "insert" },
        { keys: "esc", label: "close" },
      ];
    }

    // open and untouched: enter is still the cell's, and the arrows are how the
    // list gets used at all, which is worth saying since nothing else says it
    if (doing.list === "showing") {
      return [{ keys: "↑↓", label: "pick" }, SAVE, CANCEL];
    }
    if (!doing.formula) return [SAVE, CANCEL];
    return [{ keys: "click", label: "add cell" }, SAVE, CANCEL];
  }

  if (doing.multi) {
    // the drag is the one thing here nobody arrives knowing, and it is only
    // worth saying while the block holds something a total could be taken of
    if (doing.numbers) {
      return [{ keys: "⌥ drag", label: "total" }, { keys: "⇧ arrows", label: "resize" }, CLEAR];
    }
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
