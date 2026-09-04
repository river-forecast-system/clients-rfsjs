'use strict';

import forecastWithLevels from "./forecastWithLevels.js";
import retrospective from "./retrospective.js";

/**
 * Every reach in a list, forecast by forecast, in list order — the read behind a multi-river report.
 *
 * ── Why an iterator and not an array ──
 * A caller with a hundred reaches wants to start doing something with the first one long before the
 * hundredth lands, and wants to stop holding the first one's members once it has. Returning an array
 * of results forces the opposite: nothing happens until everything has arrived, and every ensemble
 * is in memory at once. So this yields, in list order, as results become available, while fetching
 * ahead of the consumer up to `concurrency`.
 *
 *   for await (const {index, river, forecast, returnPeriods, error} of forecastsForRivers({…}))
 *
 * ── Why a pool and not workers ──
 * This is network-bound, not CPU-bound. There is nothing for a worker thread to do between responses
 * that the event loop was not already doing, and a worker per request would be a separate module
 * instance: each one re-opening the forecast store, re-reading its metadata and time axis, and
 * sharing no chunk cache with the page's own reads. One pool on one thread means one store open for
 * the whole run and one cache, shared with everything else the app reads.
 *
 * ── Failure and cancellation ──
 * A reach that cannot be read is yielded with its `error` rather than throwing: one bad reach is a
 * line in the report that says so, not a report that does not exist. `signal` stops the pool
 * issuing anything new and ends the iteration; requests already in flight are left to settle into
 * the reader's cache, which is where they were going anyway.
 *
 * `onProgress({done, total})` fires as each *download* completes, which is ahead of what the
 * consumer has been handed — the two are different numbers and a caller showing both wants them so.
 *
 * `withRetrospective` adds each reach's simulated record to what is yielded, for a consumer that
 * needs to read the forecast against the river's own normal (see climatology.js). It is opt-in
 * because it is by far the largest read here — decades of daily values against a fortnight of
 * forecast — and most reports have no use for it. Like the thresholds, it is allowed to fail on its
 * own: a reach whose record cannot be read still yields its forecast.
 *
 * ── Reading through something else ──
 * `read` substitutes the two reads this makes, and exists for one caller: an app that keeps its own
 * copies of them. A browser client caching forecasts and records on the device has, per reach,
 * exactly the two calls below — but no way to put a cache in front of them from outside, because
 * everything that makes this worth calling (the pool, the ordering, the per-reach failure rule) is
 * in here. Without this it would have to reimplement the lot around its own readers, which is a
 * copy of this file that will drift from it.
 *
 *   read: {forecastWithLevels, retrospective}
 *
 * Either may be omitted and the package's own is used. A substitute is expected to answer what the
 * one it replaces answers; nothing here inspects the result beyond passing it on.
 */
export default async function* ({date, rivers, concurrency = 6, resolution = "hourly", withRetrospective = false, signal, onProgress, read}) {
  const total = rivers.length;
  if (!total) return;
  const readForecast = read?.forecastWithLevels ?? forecastWithLevels;
  const readRetrospective = read?.retrospective ?? retrospective;
  const settled = new Array(total);
  const waiters = new Array(total);
  // One slot per reach, resolved by the pool and awaited by the consumer. Written before it is read
  // when a download beats the consumer to it, which is the common case and the point of the pool.
  const ready = rivers.map((_, i) => new Promise((resolve) => (waiters[i] = resolve)));

  let done = 0;
  const finish = (i, value) => {
    settled[i] = value;
    done += 1;
    onProgress?.({done, total});
    waiters[i](value);
  };

  let next = 0;
  const worker = async () => {
    for (let i = next++; i < total; i = next++) {
      if (signal?.aborted) return finish(i, {index: i, river: rivers[i], aborted: true});
      const river = rivers[i];
      try {
        const [pair, retro] = await Promise.all([
          readForecast({date, riverIndex: river.riverIndex, riverId: river.riverId, resolution}),
          withRetrospective ? readRetrospective({riverIndex: river.riverIndex, riverId: river.riverId}).catch(() => null) : null
        ]);
        finish(i, {index: i, river, ...pair, retrospective: retro});
      } catch (error) {
        finish(i, {index: i, river, error});
      }
    }
  };
  // Not awaited: the consumer drives this loop, and awaiting the pool here would mean yielding
  // nothing until the last reach had landed — exactly what the iterator exists to avoid.
  void Promise.all(Array.from({length: Math.min(concurrency, total)}, worker));

  for (let i = 0; i < total; i += 1) {
    const result = await ready[i];
    if (signal?.aborted) return;
    yield result;
  }
}
