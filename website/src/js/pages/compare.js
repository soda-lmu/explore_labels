import { loadMeta, loadInstruments, loadPairwise, loadItemLabels, loadItems, loadItemProfiles, downloadText } from "../data.js";
import {
  h, initChrome, segmented, control, instrumentPicker, instrumentLabel,
  contentWarning, callout, takeaway
} from "../ui.js";
import { locator } from "../charts.js";
import {
  readState, writeState, parseInstrument, classifyComparison, lookupPair, pairIndex,
  pct, num, dec, signedPp, toCSV
} from "../logic.js";

initChrome();

const [meta, inst, pairs] = await Promise.all([loadMeta(), loadInstruments(), loadPairwise()]);
const index = pairIndex(pairs);
const state = readState(location.search);
const KEYS = ["outcome", "a", "b", "agg", "show_text"];
const byKey = new Map(inst.map((r) => [`${r.outcome}|${r.instrument}`, r]));
const outcomeLabel = (oc) => meta.outcomes.find((o) => o.id === oc).label;

// ------------------------------------------------------------------ controls
const outcomeSeg = segmented(meta.outcomes.map((o) => ({ value: o.id, label: o.label })), state.outcome, "Label");
const aggSeg = segmented([
  { value: "item", label: "One label per tweet" },
  { value: "raw", label: "Every individual label" }
], state.agg, "Prevalence basis");
document.getElementById("global-controls").append(control("Label", outcomeSeg));
const pickA = instrumentPicker(meta, state.a, "Setup A");
const pickB = instrumentPicker(meta, state.b, "Setup B");
const swap = h("button", { type: "button", class: "swap",
  onclick: () => { const a = pickA.value; pickA.set(pickB.value); pickB.set(a); update(); } }, "⇄ Swap A and B");
document.getElementById("pickers").append(pickA, pickB);
document.getElementById("swap-slot").append(swap);
document.getElementById("agg-control").append(control("Count prevalence over", aggSeg));

for (const el of [outcomeSeg, aggSeg, pickA, pickB]) el.addEventListener("input", update);

// ------------------------------------------------------------------ starters
// Landing here from the nav used to drop the reader straight into two dropdowns.
const STARTERS = [
  { label: "Same model, one tweet vs. six per prompt", a: "llm:GPT-4o-mini:joint_ol__base", b: "llm:GPT-4o-mini:joint_ol__batch" },
  { label: "Same prompt, two models", a: "llm:GPT-4o-mini:joint_ol__base", b: "llm:Llama-3.1-8B:joint_ol__base" },
  { label: "People vs. an LLM", a: "human:pooled", b: "llm:GPT-4o-mini:joint_hs__base" },
  { label: "Two human questionnaire versions", a: "human:A", b: "human:D" }
];
document.getElementById("starters").replaceChildren(...STARTERS.map((s) =>
  h("button", { type: "button", class: "chip card",
    onclick: () => { pickA.set(s.a); pickB.set(s.b); update(); document.getElementById("comparison").scrollIntoView({ block: "start" }); } },
    s.label)));

