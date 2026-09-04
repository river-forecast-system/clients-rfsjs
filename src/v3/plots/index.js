'use strict';

// Chart rendering for the v3 discharge readers. Give it a host element, the object a reader
// returned, and a language code — the plots carry their own text (translations/) and read their
// own colours from the host's CSS custom properties (--rfs-chart-*, see shared.js), so a consuming
// app supplies neither strings nor a palette.
//
// Reached at the `client-rfs-js/v3/plots` subpath and only there — never from the root or from v3/index.js —
// so chart.js stays out of a bundle that only reads data, and the charting peers stay optional.

import {clearPlots, plotAllForecast, plotAllRetro, plotExceedanceProbabilities, plotFlowAnomaly, restyleCharts} from "./orchestrator.js";
import {availableLocales, useLocale} from "./translations/index.js";

export {
  // rendering
  plotAllRetro,
  plotAllForecast,
  // the bulletin's two extra figures, rendered one at a time into a host of their own
  plotExceedanceProbabilities,
  plotFlowAnomaly,
  clearPlots,
  // repaint live charts after a theme change, without refetching the series
  restyleCharts,
  // language
  availableLocales,
  useLocale
};
