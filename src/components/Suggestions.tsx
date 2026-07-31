import { useMemo } from "react";
import { cellKey } from "../core/address";
import { displayValue } from "../core/format";
import { type CellValue, errorDisplay, isError } from "../core/formula/errors";
import { explainError } from "../core/formula/explain";
import { OPERATORS } from "../core/formula/functions";
import { canTakeOperator } from "../core/formula/scan";
import { type Suggestion, acceptSuggestion } from "../core/formula/suggest";
import { isSingleCell, rangeLabel } from "../core/range";
import { summarize } from "../core/summary";
import { type Editing, offered, setDraft, useEditing } from "../state/editing";
import { rangeValues, sheet, useSheetRevision } from "../state/sheet";

// what the range typed so far actually covers, which is where an off by one
// range is caught: before it is committed rather than after the total looks odd
function argumentText(found: Extract<Suggestion, { kind: "argument" }>): string {
  const { range } = found;
  if (!range) return `${found.name} · ${found.summary ?? "pick the cells"}`;

  const label = rangeLabel(range);
  // one cell has nothing to count, so the useful thing to show is what it holds
  if (isSingleCell(range)) return `${label} = ${sheet.getDisplay(cellKey(range.top, range.left))}`;

  const summary = summarize(rangeValues(range));
  const numbers = summary.numbers?.count ?? 0;
  const of = numbers === summary.cells ? "" : ` of ${summary.cells}`;
  return `${label} · ${numbers}${of} ${numbers === 1 ? "number" : "numbers"}`;
}

// a formula is unfinished for most of the time it is being typed, so an
// unreadable draft says nothing rather than reporting a problem on every key
function Result({ value }: { value: CellValue }) {
  if (isError(value)) {
    if (value.code === "bad-formula") return null;

    return (
      <div className="lens-result">
        <div className="lens-label is-problem">{errorDisplay(value)}</div>
        <div className="lens-message">{explainError(value)}</div>
      </div>
    );
  }

  return (
    <div className="lens-result">
      <span className="lens-answer">= {displayValue(value)}</span>
    </div>
  );
}

export function DraftPanel() {
  const editing = useEditing();
  if (!editing) return null;

  return <Panel editing={editing} />;
}

// both halves walk the whole referenced range, and the panel re-renders for
// things that do not change either: the highlight moving, the selection, a hover
function Panel({ editing }: { editing: NonNullable<Editing> }) {
  const { text } = editing;
  const { suggestion, highlight, taking } = offered(editing);
  const revision = useSheetRevision();

  // the revision is in the dependencies because both of these read the sheet
  // itself, which react cannot see
  const argument = suggestion?.kind === "argument" ? suggestion : null;
  const described = useMemo(
    () => (argument ? argumentText(argument) : null),
    [argument, revision],
  );

  const answer = useMemo(
    () => (text.length > 1 && suggestion?.kind !== "functions" ? sheet.preview(text) : null),
    [text, suggestion?.kind, revision],
  );

  return (
    <>
      {suggestion?.kind === "functions" && (
        <ul className="lens-list">
          {suggestion.matches.map((entry, index) => (
            <li
              key={entry.name}
              // lit means enter takes it, so a list that has not been asked for
              // lights nothing: the mark and the key have to agree
              className={taking && index === highlight ? "lens-option is-on" : "lens-option"}
              // the press must not reach the input: a blur there commits the cell
              onMouseDown={(event) => {
                event.preventDefault();
                setDraft(acceptSuggestion(text, entry.name));
              }}
            >
              <span className="lens-option-name">{entry.name}</span>
              <span className="lens-option-summary">{entry.summary}</span>
            </li>
          ))}
        </ul>
      )}

      {described && <div className="lens-argument">{described}</div>}

      {/* a value is written, so the next thing is an operator: one press each */}
      {canTakeOperator(text) && (
        <div className="lens-operators">
          {OPERATORS.map((operator) => (
            <button
              key={operator.insert}
              type="button"
              className="lens-operator"
              onMouseDown={(event) => {
                event.preventDefault();
                setDraft(text + operator.insert);
              }}
            >
              {operator.sign}
            </button>
          ))}
        </div>
      )}

      {/* mid word there is no answer yet, and the list is the thing being read */}
      {answer !== null && <Result value={answer} />}
    </>
  );
}
