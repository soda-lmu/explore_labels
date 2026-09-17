import { loadMeta, loadInstruments, loadPairwise, loadItemLabels, loadItems, downloadText } from "../data.js";
import {
  h, initChrome, segmented, control, instrumentPicker, instrumentLabel, instrumentColor,
  callout, contentWarning, MODEL_SYMBOL
} from "../ui.js";
import { pairPlot, locator } from "../charts.js";
import {
  readState, writeState, parseInstrument, classifyComparison, lookupPair, pairIndex,
  pct, num, dec, signedPp, bp, toCSV
} from "../logic.js";

initChrome();

const [meta, inst, pairs] = await Promise.all([loadMeta(), loadInstruments(), loadPairwise()]);
const index = pairIndex(pairs);
const state = readState(location.search);
const KEYS = ["outcome", "a", "b", "agg", "show_text"];
const byKey = new Map(inst.map((r) => [`${r.outcome}|${r.instrument}`, r]));
const outcomeLabel = (oc) => meta.outcomes.find((o) => o.id === oc).label;

// ------------------------------------------------------------------ controls
const outcomeSeg = segmented(meta.outcomes.map((o) => ({ value: o.id, label: o.label })), state.outcome, "Outcome");
const aggSeg = segmented([
  { value: "item", label: "Item labels (one per tweet)" },
  { value: "raw", label: "Every label / rating" }
], state.agg, "Prevalence basis");
document.getElementById("global-controls").append(
  control("Outcome", outcomeSeg), control("Prevalence based on", aggSeg));
const pickA = instrumentPicker(meta, state.a, "Instrument A");
const pickB = instrumentPicker(meta, state.b, "Instrument B");
const swap = h("button", { type: "button", onclick: () => { const a = pickA.value; pickA.set(pickB.value); pickB.set(a); update(); } }, "Swap A and B");
document.getElementById("pickers").append(pickA, pickB);
document.getElementById("global-controls").append(swap);

for (const el of [outcomeSeg, aggSeg, pickA, pickB]) el.addEventListener("input", update);

// ------------------------------------------------------------------ cards
function card(side, r) {
  const p = parseInstrument(r.instrument);
  const isHuman = p.source === "human";
  const unit = isHuman ? "ratings" : "labels";
  const rows = [
    ["Label-level prevalence", `${pct(r.raw_prev)} (${num(r.raw_pos)} of ${num(r.raw_n)} ${unit})`],
    ["Item-level prevalence", `${pct(r.item_prev)} (${num(r.item_pos)} of ${num(r.item_n)} tweets)`],
    ["Item label rule", r.summary_rule],
    r.reliability_stat ? [`Reliability: ${r.reliability_stat}`, `${dec(r.reliability)} over ${num(r.reliability_n)} tweets`] : ["Reliability", "not defined for the pooled reference"],
    isHuman && Number.isFinite(r.alpha) ? ["Krippendorff's α (3 annotators)", dec(r.alpha)] : null,
    !isHuman ? ["Spread of the 3 run prevalences (SD)", `${(100 * r.run_sd).toFixed(2)} pp`] : null,
    !isHuman ? ["Confidence scores", r.conf_requested ? `requested · valid for ${pct(r.conf_valid_rate)} · mean ${r.conf_mean.toFixed(0)}` : "not requested in this design"] : null
  ].filter(Boolean);
  return h("div", { class: "card" },
    h("h3", {}, h("span", { style: `color:${instrumentColor(meta, r.instrument)}` }, "■ "), `${side}: ${instrumentLabel(meta, r.instrument)}`),
    h("div", { class: "table-wrap" }, h("table", {}, h("tbody", {}, rows.map(([k, v]) => h("tr", {}, h("th", { scope: "row", style: "text-align:left;font-weight:500" }, k), h("td", { style: "white-space:normal" }, v)))))));
}

