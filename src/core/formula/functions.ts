import type { Operator } from "./parse";

export type SheetFunction = {
  name: string;
  // what it does, in the words someone would use before they knew the jargon
  summary: string;
};

export const FUNCTIONS: readonly SheetFunction[] = [
  { name: "SUM", summary: "adds up the numbers" },
  { name: "AVERAGE", summary: "the mean of the numbers" },
  { name: "COUNT", summary: "how many numbers there are" },
];

// the sign as it reads on paper, keyed by the character the formula language
// wants. the buttons that insert one and the readout that spells a formula back
// both read this, so an operator is typeset the same way wherever it appears.
export const SIGNS: Record<Operator, string> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
};

export const OPERATORS = Object.keys(SIGNS) as readonly Operator[];

export function functionsStartingWith(partial: string): SheetFunction[] {
  const start = partial.toUpperCase();
  return FUNCTIONS.filter((entry) => entry.name.startsWith(start));
}
