'use strict';

/**
 * The corridor a set of picked reaches implies, derived from the river index alone.
 *
 * riverIndex is a depth-first labelling of the network: everything upstream of a reach is a
 * contiguous run of indices ending at that reach's own, published beside it as `upstreamCount`. So
 * "is A downstream of B" is one comparison — B's index falls inside A's run — and every reach in
 * hand already carries what the comparison needs. That is the whole of the topology corridor
 * selection ever uses, which is why there is no graph to fetch for it: see runs.js, where a
 * watershed and an AOI are cut out of the same runs.
 *
 * A corridor is the smallest connected piece of river holding every pick: the union of the paths
 * from each pick down to the lowest reach they all sit under. Because the runs nest, the reaches
 * on those paths are exactly the runs that contain a pick and end no further down than that
 * lowest common one — no traversal, just a containment test per candidate.
 *
 * Picks with no common reach among the runs supplied are on a different river, and come back as
 * `detached` rather than being forced into the corridor.
 */

/** The runs holding `index`, innermost first. Runs containing a point nest, so ordering by where
 * they end orders them by size, and the first is the reach the pick landed on. */
const chainFor = (runs, index) =>
  runs.filter(r => r.lo <= index && index <= r.hi).sort((a, b) => a.hi - b.hi);

/** The nearest run in `chain` that holds every one of `indices`, or null if none does. */
const commonRun = (chain, indices) =>
  chain.find(r => indices.every(i => r.lo <= i && i <= r.hi)) ?? null;

/**
 * Group the picks by what they share, so several separate corridors are as answerable as one.
 *
 * Greedy, and that is not a compromise: a pick either sits under a run the group already sits
 * under or it does not, and with a handful of picks against a bounded corridor there is no
 * ordering that changes which river a reach is on.
 */
function group(picked, chains) {
  const groups = [];
  picked.forEach((pick, i) => {
    for (const g of groups) {
      const run = commonRun(chains[i], [...g.at.map(j => picked[j]), pick]);
      if (run) {
        g.at.push(i);
        g.run = run;
        return;
      }
    }
    groups.push({at: [i], run: null});
  });
  return groups;
}

/**
 * @param {Iterable<number>} clicks   riverIndex of each reach the user picked
 * @param {Iterable<{lo: number, hi: number}>} runs  every reach available to route through, as the
 *   run it covers; `hi` is the reach's own riverIndex. Reaches the caller has not loaded cannot be
 *   routed through, which is the one thing this does not know and the caller does.
 * @returns {{corridor: Set<number>, junctions: number[], detached: number[]}}
 */
export function corridorBetween(clicks, runs) {
  const picked = [...new Set(clicks)].filter(Number.isInteger);
  const corridor = new Set(picked);
  if (picked.length < 2) return {corridor, junctions: [], detached: picked};

  const all = [...runs];
  const chains = picked.map(c => chainFor(all, c));
  const junctions = [];
  const detached = [];

  for (const g of group(picked, chains)) {
    // One pick that met nothing else is not a corridor, only a reach — it stays selected (it is
    // already in `corridor`) and is reported so the caller can say why it is on its own.
    if (g.at.length < 2) {
      detached.push(picked[g.at[0]]);
      continue;
    }
    junctions.push(g.run.hi);
    for (const i of g.at) {
      // Innermost first, so the first run reaching past the junction ends the path down.
      for (const r of chains[i]) {
        if (r.hi > g.run.hi) break;
        corridor.add(r.hi);
      }
    }
  }
  return {corridor, junctions, detached};
}
