// Loading the precomputed web data package (src/public/data).
import { parquetReadObjects } from "hyparquet";

const BASE = new URL("data/", document.baseURI).href;
const cache = new Map();

function normalize(rows) {
  for (const r of rows) {
    for (const k in r) if (typeof r[k] === "bigint") r[k] = Number(r[k]);
  }
  return rows;
}

export async function readParquet(name, columns) {
  const key = `${name}|${columns ? columns.join(",") : "*"}`;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      // These files are all small (a few KB to a few MB), so fetch the whole
      // thing rather than using hyparquet's lazy byte-range reader. Netlify's
      // edge cache can return a full 200 response instead of the requested
      // 206 partial range on a cold cache hit, which corrupts the footer
      // parse ("footer != PAR1") for range-based reads.
      const buf = await fetch(BASE + name).then((r) => r.arrayBuffer());
      const file = { byteLength: buf.byteLength, slice: (start, end) => buf.slice(start, end) };
      return normalize(await parquetReadObjects({ file, columns }));
    })());
  }
  return cache.get(key);
}

export async function readJSON(name) {
  if (!cache.has(name)) cache.set(name, fetch(BASE + name).then((r) => r.json()));
  return cache.get(name);
}

export const loadMeta = () => readJSON("meta.json");
export const loadManifest = () => readJSON("manifest.json");
export const loadInstruments = () => readParquet("instruments.parquet");
export const loadPairwise = () => readParquet("pairwise.parquet");
export const loadRunPrevalence = () => readParquet("run_prevalence.parquet");
export const loadItems = () => readParquet("items.parquet");
export const loadItemProfiles = () => readParquet("item_profiles.parquet");
export const loadHumanAnnotations = () => readParquet("human_annotations.parquet");
export const loadLlmAnnotations = () => readParquet("llm_annotations.parquet");

/** Item-level labels for a set of instruments, aligned by tweet_id. */
export async function loadItemLabels(outcome, ids) {
  const cols = ["tweet_id", ...new Set(ids)];
  return readParquet(`item_labels_wide_${outcome}.parquet`, cols);
}

export function downloadText(filename, text, type = "text/csv") {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
