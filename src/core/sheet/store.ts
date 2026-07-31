import { type CellKey, cellKey } from "../address";
import { displayValue } from "../format";
import type { CellValue } from "../formula/errors";
import { evaluate } from "../formula/evaluate";
import { type Node, ParseError, parse } from "../formula/parse";
import { references } from "../formula/references";
import type { Selection } from "../selection";
import { type Trace, createGraph } from "./graph";
import { type Change, createHistory } from "./history";

export type Listener = () => void;

// raw cell text, straight off the store. anything that rewrites a block of the
// sheet takes one of these rather than the whole sheet: it reads, it does not
// write, and that is visible in the signature.
export type Read = (key: CellKey) => string;

export type Recalc = {
  // the cells the edit recomputed, in the order the engine did the work
  order: CellKey[];
  // cells a formula started reading in this edit, which recompute nothing and
  // would otherwise be the one part of a change with no sign of it
  connected: CellKey[];
};

export type RecalcListener = (recalc: Recalc) => void;

type Cell = {
  raw: string;
  formula: Node | null;
  value: CellValue;
};

export type Sheet = {
  getRaw(key: CellKey): string;
  getValue(key: CellKey): CellValue;
  getDisplay(key: CellKey): string;
  // the parsed formula behind a cell, for anything that wants to describe it
  // rather than run it. null when the cell holds a literal or nothing.
  getFormula(key: CellKey): Node | null;
  // what a draft would be worth if it were committed now. nothing is written,
  // so an uncommitted formula can be answered before it lands.
  preview(raw: string): CellValue;
  // the only way in: one call is one undoable action, whatever it touches.
  // the selection travels with it so undo can return you to it.
  edit(writes: Iterable<[CellKey, string]>, selection: Selection): void;
  // the last action, done a different way. it is rolled back and replaced, so
  // reading a fill one way and then the other leaves one action in history
  // rather than a correction stacked on a guess. only the caller that made the
  // action may call this, and only while it is still the last one.
  revise(writes: Iterable<[CellKey, string]>, selection: Selection): void;
  // both return the selection to restore, or null when there was nothing to do
  undo(): Selection | null;
  redo(): Selection | null;
  canUndo(): boolean;
  canRedo(): boolean;
  subscribe(key: CellKey, listener: Listener): () => void;
  // fired once per edit, undo or redo, for anything watching the sheet as a whole
  onEdit(listener: Listener): () => void;
  // same moment, but carrying the recomputation order, so a change can be
  // followed down the sheet as it actually travelled
  onRecalc(listener: RecalcListener): () => void;
  revision(): number;
  // what a cell reads and what reads it, out to three hops in each direction
  trace(key: CellKey): Trace;
};

function literalValue(raw: string): CellValue {
  if (raw.trim() === "") return "";
  const value = Number(raw);
  return Number.isNaN(value) ? raw : value;
}

export function createSheet(initial: Iterable<[CellKey, string]> = []): Sheet {
  const cells = new Map<CellKey, Cell>();
  const listeners = new Map<CellKey, Set<Listener>>();
  const editListeners = new Set<Listener>();
  const recalcListeners = new Set<RecalcListener>();
  const graph = createGraph();
  const history = createHistory();
  let revision = 0;

  function getValue(key: CellKey): CellValue {
    return cells.get(key)?.value ?? "";
  }

  const readCell = (row: number, col: number): CellValue => getValue(cellKey(row, col));

  function compile(raw: string): Cell {
    if (!raw.startsWith("=")) return { raw, formula: null, value: literalValue(raw) };

    try {
      return { raw, formula: parse(raw.slice(1)), value: 0 };
    } catch (thrown) {
      if (!(thrown instanceof ParseError)) throw thrown;
      return { raw, formula: null, value: { code: "bad-formula", blame: null, detail: raw } };
    }
  }

  function notify(key: CellKey): void {
    listeners.get(key)?.forEach((listener) => listener());
  }

  function recompute(key: CellKey): void {
    const cell = cells.get(key);
    if (!cell?.formula) return;
    cell.value = evaluate(cell.formula, readCell);
  }

  // stores the text and rewires the graph. nothing is recomputed here: an edit
  // can touch many cells and they share one downstream run.
  function write(key: CellKey, raw: string): CellKey[] | null {
    if (getRaw(key) === raw) return null;

    const cell = raw === "" ? null : compile(raw);
    if (cell) cells.set(key, cell);
    else cells.delete(key);

    return graph.setPrecedents(key, cell?.formula ? references(cell.formula) : []);
  }

  function propagate(roots: Iterable<CellKey>): CellKey[] {
    const { ordered, circular } = graph.plan(roots);

    for (const affected of ordered) {
      recompute(affected);
      notify(affected);
    }

    for (const affected of circular) {
      const stuck = cells.get(affected);
      if (stuck) stuck.value = { code: "circular", blame: null, detail: stuck.raw };
      notify(affected);
    }

    return [...ordered, ...circular];
  }

  function getRaw(key: CellKey): string {
    return cells.get(key)?.raw ?? "";
  }

  function apply(changes: Change[], field: "before" | "after"): void {
    const roots: CellKey[] = [];
    const connected: CellKey[] = [];

    for (const change of changes) {
      const added = write(change.key, change[field]);
      if (!added) continue;
      roots.push(change.key);
      connected.push(...added);
    }

    const order = propagate(roots);

    revision++;
    editListeners.forEach((listener) => listener());

    const recalc: Recalc = { order, connected: [...new Set(connected)] };
    recalcListeners.forEach((listener) => listener(recalc));
  }

  function edit(writes: Iterable<[CellKey, string]>, selection: Selection): void {
    const changes: Change[] = [];
    for (const [key, after] of writes) {
      const before = getRaw(key);
      if (before !== after) changes.push({ key, before, after });
    }
    if (changes.length === 0) return;

    apply(changes, "after");
    history.record({ changes, selection });
  }

  for (const [key, raw] of initial) write(key, raw);
  propagate(cells.keys());

  return {
    getRaw,
    getValue,

    getFormula: (key) => cells.get(key)?.formula ?? null,

    preview(raw) {
      const cell = compile(raw);
      return cell.formula ? evaluate(cell.formula, readCell) : cell.value;
    },

    edit,

    // undo lifts the entry onto the redo branch and the rollback puts the cells
    // back with it, which leaves the sheet exactly as it was before the action.
    // the new writes are then an ordinary edit: their before values are the
    // original ones, and recording abandons the branch the undo just made.
    revise(writes, selection) {
      const entry = history.undo();
      if (!entry) return;

      apply(entry.changes, "before");
      edit(writes, selection);
    },

    undo() {
      const entry = history.undo();
      if (!entry) return null;
      apply(entry.changes, "before");
      return entry.selection;
    },

    redo() {
      const entry = history.redo();
      if (!entry) return null;
      apply(entry.changes, "after");
      return entry.selection;
    },

    canUndo: history.canUndo,
    canRedo: history.canRedo,
    revision: () => revision,

    onEdit(listener) {
      editListeners.add(listener);
      return () => {
        editListeners.delete(listener);
      };
    },

    onRecalc(listener) {
      recalcListeners.add(listener);
      return () => {
        recalcListeners.delete(listener);
      };
    },

    trace: graph.trace,

    getDisplay: (key) => displayValue(getValue(key)),

    subscribe(key, listener) {
      let forKey = listeners.get(key);
      if (!forKey) {
        forKey = new Set();
        listeners.set(key, forKey);
      }
      forKey.add(listener);

      return () => {
        forKey.delete(listener);
        if (forKey.size === 0) listeners.delete(key);
      };
    },
  };
}
