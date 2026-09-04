'use strict';

import {normalizeLevels} from "./warningLevels.js";

/**
 * Turning a forecast into an alert: how much of the ensemble is over which threshold, when, and
 * what that adds up to as a single word for the top of a bulletin.
 *
 * Two readings are taken, because they answer different questions and a bulletin that gave only one
 * of them would be misleading in opposite directions. The *ensemble* reading asks how much of the
 * spread crosses a threshold at any point — it catches a flood that most members see coming even
 * where the middle of the distribution stays under the line. The *median* reading asks whether the
 * central forecast itself crosses — it catches the case the ensemble test understates, where the
 * whole distribution has moved up but no single threshold is passed by enough members at once. The
 * alert is the worse of the two, because either one being high is a reason to look.
 *
 * Neither is a probability of flooding. They are statements about a model's spread, and the wording
 * a consumer wraps them in should say so.
 */

// The four bands a reach can be in. Named by severity rather than by colour so that the vocabulary
// survives a repaint; the colours are the ones the v2 bulletin used, kept so the two read alike.
const ALERT_BANDS = ["none", "low", "moderate", "high"];
const ALERT_COLORS = {
  none: "#228B22",
  low: "#DAA520",
  moderate: "#FF8C00",
  high: "#CC0000"
};
const rank = (band) => ALERT_BANDS.indexOf(band);

/**
 * Which band passing level `i` of `n` puts a reach in.
 *
 * Everything from the middle of the set upward is the top band, the lowest threshold alone is the
 * bottom band, and what is left is in between. For the standard six return periods that is
 * 2 → low, 5 and 10 → moderate, 25/50/100 → high, which is the mapping the v2 bulletin hard-coded
 * by year; expressed by position it keeps working for a set of thresholds that is not those six.
 */
const alertBand = (i, n) => (i === 0 ? "low" : i >= n / 2 ? "high" : "moderate");

/**
 * The share of ensemble members over each threshold at each timestep.
 *
 *   {time: [Date], members: Number, rows: [{key, value, valueText, color, band, probs: [Number]}]}
 *
 * Per timestep, not per day — this is the series a bulletin plots, and collapsing it to daily
 * maxima first (as the exceedance *table* does, see exceedance.js) would flatten exactly the shape
 * a reader is looking at it for. Returns null when the reach has no thresholds.
 */
function exceedanceOverTime({forecast, levels}) {
  const normalized = normalizeLevels(levels);
  const members = forecast?.discharge?.length ?? 0;
  if (!normalized.length || !members) return null;
  const time = forecast.time;
  const rows = normalized.map((level, i) => ({
    ...level,
    band: alertBand(i, normalized.length),
    probs: time.map((_, t) => forecast.discharge.reduce((n, m) => n + (m[t] > level.value ? 1 : 0), 0) / members)
  }));
  return {time, members, rows};
}

/**
 * The ensemble reading: the highest threshold that at least `probability` of the members cross at
 * some point, with the best share it reaches and when.
 *
 * `{band, level, chance, at}` or null if nothing is crossed by enough of the ensemble. The default
 * of 30% is the v2 bulletin's: low enough that a minority signal is not thrown away, high enough
 * that one or two stray members do not raise an alert.
 */
function classifyByEnsemble(series, {probability = 0.3} = {}) {
  let worst = null;
  for (const row of series?.rows ?? []) {
    let best = 0;
    let at = null;
    row.probs.forEach((p, i) => {
      if (p > best) {
        best = p;
        at = series.time[i];
      }
    });
    if (best >= probability) worst = {band: row.band, level: row, chance: best, at};
  }
  return worst;
}

/**
 * The median reading: the highest threshold the ensemble median actually reaches, the flow it
 * reaches there, and when. `{band, level, peak, at}`, or null if it stays under everything.
 */
function classifyByMedian({forecast, levels}) {
  const normalized = normalizeLevels(levels);
  const median = forecast?.stats?.median ?? [];
  if (!normalized.length || !median.length) return null;
  let peak = -Infinity;
  let at = null;
  median.forEach((v, i) => {
    if (Number.isFinite(v) && v > peak) {
      peak = v;
      at = forecast.time?.[i] ?? null;
    }
  });
  if (!Number.isFinite(peak)) return null;
  let worst = null;
  normalized.forEach((level, i) => {
    if (peak >= level.value) worst = {band: alertBand(i, normalized.length), level, peak, at};
  });
  return worst;
}

/** The worse of any number of readings, as a band — "none" when they all came back empty. */
function worstAlert(...alerts) {
  let band = "none";
  for (const alert of alerts) {
    if (alert && rank(alert.band) > rank(band)) band = alert.band;
  }
  return {band, color: ALERT_COLORS[band]};
}

export {ALERT_BANDS, ALERT_COLORS, alertBand, classifyByEnsemble, classifyByMedian, exceedanceOverTime, worstAlert};
