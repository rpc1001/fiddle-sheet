import { describe, expect, it } from "vitest";
import { createGraph } from "./graph";

// plain numbers stand in for cell keys here; the graph never interprets them
describe("graph", () => {
  it("plans only the cell itself when nothing depends on it", () => {
    const graph = createGraph();
    expect(graph.plan(1)).toEqual({ ordered: [1], circular: [] });
  });

  it("includes a direct dependent", () => {
    const graph = createGraph();
    graph.setPrecedents(2, [1]);
    expect(graph.plan(1)).toEqual({ ordered: [1, 2], circular: [] });
  });

  it("orders a chain so each cell comes after what it reads", () => {
    const graph = createGraph();
    graph.setPrecedents(2, [1]);
    graph.setPrecedents(3, [2]);
    expect(graph.plan(1)).toEqual({ ordered: [1, 2, 3], circular: [] });
  });

  it("puts a cell after both of its precedents", () => {
    const graph = createGraph();
    graph.setPrecedents(3, [1, 2]);
    graph.setPrecedents(4, [3]);

    const { ordered } = graph.plan(1);
    expect(ordered.indexOf(3)).toBeGreaterThan(ordered.indexOf(1));
    expect(ordered.indexOf(4)).toBeGreaterThan(ordered.indexOf(3));
  });

  it("leaves out cells nothing connects to", () => {
    const graph = createGraph();
    graph.setPrecedents(2, [1]);
    expect(graph.plan(9)).toEqual({ ordered: [9], circular: [] });
  });

  it("finds a cell that reads itself", () => {
    const graph = createGraph();
    graph.setPrecedents(1, [1]);
    expect(graph.plan(1)).toEqual({ ordered: [], circular: [1] });
  });

  it("finds a two-cell cycle", () => {
    const graph = createGraph();
    graph.setPrecedents(1, [2]);
    graph.setPrecedents(2, [1]);

    const { ordered, circular } = graph.plan(1);
    expect(ordered).toEqual([]);
    expect(circular.sort()).toEqual([1, 2]);
  });

  it("still orders the cells downstream of a cycle as circular", () => {
    const graph = createGraph();
    graph.setPrecedents(1, [2]);
    graph.setPrecedents(2, [1]);
    graph.setPrecedents(3, [2]);

    const { circular } = graph.plan(1);
    expect(circular.sort()).toEqual([1, 2, 3]);
  });

  it("drops old edges when a formula is rewritten", () => {
    const graph = createGraph();
    graph.setPrecedents(2, [1]);
    graph.setPrecedents(2, [9]);

    expect(graph.plan(1)).toEqual({ ordered: [1], circular: [] });
    expect(graph.plan(9)).toEqual({ ordered: [9, 2], circular: [] });
  });

  it("breaks a cycle when the offending formula is replaced", () => {
    const graph = createGraph();
    graph.setPrecedents(1, [2]);
    graph.setPrecedents(2, [1]);
    graph.setPrecedents(2, []);

    expect(graph.plan(1)).toEqual({ ordered: [1], circular: [] });
  });
});
