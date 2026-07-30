import type { CellKey } from "../address";

export type Plan = {
  // safe recomputation order: every cell comes after everything it reads
  ordered: CellKey[];
  // cells whose value depends on itself, directly or through a chain
  circular: CellKey[];
};

// how far a cell sits from the one being looked at, in either direction. one
// hop is a cell the formula names itself, two is a cell that one reads, and so on
export type Trace = {
  inputs: Map<CellKey, number>;
  outputs: Map<CellKey, number>;
};

export type Graph = {
  // returns the precedents this cell did not have before, so a new connection
  // can be shown being made rather than only its result
  setPrecedents(key: CellKey, precedents: readonly CellKey[]): CellKey[];
  // one edit can change several cells, and a cell reading two of them must be
  // recomputed once, after both. so the plan is seeded with all of them at once.
  plan(from: Iterable<CellKey>): Plan;
  trace(from: CellKey): Trace;
};

// past three hops the tint is too faint to read and the sheet is just busy
const TRACE_DEPTH = 3;

export function createGraph(): Graph {
  // precedents: cells this formula reads. dependents: formulas that read this cell.
  const precedents = new Map<CellKey, Set<CellKey>>();
  const dependents = new Map<CellKey, Set<CellKey>>();

  function addDependent(on: CellKey, key: CellKey): void {
    let set = dependents.get(on);
    if (!set) {
      set = new Set();
      dependents.set(on, set);
    }
    set.add(key);
  }

  function setPrecedents(key: CellKey, next: readonly CellKey[]): CellKey[] {
    const before = precedents.get(key) ?? new Set<CellKey>();

    for (const previous of before) {
      const readers = dependents.get(previous);
      if (!readers) continue;
      readers.delete(key);
      // a wide range leaves one set per cell behind, and they never come back
      if (readers.size === 0) dependents.delete(previous);
    }

    if (next.length === 0) precedents.delete(key);
    else precedents.set(key, new Set(next));

    for (const precedent of next) addDependent(precedent, key);

    return [...new Set(next)].filter((precedent) => !before.has(precedent));
  }

  function affected(from: Iterable<CellKey>): Set<CellKey> {
    const seen = new Set<CellKey>(from);
    const pending = [...seen];

    while (pending.length > 0) {
      const key = pending.pop()!;
      for (const dependent of dependents.get(key) ?? []) {
        if (seen.has(dependent)) continue;
        seen.add(dependent);
        pending.push(dependent);
      }
    }

    return seen;
  }

  // kahn's algorithm over the affected cells only. anything still holding an
  // unmet dependency when the queue empties is part of a cycle.
  function plan(from: Iterable<CellKey>): Plan {
    const set = affected(from);
    const waitingOn = new Map<CellKey, number>();
    const ordered: CellKey[] = [];

    for (const key of set) {
      let count = 0;
      for (const precedent of precedents.get(key) ?? []) {
        if (set.has(precedent)) count++;
      }
      waitingOn.set(key, count);
      if (count === 0) ordered.push(key);
    }

    // ordered doubles as the queue: everything appended to it is ready to run
    for (let head = 0; head < ordered.length; head++) {
      for (const dependent of dependents.get(ordered[head]!) ?? []) {
        if (!set.has(dependent)) continue;
        const left = waitingOn.get(dependent)! - 1;
        waitingOn.set(dependent, left);
        if (left === 0) ordered.push(dependent);
      }
    }

    // a cell still waiting on something is waiting on itself, through a chain
    const circular = [...set].filter((key) => waitingOn.get(key) !== 0);
    return { ordered, circular };
  }

  // breadth first, so a cell reachable by two paths keeps the shorter one
  function reach(edges: Map<CellKey, Set<CellKey>>, from: CellKey): Map<CellKey, number> {
    const depths = new Map<CellKey, number>();
    let frontier = [from];

    for (let depth = 1; depth <= TRACE_DEPTH && frontier.length > 0; depth++) {
      const next: CellKey[] = [];

      for (const key of frontier) {
        for (const edge of edges.get(key) ?? []) {
          if (edge === from || depths.has(edge)) continue;
          depths.set(edge, depth);
          next.push(edge);
        }
      }

      frontier = next;
    }

    return depths;
  }

  function trace(from: CellKey): Trace {
    return { inputs: reach(precedents, from), outputs: reach(dependents, from) };
  }

  return { setPrecedents, plan, trace };
}
