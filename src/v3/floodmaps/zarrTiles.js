import * as zarr from "zarrita";
import {floodMapsBase, floodMapsRoot} from "../urls.js";

const httpFetcher = async (url) => {
  const r = await fetch(url);
  if (r.status === 404) return void 0;
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.arrayBuffer();
};

function fetcherStore(baseUrl, fetcher) {
  return {
    async get(key) {
      const buf = await fetcher(`${baseUrl}${key}`);
      return buf === void 0 ? void 0 : new Uint8Array(buf);
    }
  };
}

const mPerMm = (v) => {
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = Math.fround(v[i] / 1e3);
  return out;
};
const globalize = (v, origin) => {
  const out = new Int32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] + origin;
  return out;
};
// The worker is long-lived, so its caches need a ceiling — a session that pans the globe and
// selects reach after reach would otherwise grow both without bound (each slice holds ~13 typed
// arrays of per-pixel library data). Map iterates in insertion order, so re-inserting on hit and
// dropping the first key gives a plain LRU. Evicting only drops the cache entry: an in-flight
// consumer already holds the promise, and a later request simply refetches.
const MAX_CACHED_SLICES = 512;
const MAX_CACHED_TILES = 64;
// decoded rivers/tile chunks (RIVER_CHUNK x 4 int16 each, ~32 KB) — a corridor is a near-contiguous
// riverIndex run, so a session rarely needs more than a handful
const MAX_CACHED_INDEX_CHUNKS = 64;

function lruGet(cache, key) {
  const v = cache.get(key);
  if (v === void 0) return void 0;
  cache.delete(key);
  cache.set(key, v);
  return v;
}

function lruSet(cache, key, value, max) {
  cache.set(key, value);
  while (cache.size > max) cache.delete(cache.keys().next().value);
  return value;
}

class FloodMapsIndex {
  constructor(dataBase, fetcher, tilePath, riverTiles) {
    // No codec registration: the tile stores are written with blosc(cname=zstd, clevel=5, shuffle),
    // which zarrita's default registry already resolves. rollup.config.js stubs numcodecs' lz4 and
    // zstd wasm builds away and leaves blosc alone, so blosc is the only compressor that decodes.
    this.dataBase = dataBase;
    this.fetcher = fetcher;
    this.tilePath = tilePath;
    this.riverTiles = riverTiles;
  }

  dataBase;
  fetcher;
  tilePath;
  // riverIndex -> tile names, built from the headers of the tiles the viewport has touched. This
  // is the HIGHLIGHT set (what on screen is mappable), not the lookup: see resolve().
  riverTiles;
  tiles = /* @__PURE__ */ new Map();
  slices = /* @__PURE__ */ new Map();
  // `${tile}/${riverIndex}`
  activeTiles = /* @__PURE__ */ new Set();

  // The riverIndex -> store index from the root group's rivers/ subgroup — null when opened via
  // openTiles() (no root), in which case resolve() and hasCoverage() fall back to riverTiles.
  //   tileNames  tile id (position in root attrs.tilePaths) -> tile name
  //   tileArr    zarrita handle on rivers/tile, int16[nRivers, maxTilesPerRiver], fill -1
  //   chunk      rows per chunk of rivers/tile
  //   covered    rivers/covered, little-endian bitset over riverIndex
  riverIndex = null;
  indexChunks = /* @__PURE__ */ new Map();

