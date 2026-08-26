'use strict';

// all data from rfsv2 are zarr version/format 2
import {FetchStore, get, open} from "zarrita"

// Some rfsv2 stores (e.g. fdc.zarr) were written with Python's bare NaN/Infinity literals in their
// metadata, which are invalid JSON and make zarrita's JSON.parse fail. Quote those tokens on the way
// out so parsing succeeds; zarrita already interprets the quoted-string form for float fill_value.
class SanitizingFetchStore extends FetchStore {
  async get(key, opts) {
    const bytes = await super.get(key, opts);
    if (bytes && /\.(zarray|zattrs|zgroup|zmetadata)$/.test(key)) {
      const text = new TextDecoder().decode(bytes).replace(/:\s*(-?Infinity|NaN)\b/g, ': "$1"');
      return new TextEncoder().encode(text);
    }
    return bytes;
  }
}

const resolveRiverIdToIndex = async ({zarrUrl, riverId, idx, idVariable}) => {
  // idx is preferred. if not provided, riverId must be given to look up the index.
  // validate that at least one of riverId or idx is provided
  if (idx === undefined && riverId === undefined) {
    throw new Error("Either 'riverId' or 'idx' must be provided.");
  }
  if (idx === undefined) {
    idx = await getCoordinateIndex({zarrUrl, variable: idVariable, value: riverId})
  }
  return idx;
}

const fetchZarrValues = async ({zarrUrl, variable, selection = null}) => {
  const store = new SanitizingFetchStore(`${zarrUrl}/${variable}`);
  const node = await open.v2(store);
  const array = await get(node, selection);
  return [...array.data];
}

const getCoordinateValues = async ({zarrUrl, variable}) => {
  return await fetchZarrValues({zarrUrl, variable, selection: [null]});
}

const getCoordinateIndex = async ({zarrUrl, variable, value}) => {
  let coordinates = await getCoordinateValues({zarrUrl, variable});
  // int64 coordinates deserialize to BigInt; normalize both sides so Number lookups still match
  return coordinates.map(Number).indexOf(Number(value));
}

const getTimeCoordinateValues = async ({zarrUrl}) => {
  const store = new SanitizingFetchStore(`${zarrUrl}/time`);
  const node = await open.v2(store);
  const array = await get(node, [null]);

  const units = node.attrs.units;
  const originTime = new Date(units.split("since")[1].trim());
  const conversionFactor = {
    seconds: 1,
    minutes: 60,
    hours: 60 * 60,
    days: 60 * 60 * 24,
  }[units.split("since")[0].trim()];

  // Offset the epoch directly rather than with Date.setSeconds - setSeconds writes local time
  // fields, so any timestamp on the far side of a DST boundary from the origin comes back shifted
  // by an hour (e.g. 23:00 the previous day) and reads as the wrong date under getUTC*.
  const originEpoch = originTime.getTime();
  return [...array.data].map(t => new Date(originEpoch + (Number(t) * conversionFactor * 1000)));
}

export {
  fetchZarrValues,
  getCoordinateValues,
  getCoordinateIndex,
  getTimeCoordinateValues,
  resolveRiverIdToIndex,
}
