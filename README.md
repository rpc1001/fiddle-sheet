# fiddle-sheet

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

The sheet is a `Map<CellKey, Cell>` in `src/core/sheet/store.ts`. `CellKey` is a single simple
integer, `row * COLS + col.` An empty cell is an absent key instead of a a stored blank so
fresh sheet actually hold nothing and clearing a range shrinks the map. 

A cell is `{ raw, formula, value }`. Text you typed, the parsed syntax tree (null for a
literal), and the result. The tree is built once when the text is written instead of on each
recalculation. A cell deep in a chain that recomputes multiple times only is parsed once. Keeping the
tree around is also what lets anything describe a formula rather than run it, which is where the
lens gets `=B2*C2` reads as `12 x 4`.

There is one way to write: `sheet.edit(writes, selection, action)`. Typing, pasting,
clearing , filling, moving a row/col are all one call. This makes undo always accurate since its just one call and group.

A change is symmetric, so undo and redo are the same code path with one argument different:
`apply(changes, "before")` and `apply(changes, "after")`. `revise()` rolls the last action back and
records a replacement against the original before values, so reading a fill one way and then the
other leaves one entry in history rather than a guess plus a correction.

### Selection

Selection is two points, `{ anchor, focus }` instead of a rectangle. The anchor is where it started and
stays put, the focus is the end that moves. I chose this method because rectangles cant keep track of which corner you begin from, so it can't answer shifting-down: pushing the bottom edge and dragging the top edge are both "extend"
and only one is right. 

The rectangle is derived on demand. `Range` is `{ top, left, bottom, right }`, grid indices so dragging B2 to D5 and D5 to B2 produce the same range. `rangeBetween` is the only place in the codebase that has to sort corners, so everything downstream (clear, copy, fill, the lens summary, hit testing, the label) receives a range that is already
sorted and works off one shared iteration order.

A range is four edges instead of a corner and a size. To draw it, `insetOf` turns those four grid
indices into pixel distances from each side of the sheet, and they go straight into CSS as
`left/top/right/bottom`. So the browser is told where each of the four sides is, separately, which
is what lets the box animate one edge and hold another still. A width cannot, since the far edge is
the near edge plus the size.

A whole column selection is not a mode. It is an ordinary selection stretched to the far edge of the
sheet, which is also what `A:A` means to the engine, so nothing downstream needs a second path. The
anchor sits at the far end and the focus at the near one, so clicking header C leaves the keyboard
on C1 rather than C100.

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