// ------------------------------------------------------------------ examples
let showText = state.show_text === "1";
async function renderExamples(oc, a, b, pair) {
  const box = document.getElementById("examples");
  if (a === b || !pair) { box.replaceChildren(); return; }
  if (!showText) {
    box.replaceChildren(
      h("p", { class: "small" }, `${num(pair.n10)} tweets are positive under A and negative under B; ${num(pair.n01)} go the other way.`),
      contentWarning(() => { showText = true; state.show_text = "1"; update(); }));
    return;
  }
  box.replaceChildren(h("p", { class: "loading" }, "Loading tweets…"));
  const [labels, items] = await Promise.all([loadItemLabels(oc, [a, b]), loadItems()]);
  // The source text carries HTML entities (&amp;, &#8220;); decode for display only.
  const decoder = document.createElement("textarea");
  const decode = (t) => { decoder.innerHTML = t ?? ""; return decoder.value; };
  const text = new Map(items.map((t) => [t.tweet_id, decode(t.text)]));
  const pick = (from, to) => labels.filter((r) => r[a] === from && r[b] === to).slice(0, 6);
  const list = (rows) => rows.length
    ? h("ul", { class: "tweets" }, rows.map((r) => h("li", {}, h("div", { class: "id" }, `tweet ${r.tweet_id}`), text.get(r.tweet_id))))
    : h("p", { class: "muted small" }, "None.");
  box.replaceChildren(
    h("p", { class: "small muted" }, "First six tweets in each direction, in tweet-ID order. ",
      h("button", { type: "button", onclick: () => { showText = false; state.show_text = "0"; update(); } }, "Hide text")),
    h("div", { class: "grid two" },
      h("div", {}, h("h3", {}, `Positive under A, negative under B (${num(pair.n10)})`), list(pick(1, 0))),
      h("div", {}, h("h3", {}, `Negative under A, positive under B (${num(pair.n01)})`), list(pick(0, 1)))));
}

