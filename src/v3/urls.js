import {v3Base} from "./config.js";

// ── hydrography ──────────────────────────────────────────────────────────────
const globalGroupNumber = "0";
const _streamsPmtilesFile = "streams.pmtiles";
const _metadataStore = "metadata.zarr";
const hydrographyGroup = ({group} = {}) => `${v3Base()}/hydrography/group=${group}`;
const streamsPmtiles = () => `${hydrographyGroup({group: globalGroupNumber})}/${_streamsPmtilesFile}`;
const hydrographyMetadataZarr = ({group = globalGroupNumber} = {}) => `${hydrographyGroup({group})}/${_metadataStore}`;

// ── retrospective ────────────────────────────────────────────────────────────
const allowedResolutions = ["hourly", "daily", "monthly", "yearly"];
const retrospectiveZarr = ({resolution = "hourly"} = {}) => {
  if (!allowedResolutions.includes(resolution)) {
    throw new Error(`Invalid resolution: ${resolution}. Must be one of ${allowedResolutions.join(", ")}.`);
  }
  return `${v3Base()}/retrospective/${resolution}.zarr`;
}
const returnPeriodsZarr = () => `${v3Base()}/retrospective/return-periods.zarr`;
const maximumsZarr = () => `${v3Base()}/retrospective/maximums.zarr`;

// ── forecasts ────────────────────────────────────────────────────────────────
const _datePartition = date => {
  if (!/^\d{4}-?\d{2}-?\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}. Must be YYYYMMDD or YYYY-MM-DD.`);
  }
  const ymd = date.replace(/-/g, "");
  return `year=${ymd.slice(0, 4)}/month=${ymd.slice(4, 6)}/day=${ymd.slice(6, 8)}`;
};
const forecastDir = ({date}) => `${v3Base()}/forecasts15/${_datePartition(date)}`;
const forecastZarr = ({date}) => `${forecastDir({date})}/discharge.zarr`;

// ── flood maps (FLDPLN) ──────────────────────────────────────────────────────
// Individual tile stores are deliberately absent: their `lat=*/lon=*/*.zarr` paths come from
// manifest.json, which is the source of truth for the tiling, so a builder here would be a second
// one. The boundaries pmtiles is here for the same reason streamsPmtiles() is — a map layer needs
// the url without reading anything.
const _floodMapsManifestFile = "manifest.json";
const _floodMapsTileBoundariesFile = "tile_boundaries.pmtiles";
const floodMapsBase = () => `${v3Base()}/flood-maps`;
// flood-maps/ is itself a zarr v3 group: its zarr.json carries the manifest as attributes and
// its rivers/ subgroup holds the riverIndex -> store index (FloodMapsIndex.open()). manifest.json
// is the same attributes as plain JSON for readers without zarr.
const floodMapsRoot = () => `${floodMapsBase()}/zarr.json`;
const floodMapsManifest = () => `${floodMapsBase()}/${_floodMapsManifestFile}`;
const floodMapsTileBoundaries = () => `${floodMapsBase()}/${_floodMapsTileBoundariesFile}`;
// The flow graph behind topology selection (hydrography/riverNetwork.js). It sits under
// flood-maps/ because that is where the FIM pipeline writes it — it is derived from the library's
// own coverage (comid_tiles.parquet), so it covers the reaches the flood library covers, a subset
// of the network rather than all of it.
const _riverNetworkGraphFile = "network_graph_fim.json";
const riverNetworkGraph = () => `${floodMapsBase()}/${_riverNetworkGraphFile}`;

// ── map-styles ─────────────────────────────────────────────────────────────
const stylesets = Object.freeze(["timeseries", "max-flow", "time-to-peak", "below-q95"]);
const streamsStyles = ({date, styleset}) => {
  if (!styleset) throw new Error("streamsStyles requires a styleset, consult stylesets for valid values");
  if (!stylesets.includes(styleset)) {
    throw new Error(`Invalid styleset: ${styleset}. Must be one of ${stylesets.join(", ")}.`);
  }
  return `${forecastDir({date})}/maps/${styleset}/styles`;
};

export {
  // hydrography url builders
  hydrographyGroup, streamsPmtiles, hydrographyMetadataZarr,
  // retrospective url builders
  retrospectiveZarr, returnPeriodsZarr, maximumsZarr,
  // forecast url builders
  forecastDir, forecastZarr,
  // flood map (FLDPLN) url builders
  floodMapsBase, floodMapsRoot, floodMapsManifest, floodMapsTileBoundaries, riverNetworkGraph,
  // map-styles url builders
  stylesets, streamsStyles,
}
