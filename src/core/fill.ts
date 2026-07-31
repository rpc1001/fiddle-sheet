import { type Address, type CellKey, cellKey } from "./address";
import { offsetFormula } from "./formula/rewrite";
import { isFormula } from "./formula/scan";
import { isNumericText } from "./literal";
import type { Range } from "./range";
import type { Read } from "./sheet/store";

// one way of reading what the source cells were getting at, and the cells it
// would write. the first is the one the fill applies; the rest are what the
// user gets offered afterwards, and only when there is more than one.
export type ReadingName = "count" | "copy";

export type Reading = { name: ReadingName; writes: [CellKey, string][] };

export type Direction = "down" | "up" | "right" | "left";

// how far a fill from this source reaches if it is let go over cell. the drag
// commits to one axis, the one the pointer has travelled further along, so a
// hand that wanders sideways on the way down still fills a column.
export function fillExtent(source: Range, cell: Address): Range {
  const down = Math.max(0, cell.row - source.bottom);
  const up = Math.max(0, source.top - cell.row);
  const right = Math.max(0, cell.col - source.right);
  const left = Math.max(0, source.left - cell.col);

  const vertical = Math.max(down, up);
  const horizontal = Math.max(right, left);
  if (vertical === 0 && horizontal === 0) return source;

  if (vertical >= horizontal) {
    return down >= up
      ? { ...source, bottom: source.bottom + down }
      : { ...source, top: source.top - up };
  }

  return right >= left
    ? { ...source, right: source.right + right }
    : { ...source, left: source.left - left };
}

export function fillDirection(source: Range, extent: Range): Direction | null {
  if (extent.bottom > source.bottom) return "down";
  if (extent.top < source.top) return "up";
  if (extent.right > source.right) return "right";
  if (extent.left < source.left) return "left";
  return null;
}

// the cells the fill would write, in the order they run away from the source
function laneAddresses(source: Range, extent: Range, direction: Direction): Address[][] {
  const lanes: Address[][] = [];

  if (direction === "down" || direction === "up") {
    const rows = upTo(source.top, source.bottom);
    const grown =
      direction === "down"
        ? upTo(source.bottom + 1, extent.bottom)
        : upTo(extent.top, source.top - 1).reverse();

    const ordered = direction === "down" ? rows : [...rows].reverse();
    for (let col = source.left; col <= source.right; col++) {
      lanes.push([...ordered, ...grown].map((row) => ({ row, col })));
    }
    return lanes;
  }

  const cols = upTo(source.left, source.right);
  const grown =
    direction === "right"
      ? upTo(source.right + 1, extent.right)
      : upTo(extent.left, source.left - 1).reverse();

  const ordered = direction === "right" ? cols : [...cols].reverse();
  for (let row = source.top; row <= source.bottom; row++) {
    lanes.push([...ordered, ...grown].map((col) => ({ row, col })));
  }
  return lanes;
}

function upTo(from: number, to: number): number[] {
  const out: number[] = [];
  for (let at = from; at <= to; at++) out.push(at);
  return out;
}

// every honest reading of this drag, best first. an empty list means the drag
// covers nothing new and there is nothing to write.
export function fillReadings(read: Read, source: Range, extent: Range): Reading[] {
  const direction = fillDirection(source, extent);
  if (!direction) return [];

  const depth = source.bottom - source.top + 1;
  const across = source.right - source.left + 1;
  const sourceLength = direction === "down" || direction === "up" ? depth : across;

  // a single cell states no run of its own, so the drag says which way it runs
  const soloStep = direction === "up" || direction === "left" ? -1 : 1;

  const lanes = laneAddresses(source, extent, direction).map((cells) => {
    const sources = cells.slice(0, sourceLength);
    const texts = sources.map((cell) => read(cellKey(cell.row, cell.col)));
    return { sources, texts, targets: cells.slice(sourceLength), step: stepOf(texts, soloStep) };
  });

  const names = lanes
    .map(laneNames)
    .reduce((shared, some) => shared.filter((name) => some.includes(name)));

  return names.map((name) => ({
    name,
    writes: lanes.flatMap((lane) =>
      name === "copy"
        ? copyWrites(read, lane.sources, lane.targets)
        : countWrites(lane.step!, lane.targets),
    ),
  }));
}

type Lane = { texts: string[]; step: Step | null };

// what this lane could honestly mean, best reading first. copy is the only one
// that is always available, so a mixed selection always has something to write.
function laneNames({ texts, step }: Lane): ReadingName[] {
  if (!step) return ["copy"];

  // one cell states a value and nothing about a run, so both readings are open.
  // more than one cell has already stated the run, and copying it back would
  // ignore what the user spelled out.
  return texts.length === 1 ? ["count", "copy"] : ["count"];
}

type Step = { prefix: string; last: number; by: number };

// the run the source spells out, or null when it does not spell out one:
// "2, 4, 6" steps by two, "hello" steps by nothing, "1, 2, 5" changes its mind
function stepOf(texts: string[], soloStep: number): Step | null {
  const parts = texts.map(numberPart);
  if (parts.some((part) => part === null)) return null;

  const found = parts as { prefix: string; value: number }[];
  if (found.some((part) => part.prefix !== found[0]!.prefix)) return null;

  const last = found[found.length - 1]!;
  if (found.length === 1) return { prefix: last.prefix, last: last.value, by: soloStep };

  const by = found[1]!.value - found[0]!.value;
  for (let at = 1; at < found.length; at++) {
    if (found[at]!.value - found[at - 1]!.value !== by) return null;
  }

  return { prefix: last.prefix, last: last.value, by };
}

// "12" is a number, and "item 12" is a name with a number on the end, which
// counts the same way. a formula is neither: it is copied, never counted.
function numberPart(text: string): { prefix: string; value: number } | null {
  if (isFormula(text)) return null;

  if (isNumericText(text)) return { prefix: "", value: Number(text) };

  const match = /^(.*?)(-?\d+)$/.exec(text);
  return match ? { prefix: match[1]!, value: Number(match[2]) } : null;
}

function countWrites(step: Step, targets: Address[]): [CellKey, string][] {
  return targets.map((cell, at) => {
    const value = step.last + step.by * (at + 1);
    return [cellKey(cell.row, cell.col), step.prefix + numberText(value)];
  });
}

// a step of 0.1 taken ten times is 0.9999999999999999 in binary floating point,
// and the cell would show the arithmetic rather than the series
function numberText(value: number): string {
  return String(Number(value.toFixed(10)));
}

// the source repeated over the targets, each copy's formula moved as far as the
// copy itself moved, so a filled formula says the same thing about its own row
function copyWrites(read: Read, sources: Address[], targets: Address[]): [CellKey, string][] {
  return targets.map((cell, at) => {
    const from = sources[at % sources.length]!;
    const text = read(cellKey(from.row, from.col));
    const moved = offsetFormula(text, cell.row - from.row, cell.col - from.col);
    return [cellKey(cell.row, cell.col), moved];
  });
}
