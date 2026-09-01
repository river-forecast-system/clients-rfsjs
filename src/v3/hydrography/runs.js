'use strict';

/**
 * Arithmetic over riverIndex runs — topology selection without a graph.
 *
 * riverIndex is a depth-first labelling of the network: everything upstream of a reach is a
 * contiguous run of indices ending at that reach's own, and the hydrography publishes the run's
 * length beside each reach as `upstreamCount` (the streams tiles carry both as properties, and the
 * metadata store answers the same numbers by index). So a watershed is one run, "is A downstream
 * of B" is one containment test, and an area of interest is a run with runs cut out of it — no
 * graph to fetch or walk. corridor.js answers the one further question (the smallest piece of
 * river holding a set of reaches) from the same runs.
 */

/** The run everything upstream of a reach occupies, `{lo, hi, count}` — `hi` is the reach's own
 * riverIndex and the count includes it. */
export function upstreamRange({riverIndex, upstreamCount}) {
  // Number(null) is 0 and riverIndex 0 is a real reach, so a missing value must not coerce into
  // silently selecting it.
  if (riverIndex == null || upstreamCount == null) {
    throw new Error("upstreamRange requires riverIndex and upstreamCount");
  }
  const hi = Number(riverIndex);
  const n = Number(upstreamCount);
  if (!Number.isInteger(hi) || hi < 0) throw new Error(`riverIndex ${riverIndex} is not an index`);
  if (!Number.isInteger(n) || n < 0) throw new Error(`upstreamCount ${upstreamCount} is not a count`);
  return {lo: hi - n, hi, count: n + 1};
}

/** The number of reaches a list of disjoint runs covers. */
export const spanCount = spans => spans.reduce((n, s) => n + s.hi - s.lo + 1, 0);

/** Is `run` a different reach downstream of `of`? `of` is upstream exactly when its own index
 * (`of.hi`) falls inside `run`, and a different reach when `run` ends further down than it. */
export const isDownstreamOf = (run, of) =>
  !!of && run.lo <= of.hi && of.hi < run.hi;

/** `spans` minus `cut`, both sorted and disjoint, and disjoint and sorted on the way out. */
export function subtractSpans(spans, cut) {
  const out = [];
  for (const s of spans) {
    if (cut.hi < s.lo || cut.lo > s.hi) {
      out.push(s);
      continue;
    }
    if (cut.lo > s.lo) out.push({lo: s.lo, hi: cut.lo - 1});
    if (cut.hi < s.hi) out.push({lo: cut.hi + 1, hi: s.hi});
  }
  return out;
}

/**
 * The disjoint runs an outlet's watershed keeps once each inlet takes away itself and everything
 * that drains to it — an area of interest: "everything that drains to here, except what came in
 * from up there". Empty without an outlet; an inlet that cuts nothing new leaves the spans as
 * they were, which is how a caller can tell a redundant inlet from a real one.
 */
export function aoiSpans(outlet, inlets) {
  if (!outlet) return [];
  let spans = [{lo: outlet.lo, hi: outlet.hi}];
  for (const inlet of inlets) spans = subtractSpans(spans, {lo: inlet.lo, hi: inlet.hi});
  return spans;
}
