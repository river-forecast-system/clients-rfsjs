import {t} from "./translations";
import {AXIS, Chart, chartCanvas, GRID, TEXT} from "./shared";

// Wet and dry rather than good and bad: a departure from normal has a sign and no opinion.
const ABOVE = "rgb(37, 99, 235)";
const BELOW = "rgb(180, 83, 9)";

/**
 * The forecast's daily mean flow against what that calendar day normally carries.
 *
 * Bars rather than a line, because each value is a whole day's departure and not a reading at an
 * instant, and because a bar chart around zero shows the sign of the thing at a glance — which is
 * the entire point of plotting an anomaly instead of the flow itself.
 */
function renderFlowAnomaly(host, anomaly) {
  const canvas = chartCanvas(host);
  const values = anomaly.anomaly;
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: anomaly.time.map((d) => d),
      datasets: [{
        label: t("series.flowAnomaly"),
        data: values,
        backgroundColor: values.map((v) => (v >= 0 ? ABOVE : BELOW)),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {display: false},
        title: {display: true, color: TEXT, text: t("chart.flowAnomaly")},
        tooltip: {
          callbacks: {
            label: (it) => ` ${it.parsed.y >= 0 ? "+" : ""}${it.parsed.y.toFixed(2)} m³/s`
          }
        }
      },
      scales: {
        x: {
          type: "time",
          time: {unit: "day", displayFormats: {day: "MMM d"}},
          offset: true,
          title: {display: true, text: t("axis.datetime"), color: AXIS},
          ticks: {color: AXIS, maxRotation: 0},
          grid: {color: GRID}
        },
        y: {
          title: {display: true, text: t("axis.flowAnomaly"), color: AXIS},
          ticks: {color: AXIS},
          grid: {color: GRID}
        }
      }
    }
  });
}

export {renderFlowAnomaly};
