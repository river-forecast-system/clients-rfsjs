'use strict';

import {fetchZarrValues, getCoordinateValues, resolveRiverIdToIndex} from "./zarrFetchers.js";

const s3Uri = "https://geoglows-v2.s3-us-west-2.amazonaws.com";
const cloudfrontUri = "https://d2grb3c773p1iz.cloudfront.net";

const allowedResolutions = ["hourly", "daily"];
const allowedTypes = ["annual", "monthly"];

export default async function ({baseUrl, riverId, idx, resolution = "daily", fdcType = "annual"} = {}) {
  /*
  Precomputed flow duration curve from fdc.zarr. Returns, for annual:
  { p_exceed: [Number, ...], Q: [Number, ...] }
  and for monthly (a curve per calendar month):
  { p_exceed: [Number, ...], month: [1..12], Q: [ [Number, ...], ... ] }  // Q[m] is month m's curve
  */
  if (!allowedResolutions.includes(resolution)) {
    throw new Error(`Invalid resolution: ${resolution}. Must be one of ${allowedResolutions.join(", ")}.`);
  }
  if (!allowedTypes.includes(fdcType)) {
    throw new Error(`Invalid fdcType: ${fdcType}. Must be one of ${allowedTypes.join(", ")}.`);
  }
  const zarrUrl = `${baseUrl ? baseUrl : s3Uri}/retrospective/fdc.zarr`;
  const resolvedIdx = await resolveRiverIdToIndex({zarrUrl, riverId, idx, idVariable: "river_id"});
  if (resolvedIdx < 0) throw new Error(`riverId ${riverId} not found in the fdc dataset`);

  const variable = `${resolution}_${fdcType}`;
  const p_exceed = (await getCoordinateValues({zarrUrl, variable: "p_exceed"})).map(Number);

  if (fdcType === "annual") {
    const Q = (await fetchZarrValues({zarrUrl, variable, selection: [null, resolvedIdx]})).map(Number);
    return {p_exceed, Q};
  }

  const month = (await getCoordinateValues({zarrUrl, variable: "month"})).map(Number);
  const flat = await fetchZarrValues({zarrUrl, variable, selection: [null, null, resolvedIdx]}); // [month, p_exceed]
  const nP = p_exceed.length;
  const Q = month.map((_, m) => flat.slice(m * nP, (m + 1) * nP).map(Number));
  return {p_exceed, month, Q};
}
