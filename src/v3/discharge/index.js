'use strict';

// retrieval
import forecast from "./forecast.js";
import forecastWithLevels from "./forecastWithLevels.js";
import forecastsForRivers from "./forecastsForRivers.js";
import forecastsBulk from "./forecastsBulk.js";
import retrospective from "./retrospective.js";
import returnPeriods from "./returnPeriods.js";
import maximums from "./maximums.js";
// processing
import membersToStats from "./membersToStats.js";
import membersToMedian from "./membersToMedian.js";
import {dailyExceedance, dailyMemberMaxima, worstExceedance} from "./exceedance.js";
import {ALERT_BANDS, ALERT_COLORS, alertBand, classifyByEnsemble, classifyByMedian, exceedanceOverTime, worstAlert} from "./alerts.js";
import {dayOfYearMeans, flowAnomaly} from "./climatology.js";
import {SEVERITY_RAMP, formatLevelValue, levelTint, normalizeLevels, rampColor} from "./warningLevels.js";

export {
  forecast,
  forecastWithLevels,
  forecastsForRivers,
  forecastsBulk,
  retrospective,
  returnPeriods,
  maximums,
  membersToStats,
  membersToMedian,
  dailyExceedance,
  dailyMemberMaxima,
  worstExceedance,
  // flood alerts — the ensemble and median readings a bulletin is headed with
  exceedanceOverTime,
  classifyByEnsemble,
  classifyByMedian,
  worstAlert,
  alertBand,
  ALERT_BANDS,
  ALERT_COLORS,
  // the retrospective record as a normal year, and the forecast's departure from it
  dayOfYearMeans,
  flowAnomaly,
  // warning levels — the thresholds a forecast is read against, and the palette they share with
  // the hydrograph that draws them (see plots/thresholds.js)
  normalizeLevels,
  levelTint,
  formatLevelValue,
  rampColor,
  SEVERITY_RAMP
};
