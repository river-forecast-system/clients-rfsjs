'use strict';

import {tf} from "./translations";
import {rgba} from "./shared";
import {normalizeLevels as toLevels} from "../discharge/warningLevels";

/**
 * Warning levels drawn across a hydrograph — return periods, or any other set of named discharge
 * thresholds — as shaded boxes or as horizontal lines.
 *
 * They are datasets rather than something painted underneath the chart, so every level is always on
 * the chart and in its legend, and showing or hiding one is the ordinary legend click it looks like.
 * Two consequences worth knowing: a hidden dataset is left out of the axis calculation, so revealing
 * a level well above the forecast grows the y-axis to reach it on its own; and each level is one
 * dataset in both forms, since a box is a line filled to the next level's value rather than a pair
 * of series with a fill between them.
 *
 * Which of the two forms is not a control this package offers. It is a standing preference of the
 * app the charts are rendered into — one that outlives any single chart — so it arrives as an
 * argument and the consuming app is the one that remembers it.
 */

/**
 * Give each level the words a chart shows it under.
 *
 * The levels themselves — which ones there are, in what order, at what value, in what colour — are
 * discharge/warningLevels.js's, because a threshold means the same thing whether it is drawn on a
 * hydrograph or counted in an exceedance table, and the two must not be able to disagree about it.
 * What is added here is display text and only display text: a recurrence interval becomes
 * "5-year" in the reader's language, and the legend entry pairs that with the discharge.
 */
function normalizeLevels(input) {
  return toLevels(input).map((lvl) => {
    const label = typeof lvl.key === "number" ? tf("label.returnPeriodYears", {n: lvl.key}) : String(lvl.key);
    return {...lvl, label, text: `${label} · ${lvl.valueText}`};
  });
}

/**
 * Whether the levels come up shown or hidden.
 *
 * The test is the ensemble median against 90% of the lowest level: a forecast that gets that close
 * to its smallest threshold is one where the thresholds are the point of looking. Below it they
 * stay hidden — a river spends most of its life far under its 2-year flood, and a band painted
 * across every hydrograph that never approaches one teaches people to ignore the bands on the
 * hydrographs that do. Hidden, not absent: they are still in the legend, one click away.
 *
 * The median rather than the ensemble maximum, because a single member brushing a threshold is not
 * the forecast saying so.
 */
const APPROACH_FRACTION = 0.9;
const levelsVisibleByDefault = (levels, medianPeak) =>
  levels.length > 0 && Number.isFinite(medianPeak) && medianPeak >= levels[0].value * APPROACH_FRACTION;

/**
 * How a level is drawn in each form. A box is the level's own line filled up to the next level's
 * value — so the band is bounded by the two thresholds it lies between, and the topmost one runs to
 * the top of the scale, there being no bound above the largest threshold. `above` and `below` are
 * both set because which side of the target the line falls on is not worth reasoning about.
 */
function modeStyle(lvl, i, levels, mode) {
  if (mode === "lines") {
    return {fill: false, borderColor: lvl.color, borderWidth: 1.5, borderDash: [6, 4], backgroundColor: undefined};
  }
  const next = levels[i + 1];
  const band = rgba(lvl.color, 0.3);
  return {
    fill: next ? {target: {value: next.value}, above: band, below: band} : {target: "end", above: band, below: band},
    borderColor: lvl.color,
    borderWidth: 0,
    borderDash: [],
    backgroundColor: band
  };
}

/**
 * One dataset per level, spanning the full x-range at a constant y.
 *
 * `rfsLevel` marks them for the tooltip to skip: they carry two points rather than one per
 * timestep, so in the chart's index interaction mode they would otherwise appear in the tooltip at
 * the first and last steps and nowhere else.
 */
function levelDatasets(levels, {mode, firstX, lastX, hidden}) {
  return levels.map((lvl, i) => ({
    label: lvl.text,
    data: [{x: firstX, y: lvl.value}, {x: lastX, y: lvl.value}],
    parsing: false,
    hidden,
    rfsLevel: true,
    // Chart.js draws the highest order first, which puts these behind the forecast they are context
    // for. Both forms are translucent anyway; this keeps the ensemble median on top of them.
    order: 10,
    pointRadius: 0,
    pointHitRadius: 0,
    tension: 0,
    ...modeStyle(lvl, i, levels, mode)
  }));
}

export {
  levelDatasets,
  levelsVisibleByDefault,
  normalizeLevels
};