// ------------------------------------------------------------------ cards
function card(side, r) {
  const p = parseInstrument(r.instrument);
  const isHuman = p.source === "human";
  const unit = isHuman ? "ratings" : "labels";
  const repeatUnit = isHuman ? "3 people" : "3 runs";
  const rows = [
    ["Share labeled yes (every label)", `${pct(r.raw_prev)} (${num(r.raw_pos)} of ${num(r.raw_n)} ${unit})`],
    ["Share labeled yes (one label per tweet)", `${pct(r.item_prev)} (${num(r.item_pos)} of ${num(r.item_n)} tweets)`],
    ["How the tweet's one label is decided", isHuman
      ? "the label given by at least 2 of the 3 people"
      : "the label given in at least 2 of the 3 runs"],
    r.reliability_stat
      ? [`Agreement within this setup (${repeatUnit})`,
         `${dec(r.reliability)} — ${r.reliability_stat.replace(/ \(.*\)/, "")}, over ${num(r.reliability_n)} tweets`]
      : ["Agreement within this setup", "not defined for the pooled reference"],
    isHuman && Number.isFinite(r.alpha) ? ["Krippendorff's α (3 annotators)", dec(r.alpha)] : null,
    !isHuman ? ["Spread across the 3 runs", `${(100 * r.run_sd).toFixed(2)} pp (standard deviation)`] : null,
    !isHuman ? ["Confidence scores", r.conf_requested ? `requested · valid for ${pct(r.conf_valid_rate)} · mean ${r.conf_mean.toFixed(0)}` : "not requested in this recipe"] : null
  ].filter(Boolean);
  return h("div", { class: `card card-${side.toLowerCase()}` },
    h("h3", {}, h("span", { class: `pick-dot pick-${side.toLowerCase()}`, "aria-hidden": "true" }), `${side}: ${instrumentLabel(meta, r.instrument)}`),
    h("div", { class: "table-wrap" }, h("table", {}, h("tbody", {}, rows.map(([k, v]) => h("tr", {}, h("th", { scope: "row", style: "text-align:left;font-weight:500" }, k), h("td", { style: "white-space:normal" }, v)))))));
}

// ------------------------------------------------------------------ examples
let showText = state.show_text === "1";
let shown = 6;
let sortBy = "contested";
async function renderExamples(oc, a, b, pair) {
  const box = document.getElementById("examples");
  if (a === b || !pair) { box.replaceChildren(); return; }
  if (!showText) {
    box.replaceChildren(
      h("p", { class: "small" }, `${num(pair.n10)} tweets are labeled yes by A and no by B; ${num(pair.n01)} go the other way.`),
      contentWarning(() => { showText = true; state.show_text = "1"; update(); }));
    return;
  }
  box.replaceChildren(h("p", { class: "loading" }, "Loading tweets…"));
  const [labels, items, profiles] = await Promise.all([loadItemLabels(oc, [a, b]), loadItems(), loadItemProfiles()]);
  const decoder = document.createElement("textarea");
  const decode = (t) => { decoder.innerHTML = t ?? ""; return decoder.value; };
  const text = new Map(items.map((t) => [t.tweet_id, decode(t.text)]));
  const prof = new Map(profiles.filter((p) => p.outcome === oc).map((p) => [p.tweet_id, p]));

  // "Why did this flip?" is the question. Contested tweets — where people
  // themselves split — are the informative ones, so offer that order first.
  const contestedness = (id) => {
    const p = prof.get(id);
    return p ? -Math.abs((p.human_share_pos ?? 0.5) - 0.5) : -1;
  };
  const order = (rows) => sortBy === "contested"
    ? [...rows].sort((x, y) => contestedness(y.tweet_id) - contestedness(x.tweet_id))
    : [...rows].sort((x, y) => x.tweet_id - y.tweet_id);
  const pick = (from, to) => order(labels.filter((r) => r[a] === from && r[b] === to)).slice(0, shown);

  const verdict = (yes, side) => h("span", { class: `verdict ${yes ? "yes" : "no"} pick-${side}` },
    `${side.toUpperCase()}: ${yes ? "yes" : "no"}`);
  const tweetItem = (r, aYes, bYes) => {
    const p = prof.get(r.tweet_id);
    return h("li", {},
      h("div", { class: "tw-head" },
        h("span", { class: "id" }, `tweet ${r.tweet_id}`),
        verdict(aYes, "a"), verdict(bYes, "b")),
      h("div", { class: "tw-body" }, text.get(r.tweet_id)),
      p ? h("div", { class: "tw-context small muted" },
        `Across all people: ${pct(p.human_share_pos)} said yes. Across all LLM setups: ${pct(p.llm_share_pos)} said yes.`) : null);
  };
  const list = (rows, aYes, bYes) => rows.length
    ? h("ul", { class: "tweets" }, rows.map((r) => tweetItem(r, aYes, bYes)))
    : h("p", { class: "muted small" }, "None.");

  const aOnly = pick(1, 0), bOnly = pick(0, 1);
  const sortSeg = segmented([
    { value: "contested", label: "Most contested first" },
    { value: "id", label: "Tweet order" }
  ], sortBy, "Sort flipped tweets");
  sortSeg.addEventListener("input", () => { sortBy = sortSeg.value; renderExamples(oc, a, b, pair); });

  box.replaceChildren(
    h("div", { class: "controls" },
      control("Order", sortSeg),
      h("button", { type: "button", onclick: () => { showText = false; state.show_text = "0"; update(); } }, "Hide text")),
    h("p", { class: "small muted" },
      "“Across all people” is the share of all 15 human ratings of that tweet that said yes; " +
      "“across all LLM setups” is the share of the 84 LLM setups. Flips cluster on tweets where people themselves disagree."),
    h("div", { class: "grid two" },
      h("div", {}, h("h4", {}, `A says yes, B says no (${num(pair.n10)})`), list(aOnly, true, false)),
      h("div", {}, h("h4", {}, `A says no, B says yes (${num(pair.n01)})`), list(bOnly, false, true))),
    shown < Math.max(pair.n10, pair.n01)
      ? h("button", { type: "button", onclick: () => { shown += 6; renderExamples(oc, a, b, pair); } }, "Show 6 more of each")
      : null);
}

