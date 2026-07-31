# fiddle-sheet

A browser spreadsheet surface. 100 rows by 26 columns, one sheet, no backend.

<video src="demo.mp4" controls width="100%"></video>

[demo.mp4](demo.mp4)

## Running it

```
npm install
npm run dev
```

Tests:

```
npm test
```

## Technical note

### Grid state

The sheet is a sparse `Map<CellKey, Cell>` in `src/core/sheet/store.ts`. `CellKey` is a single
integer, `row * COLS + col`, so the store and the dependency graph key plain maps with no string
allocation and no parsing in the hot path. An empty cell is an absent key, not a stored blank, so a
fresh sheet holds nothing and clearing a range shrinks the map.

A cell is `{ raw, formula, value }`: the text you typed, the parsed syntax tree (null for a
literal), and the result. The tree is built once when the text is written, not on each
recalculation, so a cell deep in a chain that recomputes five hundred times parses once. Keeping the
tree around is also what lets anything describe a formula rather than run it, which is where the
lens gets `=B2*C2` reads as `12 x 4`.

There is one way to write: `sheet.edit(writes, selection, action)`. Typing a cell, pasting a block,
clearing a range, filling a column and moving a band are all one call. One call is one undoable
action however many cells it touches, so undo grouping cannot be wrong: it is not a decision made
after the fact. The selection travels with the write so undo can put you back where the edit
happened, and the action name travels with it because a paste, a fill and a clear leave identical
`{ key, before, after }` records behind. The moment it happens is the only moment you can know which
it was, which is what lets the title bar say "undo fill C2:C18".

A change is symmetric, so undo and redo are the same code path with one argument different:
`apply(changes, "before")` and `apply(changes, "after")`. `revise()` rolls the last action back and
records a replacement against the original before values, so reading a fill one way and then the
other leaves one entry in history rather than a guess plus a correction.

### Selection

Selection is two points, `{ anchor, focus }`, not a rectangle. The anchor is where it started and
stays put, the focus is the end that moves. A rectangle has forgotten which corner you began from,
so it cannot answer shift-down: pushing the bottom edge and dragging the top edge are both "extend"
and only one is right. The same fact decides what escape collapses to. It keeps the focus, because
the focus is where the next arrow starts from.

The rectangle is derived on demand. `Range` is `{ top, left, bottom, right }`, grid indices, both
ends inclusive, direction thrown away: dragging B2 to D5 and D5 to B2 produce the same range.
`rangeBetween` is the only place in the codebase that has to sort corners, so everything downstream
(clear, copy, fill, the lens summary, hit testing, the label) receives a range that is already
sorted and works off one shared iteration order.

`Range` is four edges rather than a corner and a size because each edge can then be controlled on
its own. `insetOf` gives the distance from each edge of the sheet, which goes straight into CSS as
`left/top/right/bottom`. When a selection becomes a band of whole columns, the matching lid is
already up in the header, so the box's top edge has to arrive there at once while the other three
still travel: one line, `transition-property: left, right, bottom`. A width cannot express that,
since the far edge is the near edge plus the size, so pinning one moves the other. The header lid
also positions itself from the same two numbers as the box, so the two halves of a band cannot drift
apart.

A whole column selection is not a mode. It is an ordinary selection stretched to the far edge of the
sheet, which is also what `A:A` means to the engine, so nothing downstream needs a second path. The
anchor sits at the far end and the focus at the near one, so after clicking header C the keyboard
picks up at C1 rather than C100.

### Formulas: parsing

`src/core/formula/parse.ts` is a hand written tokenizer and recursive descent parser, no dependency.
Text goes in, a tree comes out, and the text is never read again: a `ref` node holds `row` and `col`
numbers, not `"A1"`.

The tokenizer chunks characters into numbers, names and punctuation, and knows nothing else. `SUM`
and `A1` are both name tokens, because telling them apart needs the token after them.

Precedence is the call order of three functions, `parseExpression` (`+` `-`) to `parseTerm` (`*`
`/`) to `parseUnary`, not a table. The lower precedence level asks the higher one for each of its
operands, so a term is always fully assembled before a sum can see it, and `A1+B1*2` nests the
multiply inside the plus by construction. Adding an operator is a function in the chain rather than
an entry in a table. Associativity is the loop inside each of those functions: the tree built so far
becomes the left child of the next node, so `10-3-2` is 5 and not 9.

Ambiguity is resolved by one token of lookahead. A name followed by `(` is a call, otherwise it is a
reference; a reference followed by `:` is a range, otherwise a single cell. Checking the `:` first
is what makes `A:A` and `B:D` fall out of the ordinary path instead of needing a case of their own,
since `A` alone is not an address.

`Node` is a six case discriminated union, so the evaluator's switch is exhaustive at compile time
and a new node kind is a type error everywhere it is not handled.

`ParseError` deliberately does not extend `Error`. The live answer under an open formula reparses
the draft on every keystroke, and a formula is unparseable at nearly every intermediate state
(`=S`, `=SUM(`, `=SUM(A1`), so failure is the normal case rather than the exceptional one. The
expensive part of `new Error()` is the stack capture, and nothing here reads a stack.
