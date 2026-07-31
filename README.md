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
is what lets the box animate one edge and hold another still. 

A whole column selection is not a mode. It is an ordinary selection stretched to the far edge of the
sheet, which is also what `A:A` means to the engine, so nothing downstream needs a second path. The
anchor sits at the far end and the focus at the near one, so clicking header C leaves the keyboard
on C1 rather than C100.

### Formulas: parsing

`src/core/formula/parse.ts` is a tokenizer and recursive descent parser with no dependency.
Text goes in, a tree comes out, the text is never read again: a `ref` node holds `row` and `col`
numbers, not `"A1"`. I  learned this approach in my Programming Languages course at University so it was cool to  be able to apply it somewhere real for the first time. 

The tokenizer chunks chars into nums, names and punctuation. `SUM` and `A1` are both name tokens since telling them apart requires the next token after them.

Precedence is the call order of three functions, `parseExpression` (`+` `-`) to `parseTerm` (`*`
`/`) to `parseUnary`. The lower precedence level asks the higher one for each of its
operands, so a term is always fully assembled before a sum can see it, and `A1+B1*2` nests the
multiply inside the plus by construction.Associativity is the loop inside each of those functions: the tree built so far
becomes the left child of the next node making `10-3-2` is 5 and not 9.

Ambiguity is resolved by one token of lookahead. A name followed by `(` is a call, otherwise it is a
reference; a reference followed by `:` is a range, otherwise a single cell. Checking the `:` first
is what makes `A:A` and `B:D` fall out of the ordinary path instead of needing a case of their own,
since `A` alone is not an address.

### Formulas: evaluation

`evaluate(node, readCell)` takes the cell reader as an argument. `sheet.preview(raw)` parses the draft and evaluates it against the real sheet with nothing written yet.

`walk` has one branch per node kind and calls itself on the children, so evaluation follows the shape of the tree: the leaves answer first and the answers come back up.

Errors are thrown as a `Failure` to unwind out of a half finished tree, then caught once at the top
and returned as a value. Same as `ParseError`, it does not extend `Error`.

An error is `{ code, blame, detail }` instead of a string. `#VALUE!` is only how it displays.
`blame` is the address of the cell that caused it so then the sheet can point it out. 

Inside a range, text and empty cells are skipped instead of failing since a range is usually a
column with a heading on it. In plain arithmetic an empty cell reads as 0.

### Dependencies

Two maps in `src/core/sheet/graph.ts`, one each way. `precedents` is the cells a formula reads,
`dependents` is the formulas that read a cell. Both keyed by the same integer as the store.

The edges come from the tree, not the text. `references()` walks a parsed formula and returns every
cell it names, and `setPrecedents` unwires the old edges before wiring the new ones. It also returns
the edges that were not there before, which is what lets a new connection be shown being made
instead of only its result.

An edit does two passes. First it floods `dependents` outward from the cells that changed to get the
affected set. Then it runs Kahn's algorithm over that set alone, which orders it so every cell comes
after everything it reads. Each cell recomputes exactly once and never on a stale input. The cost is
the size of the affected set.

Writing and recomputing are separate. An edit stores all its cells and rewires the graph first,
then runs one pass over everything downstream. 

Cycles need no separate detection. Kahn's only releases a cell once everything it waits on has run,
so anything still waiting when the queue drains is waiting on itself, directly or through a chain.
Those come back as `circular` and get `#CYCLE!`.

`trace` reads the same two maps breadth first, three hops each way, which is what the overlay draws
when you select a cell. It stops at three because past that the tint is too faint to read and the
sheet is just busy.
