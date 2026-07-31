import { useMemo } from "react";
import { cellKey } from "../core/address";
import { displayValue } from "../core/format";
import { type CellValue, errorDisplay, isError } from "../core/formula/errors";
import { explainError } from "../core/formula/explain";
import { FUNCTIONS, OPERATORS, type SheetFunction } from "../core/formula/functions";
import { asWritten, canTakeOperator } from "../core/formula/scan";
import {
  type Suggestion,
  acceptSuggestion,
  calledFunction,
  swapFunction,
} from "../core/formula/suggest";
import { isSingleCell, rangeLabel } from "../core/range";
import { summarize } from "../core/summary";
import { type Editing, leaveDraftField, offered, setDraft, useEditing } from "../state/editing";
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

// the panel offers functions twice, for two different reasons, and a press does
// the same thing both times: lit is whichever name is already standing, and the
// caller says what taking one writes.
function FunctionList({
  entries,
  lit,
  onPick,
}: {
  entries: readonly SheetFunction[];
  lit: string | null;
  onPick: (name: string) => void;
}) {
  return (
    <ul className="lens-list">
      {entries.map((entry) => (
        <li
          key={entry.name}
          className={entry.name === lit ? "lens-option is-on" : "lens-option"}
          // the press must not reach the input: a blur there commits the cell
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(entry.name);
          }}
        >
          <span className="lens-option-name">{entry.name}</span>
          <span className="lens-option-summary">{entry.summary}</span>
        </li>
      ))}
    </ul>
  );
}

// a formula takes every click on the grid as a reference, so there is no cell a
// mouse can click to finish one. this is that click, and it sits on the line
// that holds the answer because accepting the answer is what it does.
//
// it saves by leaving the field, which is what saving a draft already is here
// and when the pointer lands anywhere else, rather than being a second way to
// save that could fall out of step with the first.
function Done() {
  return (
    <button
      type="button"
      className="lens-done"
      title="save"
      aria-label="save"
      // the press must not move focus: the field has to still be in it to leave it
      onMouseDown={(event) => {
        event.preventDefault();
        leaveDraftField();
      }}
    >
      ↵
    </button>
  );
}

// a formula is unfinished for most of the time it is being typed, so an
// unreadable draft says nothing rather than reporting a problem on every key
function Result({ value }: { value: CellValue }) {
  if (isError(value)) {
    if (value.code === "bad-formula") return null;

    return (
      <div className="lens-result">
        <div className="lens-result-body">
          <div className="lens-label is-problem">{errorDisplay(value)}</div>
          <div className="lens-message">{explainError(value)}</div>
        </div>
        <Done />
      </div>
    );
  }

  return (
    <div className="lens-result">
      <span className="lens-answer">= {displayValue(value)}</span>
      <Done />
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

  // what committing would store, not what has been typed so far: "=SUM(A1:A5"
  // is a finished formula the moment it is saved, and a draft built by clicking
  // never has the closing bracket typed at all. previewing the raw text instead
  // reports a parse error for the whole time the mouse is doing the work.
  const answer = useMemo(
    () =>
      text.length > 1 && suggestion?.kind !== "functions"
        ? sheet.preview(asWritten(text))
        : null,
    [text, suggestion?.kind, revision],
  );

  // a formula that arrived rather than was typed: the range came from the hand
  // and the function was guessed, so the other readings of the same range are
  // one press away. lit is the one standing, not the one enter would take: the
  // keyboard is in the text, and this list answers to the mouse.
  const swapping = editing.origin === "guessed" && !editing.dismissed ? calledFunction(text) : null;

  return (
    <>
      {swapping && (
        <FunctionList
          entries={FUNCTIONS}
          lit={swapping}
          onPick={(name) => setDraft(swapFunction(text, name), "guessed")}
        />
      )}

      {suggestion?.kind === "functions" && (
        <FunctionList
          entries={suggestion.matches}
          // lit means enter takes it, so a list that has not been asked for
          // lights nothing: the mark and the key have to agree
          lit={taking ? (suggestion.matches[highlight]?.name ?? null) : null}
          onPick={(name) => setDraft(acceptSuggestion(text, name))}
        />
      )}

      {described && <div className="lens-argument">{described}</div>}

      {/* mid word there is no answer yet, and the list is the thing being read */}
      {answer !== null && <Result value={answer} />}

      {/* a value is written, so the next thing is an operator: one press each.
          not while a guessed formula is standing: the open question there is
          which reading of the range this is, and two menus at once make that
          question be found before it can be answered. */}
      {!swapping && canTakeOperator(text) && (
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
    </>
  );
}