  /**
   * The flood library root — a zarr v3 group whose zarr.json carries the manifest as attributes,
   * whose rivers/ subgroup indexes riverIndex -> store, and whose lat=*\/lon=*\/fldpln.zarr stores
   * hold the data — comes from config: it sits under the configured v3Base like every other v3
   * dataset, so a consumer that has called configure() need say nothing here. `base` is an escape
   * hatch for tests reading a local tree off disk with their own fetcher; app code leaves it alone.
   *
   * Opening fetches two objects: the root header and the coverage bitset (one chunk, ~580 KB for
   * 4.76M rivers), after which hasCoverage() answers for any reach on earth with no tile loaded.
   * The viewport highlight set (riverTiles) still starts empty — setActiveTiles() grows it.
   */
  static async open({fetcher = httpFetcher, base = null} = {}) {
    const root = base ?? floodMapsBase();
    // urls.js owns the filename; an overridden base re-joins it by hand rather than teaching every
    // builder there about a base it will never see in an app.
    const rootBuf = await fetcher(base ? `${base}/zarr.json` : floodMapsRoot());
    if (!rootBuf) throw new Error(`zarr.json not found under ${root}`);
    const manifest = JSON.parse(new TextDecoder().decode(rootBuf)).attributes;
    if (!manifest?.tiles || !manifest.index || !manifest.tilePaths) {
      throw new Error(`${root}/zarr.json: not a flood-maps root (no tiles/index/tilePaths attrs)`);
    }
    const tilePath = /* @__PURE__ */ new Map();
    const tileNames = new Array(manifest.tilePaths.length);
    for (const [name, t] of Object.entries(manifest.tiles)) {
      tilePath.set(name, t.path);
      tileNames[t.id] = name;
    }
    const idx = new FloodMapsIndex(root, fetcher, tilePath, /* @__PURE__ */ new Map());
    const rivers = zarr.root(fetcherStore(`${root}/rivers`, fetcher));
    const [tileArr, coveredArr] = await Promise.all([
      zarr.open.v3(rivers.resolve("tile"), {kind: "array"}),
      zarr.open.v3(rivers.resolve("covered"), {kind: "array"})
    ]);
    const covered = (await zarr.get(coveredArr)).data;
    idx.riverIndex = {
      tileNames,
      tileArr,
      chunk: manifest.index.chunk,
      width: manifest.index.maxTilesPerRiver,
      nRivers: manifest.index.nRivers,
      covered
    };
    return idx;
  }

  /** Dev/test entry: open named tiles directly (no manifest needed);
   * coverage is built from each tile's own directory. Same `base` escape hatch as open(). */
  static async openTiles({tiles, fetcher = httpFetcher, base = null} = {}) {
    const idx = new FloodMapsIndex(
      base ?? floodMapsBase(),
      fetcher,
      new Map(Object.entries(tiles)),
      /* @__PURE__ */ new Map()
    );
    for (const name of idx.tilePath.keys()) {
      const h = await idx.tile(name);
      for (const c of h.riverIndices) {
        const list = idx.riverTiles.get(c);
        if (list) list.push(name);
        else idx.riverTiles.set(c, [name]);
      }
    }
    return idx;
  }

  /** All river indices with flood-library coverage (transfer-friendly). */
  coverage() {
    return Uint32Array.from(this.riverTiles.keys());
  }

  /** Whether the flood library holds this reach anywhere — from the global bitset when the
   * root index is open, else from the viewport-loaded tiles. */
  hasCoverage(riverIndex) {
    const ri = this.riverIndex;
    if (!ri) return this.riverTiles.has(riverIndex);
    if (riverIndex < 0 || riverIndex >= ri.nRivers) return false;
    return ((ri.covered[riverIndex >> 3] >> (riverIndex & 7)) & 1) === 1;
  }

  /** The coverage bitset itself (little-endian, bit = riverIndex), for consumers that want to
   * test membership on their own thread; null without the root index. */
  coveredBits() {
    return this.riverIndex?.covered ?? null;
  }

  /** One decoded chunk of rivers/tile: Int16Array of chunk*width entries, row-major. */
  indexChunk(k) {
    let c = lruGet(this.indexChunks, k);
    if (!c) {
      const ri = this.riverIndex;
      const start = k * ri.chunk;
      const end = Math.min(start + ri.chunk, ri.nRivers);
      c = lruSet(
        this.indexChunks,
        k,
        zarr.get(ri.tileArr, [zarr.slice(start, end), null]).then((r) => r.data),
        MAX_CACHED_INDEX_CHUNKS
      );
    }
    return c;
  }

