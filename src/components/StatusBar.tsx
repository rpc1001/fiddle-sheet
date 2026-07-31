import { useLayoutEffect, useRef, useState } from "react";
import { cellKey } from "../core/address";
import { bandOf } from "../core/geometry";
import { type Doing, hintsFor } from "../core/hints";
import { isSingleCell } from "../core/range";
import { selectionRange } from "../core/selection";
import { offered, useEditing } from "../state/editing";
import { useSelection } from "../state/selection";
import { sheet, useSheetRevision } from "../state/sheet";
import { Odometer } from "./Odometer";
import { chordLabel } from "./platform";
import "./StatusBar.css";

function behindClass(behind: string, formula: boolean): string {
  if (behind === "") return "status-behind is-empty";
  return formula ? "status-behind is-formula" : "status-behind";
}

// the shell is sized from the row inside it so it can travel between widths
// rather than jump: a state change reshapes one object instead of replacing it.
function useContentWidth() {
  const row = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    const node = row.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry!.borderBoxSize[0]!.inlineSize);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { row, width };
}

export function StatusBar() {
  const selection = useSelection();
  const editing = useEditing();
  // the raw text can change under a still selection, so watch edits too
  useSheetRevision();
  const { row, width } = useContentWidth();

  const range = selectionRange(selection);
  const focus = selection.focus;
  // while editing this shows the draft, not what is still stored underneath it
  const behind = editing?.text ?? sheet.getRaw(cellKey(focus.row, focus.col));

  const doing: Doing = editing
    ? {
        kind: "editing",
        formula: editing.text.startsWith("="),
        choosing: offered(editing).suggestion?.kind === "functions",
      }
    : {
        kind: "selecting",
        multi: !isSingleCell(range),
        empty: behind === "",
      };

  // only while the key would actually do something, so the pill never teaches a
  // shortcut that is currently dead
  const history = [
    { keys: chordLabel("Z"), label: "undo", live: sheet.canUndo() },
    { keys: chordLabel("Y"), label: "redo", live: sheet.canRedo() },
  ].filter((hint) => hint.live);

  const hints = hintsFor(doing);
  const formula = behind.startsWith("=");
  const single = isSingleCell(range);
  const band = bandOf(range);

  return (
    <div className="status-bar" style={{ width }}>
      <div className="status-row" ref={row}>
        <span className={formula ? "status-ref is-formula" : "status-ref"}>
          <Odometer address={{ row: range.top, col: range.left }} band={band} />
          {!single && (
            <>
              <span className="status-ref-join">:</span>
              <Odometer address={{ row: range.bottom, col: range.right }} band={band} />
            </>
          )}
        </span>
        <span className={behindClass(behind, formula)}>{behind || "empty"}</span>
        <span className="status-hints" key={hints.map((hint) => hint.keys).join()}>
          {hints.map((hint) => (
            <span key={hint.keys} className="status-hint">
              <kbd className="status-keys">{hint.keys}</kbd>
              {hint.label}
            </span>
          ))}
        </span>
        {history.map((hint) => (
          <span key={hint.label} className="status-hint">
            <kbd className="status-keys">{hint.keys}</kbd>
            {hint.label}
          </span>
        ))}
      </div>
    </div>
  );
}
