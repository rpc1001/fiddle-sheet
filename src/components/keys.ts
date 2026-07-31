import type { ClipboardEvent, KeyboardEvent, MouseEvent } from "react";
import { type Address, cellKey } from "../core/address";
import { clipText, copyClip, parseClip, pasteWrites, pastedRange } from "../core/clipboard";
import { fillWrites } from "../core/entry";
import { COLS, clampAddress } from "../core/geometry";
import { jumpTarget } from "../core/jump";
import { cellsIn } from "../core/range";
import {
  collapsed,
  columnSpan,
  moved,
  reachedTo,
  rowSpan,
  selectionRange,
} from "../core/selection";
import { clipFor, dropClip, getClip, holdClip } from "../state/clipboard";
import { getEditing, startEditing } from "../state/editing";
import { clearOffer, getOffer } from "../state/filling";
import { getSelection, setSelection } from "../state/selection";
import { redo, sheet, undo } from "../state/sheet";
import type { Surface } from "./surface";

const STEPS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

function isTyping(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
}

function isChord(event: KeyboardEvent, key: string): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key;
}

export type Keys = {
  onKeyDown(event: KeyboardEvent<HTMLDivElement>): void;
  onCopy(event: ClipboardEvent<HTMLDivElement>): void;
  onCut(event: ClipboardEvent<HTMLDivElement>): void;
  onPaste(event: ClipboardEvent<HTMLDivElement>): void;
  onDoubleClick(event: MouseEvent<HTMLDivElement>): void;
};

export function useKeys(surface: Surface): Keys {
  const { cellUnder, revealFocus } = surface;

  function openEditor(cell: Address): void {
    startEditing(cell, sheet.getRaw(cellKey(cell.row, cell.col)));
  }

  function reach(focus: Address, extend: boolean): void {
    setSelection(reachedTo(getSelection(), focus, extend));
    revealFocus();
  }

  // the browser's own copy, cut and paste rather than a chord: they fire from
  // the real shortcut on every platform, they carry the system clipboard with
  // them, and they are what lets a range cross into another spreadsheet.
  function copy(event: ClipboardEvent<HTMLDivElement>, cut: boolean): void {
    if (getEditing()) return;
    event.preventDefault();

    const clip = copyClip(sheet.getRaw, selectionRange(getSelection()), cut);
    event.clipboardData.setData("text/plain", clipText(clip));
    holdClip(clip);
  }

  // a cut writes nothing until it lands: until then there is a way back, and
  // the cells are still worth reading
  function onPaste(event: ClipboardEvent<HTMLDivElement>): void {
    if (getEditing()) return;
    event.preventDefault();

    const text = event.clipboardData.getData("text/plain");
    if (text === "") return;

    const clip = clipFor(text);
    const rows = clip ? clip.rows : parseClip(text);
    const into = selectionRange(getSelection());
    const at = { row: into.top, col: into.left };

    sheet.edit(pasteWrites(clip, rows, at), getSelection(), "paste");

    const landed = pastedRange(at, rows.length, rows[0]?.length ?? 0);
    setSelection({
      anchor: { row: landed.top, col: landed.left },
      focus: { row: landed.bottom, col: landed.right },
    });

    // the cells a cut came from are gone, so it has nothing left to say
    if (clip?.cut) dropClip();
  }

  function onDoubleClick(event: MouseEvent<HTMLDivElement>): void {
    if (getEditing()) return;
    openEditor(cellUnder(event));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (getEditing()) return;
    const selection = getSelection();
    const focus = selection.focus;
    const step = STEPS[event.key];
    const jump = event.metaKey || event.ctrlKey;
    const fillAxis = isChord(event, "d") ? "down" : isChord(event, "r") ? "right" : null;

    if (step) {
      // held, the arrow covers the run rather than a cell of it. it is the one
      // way to cross a hundred rows without a hundred presses, and the run is
      // the unit that means something: a block of data, then the gap after it.
      reach(
        jump
          ? jumpTarget(sheet.getRaw, focus, step[0], step[1])
          : clampAddress(focus.row + step[0], focus.col + step[1]),
        event.shiftKey,
      );
    } else if (isChord(event, "a")) {
      setSelection(columnSpan(0, COLS - 1));
    } else if (fillAxis) {
      // the fill handle's drag, keyed. the selection is both the source and how
      // far it reaches, which is the one thing a key press can say that a drag
      // has to be told: it is already on screen.
      sheet.edit(fillWrites(sheet.getRaw, selectionRange(selection), fillAxis), selection, "fill");
    } else if (event.key === " " && (event.ctrlKey || event.shiftKey)) {
      // the bands the selection already spans, named by the axis rather than
      // dragged along the header
      const range = selectionRange(selection);
      setSelection(
        event.ctrlKey ? columnSpan(range.left, range.right) : rowSpan(range.top, range.bottom),
      );
    } else if (event.key === "Tab") {
      setSelection(moved(selection, 0, event.shiftKey ? -1 : 1, false));
      revealFocus();
    } else if (event.key === "Enter") {
      openEditor(selection.focus);
    } else if (event.key === "Backspace" || event.key === "Delete") {
      const cleared = [...cellsIn(selectionRange(selection))];
      sheet.edit(
        cleared.map((cell) => [cellKey(cell.row, cell.col), ""]),
        selection,
        "clear",
      );
    } else if (event.key === "Escape") {
      // one press puts down one thing, the most recent first. the fill is
      // already written, so dismissing its readings takes nothing back: that is
      // undo, the same as for every other edit.
      if (getOffer()) clearOffer();
      else if (getClip()) dropClip();
      else setSelection(collapsed(selection));
    } else if (isChord(event, "z")) {
      // shift+z is the mac habit for redo, ctrl+y the windows one
      if (event.shiftKey) redo();
      else undo();
      revealFocus();
    } else if (isChord(event, "y")) {
      redo();
      revealFocus();
    } else if (isTyping(event)) {
      // typing over a cell replaces it, so the first character is the draft
      startEditing(selection.focus, event.key);
    } else {
      return;
    }

    event.preventDefault();
  }

  return {
    onKeyDown,
    onCopy: (event) => copy(event, false),
    onCut: (event) => copy(event, true),
    onPaste,
    onDoubleClick,
  };
}
