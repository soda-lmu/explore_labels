import { loadMeta, loadItemProfiles, loadItems, loadHumanAnnotations, loadLlmAnnotations } from "../data.js";
import { h, initChrome, segmented, control, select, contentWarning, takeaway, FAMILY_VAR } from "../ui.js";
import { readState, writeState, pct, num, dec } from "../logic.js";

initChrome();

const DEFAULTS = { outcome: "HS", sort: "disagreement", tweet: "" };
const KEYS = ["outcome", "sort", "tweet"];
const PAGE = 25;

const SORTS = [
  { id: "disagreement", label: "Humans and LLMs disagree most",
    cmp: (a, b) => Math.abs(b.human_share_pos - b.llm_share_pos) - Math.abs(a.human_share_pos - a.llm_share_pos) },
  { id: "human_sensitive", label: "Most human-sensitive",
    cmp: (a, b) => b.human_instability - a.human_instability },
  { id: "llm_sensitive", label: "Most LLM-sensitive",
    cmp: (a, b) => b.llm_instability - a.llm_instability },
  { id: "human_stable_llm_unstable", label: "Human-stable, LLM-unstable",
    cmp: (a, b) => (b.llm_instability - b.human_instability) - (a.llm_instability - a.human_instability) },
  { id: "human_unstable_llm_stable", label: "Human-unstable, LLM-stable",
    cmp: (a, b) => (b.human_instability - b.llm_instability) - (a.human_instability - a.llm_instability) },
  { id: "stable", label: "Most stable overall (people and models agree)",
    cmp: (a, b) => (a.human_instability + a.llm_instability) - (b.human_instability + b.llm_instability) }
];

const [meta, profiles, items] = await Promise.all([loadMeta(), loadItemProfiles(), loadItems()]);
const decoder = document.createElement("textarea");
const decode = (t) => { decoder.innerHTML = t ?? ""; return decoder.value; };
const textById = new Map(items.map((t) => [t.tweet_id, decode(t.text)]));
const profileByOutcome = new Map(meta.outcomes.map((o) => [o.id,
  new Map(profiles.filter((p) => p.outcome === o.id).map((p) => [p.tweet_id, p]))]));

const state = readState(location.search, DEFAULTS);
if (!SORTS.some((s) => s.id === state.sort)) state.sort = DEFAULTS.sort;

// ------------------------------------------------------------------ controls
const outcomeSeg = segmented(meta.outcomes.map((o) => ({ value: o.id, label: o.label })), state.outcome, "Label");
const sortSelect = select(SORTS.map((s) => ({ value: s.id, label: s.label })), state.sort);
document.getElementById("controls").append(control("Label", outcomeSeg), control("Sort by", sortSelect));

let shown = PAGE;
let showText = false;

outcomeSeg.addEventListener("input", () => { state.outcome = outcomeSeg.value; shown = PAGE; syncUrl(); renderList(); });
sortSelect.addEventListener("input", () => { state.sort = sortSelect.value; shown = PAGE; syncUrl(); renderList(); });

function syncUrl() {
  history.replaceState(null, "", writeState(state, KEYS, DEFAULTS) || location.pathname);
}

// ------------------------------------------------------------------ index list
function renderList() {
  const oc = state.outcome;
  const sort = SORTS.find((s) => s.id === state.sort);
  const rows = [...profileByOutcome.get(oc).values()].sort(sort.cmp);
  document.getElementById("index-summary").textContent =
    `${num(rows.length)} tweets, sorted by: ${sort.label}. Instability runs 0 (everyone agreed) to 1 (the vote split as close to 50/50 as possible).`;

  const visible = rows.slice(0, shown);
  const table = h("div", { class: "table-wrap idx-table" }, h("table", {},
    h("thead", {}, h("tr", {},
      h("th", { scope: "col" }, "#"),
      h("th", { scope: "col" }, "Tweet"),
      h("th", { scope: "col" }, "Humans said yes"),
      h("th", { scope: "col" }, "LLMs said yes"),
      h("th", { scope: "col" }, "Human instability"),
      h("th", { scope: "col" }, "LLM instability"))),
    h("tbody", {}, visible.map((r, i) => h("tr", { class: r.tweet_id === Number(state.tweet) ? "is-selected" : "" },
      h("td", {}, h("button", { type: "button", class: "idx-row-btn", onclick: () => selectTweet(r.tweet_id) }, String(i + 1))),
      h("td", {}, h("button", { type: "button", class: "idx-row-btn", onclick: () => selectTweet(r.tweet_id) }, `#${r.tweet_id}`)),
      h("td", {}, pct(r.human_share_pos)),
      h("td", {}, pct(r.llm_share_pos)),
      h("td", {}, dec(r.human_instability)),
      h("td", {}, dec(r.llm_instability)))))));
  document.getElementById("index-table").replaceChildren(table);

  const more = document.getElementById("index-more");
  more.replaceChildren(shown < rows.length
    ? h("button", { type: "button", onclick: () => { shown += PAGE; renderList(); } }, `Show ${Math.min(PAGE, rows.length - shown)} more`)
    : null);
}

function selectTweet(id) {
  state.tweet = String(id);
  syncUrl();
  renderList();
  renderDetail();
  document.getElementById("detail").scrollIntoView({ block: "start", behavior: "smooth" });
}

