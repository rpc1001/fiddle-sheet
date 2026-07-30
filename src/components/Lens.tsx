import type { CSSProperties, RefObject } from "react";
import { cellKey } from "../core/address";
import { formatNumber } from "../core/format";
import { type CellValue, errorDisplay, isError } from "../core/formula/errors";
import { explainError, hasReference, substitute } from "../core/formula/explain";
import { type Viewport, fitsBelow, fitsRight, rectOf } from "../core/geometry";
import { type Range, isSingleCell, rangeAt } from "../core/range";
import { selectionRange } from "../core/selection";
import { summarize } from "../core/summary";
import { useEditing } from "../state/editing";
import { useSelection } from "../state/selection";
import { rangeValues, sheet, useSheetRevision } from "../state/sheet";
import { DraftPanel } from "./Suggestions";
import { viewportBox } from "./viewport";
import "./Lens.css";

const GAP = 18;
const WIDTH = 236;
const DRAFT_WIDTH = 330;
// enough of the panel to know whether it would fall off the bottom
const DRAFT_HEIGHT = 150;

type View =
  | { kind: "answer"; label: string; value: string; note: string | null }
  | { kind: "problem"; label: string; message: string };

const readCell = (row: number, col: number): CellValue => sheet.getValue(cellKey(row, col));

// the answer for a whole block: the sum first, because that is what people are
// almost always counting, and the rest underneath so nothing needs choosing
function rangeView(range: Range): View {
  const summary = summarize(rangeValues(range));
  const { numbers } = summary;

  if (!numbers) {
    return {
      kind: "answer",
      label: `${summary.cells} cells`,
      value: String(summary.filled),
      note: "filled",
    };
  }

  return {
    kind: "answer",
    label: `sum of ${numbers.count} cells`,
    value: formatNumber(numbers.sum),
    note: `avg ${formatNumber(numbers.average)} · min ${formatNumber(numbers.min)} · max ${formatNumber(numbers.max)}`,
  };
}

// a cell shows its result, never its formula, so this is the only place the
// working behind a number is visible without opening it
function cellView(row: number, col: number): View | null {
  const key = cellKey(row, col);
  const value = sheet.getValue(key);

  if (isError(value)) {
    return { kind: "problem", label: errorDisplay(value), message: explainError(value) };
  }

  const formula = sheet.getFormula(key);
  if (!formula) return null;

  return {
    kind: "answer",
    label: sheet.getRaw(key),
    value: sheet.getDisplay(key),
    note: hasReference(formula) ? substitute(formula, readCell) : null,
  };
}

// under the cell while it is open, because suggestions belong next to the caret
// and the editor takes the room to the right as the formula grows
function draftPlacement(range: Range, view: Viewport): CSSProperties {
  const box = rectOf(range);
  const above = !fitsBelow(box, DRAFT_HEIGHT, GAP, view);

  return {
    left: box.left,
    top: above ? box.top - GAP : box.top + box.height + GAP,
    transform: above ? "translateY(-100%)" : undefined,
    "--lens-w": `${DRAFT_WIDTH}px`,
  } as CSSProperties;
}

// beside the selection when the cell is closed, on whichever side has the room
function answerPlacement(range: Range, view: Viewport): CSSProperties {
  const box = rectOf(range);
  const left = !fitsRight(box, WIDTH, GAP, view);

  return {
    left: left ? box.left - GAP : box.left + box.width + GAP,
    top: box.top + box.height / 2,
    transform: left ? "translate(-100%, -50%)" : "translateY(-50%)",
    "--lens-w": `${WIDTH}px`,
  } as CSSProperties;
}

function Body({ view }: { view: View }) {
  if (view.kind === "problem") {
    return (
      <>
        <div className="lens-label is-problem">{view.label}</div>
        <div className="lens-message">{view.message}</div>
      </>
    );
  }

  return (
    <>
      <div className="lens-label">{view.label}</div>
      <div className="lens-value">{view.value}</div>
      {view.note && <div className="lens-note">{view.note}</div>}
    </>
  );
}

export function Lens({ viewport }: { viewport: RefObject<HTMLDivElement | null> }) {
  const selection = useSelection();
  const editing = useEditing();
  useSheetRevision();

  const box = viewportBox(viewport.current);

  if (editing) {
    // a plain value has nothing to suggest and its own cell already shows it
    if (!editing.text.startsWith("=")) return null;

    // the cell being edited, not the selection: enter on a multi-cell selection
    // opens the focus corner, and the panel belongs under that input
    return (
      <div className="lens" style={draftPlacement(rangeAt(editing.cell), box)}>
        <DraftPanel />
      </div>
    );
  }

  const range = selectionRange(selection);
  const view = isSingleCell(range) ? cellView(range.top, range.left) : rangeView(range);
  if (!view) return null;

  return (
    <div className="lens" style={answerPlacement(range, box)}>
      <Body view={view} />
    </div>
  );
}
