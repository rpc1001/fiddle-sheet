import type { CSSProperties, RefObject } from "react";
import { type Address, cellKey } from "../core/address";
import { formatNumber } from "../core/format";
import { type CellValue, errorDisplay, isError } from "../core/formula/errors";
import { explainError, hasReference, substitute } from "../core/formula/explain";
import {
  type Viewport,
  fitsAbove,
  fitsBelow,
  fitsLeft,
  fitsRight,
  keepAcross,
  keepDown,
  type Rect,
  rectOf,
  visiblePart,
} from "../core/geometry";
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
// enough of each panel to know whether it would fall off the bottom
const DRAFT_HEIGHT = 150;
const ANSWER_HEIGHT = 108;

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

// against the selection, or against the window when the selection leaves no
// clear space to hang off at all
type Placement = { at: "selection" | "window"; style: CSSProperties };

type Side = "right" | "left" | "below" | "above";

const SIDES: Side[] = ["right", "left", "below", "above"];

// how far the cell being worked on sits from each edge of the selection
function distanceFrom(cell: Rect, box: Rect, side: Side): number {
  if (side === "right") return box.left + box.width - (cell.left + cell.width);
  if (side === "left") return cell.left - box.left;
  if (side === "below") return box.top + box.height - (cell.top + cell.height);
  return cell.top - box.top;
}

// the nearest edge of the selection with room beside it, lined up with the cell
// being worked on. one rule rather than a running order: the answer turns up
// where the hand already is, and on a selection wider than the window a fixed
// preference for one side puts it clean across the screen from the pointer.
// it measures the visible part of the selection, not the whole of it: a band
// runs past the window on one axis, so its own edges are off screen.
function answerPlacement(range: Range, focus: Address, view: Viewport): Placement {
  const box = visiblePart(rectOf(range), view);
  const cell = rectOf(rangeAt(focus));
  const panel = { "--lens-w": `${WIDTH}px` } as CSSProperties;

  const room: Record<Side, boolean> = {
    right: fitsRight(box, WIDTH, GAP, view),
    left: fitsLeft(box, WIDTH, GAP, view),
    below: fitsBelow(box, ANSWER_HEIGHT, GAP, view),
    above: fitsAbove(box, ANSWER_HEIGHT, GAP, view),
  };

  const free = SIDES.filter((side) => room[side]);

  // the selection fills the window both ways, so there is no clear space to find
  // and covering some of it is the only option left. it takes the window's right
  // edge instead of the selection's, which also makes it the one placement that
  // stays put while the sheet scrolls.
  if (free.length === 0) {
    return { at: "window", style: { ...panel, "--lens-gap": `${GAP}px` } as CSSProperties };
  }

  const side = free.reduce((near, other) =>
    distanceFrom(cell, box, other) < distanceFrom(cell, box, near) ? other : near,
  );
  const alongside = keepDown(cell.top, ANSWER_HEIGHT, GAP, view);
  const under = keepAcross(cell.left, WIDTH, GAP, view);

  if (side === "right") {
    return { at: "selection", style: { ...panel, left: box.left + box.width + GAP, top: alongside } };
  }

  if (side === "left") {
    return {
      at: "selection",
      style: { ...panel, left: box.left - GAP, top: alongside, transform: "translateX(-100%)" },
    };
  }

  if (side === "below") {
    return { at: "selection", style: { ...panel, left: under, top: box.top + box.height + GAP } };
  }

  return {
    at: "selection",
    style: { ...panel, left: under, top: box.top - GAP, transform: "translateY(-100%)" },
  };
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

  const placement = answerPlacement(range, selection.focus, box);

  return (
    <div
      className={placement.at === "window" ? "lens is-in-window" : "lens"}
      style={placement.style}
    >
      <Body view={view} />
    </div>
  );
}
