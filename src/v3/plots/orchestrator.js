import {AXIS, GRID, refreshChartTheme, TEXT} from "./shared";
import {deriveRetro} from "./derive";
import {renderDailyTimeseries} from "./dailyTimeseries";
import {renderMonthlyStatus} from "./monthlyStatus";
import {renderFlowDurationCurve} from "./flowDurationCurve";
import {renderYearlyVolumes} from "./yearlyVolumes";
import {renderYearlyPeaks} from "./yearlyPeaks";
import {renderRasterHydrograph} from "./rasterHydrograph";
import {renderCumulativeVolume} from "./cumulativeVolume";
import {renderForecastHydrograph} from "./forecastHydrograph";
import {renderExceedanceProbabilities} from "./exceedanceProbabilities";
import {renderFlowAnomaly} from "./flowAnomaly";
import {useLocale} from "./translations";

let activeRetro = [];
let activeForecast = [];
// The bulletin charts are kept apart from the forecast's because a bulletin renders all three in
// turn: sharing one list would have each render destroy the one before it.
let activeExceedance = [];
let activeAnomaly = [];
const destroy = (list) => list.forEach((c) => c.destroy());

function clearPlots() {
  destroy(activeRetro);
  activeRetro = [];
  destroy(activeForecast);
  activeForecast = [];
  destroy(activeExceedance);
  activeExceedance = [];
  destroy(activeAnomaly);
  activeAnomaly = [];
}

// Theme colors are baked into each chart's options when it's constructed, so flipping the theme
// with charts already on screen leaves them in the old palette. Rather than re-rendering (which
// would refetch the series), walk the live instances and patch the colors in place. AXIS/GRID/TEXT
// are live ESM bindings, so they already hold the new values once refreshChartTheme() has run.
function restyleCharts() {
  const live = [...activeRetro, ...activeForecast, ...activeExceedance, ...activeAnomaly];
  // Read the new palette from a chart that is actually on screen, so any custom properties scoped
  // below :root apply. With nothing rendered there is nothing to restyle anyway.
  if (live.length === 0) return;
  refreshChartTheme(live[0].canvas);
  for (const c of live) {
    for (const scale of Object.values(c.options.scales ?? {})) {
      if (scale.title) scale.title.color = AXIS;
      if (scale.ticks) scale.ticks.color = AXIS;
      if (scale.grid) scale.grid.color = GRID;
    }
    const plugins = c.options.plugins ?? {};
    if (plugins.legend?.labels) plugins.legend.labels.color = TEXT;
    if (plugins.title) plugins.title.color = TEXT;
    c.update("none");
  }
}

function block(root) {
  const host = document.createElement("div");
  host.className = "plot-block";
  root.appendChild(host);
  return host;
}

/**
 * Render the retrospective charts into `root`.
 *
 * `lang` is a language code — "es", "en-GB", anything BCP-47-ish. The locale's chunk is fetched on
 * first use, which is why this is async; unknown codes and failed loads fall back to English rather
 * than rejecting. Callers hold no chart strings of their own: pass the code, get the language.
 */
async function plotAllRetro(root, ts, {lang} = {}) {
  await useLocale(lang);
  destroy(activeRetro);
  activeRetro = [];
  refreshChartTheme(root);
  root.innerHTML = "";
  const d = deriveRetro(ts);
  activeRetro.push(
    renderDailyTimeseries(block(root), ts),
    renderMonthlyStatus(block(root), d),
    renderFlowDurationCurve(block(root), d),
    renderYearlyVolumes(block(root), d),
    renderYearlyPeaks(block(root), d),
    renderRasterHydrograph(block(root), d),
    renderCumulativeVolume(block(root), d)
  );
}

/**
 * Render the forecast chart into `root`. `lang` behaves as in plotAllRetro.
 *
 * `returnPeriods` is the optional warning-level context drawn behind the ensemble — see
 * renderForecastHydrograph. It is a separate argument rather than a field on `fc` because it comes
 * from a separate reader (and a separate store): a caller that has one and not the other still
 * gets a chart. `levelsAs` picks the form they take, "boxes" or "lines".
 */
async function plotAllForecast(root, fc, {lang, returnPeriods, levelsAs} = {}) {
  await useLocale(lang);
  destroy(activeForecast);
  activeForecast = [];
  refreshChartTheme(root);
  root.innerHTML = "";
  activeForecast.push(renderForecastHydrograph(block(root), fc, {returnPeriods, levelsAs}));
}

/**
 * The share of the ensemble over each threshold through the forecast — see
 * discharge/alerts.js exceedanceOverTime(), whose output this takes. `probability` is the share an
 * alert was classified at, drawn as the decision line.
 */
async function plotExceedanceProbabilities(root, series, {lang, probability} = {}) {
  await useLocale(lang);
  destroy(activeExceedance);
  activeExceedance = [];
  refreshChartTheme(root);
  root.innerHTML = "";
  activeExceedance.push(renderExceedanceProbabilities(block(root), series, {probability}));
}

/**
 * The forecast's departure from the retrospective record's normal for the time of year — see
 * discharge/climatology.js flowAnomaly(), whose output this takes.
 */
async function plotFlowAnomaly(root, anomaly, {lang} = {}) {
  await useLocale(lang);
  destroy(activeAnomaly);
  activeAnomaly = [];
  refreshChartTheme(root);
  root.innerHTML = "";
  activeAnomaly.push(renderFlowAnomaly(block(root), anomaly));
}

export {
  clearPlots,
  plotExceedanceProbabilities,
  plotFlowAnomaly,
  plotAllForecast,
  plotAllRetro,
  restyleCharts
};
