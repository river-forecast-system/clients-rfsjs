'use strict';

import forecast from "./forecast.js";
import returnPeriods from "./returnPeriods.js";

/**
 * A reach's ensemble forecast together with the warning levels it is meant to be read against.
 *
 * They live in different stores, so this is two reads issued together rather than one — and the
 * second is allowed to fail. Return periods are *context* for a forecast, not part of it: a reach
 * the Gumbel fit has no values for, or a threshold store that is unreachable, costs the bands and
 * not the hydrograph. Every consumer wants that rule and none of them should have to write it, which
 * is the whole reason this composite exists rather than each app pairing the two reads itself.
 *
 *   {forecast: {riverIndex, riverId, time, discharge, stats}, returnPeriods: {…} | null}
 *
 * `riverId` is echoed onto the forecast when it is given, because the readers only return one when
 * you query by id and everything downstream — a chart title, a report's summary row — names the
 * reach from it. Pass both `riverIndex` and `riverId` where both are known: the index is what the
 * stores are addressed by, and passing it means neither read scans the riverId axis to find it.
 */
export default async function ({date, riverIndex, riverId, resolution = "hourly"}) {
  const [fc, rp] = await Promise.all([
    forecast({date, riverIndex, riverId}),
    returnPeriods({riverIndex, riverId, resolution}).catch(() => null)
  ]);
  return {forecast: {...fc, riverId: riverId ?? fc.riverId}, returnPeriods: rp};
}
