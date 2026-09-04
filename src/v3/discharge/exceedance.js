'use strict';

import {levelTint, normalizeLevels} from "./warningLevels.js";

/**
 * How likely the ensemble is to pass each of a reach's warning levels, day by day.
 *
 * This is the number a forecast report is actually built on: not "what will the river do" but "how
 * many of the members say it goes over the line, and when". It is derived from the members rather
 * than from the median or the spread, because that is the only series that can answer it — a
 * percentile band tells you where the middle of the ensemble is, not how much of it is above a
 * threshold.
 */

const utcDayKey = (d) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;

/**
 * Each member's maximum within each UTC day of the forecast, as `{days, maxima}` — `days` the first
 * timestamp seen in each day, `maxima` one Float64Array per member indexed by day.
 *
 * Grouped off the time axis itself rather than by assuming a step. A fixed "eight steps to the day"
 * is only true while the forecast is published three-hourly, and a wrong assumption there does not
 * fail loudly: it silently mislabels every column and folds two days into one.
 */
function dailyMemberMaxima({time, discharge}) {
  const days = [];
  const column = new Map();
  const columnOf = time.map((d) => {
    const key = utcDayKey(d);
    if (!column.has(key)) {
      column.set(key, days.length);
      days.push(d);
    }
    return column.get(key);
  });
  const maxima = discharge.map((member) => {
    const row = new Float64Array(days.length).fill(-Infinity);
    for (let i = 0; i < member.length; i += 1) {
      const v = member[i];
      const c = columnOf[i];
      if (Number.isFinite(v) && v > row[c]) row[c] = v;
    }
    return row;
  });
  return {days, maxima};
}

/**
 * The exceedance table for one reach, or null when it has no thresholds to be read against.
 *
 * `forecast` is what the forecast reader returned — the member series and the time axis; `levels`
 * is what the returnPeriods reader returned, or any other set of named thresholds (see
 * normalizeLevels). The result is:
 *
 *   {days: [Date], members: Number, rows: [{key, value, valueText, color, probs: [Number], tints: [String]}]}
 *
 * one row per level ascending, `probs[i]` the share of members whose maximum on `days[i]` passes it.
 * `tints` is the same row as colours, ready to paint a heat map with; it is precomputed rather than
 * left to the caller so that the table and the hydrograph beside it cannot end up in two palettes.
 */
function dailyExceedance({forecast, levels}) {
  const normalized = normalizeLevels(levels);
  if (!normalized.length) return null;

  const {days, maxima} = dailyMemberMaxima(forecast);
  const members = maxima.length;
  if (!members) return null;

  const rows = normalized.map((level) => {
    const probs = days.map((_, c) => maxima.reduce((n, m) => n + (m[c] > level.value ? 1 : 0), 0) / members);
    return {...level, probs, tints: probs.map((p) => (p > 0 ? levelTint(level.color, p) : null))};
  });
  return {days, members, rows};
}

/**
 * The worst thing the table says: the highest level anything in the ensemble is forecast to pass,
 * and the best chance it is given on any day — `{level, chance}`, or null if nothing is passed.
 *
 * The highest rather than the most likely, because that is the question somebody scanning a list of
 * rivers is asking. A 3% chance of a 100-year flood is what they need to see, and it would be
 * buried by a 90% chance of the 2-year flood underneath it.
 */
function worstExceedance(table) {
  let worst = null;
  for (const row of table?.rows ?? []) {
    const chance = row.probs.reduce((m, p) => (p > m ? p : m), 0);
    if (chance > 0) worst = {level: row, chance};
  }
  return worst;
}

export {dailyExceedance, dailyMemberMaxima, worstExceedance};
