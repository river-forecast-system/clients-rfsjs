import {describe, expect, it} from "vitest";
import {
  aoiSpans, buildIdLookup, corridorBetween, isDownstreamOf, lookupRiverIndex, spanCount,
  subtractSpans, upstreamRange, verifyIdLookup
} from "../src/v3/hydrography/index.js";

// A small depth-first-labelled network, as the runs each reach covers (`hi` is the reach's own
// riverIndex): headwater A(0) → B(1), headwater C(2), B and C join at D(3), D → E(4).
const RUNS = [
  {lo: 0, hi: 0},  // A
  {lo: 0, hi: 1},  // B
  {lo: 2, hi: 2},  // C
  {lo: 0, hi: 3},  // D
  {lo: 0, hi: 4},  // E
];

describe("upstreamRange", () => {
  it("turns a reach's index and upstream count into its run", () => {
    expect(upstreamRange({riverIndex: 3, upstreamCount: 3})).toEqual({lo: 0, hi: 3, count: 4});
    expect(upstreamRange({riverIndex: 2, upstreamCount: 0})).toEqual({lo: 2, hi: 2, count: 1});
    expect(upstreamRange({riverIndex: "3", upstreamCount: "3"})).toEqual({lo: 0, hi: 3, count: 4});
  });
  it("refuses what is not an index and a count", () => {
    expect(() => upstreamRange({riverIndex: -1, upstreamCount: 0})).toThrow();
    expect(() => upstreamRange({riverIndex: 3, upstreamCount: -2})).toThrow();
    expect(() => upstreamRange({riverIndex: 1.5, upstreamCount: 0})).toThrow();
    expect(() => upstreamRange({riverIndex: null, upstreamCount: null})).toThrow();
  });
});

describe("spanCount", () => {
  it("counts the reaches disjoint runs cover", () => {
    expect(spanCount([])).toBe(0);
    expect(spanCount([{lo: 0, hi: 4}])).toBe(5);
    expect(spanCount([{lo: 0, hi: 1}, {lo: 3, hi: 4}])).toBe(4);
  });
});

describe("isDownstreamOf", () => {
  it("holds when the other reach's index falls inside a longer run", () => {
    expect(isDownstreamOf({lo: 0, hi: 4}, {lo: 0, hi: 1})).toBe(true);   // E below B
    expect(isDownstreamOf({lo: 0, hi: 1}, {lo: 0, hi: 4})).toBe(false);  // B not below E
    expect(isDownstreamOf({lo: 0, hi: 1}, {lo: 2, hi: 2})).toBe(false);  // B not below C
  });
  it("is false for the same reach and for no reach", () => {
    expect(isDownstreamOf({lo: 0, hi: 3}, {lo: 0, hi: 3})).toBe(false);
    expect(isDownstreamOf({lo: 0, hi: 3}, null)).toBe(false);
  });
});

describe("subtractSpans", () => {
  it("cuts the middle of a run into two", () => {
    expect(subtractSpans([{lo: 0, hi: 9}], {lo: 3, hi: 5}))
      .toEqual([{lo: 0, hi: 2}, {lo: 6, hi: 9}]);
  });
  it("trims an edge and drops a fully covered run", () => {
    expect(subtractSpans([{lo: 0, hi: 9}], {lo: 0, hi: 4})).toEqual([{lo: 5, hi: 9}]);
    expect(subtractSpans([{lo: 0, hi: 4}], {lo: 0, hi: 4})).toEqual([]);
  });
  it("leaves runs the cut never touches", () => {
    expect(subtractSpans([{lo: 0, hi: 1}, {lo: 5, hi: 9}], {lo: 2, hi: 4}))
      .toEqual([{lo: 0, hi: 1}, {lo: 5, hi: 9}]);
  });
});