  /**
   * Which store(s) hold each reach: riverIndex[] -> Map(tile name -> riverIndex[]), the exact set
   * of stores to open and what to pull from each. Reads rivers/tile, one chunk per
   * floor(riverIndex / chunk) touched; nothing geometric, and a reach split across tiles lists all
   * of them whether or not they are on screen. Reaches with no coverage are simply absent.
   * Without the root index (openTiles) this is the viewport-derived riverTiles map instead.
   */
  async resolve(riverIndices) {
    const out = /* @__PURE__ */ new Map();
    const add = (name, c) => {
      const list = out.get(name);
      if (list) list.push(c);
      else out.set(name, [c]);
    };
    const ri = this.riverIndex;
    if (!ri) {
      for (const c of riverIndices) for (const t of this.riverTiles.get(c) ?? []) add(t, c);
      return out;
    }
    const byChunk = /* @__PURE__ */ new Map();
    for (const c of riverIndices) {
      if (c < 0 || c >= ri.nRivers) continue;
      const k = Math.floor(c / ri.chunk);
      const list = byChunk.get(k);
      if (list) list.push(c);
      else byChunk.set(k, [c]);
    }
    await Promise.all([...byChunk].map(async ([k, list]) => {
      const rows = await this.indexChunk(k);
      for (const c of list) {
        const base = (c - k * ri.chunk) * ri.width;
        for (let j = 0; j < ri.width; j++) {
          const id = rows[base + j];
          if (id < 0) break;
          const name = ri.tileNames[id];
          if (name === void 0) throw new Error(`rivers/tile: riverIndex ${c} names tile id ${id}, not in root tilePaths`);
          add(name, c);
        }
      }
    }));
    return out;
  }

  /**
   * Fold the given tiles' river lists into coverage (riverIndex -> tiles), loading each new tile's
   * header once. Accumulates: a tile stays active after it leaves the viewport, so coverage
   * only grows as the user pans. Returns the current coverage river indices (transfer-friendly).
   *
   * This is the on-screen highlight set only. Finding a reach's stores for fetching goes through
   * resolve() and the root index, so a reach whose library lives in an off-screen tile is still
   * fetched in full; it is merely not listed here until that tile is panned into view.
   */
  async setActiveTiles(names) {
    for (const name of names) {
      if (this.activeTiles.has(name) || !this.tilePath.has(name)) continue;
      this.activeTiles.add(name);
      let h;
      try {
        h = await this.tile(name);
      } catch (err) {
        console.warn(`flood-maps: tile ${name} unavailable — ${err.message ?? err}`);
        this.activeTiles.delete(name);
        this.tiles.delete(name);
        continue;
      }
      for (const c of h.riverIndices) {
        const list = this.riverTiles.get(c);
        if (list) {
          if (!list.includes(name)) list.push(name);
        } else {
          this.riverTiles.set(c, [name]);
        }
      }
    }
    return this.coverage();
  }

  tile(name) {
    let h = lruGet(this.tiles, name);
    if (!h) h = lruSet(this.tiles, name, this.openTile(name), MAX_CACHED_TILES);
    return h;
  }

  async openTile(name) {
    const path = this.tilePath.get(name);
    if (!path) throw new Error(`tile ${name} not in manifest`);
    const storeUrl = `${this.dataBase}/${path}`;
    const metaBuf = await this.fetcher(`${storeUrl}/zarr.json`);
    if (!metaBuf) throw new Error(`zarr.json missing for ${name}`);
    const attrs = JSON.parse(new TextDecoder().decode(metaBuf)).attributes;
    // The river directory is keyed by GEOGLOWS v3 riverIndex — the reach's row position in
    // hydrography/group=0/metadata.parquet, the same number every discharge reader takes. Fail
    // loudly if it is missing: a silently missing list means empty coverage, which looks like
    // "this viewport has no flood data" rather than a broken store.
    const riverIndices = attrs.rivers?.riverIndex;
    if (!riverIndices) throw new Error(`${name}: store attrs.rivers has no riverIndex list`);
    const rank = /* @__PURE__ */ new Map();
    riverIndices.forEach((c, i) => rank.set(c, i));
    const root = zarr.root(fetcherStore(storeUrl, this.fetcher));
    return {attrs, riverIndices, rank, root, arrays: /* @__PURE__ */ new Map()};
  }

