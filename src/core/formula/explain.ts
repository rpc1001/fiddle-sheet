import { addressLabel } from "../address";
import { displayValue, formatNumber } from "../format";
import { rangeLabel } from "../range";
import type { CellError, CellValue } from "./errors";
import type { ReadCell } from "./evaluate";
import { SIGNS } from "./functions";
import type { Node, Operator } from "./parse";

// the formula with every reference swapped for what it currently holds, so
// "=B2*C2" reads as "12 × 4" without opening the cells it names
export function substitute(node: Node, readCell: ReadCell): string {
  switch (node.kind) {
    case "number":
      return formatNumber(node.value);

    case "ref":
      return valueText(readCell(node.row, node.col));

    case "range":
      return rangeLabel(node.range);

    case "negate":
      return `-${substitute(node.operand, readCell)}`;

    case "binary": {
      const left = grouped(node.left, node.op, readCell);
      const right = grouped(node.right, node.op, readCell);
      return `${left} ${SIGNS[node.op]} ${right}`;
    }

    case "call":
      return `${node.name}(${node.args.map((arg) => substitute(arg, readCell)).join(", ")})`;
  }
}

// "=(A1+A2)*2" has to keep its brackets once the references are gone, or the
// substituted line says something the formula does not
function grouped(node: Node, parent: Operator, readCell: ReadCell): string {
  const text = substitute(node, readCell);
  const loose = node.kind === "binary" && (node.op === "+" || node.op === "-");
  return loose && (parent === "*" || parent === "/") ? `(${text})` : text;
}

// substituted text is read as a sentence, so a blank and a word both have to
// look like what they are rather than disappearing into the line
function valueText(value: CellValue): string {
  if (typeof value !== "string") return displayValue(value);
  return value === "" ? "(empty)" : `"${value}"`;
}

// substituting a formula with no references in it just repeats the formula
export function hasReference(node: Node): boolean {
  switch (node.kind) {
    case "ref":
    case "range":
      return true;
    case "negate":
      return hasReference(node.operand);
    case "binary":
      return hasReference(node.left) || hasReference(node.right);
    case "call":
      return node.args.some(hasReference);
    case "number":
      return false;
  }
}

// plain english for the codes in errors.ts, short enough to read at a glance.
// the point is that "#VALUE!" alone never says which cell to go and fix.
export function explainError(error: CellError): string {
  switch (error.code) {
    case "not-a-number":
      // without a blame the detail is already the whole sentence
      return error.blame ? `${addressLabel(error.blame)} is text, not a number` : error.detail;

    case "divide-by-zero":
      return error.detail;

    case "unknown-function":
      return `no function called ${error.detail}`;

    case "bad-formula":
      return "this formula cannot be read";

    case "circular":
      return "this formula depends on itself";
  }
}
