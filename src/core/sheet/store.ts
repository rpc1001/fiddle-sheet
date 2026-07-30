import { type CellKey, cellKey } from "../address";
import { type CellValue, errorDisplay, isError } from "../formula/errors";
import { evaluate } from "../formula/evaluate";
import { type Node, ParseError, parse } from "../formula/parse";
import { references } from "../formula/references";
import { createGraph } from "./graph";

export type Listener = () => void;

type Cell = {
  raw: string;
  formula: Node | null;
  value: CellValue;
};

export type Sheet = {
  getRaw(key: CellKey): string;
  getValue(key: CellKey): CellValue;
  getDisplay(key: CellKey): string;
  setRaw(key: CellKey, raw: string): void;
  subscribe(key: CellKey, listener: Listener): () => void;
};

function literalValue(raw: string): CellValue {
  if (raw.trim() === "") return "";
  const value = Number(raw);
  return Number.isNaN(value) ? raw : value;
}

// keeps 0.1+0.2 from showing as 0.30000000000000004
function formatNumber(value: number): string {
  return String(Math.round(value * 1e10) / 1e10);
}

export function createSheet(initial: Iterable<[CellKey, string]> = []): Sheet {
  const cells = new Map<CellKey, Cell>();
  const listeners = new Map<CellKey, Set<Listener>>();
  const graph = createGraph();

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

  function setRaw(key: CellKey, raw: string): void {
    if (getRaw(key) === raw) return;

    const cell = raw === "" ? null : compile(raw);
    if (cell) cells.set(key, cell);
    else cells.delete(key);

    graph.setPrecedents(key, cell?.formula ? references(cell.formula) : []);

    const { ordered, circular } = graph.plan(key);

    for (const affected of ordered) {
      recompute(affected);
      notify(affected);
    }

    for (const affected of circular) {
      const stuck = cells.get(affected);
      if (stuck) stuck.value = { code: "circular", blame: null, detail: stuck.raw };
      notify(affected);
    }
  }

  function getRaw(key: CellKey): string {
    return cells.get(key)?.raw ?? "";
  }

  for (const [key, raw] of initial) setRaw(key, raw);

  return {
    getRaw,
    getValue,

    getDisplay(key) {
      const value = getValue(key);
      if (isError(value)) return errorDisplay(value);
      return typeof value === "number" ? formatNumber(value) : value;
    },

    setRaw,

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
