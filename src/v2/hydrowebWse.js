'use strict';

import {fetchZarrValues, getCoordinateValues, resolveRiverIdToIndex} from "./zarrFetchers.js";

const s3Uri = "https://geoglows-v2.s3-us-west-2.amazonaws.com";
const cloudfrontUri = "https://d2grb3c773p1iz.cloudfront.net";

export default async function ({baseUrl, riverId, idx} = {}) {
  /*
  Water-surface-elevation transform curves from hydroweb.zarr. Only rivers with hydroweb
  observations are present, so an id outside that subset throws. Returns:
  { p_exceed: [Number, ...], month: [1..12], wse: [ [Number x nP], ... ] }  // wse[m] is month m's curve
  */
  const zarrUrl = `${baseUrl ? baseUrl : s3Uri}/transformers/hydroweb.zarr`;
  const resolvedIdx = await resolveRiverIdToIndex({zarrUrl, riverId, idx, idVariable: "river_id"});
  if (resolvedIdx < 0) throw new Error(`riverId ${riverId} has no hydroweb WSE transform`);

  const [month, p_exceed] = await Promise.all([
    getCoordinateValues({zarrUrl, variable: "month"}),
    getCoordinateValues({zarrUrl, variable: "p_exceed"}),
  ]);
  const flat = await fetchZarrValues({zarrUrl, variable: "wse", selection: [null, null, resolvedIdx]}); // [month, p_exceed]
  const nP = p_exceed.length;
  const wse = month.map((_, m) => flat.slice(m * nP, (m + 1) * nP).map(Number));
  return {p_exceed: p_exceed.map(Number), month: month.map(Number), wse};
}
