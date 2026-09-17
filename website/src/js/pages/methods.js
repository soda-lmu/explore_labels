import { loadManifest } from "../data.js";
import { h, initChrome } from "../ui.js";
import { table } from "../charts.js";
import { num } from "../logic.js";

initChrome();
const manifest = await loadManifest();

const about = {
  "items.parquet": "The 3,000 tweets: ID, masked text, and the split each came from in the original Davidson et al. data.",
  "instruments.parquet": "One row per setup (84 LLM model × prompt conditions, human versions A–E, pooled humans) and label (OL, HS): prevalence with intervals, reliability, and confidence summaries.",
  "item_labels.parquet": "Each tweet's summary label under every setup, for OL and HS (long format).",
  "item_labels_wide_OL.parquet": "The OL summary labels from item_labels, one row per tweet and one column per setup.",
  "item_labels_wide_HS.parquet": "The HS summary labels from item_labels, one row per tweet and one column per setup.",
  "pairwise.parquet": "Agreement between every pair of setups for each label: raw agreement, Cohen's κ, 2×2 counts, and both prevalences.",
  "run_prevalence.parquet": "Share of positive labels in each LLM run (model × prompt condition × run), for each label.",
  "item_profiles.parquet": "Per tweet and label: share of positive labels among people and among LLMs, the pooled human label, and how much the label changes across human versions and across LLM setups.",
  "llm_annotations.parquet": "Every LLM label: tweet, label type, model, prompt condition, run, label, and confidence (where requested).",
  "human_annotations.parquet": "Every human rating: tweet, version, annotator (site-specific ID), rating slot, label type, and label."
};

document.getElementById("manifest").append(
  table(Object.entries(manifest.files).map(([name, f]) => ({ name, about: about[name] ?? "", ...f })), [
    { key: "name", label: "File", format: (v) => h("a", { href: `data/${v}`, download: true }, v) },
    { key: "about", label: "Contents", format: (v) => h("span", { class: "desc" }, v) },
    { key: "rows", label: "Rows", format: num },
    { key: "bytes", label: "Size", format: (v) => `${(v / 1e6).toFixed(2)} MB` }
  ]),
  h("p", { class: "small muted" }, `Built ${manifest.built} from `, h("a", { href: manifest.source_repo }, manifest.source_repo), ". Annotator IDs are replaced by website-specific numbers. All files are Parquet.")
);
