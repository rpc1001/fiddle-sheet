import type { Range } from "../range";
import { FUNCTIONS, type SheetFunction, functionsStartingWith } from "./functions";
import { draftReferences } from "./scan";

export type Suggestion =
  // a name is being typed and these are the functions it could still become
  | { kind: "functions"; matches: SheetFunction[] }
  // the brackets are open, so the useful thing to say is what the argument
  // covers, or what the function wants when nothing has been typed yet
  | { kind: "argument"; name: string; summary: string | null; range: Range | null }
  | null;

const TRAILING_NAME = /[A-Za-z]+$/;
// a formula can only take a function name in the same places it takes a
// reference: after the equals, an operator, an open bracket or a comma
const WANTS_NAME = /[=+\-*/(,]\s*$/;

// the letters at the end that could still become a function name. letters after
// a colon are the far end of a range ("=SUM(A:A"), which is not a name at all.
function partialName(text: string): string | null {
  const found = TRAILING_NAME.exec(text);
  if (!found) return null;
  return text[found.index - 1] === ":" ? null : found[0];
}

export function suggest(text: string): Suggestion {
  if (!text.startsWith("=")) return null;

  const partial = partialName(text);
  if (partial) {
    const matches = functionsStartingWith(partial);
    return matches.length > 0 ? { kind: "functions", matches } : null;
  }

  const call = openCall(text);
  if (call) {
    // only what was typed inside these brackets: an earlier argument is
    // finished business and describing it would be describing the wrong thing
    const inside = draftReferences(text.slice(call.at + 1));
    return {
      kind: "argument",
      name: call.name,
      summary: FUNCTIONS.find((entry) => entry.name === call.name)?.summary ?? null,
      range: inside[inside.length - 1] ?? null,
    };
  }

  // nothing typed yet: show what there is rather than making it be guessed
  if (WANTS_NAME.test(text)) return { kind: "functions", matches: [...FUNCTIONS] };

  return null;
}

// the function whose brackets are still open, innermost first. anything already
// closed is finished business and has nothing left to say.
function openCall(text: string): { name: string; at: number } | null {
  let depth = 0;

  for (let at = text.length - 1; at >= 0; at--) {
    const char = text[at];
    if (char === ")") depth++;
    else if (char === "(") {
      if (depth > 0) {
        depth--;
        continue;
      }
      const name = TRAILING_NAME.exec(text.slice(0, at))?.[0];
      return name ? { name: name.toUpperCase(), at } : null;
    }
  }

  return null;
}

// accepting a suggestion replaces the half-typed name and opens the bracket, so
// the next thing typed or clicked is the argument. nothing half typed, as after
// a bare "=", means there is nothing to replace and the name is simply added.
export function acceptSuggestion(text: string, name: string): string {
  const opened = `${name}(`;
  const partial = partialName(text);
  return partial ? text.slice(0, text.length - partial.length) + opened : text + opened;
}
