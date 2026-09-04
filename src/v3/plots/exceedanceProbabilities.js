import {t} from "./translations";
import {AXIS, Chart, chartCanvas, GRID, TEXT} from "./shared";

/**
 * How much of the ensemble is over each threshold, through the forecast.
 *
 * One line per warning level in that level's own colour, so the chart is read against the
 * hydrograph beside it without a second legend to learn. The y-axis is pinned to 0–100 rather than
 * fitted: a reach where nothing gets near a threshold has to *look* like nothing got near a
 * threshold, and an auto-scaled axis would redraw a 2% blip as a mountain.
 *
 * `probability` draws the decision line an alert was classified against (see classifyByEnsemble),
 * so a reader can see which crossings counted and which were below the bar.
 */
function renderExceedanceProbabilities(host, series, {probability = 0.3} = {}) {
  const canvas = chartCanvas(host);
  const x = series.time;
  return new Chart(canvas, {
    type: "line",
    data: {
      datasets: [
        ...series.rows.map((row) => ({
          label: `${row.key}`,
          data: x.map((d, i) => ({x: d.getTime(), y: row.probs[i] * 100})),
          parsing: false,
          borderColor: row.color,
          backgroundColor: row.color,
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 6,
          tension: 0.2
        })),
        {
          label: t("series.alertThreshold"),
          data: [{x: x[0]?.getTime(), y: probability * 100}, {x: x[x.length - 1]?.getTime(), y: probability * 100}],
          parsing: false,
          borderColor: AXIS,
          borderWidth: 1,
          borderDash: [5, 4],
          pointRadius: 0,
          pointHitRadius: 0,
          order: 10
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {mode: "index", axis: "x", intersect: false},
      plugins: {
        legend: {position: "right", labels: {color: TEXT, boxWidth: 12, font: {size: 11}}},
        title: {display: true, color: TEXT, text: t("chart.exceedanceProbabilities")},
        tooltip: {
          callbacks: {
            title: (items) => new Date(items[0].parsed.x).toISOString().slice(0, 16).replace("T", " ") + " UTC",
            label: (it) => ` ${it.dataset.label}: ${it.parsed.y.toFixed(0)}%`
          }
        }
      },
      scales: {
        x: {
          type: "time",
          time: {unit: "day", displayFormats: {day: "MMM d"}},
          title: {display: true, text: t("axis.datetime"), color: AXIS},
          ticks: {color: AXIS, maxRotation: 0},
          grid: {color: GRID}
        },
        y: {
          min: 0,
          max: 100,
          title: {display: true, text: t("axis.membersExceeding"), color: AXIS},
          ticks: {color: AXIS, callback: (v) => `${v}%`},
          grid: {color: GRID}
        }
      }
    }
  });
}

export {renderExceedanceProbabilities};