// ------------------------------------------------------------------ render
let current = null;
function update() {
  state.outcome = outcomeSeg.value;
  state.agg = aggSeg.value;
  state.a = pickA.value;
  state.b = pickB.value;
  history.replaceState(null, "", writeState(state, KEYS) || location.pathname);

  const { outcome: oc, a, b, agg } = state;
  const A = byKey.get(`${oc}|${a}`), B = byKey.get(`${oc}|${b}`);
  const cls = classifyComparison(a, b, meta);
  const notes = [...cls.notes];
  if (agg === "raw") {
    const pa = parseInstrument(a), pb = parseInstrument(b);
    if (pa.source !== pb.source) notes.push("Label-level prevalence counts individual human ratings on one side and individual LLM run labels on the other. Switch to item labels for a like-for-like per-tweet comparison.");
  }
  document.getElementById("classification").replaceChildren(callout(cls.level, cls.title, notes));
  document.getElementById("cards").replaceChildren(card("A", A), card("B", B));

  const key = agg === "raw" ? "raw" : "item";
  const all = inst.filter((r) => r.outcome === oc).map((r) => ({ prev: r[`${key}_prev`] }));
  locator(document.getElementById("locator"), all, [
    { side: "A", prev: A[`${key}_prev`], color: instrumentColor(meta, a) },
    { side: "B", prev: B[`${key}_prev`], color: instrumentColor(meta, b) }
  ]);

  const pair = a === b ? null : lookupPair(index, oc, a, b);
  const pa = A[`${key}_prev`], pb = B[`${key}_prev`];
  const diff = pb - pa;
  const flips = pair ? pair.n10 + pair.n01 : NaN;
  const tiles = [
    ["Prevalence A", pct(pa), agg === "raw" ? `${num(A.raw_n)} labels` : `${num(A.item_n)} tweets`],
    ["Prevalence B", pct(pb), agg === "raw" ? `${num(B.raw_n)} labels` : `${num(B.item_n)} tweets`],
    ["Difference B − A", signedPp(diff), bp(diff)],
    ["Cohen's κ", pair ? dec(pair.kappa) : "—", "item labels, shared tweets"],
    ["Raw agreement", pair ? pct(pair.agree) : "—", pair ? `${num(pair.n)} shared tweets` : ""],
    ["Tweets that flip", pair ? num(flips) : "—", pair ? `${pct(flips / pair.n)} of shared tweets` : ""]
  ];
  document.getElementById("cmp-tiles").replaceChildren(...tiles.map(([k, v, s]) =>
    h("div", { class: "tile" }, h("div", { class: "k" }, k), h("div", { class: "v" }, v), h("div", { class: "s" }, s))));

  const sym = (id) => { const p = parseInstrument(id); return p.source === "human" ? "diamond" : MODEL_SYMBOL[p.model]; };
  const ci = (r) => agg === "raw" ? [r.raw_lo, r.raw_hi] : [r.item_lo, r.item_hi];
  pairPlot(document.getElementById("pair-plot"), [
    { side: "A", prev: pa, lo: ci(A)[0], hi: ci(A)[1], color: instrumentColor(meta, a), symbol: sym(a), label: instrumentLabel(meta, a), n: agg === "raw" ? A.raw_n : A.item_n },
    { side: "B", prev: pb, lo: ci(B)[0], hi: ci(B)[1], color: instrumentColor(meta, b), symbol: sym(b), label: instrumentLabel(meta, b), n: agg === "raw" ? B.raw_n : B.item_n }
  ]);

  const m = document.getElementById("matrix");
  if (pair) {
    const cell = (v, flip) => h("td", { class: `cell${flip ? " flip" : ""}` }, num(v), h("div", { class: "small muted" }, pct(v / pair.n)));
    m.replaceChildren(h("div", { class: "table-wrap" }, h("table", { class: "matrix" },
      h("caption", { class: "small muted", style: "caption-side:bottom;text-align:left;padding-top:.4rem" },
        `Rows: A's item label. Columns: B's item label. Shaded cells are flips. ${outcomeLabel(oc)}.`),
      h("thead", {}, h("tr", {}, h("th", {}, ""), h("th", { scope: "col" }, "B negative"), h("th", { scope: "col" }, "B positive"))),
      h("tbody", {},
        h("tr", {}, h("th", { scope: "row" }, "A negative"), cell(pair.n00, false), cell(pair.n01, true)),
        h("tr", {}, h("th", { scope: "row" }, "A positive"), cell(pair.n10, true), cell(pair.n11, false))))));
  } else {
    m.replaceChildren(h("p", { class: "muted" }, "Choose two different instruments."));
  }

  const aggText = agg === "raw"
    ? "Prevalence is the share of positive labels among every eligible LLM run label or every human rating."
    : "Prevalence is the share of tweets whose item label is positive (LLM: modal label of 3 runs; humans: majority of the version's 3 ratings, or of all 15 for the reference).";
  document.getElementById("method-statement").textContent =
    `${outcomeLabel(oc)}. ${aggText} Cohen's κ, raw agreement and flips always compare item labels on the ${pair ? num(pair.n) : "—"} tweets that have a label under both instruments. ` +
    "Reliability (within an instrument) and sensitivity (between instruments) answer different questions: a high κ inside A says nothing about how A compares with B.";

  current = {
    outcome: oc, instrument_a: a, label_a: instrumentLabel(meta, a), instrument_b: b, label_b: instrumentLabel(meta, b),
    comparison_type: cls.title, prevalence_basis: agg === "raw" ? "label-level" : "item-level",
    prev_a: pa, prev_b: pb, diff_pp: 100 * diff,
    n_a: agg === "raw" ? A.raw_n : A.item_n, n_b: agg === "raw" ? B.raw_n : B.item_n,
    shared_tweets: pair?.n, cohen_kappa: pair?.kappa, raw_agreement: pair?.agree,
    a_neg_b_neg: pair?.n00, a_neg_b_pos: pair?.n01, a_pos_b_neg: pair?.n10, a_pos_b_pos: pair?.n11,
    reliability_a: A.reliability, reliability_b: B.reliability, url: location.href
  };
  renderExamples(oc, a, b, pair);
}

document.getElementById("download").addEventListener("click", () => {
  if (current) downloadText(`comparison_${current.outcome}.csv`, toCSV([current]));
});
document.getElementById("copy-link").addEventListener("click", async () => {
  const s = document.getElementById("copy-status");
  try { await navigator.clipboard.writeText(location.href); s.textContent = "Link copied."; }
  catch { s.textContent = location.href; }
});

update();
