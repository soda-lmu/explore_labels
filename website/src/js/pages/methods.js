import { loadMeta, loadInstruments, loadManifest } from "../data.js";
import { h, initChrome } from "../ui.js";
import { table } from "../charts.js";
import { pct, num } from "../logic.js";

initChrome();
const [meta, inst, manifest] = await Promise.all([loadMeta(), loadInstruments(), loadManifest()]);

const kern = { A: [51.6, 26.8], B: [58.8, 29.6], C: [58.5, 28.2], D: [54.4, 33.5], E: [59.0, 31.8] };
const get = (oc, v) => inst.find((r) => r.outcome === oc && r.instrument === `human:${v}`);
const rows = meta.human_versions.map((v) => ({
  version: v.version,
  n: get("OL", v.version).raw_n,
  ol: get("OL", v.version).raw_prev, ol_pub: kern[v.version][0],
  hs: get("HS", v.version).raw_prev, hs_pub: kern[v.version][1]
}));
document.getElementById("manifest").append(
  h("h3", {}, "Kern et al. (2023), Table 1: this site vs. published"),
  table(rows, [
    { key: "version", label: "Version" },
    { key: "n", label: "OL ratings", format: num },
    { key: "ol", label: "OL (site)", format: (v) => pct(v) },
    { key: "ol_pub", label: "OL (published)", format: (v) => `${v.toFixed(1)}%` },
    { key: "hs", label: "HS (site)", format: (v) => pct(v) },
    { key: "hs_pub", label: "HS (published)", format: (v) => `${v.toFixed(1)}%` }
  ]),
  h("h3", {}, "Data files"),
  table(Object.entries(manifest.files).map(([name, f]) => ({ name, ...f })), [
    { key: "name", label: "File", format: (v) => h("a", { href: `data/${v}`, download: true }, v) },
    { key: "rows", label: "Rows", format: num },
    { key: "bytes", label: "Size", format: (v) => `${(v / 1e6).toFixed(2)} MB` },
    { key: "sha256", label: "SHA-256", format: (v) => h("code", {}, v.slice(0, 12)) }
  ]),
  h("p", { class: "small muted" }, `Built ${manifest.built} from `, h("a", { href: manifest.source_repo }, manifest.source_repo), ". Annotator IDs are replaced by website-specific numbers.")
);
