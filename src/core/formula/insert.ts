import { type Address, addressLabel } from "../address";
import { rangeBetween, rangeLabel } from "../range";

export type Span = { start: number; end: number };

// clicking a cell only writes into a formula where a reference could legally
// follow: right after the equals sign, an operator, an open paren or a comma.
// anywhere else the click means "I am done here, take me to that cell".
const OPEN = /[=+\-*/(,:]\s*$/;

export function acceptsReference(text: string): boolean {
  return text.startsWith("=") && OPEN.test(text);
}

// references are only ever written at the end of the draft, so a second click
// replaces the one the last click wrote rather than piling them up
export function insertReference(
  text: string,
  previous: Span | null,
  anchor: Address,
  focus: Address,
): { text: string; span: Span } {
  const base = previous ? text.slice(0, previous.start) : text;
  // a typed colon is already half a range, so only its far end goes in:
  // "=SUM(A1:" plus a "B7:D9" drag would read "A1:B7:D9" and not parse
  const label = /:\s*$/.test(base)
    ? addressLabel(focus)
    : rangeLabel(rangeBetween(anchor, focus));

  return {
    text: base + label,
    span: { start: base.length, end: base.length + label.length },
  };
}