/**
 * The reliability-vs-sensitivity line, phrased to match the numbers rather
 * than assuming A is highly repeatable — some setups are not.
 */
function repeatSentence(rel, flips, n) {
  const share = pct(flips / n);
  const counts = `${num(flips)} of ${num(n)} tweets (${share})`;
  if (rel >= 0.75) {
    return `Setup A repeats itself almost exactly (agreement within A: ${dec(rel)}). ` +
      `But switching from A to B changes the label on ${counts}. ` +
      `A setup can be highly repeatable and still be highly sensitive to how the question was asked — they are different properties.`;
  }
  if (rel >= 0.5) {
    return `Setup A repeats itself only moderately (agreement within A: ${dec(rel)}), ` +
      `and switching from A to B changes the label on ${counts}. ` +
      `Neither number alone tells you the labels are sound: the first is about repeating the same setup, the second about changing it.`;
  }
  return `Setup A does not agree with itself well (agreement within A: ${dec(rel)}), ` +
    `and switching from A to B changes the label on ${counts}. ` +
    `Here the labels are unstable both ways — within the setup and between setups.`;
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
  document.getElementById("cards").replaceChildren(card("A", A), card("B", B));

  // Guardrails: what kind of contrast this is, and what it does and does not
  // support. Previously computed and discarded.
  document.getElementById("guardrail").replaceChildren(callout(cls.level, cls.title, cls.notes));

  document.getElementById("agg-note").textContent = agg === "raw"
    ? "Every individual label counted separately: about 9,000 per setup."
    : "Each tweet counted once, using the label it got in at least 2 of 3 runs or from at least 2 of 3 people: 3,000 per setup.";

  const key = agg === "raw" ? "raw" : "item";
  const all = inst.filter((r) => r.outcome === oc).map((r) => ({
    prev: r[`${key}_prev`],
    side: r.instrument === a ? "A" : r.instrument === b ? "B" : null
  }));
  locator(document.getElementById("locator"), all);

  const pair = a === b ? null : lookupPair(index, oc, a, b);
  const pa = A[`${key}_prev`], pb = B[`${key}_prev`];
  const diff = pb - pa;
  const flips = pair ? pair.n10 + pair.n01 : NaN;

  // The headline: the concrete count first, the coefficients after it.
  const tiles = [
    ["Tweets that get a different label", pair ? num(flips) : "—", pair ? `${pct(flips / pair.n)} of the ${num(pair.n)} shared tweets` : "", "flip"],
    ["Difference in share labeled yes", signedPp(diff), "B minus A"],
    ["Share labeled yes, A", pct(pa), agg === "raw" ? `${num(A.raw_n)} labels` : `${num(A.item_n)} tweets`, "a"],
    ["Share labeled yes, B", pct(pb), agg === "raw" ? `${num(B.raw_n)} labels` : `${num(B.item_n)} tweets`, "b"],
    ["Tweets labeled the same way", pair ? pct(pair.agree) : "—", "raw agreement"],
    ["Cohen's κ", pair ? dec(pair.kappa) : "—", "agreement above chance"]
  ];
  document.getElementById("cmp-tiles").replaceChildren(...tiles.map(([k, v, sub, pick]) =>
    h("div", { class: `tile${pick ? ` tile-pick pick-${pick}` : ""}` },
      h("div", { class: "k" }, k), h("div", { class: "v" }, v), h("div", { class: "s" }, sub))));

  // Reliability and sensitivity answer different questions. Say so with the
  // page's own numbers rather than leaving them in separate boxes.
  const relA = Number.isFinite(A.reliability) ? A.reliability : null;
  const relB = Number.isFinite(B.reliability) ? B.reliability : null;
  const rel = relA ?? relB;
  document.getElementById("headline").replaceChildren(
    pair && rel != null
      ? takeaway(repeatSentence(relA ?? rel, flips, pair.n))
      : h("p", { class: "muted" }, "Choose two different setups."));

  const m = document.getElementById("matrix");
  if (pair) {
    const cell = (v, flip) => h("td", { class: `cell${flip ? " flip" : ""}` }, num(v), h("div", { class: "small muted" }, pct(v / pair.n)));
    m.replaceChildren(h("div", { class: "table-wrap" }, h("table", { class: "matrix" },
      h("caption", { class: "small muted", style: "caption-side:bottom;text-align:left;padding-top:.4rem" },
        `Rows: the label A gave. Columns: the label B gave. Shaded cells are the tweets the two setups disagree on. ${outcomeLabel(oc)}.`),
      h("thead", {}, h("tr", {}, h("th", {}, ""), h("th", { scope: "col", class: "pick-b" }, "B says no"), h("th", { scope: "col", class: "pick-b" }, "B says yes"))),
      h("tbody", {},
        h("tr", {}, h("th", { scope: "row", class: "pick-a" }, "A says no"), cell(pair.n00, false), cell(pair.n01, true)),
        h("tr", {}, h("th", { scope: "row", class: "pick-a" }, "A says yes"), cell(pair.n10, true), cell(pair.n11, false))))));
  } else {
    m.replaceChildren(h("p", { class: "muted" }, "Choose two different setups."));
  }

  const aggText = agg === "raw"
    ? "the share of positive labels among every eligible LLM run label or every human rating"
    : "the share of tweets whose single label is positive";
  document.getElementById("method-short").textContent =
    `${outcomeLabel(oc)}. “Share labeled yes” is ${aggText}. Agreement and flips always compare one label per tweet, ` +
    `on the ${pair ? num(pair.n) : "—"} tweets that have a label under both setups.`;
  document.getElementById("method-long").textContent =
    "Cohen's κ corrects raw agreement for the agreement you would expect by chance given each setup's prevalence, " +
    "so it can look low even when the two setups agree on most tweets. Raw agreement is always shown next to it for that reason. " +
    "Agreement within a setup (reliability) and agreement between two setups (sensitivity) answer different questions: " +
    "a high κ inside A says nothing about how A compares with B.";

  current = {
    outcome: oc, instrument_a: a, label_a: instrumentLabel(meta, a), instrument_b: b, label_b: instrumentLabel(meta, b),
    comparison_type: cls.title, comparison_caveats: cls.notes.join(" "),
    prevalence_basis: agg === "raw" ? "label-level" : "item-level",
    prev_a: pa, prev_b: pb, diff_pp: 100 * diff,
    n_a: agg === "raw" ? A.raw_n : A.item_n, n_b: agg === "raw" ? B.raw_n : B.item_n,
    shared_tweets: pair?.n, cohen_kappa: pair?.kappa, raw_agreement: pair?.agree, flips,
    a_neg_b_neg: pair?.n00, a_neg_b_pos: pair?.n01, a_pos_b_neg: pair?.n10, a_pos_b_pos: pair?.n11,
    reliability_a: A.reliability, reliability_b: B.reliability, url: location.href
  };
  shown = 6;
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