describe("aoiSpans", () => {
  it("is the watershed until inlets cut it", () => {
    expect(aoiSpans({lo: 0, hi: 9}, [])).toEqual([{lo: 0, hi: 9}]);
    expect(aoiSpans(null, [])).toEqual([]);
  });
  it("each inlet takes itself and everything above it", () => {
    expect(aoiSpans({lo: 0, hi: 9}, [{lo: 2, hi: 5}])).toEqual([{lo: 0, hi: 1}, {lo: 6, hi: 9}]);
    expect(spanCount(aoiSpans({lo: 0, hi: 9}, [{lo: 2, hi: 5}, {lo: 8, hi: 8}]))).toBe(5);
  });
  it("a redundant inlet changes nothing — how a caller tells", () => {
    const once = aoiSpans({lo: 0, hi: 9}, [{lo: 2, hi: 5}]);
    expect(spanCount(aoiSpans({lo: 0, hi: 9}, [{lo: 2, hi: 5}, {lo: 3, hi: 4}])))
      .toBe(spanCount(once));
  });
});

describe("corridorBetween", () => {
  it("joins two headwaters through their common reach", () => {
    const {corridor, junctions, detached} = corridorBetween([0, 2], RUNS);
    expect([...corridor].sort()).toEqual([0, 1, 2, 3]);  // A, B, C, D — not E
    expect(junctions).toEqual([3]);
    expect(detached).toEqual([]);
  });
  it("follows the mainstem between two reaches on it", () => {
    const {corridor} = corridorBetween([0, 4], RUNS);
    expect([...corridor].sort()).toEqual([0, 1, 3, 4]);  // the path, skipping C
  });
  it("keeps a single pick as just that reach", () => {
    const {corridor, detached} = corridorBetween([2], RUNS);
    expect([...corridor]).toEqual([2]);
    expect(detached).toEqual([2]);
  });
  it("reports picks no drawn run connects as detached", () => {
    const {corridor, junctions, detached} = corridorBetween([0, 100], RUNS);
    expect([...corridor].sort((a, b) => a - b)).toEqual([0, 100]);  // both stay selected
    expect(junctions).toEqual([]);
    expect(detached.sort((a, b) => a - b)).toEqual([0, 100]);
  });
  it("dedupes picks and ignores what is not an index", () => {
    const {corridor} = corridorBetween([2, 2, null, NaN], RUNS);
    expect([...corridor]).toEqual([2]);
  });
});

describe("buildIdLookup / lookupRiverIndex", () => {
  it("sorts the axis and carries each id's position along", () => {
    // Axis order is topological, not ascending; position on the axis is the riverIndex.
    const {sortedIds, positions} = buildIdLookup(new Int32Array([50, 10, 40, 20, 30]));
    expect([...sortedIds]).toEqual([10, 20, 30, 40, 50]);
    expect([...positions]).toEqual([1, 3, 4, 2, 0]);
    const lookup = {sortedIds, positions};
    expect(lookupRiverIndex(lookup, 50)).toBe(0);
    expect(lookupRiverIndex(lookup, 30)).toBe(4);
    expect(lookupRiverIndex(lookup, "20")).toBe(3);
    expect(lookupRiverIndex(lookup, 25)).toBe(-1);
  });
  it("orders negative ids below positive ones", () => {
    const {sortedIds, positions} = buildIdLookup(new Int32Array([1, -2, 0]));
    expect([...sortedIds]).toEqual([-2, 0, 1]);
    const lookup = {sortedIds, positions};
    expect(lookupRiverIndex(lookup, -2)).toBe(1);
    expect(lookupRiverIndex(lookup, 1)).toBe(0);
  });
  it("reports each of the four radix passes", () => {
    const passes = [];
    buildIdLookup(new Int32Array([3, 1, 2]), (p) => passes.push(p));
    expect(passes).toEqual([1, 2, 3, 4]);
  });
});

describe("verifyIdLookup", () => {
  it("accepts a strictly ascending result of the expected length", () => {
    expect(() => verifyIdLookup(new Int32Array([1, 2, 3]), 3)).not.toThrow();
  });
  it("refuses a truncated download", () => {
    expect(() => verifyIdLookup(new Int32Array([1, 2]), 3)).toThrow(/expected 3/);
  });
  it("refuses duplicate ids", () => {
    expect(() => verifyIdLookup(new Int32Array([1, 2, 2]), 3)).toThrow(/strictly ascending/);
  });
});
