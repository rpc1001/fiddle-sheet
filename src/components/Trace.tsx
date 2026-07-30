import { type CSSProperties, useMemo } from "react";
import { type CellKey, addressOf, cellKey } from "../core/address";
import { blocks } from "../core/blocks";
import { draftReferences } from "../core/formula/scan";
import { rectOf } from "../core/geometry";
import { type Range, isSingleCell, rangeAt, rangeLabel } from "../core/range";
import { selectionRange } from "../core/selection";
import { useEditing } from "../state/editing";
import { PULSE_MS, rippleDelay, useRipple } from "../state/ripple";
import { useSelection } from "../state/selection";
import { sheet, useSheetRevision } from "../state/sheet";
import "./Trace.css";

type Kind = "input" | "output";
type Mark = { key: string; range: Range; depth: number; kind: Kind };

function boxOf(key: CellKey): CSSProperties {
  return rectOf(rangeAt(addressOf(key)));
}

// cells at the same distance in the same direction are one shape, so a traced
// range is outlined once instead of cell by cell
function marksFor(reach: Map<CellKey, number>, kind: Kind): Mark[] {
  const byDepth = new Map<number, CellKey[]>();
  for (const [at, depth] of reach) {
    const group = byDepth.get(depth) ?? [];
    group.push(at);
    byDepth.set(depth, group);
  }

  return [...byDepth].flatMap(([depth, keys]) =>
    blocks(keys.map(addressOf)).map((range) => ({
      key: `${kind}-${depth}-${rangeLabel(range)}`,
      range,
      depth,
      kind,
    })),
  );
}

function markElements(marks: Mark[]) {
  return marks.map((mark) => (
    <div
      key={mark.key}
      className={mark.kind === "input" ? "trace-mark is-input" : "trace-mark is-output"}
      style={{ ...rectOf(mark.range), "--depth": mark.depth } as CSSProperties}
    />
  ));
}

// what the selected cell reads, and what reads it, fading with every hop away.
// direction is the colour, distance is the strength, and nothing is drawn
// between cells: a line to a precedent forty rows up is a line to nowhere.
function Marks() {
  const selection = useSelection();
  const revision = useSheetRevision();
  const range = selectionRange(selection);
  const at = isSingleCell(range) ? cellKey(range.top, range.left) : null;

  // a range reference is one graph edge per cell, so this walks the whole range
  // and sorts it into blocks. arrowing across a wide SUM would do it per keypress.
  const marks = useMemo(() => {
    if (at === null) return null;
    const { inputs, outputs } = sheet.trace(at);
    return [...marksFor(inputs, "input"), ...marksFor(outputs, "output")];
  }, [at, revision]);

  if (!marks) return null;
  return <>{markElements(marks)}</>;
}

// the cells a half-typed formula names, lit while it is being typed. the same
// colour the committed formula will trace in, so the draft is a preview of it.
function DraftMarks({ text }: { text: string }) {
  const marks = draftReferences(text).map((range, at) => ({
    key: `draft-${at}-${rangeLabel(range)}`,
    range,
    depth: 1,
    kind: "input" as const,
  }));

  return <>{markElements(marks)}</>;
}

// two things move on an edit: the recalculation running out to whatever reads
// the cell, and the new connections a formula just made back to what it reads
function Ripple() {
  const { downstream, connected, run } = useRipple();
  const duration = `${PULSE_MS}ms`;

  return (
    <>
      {downstream.map((at, index) => (
        <div
          key={`down-${run}-${at}`}
          className="trace-pulse is-output"
          style={{
            ...boxOf(at),
            animationDuration: duration,
            animationDelay: `${rippleDelay(index, downstream.length)}ms`,
          }}
        />
      ))}
      {blocks(connected.map(addressOf)).map((range) => (
        <div
          key={`link-${run}-${rangeLabel(range)}`}
          className="trace-pulse is-input"
          style={{ ...rectOf(range), animationDuration: duration }}
        />
      ))}
    </>
  );
}

export function TraceOverlay() {
  const editing = useEditing();

  return (
    <>
      {editing ? <DraftMarks text={editing.text} /> : <Marks />}
      <Ripple />
    </>
  );
}
