import { columnIndex, parseAddress } from "../address";
import { ROWS } from "../geometry";
import { type Range, rangeAt, rangeBetween } from "../range";

// "B2" and "B7" -> B2:B7, "A" and "C" -> the whole of A to C. null when the two
// sides are not the same kind of thing, or name a cell off the sheet.
export function referenceRange(startText: string, endText: string): Range | null {
  const start = parseAddress(startText);
  const end = parseAddress(endText);
  if (start && end) return rangeBetween(start, end);

  const startCol = columnIndex(startText);
  const endCol = columnIndex(endText);
  if (startCol === null || endCol === null) return null;

  return rangeBetween({ row: 0, col: startCol }, { row: ROWS - 1, col: endCol });
}

// anything shaped like a reference, whole or half typed, and function names too:
// what it turns out to be is the caller's question
export const CHUNK = /[A-Za-z]+\d*(?::[A-Za-z]+\d*)?/g;

// every reference in a half-typed formula. the parser cannot help here: "=SUM(B2:B7"
// is not a formula yet, and the cells still have to light up while it is being typed.
export function draftReferences(text: string): Range[] {
  const found: Range[] = [];

  for (const [chunk] of text.matchAll(CHUNK)) {
    const [startText, endText] = chunk.split(":");
    const range =
      endText === undefined ? cellRange(startText!) : referenceRange(startText!, endText);

    if (range) found.push(range);
  }

  return found;
}

// a value has just been written, so an operator is the next legal thing: a
// reference, a number, or a closing bracket at the end of the draft
const COMPLETE_VALUE = /([A-Za-z]\d+|\d|\))\s*$/;

export function canTakeOperator(text: string): boolean {
  return text.startsWith("=") && COMPLETE_VALUE.test(text);
}

// "=SUM(B2:B7" commits as "=SUM(B2:B7)". the closing bracket carries no meaning
// of its own here, so asking for it is a rule with nothing behind it.
export function balanceBrackets(text: string): string {
  if (!text.startsWith("=")) return text;

  let depth = 0;
  for (const char of text) {
    if (char === "(") depth++;
    else if (char === ")") depth = Math.max(0, depth - 1);
  }

  return text + ")".repeat(depth);
}

function cellRange(text: string): Range | null {
  const address = parseAddress(text);
  return address ? rangeAt(address) : null;
}