  array(h, name) {
    let a = h.arrays.get(name);
    if (!a) {
      // open.v3, not the version-agnostic open: these stores are v3 (openTile has already read
      // their zarr.json), and the agnostic path guesses v2 first, so
      // every array cost a doomed .zattrs GET before falling back. Worse, that fallback only fires
      // for zarrita's own not-found errors — an origin that answers missing keys with anything but
      // 404 (CloudFront over an S3 bucket without s3:ListBucket returns 403) makes the probe throw
      // instead, and the v3 read never happens.
      a = zarr.open.v3(h.root.resolve(name), {kind: "array"});
      h.arrays.set(name, a);
    }
    return a;
  }

  async read1d(h, name, start, count) {
    const arr = await this.array(h, name);
    if (count === 0) {
      return new (arr.shape.length ? Uint8Array : Uint8Array)(0);
    }
    const res = await zarr.get(arr, [zarr.slice(start, start + count)]);
    return res.data;
  }

  async read2d(h, name, start, count) {
    if (count === 0) return new Float32Array(0);
    const arr = await this.array(h, name);
    const res = await zarr.get(arr, [zarr.slice(start, start + count), null]);
    return res.data;
  }

  /** Load (and cache) one river's slice from one tile. */
  slice(tileName, riverIndex) {
    const key = `${tileName}/${riverIndex}`;
    let s = lruGet(this.slices, key);
    if (!s) s = lruSet(this.slices, key, this.loadSlice(tileName, riverIndex), MAX_CACHED_SLICES);
    return s;
  }

  async loadSlice(tileName, riverIndex) {
    const h = await this.tile(tileName);
    const r = h.rank.get(riverIndex);
    if (r === void 0) throw new Error(`riverIndex ${riverIndex} not in tile ${tileName}`);
    const d = h.attrs.rivers;
    const {gRow0, gCol0} = h.attrs.grid;
    const vs = d.visitStart[r];
    const vc = d.visitCount[r];
    const ps = d.pixStart[r];
    const pc = d.pixCount[r];
    const rs = d.relStart[r];
    const rc = d.relCount[r];
    const [fspLocal, sRow, sCol, bed, qBaseflow, q, wse, pixRow, pixCol, fill, relCount, relFspLocal, relDtf] = await Promise.all([
      this.read1d(h, "streams/fsp_local", vs, vc),
      this.read1d(h, "streams/row", vs, vc),
      this.read1d(h, "streams/col", vs, vc),
      this.read1d(h, "streams/bed", vs, vc),
      this.read1d(h, "streams/q_baseflow", vs, vc),
      this.read2d(h, "streams/q", vs, vc),
      this.read2d(h, "streams/wse", vs, vc),
      this.read1d(h, "library/pix_row", ps, pc),
      this.read1d(h, "library/pix_col", ps, pc),
      this.read1d(h, "library/fill_mm", ps, pc),
      this.read1d(h, "library/rel_count", ps, pc),
      this.read1d(h, "library/fsp_local", rs, rc),
      this.read1d(h, "library/dtf_mm", rs, rc)
    ]);
    const runs = d.runStarts[r];
    const runStarts = new Int32Array(runs.length + 1);
    runStarts.set(runs);
    runStarts[runs.length] = vc;
    return {
      riverIndex,
      tile: tileName,
      nVisit: vc,
      nFsp: d.fspCount[r],
      runStarts,
      fspLocal,
      row: globalize(sRow, gRow0),
      col: globalize(sCol, gCol0),
      bed,
      qBaseflow,
      q,
      wse,
      nPix: pc,
      pixRow: globalize(pixRow, gRow0),
      pixCol: globalize(pixCol, gCol0),
      fill: mPerMm(fill),
      relCount,
      relFspLocal,
      relDtf: mPerMm(relDtf)
    };
  }

  /**
   * Fetch every (tile, riverIndex) slice for the selected rivers, finding the stores through
   * resolve(). River indices without coverage are silently skipped (callers gate UI on
   * hasCoverage). A river crossing tiles yields one slice per owning tile; the slices are
   * disjoint by construction and compose by scatter-max in the global frame.
   */
  async slicesFor(riverIndices) {
    const byTile = await this.resolve(riverIndices);
    const jobs = [];
    for (const [t, list] of byTile) for (const c of list) jobs.push(this.slice(t, c));
    return Promise.all(jobs);
  }
}

export {
  FloodMapsIndex,
  httpFetcher
};
