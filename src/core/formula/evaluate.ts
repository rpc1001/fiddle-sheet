import type { Address } from "../address";
import { type CellError, type CellValue, type ErrorCode, isError } from "./errors";
import { cellsIn } from "../range";
import type { Node } from "./parse";

export type ReadCell = (row: number, col: number) => CellValue;

// thrown to unwind out of a half-finished tree. deliberately not an Error:
// nothing reads a stack from it, and capturing one costs more than the arithmetic.
class Failure {
  constructor(readonly error: CellError) {}
}

function fail(code: ErrorCode, detail: string, blame: Address | null = null): never {
  throw new Failure({ code, blame, detail });
}

export function evaluate(node: Node, readCell: ReadCell): number | CellError {
  try {
    return walk(node, readCell);
  } catch (thrown) {
    if (thrown instanceof Failure) return thrown.error;
    throw thrown;
  }
}

function walk(node: Node, readCell: ReadCell): number {
  switch (node.kind) {
    case "number":
      return node.value;

    case "ref":
      return refValue(node.row, node.col, readCell);

    case "negate":
      return -walk(node.operand, readCell);

    case "binary":
      return applyOperator(node.op, walk(node.left, readCell), walk(node.right, readCell));

    case "call":
      return applyFunction(node.name, node.args, readCell);

    // a bare range is only meaningful as a function argument
    case "range":
      fail("not-a-number", "wrap the range in SUM or AVERAGE");
  }
}

function refValue(row: number, col: number, readCell: ReadCell): number {
  const value = readCell(row, col);

  // an error passes through with its original blame intact
  if (isError(value)) throw new Failure(value);

  // an empty cell counts as zero in arithmetic, the same as Sheets
  if (typeof value === "string") {
    if (value.trim() === "") return 0;
    fail("not-a-number", value, { row, col });
  }

  return value;
}

function applyOperator(op: "+" | "-" | "*" | "/", left: number, right: number): number {
  switch (op) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      if (right === 0) fail("divide-by-zero", "dividing by zero");
      return left / right;
  }
}

// text and empty cells inside a range are skipped rather than failing, because a
// range is usually a column with a heading in it. errors still propagate.
function collectNumbers(args: Node[], readCell: ReadCell): number[] {
  const numbers: number[] = [];

  for (const arg of args) {
    if (arg.kind === "range") {
      for (const address of cellsIn(arg.range)) {
        const value = readCell(address.row, address.col);
        if (isError(value)) throw new Failure(value);
        if (typeof value === "number") numbers.push(value);
      }
    } else {
      numbers.push(walk(arg, readCell));
    }
  }

  return numbers;
}

function total(numbers: number[]): number {
  return numbers.reduce((sum, value) => sum + value, 0);
}

function applyFunction(name: string, args: Node[], readCell: ReadCell): number {
  const numbers = collectNumbers(args, readCell);

  switch (name) {
    case "SUM":
      return total(numbers);

    case "COUNT":
      return numbers.length;

    case "AVERAGE": {
      if (numbers.length === 0) fail("divide-by-zero", "nothing to average");
      return total(numbers) / numbers.length;
    }

    default:
      fail("unknown-function", name);
  }
}
