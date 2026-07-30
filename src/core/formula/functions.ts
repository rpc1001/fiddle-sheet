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

// the sign as it reads on paper and the character the formula language wants
export const OPERATORS: readonly { sign: string; insert: string }[] = [
  { sign: "+", insert: "+" },
  { sign: "−", insert: "-" },
  { sign: "×", insert: "*" },
  { sign: "÷", insert: "/" },
];

export function functionsStartingWith(partial: string): SheetFunction[] {
  const start = partial.toUpperCase();
  return FUNCTIONS.filter((entry) => entry.name.startsWith(start));
}
