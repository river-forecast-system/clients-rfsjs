'use strict';

/**
 * The riverId -> riverIndex lookup, as pure arithmetic.
 *
 * The metadata store's riverId axis is in topological order — a hydrologically meaningful
 * ordering, not ascending id — so a reach's position in it IS its riverIndex, but the array cannot
 * be searched by id as downloaded. The permutation is real information and has to be built once:
 *
 *   sortedIds   Int32Array(N)    ids ascending
 *   positions   Uint32Array(N)   positions[k] = axis position of sortedIds[k]
 *
 * Binary search sortedIds, read the answer out of positions. Nothing about the store needs to
 * change for this; the ordering is not going to become ascending and the client absorbs it once.
 *
 * Fetching the axis (fetchMetadataArray), caching the built arrays, and threading are the
 * caller's business — these three functions are the arithmetic between them.
 */

/**
 * Build the lookup from the riverId axis, downloaded in axis order.
 *
 * LSD radix, four passes over the four bytes of an int32. sort() with a comparator would be
 * millions of JS calls and the GC churn to match — seconds of jank even off the main thread.
 * This allocates once and touches each element four times.
 *
 * The most significant pass XORs its bucket by 0x80, which maps negative ids below positive ones
 * and makes the result correct for any int32 rather than only the positive ones today's ids
 * happen to be. Free: it is an XOR by zero on the other three passes.
 *
 * `ids` is consumed as scratch — the caller must not hold on to it after this.
 * onPass(pass) fires after each of the four passes, for progress reporting.
 */
function buildIdLookup(ids, onPass) {
  const n = ids.length;
  let keysIn = ids;
  let valsIn = new Uint32Array(n);
  // Identity to start: a reach's position on the axis is its riverIndex, so this is the payload
  // the sort carries along and permutes.
  for (let i = 0; i < n; i++) valsIn[i] = i;
  let keysOut = new Int32Array(n);
  let valsOut = new Uint32Array(n);
  const counts = new Uint32Array(256);

  for (let shift = 0, pass = 0; shift < 32; shift += 8, pass++) {
    const flip = shift === 24 ? 0x80 : 0;
    counts.fill(0);
    for (let i = 0; i < n; i++) counts[(((keysIn[i] >>> shift) & 0xFF) ^ flip)]++;
    let sum = 0;
    for (let b = 0; b < 256; b++) {
      const c = counts[b];
      counts[b] = sum;
      sum += c;
    }
    for (let i = 0; i < n; i++) {
      const key = keysIn[i];
      const at = counts[(((key >>> shift) & 0xFF) ^ flip)]++;
      keysOut[at] = key;
      valsOut[at] = valsIn[i];
    }
    const tk = keysIn;
    keysIn = keysOut;
    keysOut = tk;
    const tv = valsIn;
    valsIn = valsOut;
    valsOut = tv;
    onPass?.(pass + 1);
  }
  // Four passes is an even number of swaps, so the result lands back in the arrays that came in.
  return {sortedIds: keysIn, positions: valsIn};
}

/**
 * Refuse a lookup built from a bad download. A truncated or reordered axis is otherwise
 * undetectable downstream: every index it yields is a plausible row number, and the discharge
 * readers echo back no riverId to contradict it.
 */
function verifyIdLookup(sortedIds, expectedLength) {
  if (sortedIds.length !== expectedLength) {
    throw new Error(`sorted ${sortedIds.length} ids, expected ${expectedLength}`);
  }
  for (let i = 1; i < sortedIds.length; i++) {
    if (sortedIds[i] <= sortedIds[i - 1]) {
      throw new Error(`ids are not strictly ascending at ${i} (${sortedIds[i - 1]} then ${sortedIds[i]}) — the download is corrupt or the store has duplicate river ids`);
    }
  }
}

/**
 * The reach's position on the zarr riverId axis, or -1 if the id is not in the network.
 *
 * ~23 probes over a contiguous typed array. The read this precedes costs five orders of magnitude
 * more, which is why a fancier structure than a sorted array would buy nothing.
 */
function lookupRiverIndex({sortedIds, positions}, riverId) {
  const target = Number(riverId);
  let lo = 0;
  let hi = sortedIds.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const value = sortedIds[mid];
    if (value === target) return positions[mid];
    if (value < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

export {buildIdLookup, lookupRiverIndex, verifyIdLookup};
