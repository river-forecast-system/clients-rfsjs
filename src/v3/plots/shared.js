import {BarController, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale, LineController, LineElement, PointElement, TimeScale, Title, Tooltip} from "chart.js";
import "chartjs-adapter-date-fns";
import {MONTH_START_DOY} from "./derive";
import {t} from "./translations";

Chart.register(LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, TimeScale, Filler, Legend, Tooltip, Title);
Chart.defaults.plugins.title.font = {...Chart.defaults.plugins.title.font, size: 18};
Chart.defaults.plugins.legend.position = "right";
Chart.defaults.scale.title.font = {size: 14, weight: "bold"};
// Legend markers read by dataset shape instead of the default outlined box: a line series shows a
// short line in its own colour/width/dash, a filled band (fill + no border) shows a filled square,
// and a scatter series keeps its point marker. Centralized here so every chart's legend matches.
Chart.defaults.plugins.legend.labels.usePointStyle = true;
const baseGenerateLabels = Chart.defaults.plugins.legend.labels.generateLabels;
if (typeof baseGenerateLabels === "function") {
  Chart.defaults.plugins.legend.labels.generateLabels = (chart) => {
    const items = baseGenerateLabels(chart);
    for (const item of items) {
      const ds = chart.data.datasets[item.datasetIndex];
      if (!ds) continue;
      if (ds.type === "scatter" || ds.showLine === false) continue; // keep the point marker
      if (Boolean(ds.fill) && ds.fill !== false && !ds.borderWidth) {
        item.pointStyle = "rect"; // filled band → filled square
      } else {
        item.pointStyle = "line"; // line series → line in its own colour/width/dash
        item.strokeStyle = ds.borderColor;
        item.lineWidth = ds.borderWidth || 2;
        item.lineDash = ds.borderDash || [];
      }
    }
    return items;
  };
}
// A chart is a <canvas>, so a stylesheet cannot reach its axes, gridlines or labels — every colour
// has to arrive as a JS value at draw time. Rather than keeping a palette here (which was a
// hand-copied duplicate of style.css, and had already drifted between the two themes), read the
// host's CSS custom properties at render time. The stylesheet stays the single source of truth and
// nothing here needs to know what a theme is: --rfs-chart-* is defined per theme in CSS, so a
// theme flip is picked up by the next refreshChartTheme() with no theme logic in this file.
//
// The fallbacks below are the neutral dark palette, used only when there is no DOM to read from —
// under vitest, or if a caller renders into a detached node. They keep the plots headless-safe
// rather than throwing.
const FALLBACK_AXIS = "#94a3b8";
const FALLBACK_GRID = "rgba(148,163,184,.12)";
const FALLBACK_TEXT = "#e2e8f0";

let AXIS = FALLBACK_AXIS;
let GRID = FALLBACK_GRID;
let TEXT = FALLBACK_TEXT;

/**
 * Re-read the chart palette from CSS. `host` is the element the charts are rendered into; custom
 * properties inherit, so reading from it picks up anything scoped below :root. It must be attached
 * to the document — getComputedStyle on a detached node returns empty strings, which fall back.
 * Call before constructing charts (the colours are baked into each chart's options) and again when
 * the theme changes — see restyleCharts() in orchestrator.js.
 */
function refreshChartTheme(host) {
  const el = host ?? (typeof document === "undefined" ? null : document.documentElement);
  if (!el || typeof getComputedStyle !== "function") {
    AXIS = FALLBACK_AXIS;
    GRID = FALLBACK_GRID;
    TEXT = FALLBACK_TEXT;
    return;
  }
  const cs = getComputedStyle(el);
  const read = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  AXIS = read("--rfs-chart-axis", FALLBACK_AXIS);
  GRID = read("--rfs-chart-grid", FALLBACK_GRID);
  TEXT = read("--rfs-chart-text", FALLBACK_TEXT);
}

const VIRIDIS5 = ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"];
const VIRIDIS7 = ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#bddf26", "#fde725"];
const rgba = (rgb, a) => rgb.replace("rgb(", "rgba(").replace(")", `, ${a})`);
const axis = (text, opts = {}) => ({
  title: {display: true, text, color: AXIS},
  ticks: {color: AXIS},
  grid: {color: GRID},
  ...opts
});
const commonPlugins = (title, legend = true) => ({
  legend: {display: legend, labels: {color: TEXT, boxWidth: 12, font: {size: 11}}},
  title: {display: true, text: title, color: TEXT}
});
const doyMonthAxis = () => ({
  type: "linear",
  min: 0.5,
  max: 366.5,
  afterBuildTicks: (a) => {
    a.ticks = MONTH_START_DOY.map((value) => ({value}));
  },
  ticks: {color: AXIS, callback: (v) => t("months")[MONTH_START_DOY.indexOf(Number(v))] ?? ""},
  grid: {color: GRID}
});

function chartCanvas(host) {
  const wrap = document.createElement("div");
  wrap.className = "chart-canvas";
  const canvas = document.createElement("canvas");
  wrap.appendChild(canvas);
  host.appendChild(wrap);
  return canvas;
}

export {
  AXIS,
  Chart,
  GRID,
  TEXT,
  VIRIDIS5,
  VIRIDIS7,
  axis,
  chartCanvas,
  commonPlugins,
  doyMonthAxis,
  refreshChartTheme,
  rgba
};
