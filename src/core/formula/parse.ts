import { parseAddress } from "../address";
import type { Range } from "../range";
import { referenceRange } from "./scan";

export type Operator = "+" | "-" | "*" | "/";

export type Node =
  | { kind: "number"; value: number }
  | { kind: "ref"; row: number; col: number }
  | { kind: "range"; range: Range }
  | { kind: "negate"; operand: Node }
  | { kind: "binary"; op: Operator; left: Node; right: Node }
  | { kind: "call"; name: string; args: Node[] };

// deliberately not an Error, for the same reason as Failure in evaluate.ts:
// a half-typed formula throws on nearly every keystroke and nothing reads a stack
export class ParseError {
  constructor(readonly message: string) {}
}

type Punctuation = Operator | "(" | ")" | "," | ":";

type Token =
  | { type: "number"; value: number }
  | { type: "name"; text: string }
  | { type: "symbol"; text: Punctuation };

const SYMBOLS: readonly Punctuation[] = ["+", "-", "*", "/", "(", ")", ",", ":"];

function punctuationAt(char: string): Punctuation | null {
  return SYMBOLS.find((symbol) => symbol === char) ?? null;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;

  while (at < source.length) {
    const char = source[at]!;
    const symbol = punctuationAt(char);

    if (char === " ") {
      at++;
    } else if (symbol) {
      tokens.push({ type: "symbol", text: symbol });
      at++;
    } else if (/[0-9.]/.test(char)) {
      const start = at;
      while (at < source.length && /[0-9.]/.test(source[at]!)) at++;
      const value = Number(source.slice(start, at));
      if (Number.isNaN(value)) throw new ParseError(`bad number: ${source.slice(start, at)}`);
      tokens.push({ type: "number", value });
    } else if (/[A-Za-z$]/.test(char)) {
      const start = at;
      while (at < source.length && /[A-Za-z0-9$]/.test(source[at]!)) at++;
      tokens.push({ type: "name", text: source.slice(start, at) });
    } else {
      throw new ParseError(`unexpected character: ${char}`);
    }
  }

  return tokens;
}

// formula text without its leading "=" -> a tree. throws ParseError on bad input.
export function parse(source: string): Node {
  const tokens = tokenize(source);
  let at = 0;

  const peek = (): Token | undefined => tokens[at];

  function eat(text: string): boolean {
    const token = peek();
    if (token?.type === "symbol" && token.text === text) {
      at++;
      return true;
    }
    return false;
  }

  function expect(text: string): void {
    if (!eat(text)) throw new ParseError(`expected ${text}`);
  }

  function parseExpression(): Node {
    let left = parseTerm();
    for (;;) {
      const op = eat("+") ? "+" : eat("-") ? "-" : null;
      if (!op) return left;
      left = { kind: "binary", op, left, right: parseTerm() };
    }
  }

  function parseTerm(): Node {
    let left = parseUnary();
    for (;;) {
      const op = eat("*") ? "*" : eat("/") ? "/" : null;
      if (!op) return left;
      left = { kind: "binary", op, left, right: parseUnary() };
    }
  }

  function parseUnary(): Node {
    if (eat("-")) return { kind: "negate", operand: parseUnary() };
    if (eat("+")) return parseUnary();
    return parsePrimary();
  }

  function parsePrimary(): Node {
    const token = peek();
    if (!token) throw new ParseError("unexpected end of formula");

    if (token.type === "number") {
      at++;
      return { kind: "number", value: token.value };
    }

    if (eat("(")) {
      const inner = parseExpression();
      expect(")");
      return inner;
    }

    if (token.type === "name") {
      at++;
      return eat("(") ? parseCall(token.text) : parseReference(token.text);
    }

    throw new ParseError(`unexpected ${token.text}`);
  }

  function parseCall(name: string): Node {
    const args: Node[] = [];
    if (!eat(")")) {
      do {
        args.push(parseExpression());
      } while (eat(","));
      expect(")");
    }
    return { kind: "call", name: name.toUpperCase(), args };
  }

  // "B7", "A1:C5", or a whole-column form like "A:A" and "B:D"
  function parseReference(text: string): Node {
    if (!eat(":")) {
      const address = parseAddress(text);
      if (!address) throw new ParseError(`bad reference: ${text}`);
      return { kind: "ref", ...address };
    }

    const end = peek();
    if (end?.type !== "name") throw new ParseError("expected a reference after :");
    at++;

    return { kind: "range", range: parseRange(text, end.text) };
  }

  const tree = parseExpression();
  if (at < tokens.length) throw new ParseError("unexpected trailing input");
  return tree;
}

function parseRange(startText: string, endText: string): Range {
  const range = referenceRange(startText, endText);
  if (!range) throw new ParseError(`bad range: ${startText}:${endText}`);
  return range;
}
