import { describe, expect, it } from "vitest";
import { rangeLabel } from "../range";
import { acceptSuggestion, suggest } from "./suggest";

const names = (text: string): string[] => {
  const found = suggest(text);
  return found?.kind === "functions" ? found.matches.map((entry) => entry.name) : [];
};

describe("suggest", () => {
  it("says nothing about plain text", () => {
    expect(suggest("Groceries")).toBeNull();
  });

  it("offers everything once the equals is typed and a letter follows", () => {
    expect(names("=S")).toEqual(["SUM"]);
  });

  it("narrows as the name is typed", () => {
    expect(names("=A")).toEqual(["AVERAGE"]);
    expect(names("=C")).toEqual(["COUNT"]);
  });

  // the list that opened by itself must not be able to take enter off the cell,
  // and this is the only thing that tells the two apart
  it("says whether the list is narrowing something that was typed", () => {
    const typed = (text: string) => {
      const found = suggest(text);
      return found?.kind === "functions" ? found.typed : null;
    };

    expect(typed("=S")).toBe(true);
    expect(typed("=")).toBe(false);
    expect(typed("=A1+")).toBe(false);
  });

  it("offers nothing for a name that matches none of them", () => {
    expect(suggest("=ZZ")).toBeNull();
  });

  it("offers everything the moment the equals is typed", () => {
    expect(names("=")).toEqual(["SUM", "AVERAGE", "COUNT"]);
  });

  it("offers everything again after an operator", () => {
    expect(names("=B1+")).toEqual(["SUM", "AVERAGE", "COUNT"]);
  });

  it("switches to the argument once the bracket is open", () => {
    const found = suggest("=SUM(B2:B7");
    expect(found).toEqual({
      kind: "argument",
      name: "SUM",
      summary: "adds up the numbers",
      range: { top: 1, left: 1, bottom: 6, right: 1 },
    });
  });

  it("says what the function wants before an argument is typed", () => {
    expect(suggest("=SUM(")).toEqual({
      kind: "argument",
      name: "SUM",
      summary: "adds up the numbers",
      range: null,
    });
  });

  it("ignores a reference that came before the bracket", () => {
    expect(suggest("=B1+SUM(")).toMatchObject({ name: "SUM", range: null });
  });

  it("reports the argument being typed now, not an earlier one", () => {
    const found = suggest("=SUM(A1,B2:B7");
    expect(found?.kind === "argument" && found.range && rangeLabel(found.range)).toBe("B2:B7");
  });

  it("reads a column range as an argument, not a half-typed name", () => {
    const found = suggest("=SUM(A:A");
    expect(found?.kind).toBe("argument");
    expect(found?.kind === "argument" && found.range && rangeLabel(found.range)).toBe("A1:A100");
  });

  it("says nothing once the brackets are closed", () => {
    expect(suggest("=SUM(B2:B7)")).toBeNull();
  });

  it("looks at the innermost open bracket", () => {
    const found = suggest("=SUM(AVERAGE(B1:B3");
    expect(found?.kind === "argument" && found.name).toBe("AVERAGE");
  });
});

describe("acceptSuggestion", () => {
  it("finishes the name and opens the bracket", () => {
    expect(acceptSuggestion("=SU", "SUM")).toBe("=SUM(");
  });

  it("leaves what came before it alone", () => {
    expect(acceptSuggestion("=B1+AV", "AVERAGE")).toBe("=B1+AVERAGE(");
  });

  it("adds the name when nothing has been typed to replace", () => {
    expect(acceptSuggestion("=", "SUM")).toBe("=SUM(");
    expect(acceptSuggestion("=B1+", "COUNT")).toBe("=B1+COUNT(");
  });
});
