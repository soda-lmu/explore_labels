// Loading the precomputed web data package (src/public/data).
import { asyncBufferFromUrl, parquetReadObjects } from "hyparquet";

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
      const file = await asyncBufferFromUrl({ url: BASE + name });
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
