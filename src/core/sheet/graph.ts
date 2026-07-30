import type { CellKey } from "../address";

export type Plan = {
  // safe recomputation order: every cell comes after everything it reads
  ordered: CellKey[];
  // cells whose value depends on itself, directly or through a chain
  circular: CellKey[];
};

export type Graph = {
  setPrecedents(key: CellKey, precedents: readonly CellKey[]): void;
  plan(from: CellKey): Plan;
};

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

  function setPrecedents(key: CellKey, next: readonly CellKey[]): void {
    for (const previous of precedents.get(key) ?? []) {
      dependents.get(previous)?.delete(key);
    }

    precedents.set(key, new Set(next));
    for (const precedent of next) addDependent(precedent, key);
  }

  function affected(from: CellKey): Set<CellKey> {
    const seen = new Set<CellKey>([from]);
    const pending = [from];

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
  function plan(from: CellKey): Plan {
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

  return { setPrecedents, plan };
}
