import { type Address, type CellKey, addressLabel, addressOf, cellKey, parseAddress } from "./address";
import type { Range } from "./range";
import type { Read } from "./sheet/store";

// fixtures for the core tests. they go through address.ts rather than doing the
// row and column arithmetic again, so the sheet's width is stated in one place
// here as well as in the code under test.

export function at(label: string): CellKey {
  const address = parseAddress(label);
  if (!address) throw new Error(`bad test address: ${label}`);
  return cellKey(address.row, address.col);
}

export function addressAt(label: string): Address {
  return addressOf(at(label));
}

// a sheet of raw text in the shape Read takes: { A1: "1", B2: "=A1*2" }
export function sheetOf(cells: Record<string, string>): Read {
  const byKey = new Map<CellKey, string>();
  for (const [label, text] of Object.entries(cells)) byKey.set(at(label), text);
  return (key) => byKey.get(key) ?? "";
}

// writes read back the way the sheet shows them: { A3: "3" }
export function written(writes: [CellKey, string][]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, text] of writes) out[addressLabel(addressOf(key))] = text;
  return out;
}

// "A1", or "A1:B2" from its top left to its bottom right
export function rangeOf(text: string): Range {
  const [from, to] = text.split(":");
  const one = addressAt(from!);
  const two = addressAt(to ?? from!);
  return { top: one.row, left: one.col, bottom: two.row, right: two.col };
}
