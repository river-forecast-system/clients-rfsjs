'use strict';

import {fetchZarrValues, getCoordinateValues, resolveRiverIdToIndex} from "./zarrFetchers.js";

const s3Uri = "https://geoglows-v2.s3-us-west-2.amazonaws.com";
const cloudfrontUri = "https://d2grb3c773p1iz.cloudfront.net";

export default async function ({baseUrl, riverId, idx} = {}) {
  /*
  Per-month bias-correction polynomial fits from polyfits.zarr. Returns:
  {
    month:  [1..12],
    PtoQ:   [ [coeff x 8], ... ],   // percentile -> discharge polynomial, per month
    QtoP:   [ [coeff x 8], ... ],   // discharge -> percentile polynomial, per month
    Qrange: [ [min, max], ... ],    // fitted discharge range, per month
  }
  */
  const zarrUrl = `${baseUrl ? baseUrl : s3Uri}/transformers/polyfits.zarr`;
  const resolvedIdx = await resolveRiverIdToIndex({zarrUrl, riverId, idx, idVariable: "river_id"});
  if (resolvedIdx < 0) throw new Error(`riverId ${riverId} not found in the polyfits dataset`);

  const month = (await getCoordinateValues({zarrUrl, variable: "month"})).map(Number);
  const [ptoq, qtop, qrange] = await Promise.all([
    fetchZarrValues({zarrUrl, variable: "PtoQ", selection: [resolvedIdx, null, null]}),   // [month, 8]
    fetchZarrValues({zarrUrl, variable: "QtoP", selection: [resolvedIdx, null, null]}),   // [month, 8]
    fetchZarrValues({zarrUrl, variable: "Qrange", selection: [resolvedIdx, null, null]}), // [month, 2]
  ]);
  const reshape = (flat, cols) => month.map((_, m) => flat.slice(m * cols, (m + 1) * cols).map(Number));
  return {month, PtoQ: reshape(ptoq, 8), QtoP: reshape(qtop, 8), Qrange: reshape(qrange, 2)};
}
