'use strict';

// The metadata tables are SNAPPY parquet, which hyparquet core reads without the compressor pack.
import {asyncBufferFromUrl, parquetReadObjects} from "hyparquet";

const s3Uri = "https://geoglows-v2.s3-us-west-2.amazonaws.com";
const cloudfrontUri = "https://d2grb3c773p1iz.cloudfront.net";
const modelTable = "tables/v2-model-table.parquet"; // full attributes, keyed by LINKNO
const packageTable = "tables/package-metadata-table.parquet"; // LINKNO, VPUCode, lat, lon

const idVariable = "LINKNO";
const coerce = (v) => (typeof v === "bigint" ? Number(v) : v);

const readRows = async ({baseUrl, table, columns}) => {
  const scoped = columns?.length ? [...new Set([idVariable, ...columns])] : undefined;
  const file = await asyncBufferFromUrl({url: `${baseUrl ? baseUrl : s3Uri}/${table}`});
  return await parquetReadObjects({file, columns: scoped});
};

const findRow = (rows, riverId) => rows.find((r) => Number(r[idVariable]) === riverId);

// A river's full attribute row from the model metadata table. `columns` scopes the read (LINKNO is
// always included); omit to read every column. Throws if the id is not present.
const metadataTable = async ({riverId, columns, baseUrl} = {}) => {
  const target = Number(riverId);
  if (!Number.isFinite(target)) {
    throw new Error(`metadataTable requires a numeric riverId, got ${riverId}`);
  }
  const row = findRow(await readRows({baseUrl, table: modelTable, columns}), target);
  if (!row) throw new Error(`riverId ${riverId} not found in the metadata table`);
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = coerce(v);
  return out;
};

// The VPU number (VPUCode) for a river.
const riverToVpu = async ({riverId, baseUrl} = {}) => {
  const {VPUCode} = await metadataTable({riverId, columns: ["VPUCode"], baseUrl});
  return VPUCode;
};

// Coordinates for a river id — `{riverId, lat, lon}`.
const riverToLatlon = async ({riverId, baseUrl} = {}) => {
  const target = Number(riverId);
  if (!Number.isFinite(target)) {
    throw new Error(`riverToLatlon requires a numeric riverId, got ${riverId}`);
  }
  const row = findRow(
    await readRows({baseUrl, table: packageTable, columns: ["lat", "lon"]}),
    target,
  );
  if (!row) throw new Error(`riverId ${riverId} not found in the metadata table`);
  return {riverId: target, lat: coerce(row.lat), lon: coerce(row.lon)};
};

// The river nearest a coordinate — `{riverId, lat, lon}`. Nearest by Euclidean degrees, matching
// pygeoglows' latlon_to_river.
const latlonToRiver = async ({lat, lon, baseUrl} = {}) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`latlonToRiver requires numeric lat and lon, got (${lat}, ${lon})`);
  }
  const rows = await readRows({baseUrl, table: packageTable, columns: ["lat", "lon"]});
  let best = null;
  let bestD2 = Infinity;
  for (const r of rows) {
    const dLat = r.lat - lat;
    const dLon = r.lon - lon;
    const d2 = dLat * dLat + dLon * dLon;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = r;
    }
  }
  if (!best) throw new Error("metadata table is empty");
  return {riverId: Number(best[idVariable]), lat: coerce(best.lat), lon: coerce(best.lon)};
};

export {metadataTable, riverToVpu, riverToLatlon, latlonToRiver};
