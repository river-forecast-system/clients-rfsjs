'use strict';

import {fetchZarrValues, getCoordinateValues, resolveRiverIdToIndex} from "./zarrFetchers.js";

const s3Uri = "https://geoglows-v2.s3-us-west-2.amazonaws.com";
const cloudfrontUri = "https://d2grb3c773p1iz.cloudfront.net";

export default async function ({baseUrl, riverId, idx} = {}) {
  /*
  The seasonal (monthly) flow-duration-curve transform from sfdc.zarr. Returns:
  { p_exceed: [Number, ...], month: [1..12], sfdc: [ [Number x 12], ... ] }  // sfdc[p][m]
  */
  const zarrUrl = `${baseUrl ? baseUrl : s3Uri}/transformers/sfdc.zarr`;
  const resolvedIdx = await resolveRiverIdToIndex({zarrUrl, riverId, idx, idVariable: "river_id"});
  if (resolvedIdx < 0) throw new Error(`riverId ${riverId} not found in the sfdc dataset`);

  const [p_exceed, month] = await Promise.all([
    getCoordinateValues({zarrUrl, variable: "p_exceed"}),
    getCoordinateValues({zarrUrl, variable: "month"}),
  ]);
  const flat = await fetchZarrValues({zarrUrl, variable: "sfdc", selection: [resolvedIdx, null, null]}); // [p_exceed, month]
  const nM = month.length;
  const sfdc = p_exceed.map((_, p) => flat.slice(p * nM, (p + 1) * nM).map(Number));
  return {p_exceed: p_exceed.map(Number), month: month.map(Number), sfdc};
}
