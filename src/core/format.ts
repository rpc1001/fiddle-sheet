import { type CellValue, errorDisplay, isError } from "./formula/errors";

// how every number in the app reads: grouped thousands and at most two
// decimals. the stored value keeps its full precision, this is only the display,
// and it is what stops 0.1+0.2 showing as 0.30000000000000004.
const PLAIN = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

// two decimals would round anything under a hundredth away to nothing, so small
// numbers are shown by their significant digits instead
const SMALL = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 });

export function formatNumber(value: number): string {
  const size = Math.abs(value);
  return size > 0 && size < 0.01 ? SMALL.format(value) : PLAIN.format(value);
}

// how a stored value reads anywhere it is shown: the cell, the lens, the draft
// preview. one rule, so an error never renders two ways in the same sheet.
export function displayValue(value: CellValue): string {
  if (isError(value)) return errorDisplay(value);
  return typeof value === "number" ? formatNumber(value) : value;
}
