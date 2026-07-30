import type { Address } from "../address";

export type ErrorCode =
  | "not-a-number"
  | "divide-by-zero"
  | "unknown-function"
  | "bad-formula"
  | "circular";

// blame points at the cell that caused this, not the cell that reported it, so a
// formula built on a formula can still name the original culprit
export type CellError = {
  code: ErrorCode;
  blame: Address | null;
  detail: string;
};

// what a cell is worth to a formula reading it: a number, text, or an error
export type CellValue = number | string | CellError;

export function isError(value: CellValue): value is CellError {
  return typeof value === "object";
}

const DISPLAY: Record<ErrorCode, string> = {
  "not-a-number": "#VALUE!",
  "divide-by-zero": "#DIV/0!",
  "unknown-function": "#NAME?",
  "bad-formula": "#ERROR!",
  circular: "#CYCLE!",
};

export function errorDisplay(error: CellError): string {
  return DISPLAY[error.code];
}
