'use strict';

// English is the base locale and the fallback for every other one. It is the only locale imported
// statically — see index.js — so a consumer that never switches language pays for this file alone.
// Every other locale is merged over this one, so a partial translation is legal: missing keys fall
// back to English rather than rendering a raw key.

export default {
  // chart titles. The two with {riverId} are rendered with tf() rather than t().
  "chart.cumulativeVolume": "Cumulative annual volume",
  "chart.dailyTimeseries": "Retrospective daily discharge · river {riverId}",
  "chart.flowDurationCurve": "Flow duration curve",
  "chart.forecastHydrograph": "15-day ensemble forecast · river {riverId}",
  "chart.monthlyStatus": "Monthly flow status",
  "chart.rasterHydrograph": "Raster hydrograph",
  "chart.yearlyPeaks": "Yearly peak discharge",
  "chart.yearlyVolumes": "Yearly volumes",

  // axis titles
  "axis.cumulativeVolume": "Cumulative volume (Mm³)",
  "axis.datetime": "Datetime (UTC+00:00)",
  "axis.dayOfPeak": "Day of peak",
  "axis.dayOfYear": "Day of year",
  "axis.discharge": "Discharge (m³/s)",
  "axis.flow": "Flow (m³/s)",
  "axis.month": "Month",
  "axis.percentile": "Percentile (%)",
  "axis.volume": "Volume (m³ × 10⁶)",
  "axis.year": "Year",

  // interpolated into a tooltip alongside a day-of-year number
  "tooltip.day": "day",

  // series names shown in legends and tooltips
  "series.allMonths": "All months",
  "series.annualVolume": "Annual volume",
  "series.dailyMean": "Daily mean discharge",
  "series.fiveYearAverage": "5-year average",
  "series.monthlyAverage": "Monthly average",
  "series.ensembleMedian": "Ensemble median",
  "series.iqr": "IQR (25–75%)",
  "series.medianDay": "Median day",
  "series.range": "Range (min–max)",
  "series.temporalOutlier": "Temporal outlier",

  // warning levels drawn across the forecast — the label names the level, e.g. "25-year"
  "label.returnPeriodYears": "{n}-year",

  // in-chart controls
  "control.all": "All",
  "control.resetZoom": "Reset zoom",
  "control.yearsShort": "{n}y",
  "control.zoomHint": "drag a box to zoom · shift-drag to pan",

  // Ordered lists, not keyed lookups: index is the month number / status band, so a translation
  // must keep the order rather than the wording. Status runs high -> low.
  "months": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  "status": ["High", "Above normal", "Normal", "Below normal", "Low"],
  "chart.exceedanceProbabilities": "Chance of exceeding each return period",
  "chart.flowAnomaly": "Forecast flow anomaly vs. climatology",
  "axis.membersExceeding": "Members exceeding (%)",
  "axis.flowAnomaly": "Departure from normal (m³/s)",
  "series.alertThreshold": "Alert threshold",
  "series.flowAnomaly": "Departure from normal",
};
