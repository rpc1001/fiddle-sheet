import { type CellKey, cellKey } from "../address";
import { cellsIn } from "../range";
import type { Node } from "./parse";

// every cell a formula reads, so the dependency graph knows what it listens to
export function references(node: Node): CellKey[] {
  const found: CellKey[] = [];
  collect(node, found);
  return found;
}

function collect(node: Node, found: CellKey[]): void {
  switch (node.kind) {
    case "number":
      return;

    case "ref":
      found.push(cellKey(node.row, node.col));
      return;

    case "range":
      for (const address of cellsIn(node.range)) found.push(cellKey(address.row, address.col));
      return;

    case "negate":
      collect(node.operand, found);
      return;

    case "binary":
      collect(node.left, found);
      collect(node.right, found);
      return;

    case "call":
      for (const arg of node.args) collect(arg, found);
      return;
  }
}
