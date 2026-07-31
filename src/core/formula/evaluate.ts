import type { Address } from "../address";
import { type CellError, type CellValue, type ErrorCode, isError } from "./errors";
import { cellsIn } from "../range";
import type { Node } from "./parse";

type Binary = Extract<Node, { kind: "binary" }>;

export type ReadCell = (row: number, col: number) => CellValue;

// thrown to unwind out of a half-finished tree. deliberately not an Error:
// nothing reads a stack from it, and capturing one costs more than the arithmetic.
class Failure {
  constructor(readonly error: CellError) {}
}

function fail(code: ErrorCode, detail: string, blame: Address | null = null): never {
  throw new Failure({ code, blame, detail });
}

// an error read out of a cell passes through with its original blame intact. one
// that never named a cell takes the cell it was read from: a formula reading a
// broken formula can at least point at the broken one, which is nearer to the
// fix than pointing at nothing.
function passed(error: CellError, from: Address): never {
  throw new Failure(error.blame ? error : { ...error, blame: from });
}

// the cell a value came from, when it came from a cell at all rather than from
// working. only a reference has an address to point at.
function refAddress(node: Node): Address | null {
  return node.kind === "ref" ? { row: node.row, col: node.col } : null;
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
      return applyOperator(node, walk(node.left, readCell), walk(node.right, readCell));

    case "call":
      return applyFunction(node.name, node.args, readCell);

    // a bare range is only meaningful as a function argument
    case "range":
      fail("not-a-number", "wrap the range in SUM or AVERAGE");
  }
}

function refValue(row: number, col: number, readCell: ReadCell): number {
  const value = readCell(row, col);

  if (isError(value)) passed(value, { row, col });

  // an empty cell counts as zero in arithmetic, the same as Sheets
  if (typeof value === "string") {
    if (value.trim() === "") return 0;
    fail("not-a-number", value, { row, col });
  }

  return value;
}

// the whole node rather than its operator, because a division that fails has to
// name the operand it failed on and only the node still knows what that was
function applyOperator(node: Binary, left: number, right: number): number {
  switch (node.op) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      // the divisor is the thing to go and change, when it is a cell at all
      if (right === 0) fail("divide-by-zero", "dividing by zero", refAddress(node.right));
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
        if (isError(value)) passed(value, address);
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