// ------------------------------------------------------------------ human / LLM annotation indexes (lazy)
let humanIndex = null, llmIndex = null, annotationsLoading = null;
async function ensureAnnotations() {
  if (humanIndex && llmIndex) return;
  if (!annotationsLoading) {
    annotationsLoading = Promise.all([loadHumanAnnotations(), loadLlmAnnotations()]).then(([human, llm]) => {
      humanIndex = new Map();
      for (const r of human) {
        const key = `${r.tweet_id}|${r.outcome}`;
        if (!humanIndex.has(key)) humanIndex.set(key, []);
        humanIndex.get(key).push(r);
      }
      llmIndex = new Map();
      for (const r of llm) {
        const key = `${r.tweet_id}|${r.outcome}`;
        if (!llmIndex.has(key)) llmIndex.set(key, []);
        llmIndex.get(key).push(r);
      }
    });
  }
  return annotationsLoading;
}

// ------------------------------------------------------------------ detail
function tallyChip(version, rows) {
  const n = rows.length;
  const pos = rows.reduce((a, r) => a + (r.label === 1 ? 1 : 0), 0);
  const cls = n === 0 ? "" : pos === n ? "all-yes" : pos === 0 ? "all-no" : "split";
  const text = n === 0 ? `Version ${version}: no ratings` : `Version ${version}: ${pos} of ${n} said yes`;
  return h("span", { class: `tally-chip ${cls}` }, text);
}

function runDots(rows) {
  const byRun = new Map(rows.map((r) => [r.run, r.label]));
  const dots = [1, 2, 3].map((run) => {
    const label = byRun.get(run);
    const cls = label == null ? "na" : label === 1 ? "yes" : "no";
    return h("span", { class: `run-dot ${cls}`, title: label == null ? `run ${run}: no data` : `run ${run}: ${label === 1 ? "yes" : "no"}` });
  });
  return h("span", { class: "run-dots" }, dots);
}

function llmGrid(oc, tweetId) {
  const rowsByModelDesign = new Map();
  for (const r of (llmIndex.get(`${tweetId}|${oc}`) ?? [])) {
    const key = `${r.model}|${r.design_id}`;
    if (!rowsByModelDesign.has(key)) rowsByModelDesign.set(key, []);
    rowsByModelDesign.get(key).push(r);
  }
  const structures = meta.structures;
  const variants = meta.variants;
  const headRow1 = h("tr", {}, h("th", {}), structures.map((s) => h("th", { colSpan: variants.length, scope: "colgroup" }, s.label)));
  const headRow2 = h("tr", { class: "variant-row" }, h("th", {}), structures.flatMap(() =>
    variants.map((v) => h("th", { scope: "col" }, v.label))));
  const body = meta.models.map((m) => h("tr", {},
    h("th", { scope: "row", class: "model-name" },
      h("span", { class: "fam-dot", style: `background:${FAMILY_VAR[m.family]}` }), m.label),
    structures.flatMap((s) => variants.map((v) => {
      const designId = `${s.id}__${v.id}`;
      const rows = rowsByModelDesign.get(`${m.id}|${designId}`) ?? [];
      return h("td", {}, runDots(rows));
    }))));
  return h("div", { class: "table-wrap llm-grid-wrap" }, h("table", {},
    h("thead", {}, headRow1, headRow2),
    h("tbody", {}, body)));
}

function summarySentence(oc, prof) {
  if (!prof) return "No profile data for this tweet.";
  return `Across the 15 human ratings (all five questionnaire versions pooled), ${pct(prof.human_share_pos)} said yes ` +
    `— human instability ${dec(prof.human_instability)}. Across the 84 LLM setups (7 models × 12 prompt recipes, each averaged over 3 runs), ` +
    `${pct(prof.llm_share_pos)} said yes — LLM instability ${dec(prof.llm_instability)}. ` +
    `Instability of 0 means everyone agreed; 1 means the vote was as close to a 50/50 split as it gets.`;
}

async function renderDetail() {
  const box = document.getElementById("detail");
  const id = Number(state.tweet);
  if (!id) { box.replaceChildren(); return; }
  const oc = state.outcome;
  const prof = profileByOutcome.get(oc).get(id);

  box.replaceChildren(
    h("div", { class: "detail-header" },
      h("h2", {}, `Tweet #${id}`),
      h("button", { type: "button", onclick: () => { state.tweet = ""; syncUrl(); renderList(); renderDetail(); } }, "Close")),
    takeaway(summarySentence(oc, prof)),
    h("p", { class: "loading" }, "Loading ratings…"));

  await ensureAnnotations();
  if (Number(state.tweet) !== id) return; // superseded by another click while loading

  const humanRows = humanIndex.get(`${id}|${oc}`) ?? [];
  const byVersion = new Map(meta.human_versions.map((v) => [v.version, []]));
  for (const r of humanRows) if (byVersion.has(r.version)) byVersion.get(r.version).push(r);

  const textNode = showText
    ? h("div", { class: "detail-tweet-text" }, textById.get(id) ?? "(text not found)")
    : h("div", {}, contentWarning(() => { showText = true; renderDetail(); }));

  box.replaceChildren(
    h("div", { class: "detail-header" },
      h("h2", {}, `Tweet #${id}`),
      h("button", { type: "button", onclick: () => { state.tweet = ""; syncUrl(); renderList(); renderDetail(); } }, "Close")),
    takeaway(summarySentence(oc, prof)),
    textNode,
    h("h3", {}, "Human ratings by questionnaire version"),
    h("div", { class: "tally-chips" }, meta.human_versions.map((v) => tallyChip(v.version, byVersion.get(v.version) ?? []))),
    h("h3", {}, "LLM labels by model and prompt recipe"),
    h("p", { class: "small muted" }, "Each cell is one prompt recipe for that model: three dots, one per run. Filled = labeled yes, hollow = labeled no, dotted = no data."),
    llmGrid(oc, id));
}

renderList();
if (state.tweet) renderDetail();
