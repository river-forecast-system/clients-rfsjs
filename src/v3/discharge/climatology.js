'use strict';

/**
 * The retrospective record as a normal year, and a forecast read against it.
 *
 * "Is this a lot of water" is not answerable from a forecast alone — 400 m³/s is a drought on one
 * river and a flood on another, and on the same river it is one or the other depending on the month.
 * The retrospective simulation is what makes it answerable: average every year's value for a given
 * calendar day and you have what that day normally looks like, and the forecast's distance from
 * that is the part worth plotting.
 */

const dayKey = (d) => `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

/**
 * The mean simulated flow for each calendar day of the year, as a Map keyed "MM-DD".
 *
 * Keyed by month and day rather than by day number so that leap years need no special case: Feb 29
 * is its own key with fewer years behind it, and Mar 1 is Mar 1 in every year rather than sliding
 * by one.
 */
function dayOfYearMeans({time, discharge}) {
  const sums = new Map();
  for (let i = 0; i < time.length; i += 1) {
    const v = discharge[i];
    if (!Number.isFinite(v)) continue;
    const key = dayKey(time[i]);
    const acc = sums.get(key);
    if (acc) {
      acc.total += v;
      acc.n += 1;
    } else {
      sums.set(key, {total: v, n: 1});
    }
  }
  const means = new Map();
  for (const [key, {total, n}] of sums) means.set(key, total / n);
  return means;
}

/**
 * The forecast's daily mean flow minus what that calendar day normally carries.
 *
 *   {time: [Date], anomaly: [Number]}
 *
 * Daily, because the climatology is daily: comparing a three-hourly forecast step against a daily
 * average would put the shape of a single day's rise and fall into what is meant to be a departure
 * from normal. A day the record has never covered is skipped rather than treated as an anomaly of
 * its own size, which is what subtracting a missing climatology as zero would do.
 */
function flowAnomaly({forecast, climatology}) {
  const series = forecast?.stats?.average ?? [];
  const time = forecast?.time ?? [];
  if (!series.length || !climatology?.size) return null;
  const days = new Map();
  for (let i = 0; i < time.length; i += 1) {
    const v = series[i];
    if (!Number.isFinite(v)) continue;
    const d = time[i];
    const key = d.toISOString().slice(0, 10);
    const acc = days.get(key);
    if (acc) {
      acc.total += v;
      acc.n += 1;
    } else {
      days.set(key, {total: v, n: 1, date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), climKey: dayKey(d)});
    }
  }
  const out = {time: [], anomaly: []};
  for (const {total, n, date, climKey} of days.values()) {
    const normal = climatology.get(climKey);
    if (normal === undefined) continue;
    out.time.push(date);
    out.anomaly.push(total / n - normal);
  }
  return out.time.length ? out : null;
}

export {dayOfYearMeans, flowAnomaly};
