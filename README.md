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

An edit floods `dependents` outward from the cells that changed to get the affected set, then runs
Kahn's algorithm over that set alone, which orders it so every cell comes after everything it reads.
The whole edit is seeded at once, so a cell reading two changed cells recomputes once, after both,
instead of twice with a stale value in between. The cost is the size of the affected set.

Cycles need no separate detection. Kahn's only releases a cell once everything it waits on has run,
so anything still waiting when the queue drains is waiting on itself, and gets `#CYCLE!`.

### Trade-offs

The grid is fixed at 100 by 26 instead of an infinite canvas. That is the brief's scope, and taking
it means the geometry is constants: row height, column width, the size of the whole sheet. Hit
testing is then arithmetic on a pointer position rather than a lookup, and the selection box can be
positioned from the sheet's four edges because the sheet has a known size. An infinite canvas makes
all of that dynamic. The cost is that 26 columns is hard capped, since a column label is one letter.

Every cell renders. All 2,600 of them are real divs, no windowing. I built windowing first and then
deleted it. At this size it buys nothing and it costs complexity and possible delays on rendering.Past ten thousand or so rows I would put windowing back.

A range reference is one graph edge per cell, so `=SUM(A:A)` makes a hundred of them. Correct and
fast here, wrong at a million rows, where the fix is range nodes with interval overlap. Definitely not worth building for a sheet this size.

Moving a column or a row rewrites the whole sheet. Every cell is walked to remap the formulas that
point at what moved, so it is O(sheet) per move instead of O(affected). It is nothing at 2,600
cells, but it does not scale.

No persistence. Refresh and you are back to the seed, I chose this for testing and demo purposes.

No multi-range selection. Ctrl-clicking a second range is out, because every consumer of the
selection assumes one rectangle: the fill, the paste, the summary, the clear, the overlay geometry.
Supporting a set of rectangles complicates all of them to serve an interaction that mostly exists
for formatting, which is out of scope here anyway.

No column resizing. Column width is one constant that layout and hit testing both read, and making
it per column means a lookup everywhere that is currently arithmetic. 

### What I would do with more time

**Make it hold a real sheet.** Everything here is honest at 2,600 cells and gives out somewhere past
a few thousand. 

**Let people theme it.** The whole surface already runs off one set of custom properties. Colour,
type, radii, shadows, and the easings and durations too, which means motion is as themeable as
paint. Light and dark are just two sets of those values. I would open that up: pick a palette, pick
how much the sheet moves, or write your own and share it. I think choosing your own  style of animations would be more fun for the users, do you want something fun and playful or sleek and crispy, or maybe a mix of both?  A spreadsheet is a thing people sit in front of all day and nobody has ever been allowed to make one theirs.

### Where this differs from Sheets

A spreadsheet sometiems feels like a black box: the dependency graph, the recalculation travelling through it, which cell actually broke, what a formula is really computing. All of that exists inside the engine and none of it reaches the
screen, so I mostly focued on  transparency. The second is that the hard part for someone new is actually knowing what to type, so the gestures should state the thing rather than expect you to already know it. The third is that a spreadsheet is a thing people sit in front of all day, so I wanted to make it more fun and enjoyable.

**The lens.** The main transparency tool.A dark panel that follows the selection and answers whatever is under it. Select a
block and it leads with the sum, then count, average, min and max underneath, so nothing has to be
chosen. Select a single cell holding a formula and it shows the formula, the value, and the working
with the references swapped for what they are worth, so `=B2*C2` reads back as `12 x 4`. Select a
cell in error and it gives the code and a sentence. Select a plain number and it says nothing,
because the cell already did. While you are typing a formula it becomes the draft panel, carrying
the suggestions and the running answer.

It sits on the nearest edge of the selection that has room, lined up with the cell you are working
on, measured against the visible part of the selection rather than the whole of it. Sheets
puts the same answer in the bottom right corner of the window, which is the furthest point on screen
from your eyes.

**Drag a block of numbers onto an empty cell to total it.** No equivalent in Sheets. The hard part
of a first spreadsheet is knowing that `SUM` exists and that the range is spelled `A2:A18`. Alt held,
carrying a selection to a cell states both at once, and what hangs off the pointer is the formula it
would write. It lands open rather than committed, since the range came from the hand and the
function was only a guess.

**It finishes what you started typing.** `=SUM(A1:A5` closes its own bracket and `=SUM(C` expands
to `=SUM(C:C)`. This reduces annoyances from petty syntax errors for spreadsheet noobs such as myself.

**A fill of one number counts instead of copying, and offers the other reading.** Dragging a handle
says extend, and copying is what paste is for. It is not a coin flip you lose, because the lens
lists the other readings with the values each would write, and picking one replaces the same history
entry instead of stacking a correction on a guess.

**Errors name the cell to go and fix.** `#VALUE!` says something is wrong somewhere in a formula
that might read fifty cells. Every error carries a blame address, so the culprit forty rows away
gets marked and the lens says "B4 is text, not a number".

**Selecting a cell traces what it reads and what reads it.** Three hops each way, merged into the
fewest rectangles so a traced range is one outline instead of a grid of tiles. 

**A recalculation is animated in the order it happened.** The engine hands over the order it
recomputed in and the pulse follows it, so propagation is visible rather than assumed. Dropped
entirely under reduced motion.

**Undo says what it will take back.** `undo fill C2:C8`, `undo move B:D`. Only possible because the
action name travels with the write. Sheets says nothing at all.
