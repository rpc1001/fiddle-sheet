import { type PointerEvent, useState } from "react";
import type { Entry } from "../core/sheet/history";
import { placeOf } from "../core/sheet/place";
import { redo, sheet, undo, useSheetRevision } from "../state/sheet";
import "./TitleBar.css";

// the grid keeps the keyboard: without this the button would take focus and the
// same shortcut would stop working straight after you clicked it
function keepFocus(event: { preventDefault(): void }): void {
  event.preventDefault();
}

const NAME = "fiddle";

function lift(word: HTMLElement, by: (index: number) => number): void {
  for (const [index, letter] of [...word.children].entries()) {
    (letter as HTMLElement).style.setProperty("--lift", by(index).toFixed(3));
  }
}

// each letter rises by how near the pointer is and drops again behind it. the
// name is set in the monospaced face, so a letter's middle is its index times
// one advance and a single box read places all six.
function stir(event: PointerEvent<HTMLSpanElement>): void {
  const box = event.currentTarget.getBoundingClientRect();
  const step = box.width / NAME.length;

  lift(event.currentTarget, (index) => {
    const away = (event.clientX - box.left - (index + 0.5) * step) / step;
    return Math.exp((-away * away) / 2);
  });
}

// written straight to the letters rather than held as state: a pointer move is
// not something the bar needs to remember, and rendering one would put the whole
// header through react on every frame of it
function Fiddle() {
  return (
    <span
      className="title-lead"
      onPointerMove={stir}
      onPointerLeave={(event) => lift(event.currentTarget, () => 0)}
    >
      {[...NAME].map((letter, index) => (
        <span key={index} className="title-letter">
          {letter}
        </span>
      ))}
    </span>
  );
}

type Way = "undo" | "redo";

// an arc doubling back on itself, drawn rather than typed: neither glyph for
// this is in the two fonts, so as text they arrive in whatever the system has.
// redo is the same drawing mirrored, which is all the two differ by.
function Arrow({ way }: { way: Way }) {
  return (
    <svg className="step-arrow" viewBox="0 0 16 16" aria-hidden="true">
      <g transform={way === "redo" ? "scale(-1 1) translate(-16 0)" : undefined}>
        <path d="M2.5 6h7a3.5 3.5 0 0 1 0 7H6" />
        <path d="M5 3.75 2.5 6 5 8.25" />
      </g>
    </svg>
  );
}

function Step({
  way,
  entry,
  onRun,
  onShow,
}: {
  way: Way;
  entry: Entry | null;
  onRun: () => void;
  onShow: (way: Way | null) => void;
}) {
  return (
    <button
      type="button"
      className="step"
      aria-label={entry ? `${way} ${entry.action} ${placeOf(entry)}` : way}
      disabled={entry === null}
      onMouseDown={keepFocus}
      onClick={onRun}
      onPointerEnter={() => onShow(way)}
      onPointerLeave={() => onShow(null)}
      onFocus={() => onShow(way)}
      onBlur={() => onShow(null)}
    >
      <Arrow way={way} />
      {way}
    </button>
  );
}

export function TitleBar() {
  useSheetRevision();
  const [asked, setAsked] = useState<Way | null>(null);

  const steps = { undo: sheet.peekUndo(), redo: sheet.peekRedo() };
  // only for the side being pointed at, and only while that side has something
  // to take back: naming a step that is not there is worse than naming nothing
  const shown = asked && steps[asked];
  const place = shown && placeOf(shown);

  return (
    <header className="title-bar">
      <h1 className="title-name">
        <Fiddle />
        <span className="title-join">-</span>sheet
      </h1>

      <div className="title-actions">
        <span className="step-label" aria-hidden="true">
          {shown && (
            // keyed so the readout re-runs its entrance when the step changes
            // under a pointer that never left
            <span key={`${asked}-${shown.action}-${place}`} className="step-said">
              {asked} {shown.action} <span className="step-place">{place}</span>
            </span>
          )}
        </span>

        <div className="step-pair">
          <Step way="undo" entry={steps.undo} onRun={undo} onShow={setAsked} />
          <Step way="redo" entry={steps.redo} onRun={redo} onShow={setAsked} />
        </div>
      </div>
    </header>
  );
}
