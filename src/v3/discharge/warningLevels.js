'use strict';

/**
 * Warning levels: the named discharge thresholds a forecast is read against, and the palette they
 * are read in.
 *
 * This lives beside the readers rather than in plots/ because a threshold is not a chart. It is the
 * meaning of a number — a reach's 50-year flood is the same 50-year flood in a hydrograph, in an
 * exceedance table, and in a printed report, and it has to be the same colour in all three or the
 * reader is being told two different things on one page. plots/thresholds.js draws these; nothing
 * here knows that charts exist, so a consumer computing exceedance statistics can have the levels
 * without pulling chart.js in behind them.
 *
 * Display text is deliberately absent. A level carries what it *is* — its key, its value, its
 * colour — and whoever renders it says what it is called, in whatever language they are in.
 */

// Ascending severity. Deliberately the v2 hydroviewer's return-period palette, in its order, so a
// 2/5/10/25/50/100-year set renders in the colours users already read as "yellow is a nuisance
// flood, violet is a catastrophe".
const SEVERITY_RAMP = [
  "rgb(254, 240, 1)",
  "rgb(253, 154, 1)",
  "rgb(255, 56, 5)",
  "rgb(255, 0, 0)",
  "rgb(128, 0, 106)",
  "rgb(128, 0, 246)"
];

// Sample the ramp by position so any number of levels spans the same yellow-to-violet range. With
// exactly six levels this is the identity, which is the common case (the standard return periods).
const rampColor = (i, n) => SEVERITY_RAMP[Math.round((i * (SEVERITY_RAMP.length - 1)) / Math.max(1, n - 1))];

const rgba = (rgb, a) => rgb.replace("rgb(", "rgba(").replace(")", `, ${a})`);

/**
 * A level's colour at a probability: its own hue, faint but visible where the chance is slight and
 * at full strength where it is certain. For heat-mapping an exceedance table, so that a 5% cell and
 * a 90% cell read as the same threshold at two weights rather than as two different thresholds.
 */
const levelTint = (color, probability) => rgba(color, (0.2 + 0.65 * Math.max(0, Math.min(1, probability))).toFixed(3));

// Enough digits to tell two thresholds apart without implying precision the fit doesn't have.
const formatLevelValue = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));

// Spelled out rather than left to Number(), which turns both null and "" into a real level at zero.
const toValue = (value) => (value === null || value === undefined || value === "" ? NaN : Number(value));

/**
 * Accept either shape and return one: levels ascending, each with the key it came in under, its
 * value, that value formatted, and its colour.
 *
 *   {2: 451.2, 5: 780.4, ...}                        return periods keyed by recurrence interval,
 *                                                    as the returnPeriods reader returns them —
 *                                                    `key` comes back as the number of years
 *   [{label: "Bankfull", value: 900, color: "..."}]  any other set of named warning levels —
 *                                                    `key` comes back as the label given
 *
 * Anything without a finite value is dropped rather than kept: a store with no fit for a reach
 * writes NaN, and a reach with no fit has no threshold to show.
 */
function normalizeLevels(input) {
  if (!input) return [];
  const raw = Array.isArray(input)
    ? input.map((lvl) => ({key: lvl.label, value: toValue(lvl.value), color: lvl.color}))
    : Object.entries(input).map(([years, value]) => ({key: Number(years), value: toValue(value)}));
  const levels = raw
    .filter((lvl) => Number.isFinite(lvl.value) && lvl.key !== undefined && lvl.key !== null)
    .sort((a, b) => a.value - b.value);
  return levels.map((lvl, i) => ({
    key: lvl.key,
    value: lvl.value,
    valueText: formatLevelValue(lvl.value),
    color: lvl.color ?? rampColor(i, levels.length)
  }));
}

export {SEVERITY_RAMP, formatLevelValue, levelTint, normalizeLevels, rampColor, rgba};
