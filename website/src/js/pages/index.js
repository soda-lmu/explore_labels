import { loadMeta, loadInstruments, loadRunPrevalence } from "../data.js";
import { h, initChrome, segmented, control, select, familyLegend, modelLabel, takeaway } from "../ui.js";
import { humanFigure, llmFigure } from "../instruments.js";
import { stripPlot, figureTable } from "../charts.js";
import { readState, writeState, num, pct, llmId, humanId, partnerDesign } from "../logic.js";

initChrome();

const [meta, inst, runs] = await Promise.all([loadMeta(), loadInstruments(), loadRunPrevalence()]);
const state = readState(location.search, { outcome: "HS", model: "GPT-4o-mini", design: "joint_ol__base", sel: "" });
const famOf = Object.fromEntries(meta.models.map((m) => [m.id, m.family]));
const designOf = Object.fromEntries(meta.designs.map((d) => [d.design_id, d]));
const outcomeLabel = (oc) => meta.outcomes.find((o) => o.id === oc).label;

// ---------------------------------------------------------------- section 1
const outcomeSeg = segmented(meta.outcomes.map((o) => ({ value: o.id, label: o.label })), state.outcome, "Label");
const modelSel = select(meta.models.map((m) => ({ value: m.id, label: m.label })), state.model);
const designSel = select(meta.designs.map((d) => ({ value: d.design_id, label: d.label })), state.design);
document.getElementById("trap-controls").append(
  control("Label", outcomeSeg), control("Model", modelSel), control("Prompt recipe (top row)", designSel));
document.getElementById("trap-legend").append(familyLegend(meta));

const ROWS = {
  runs: "Same setup, run 3 times",
  designs: "One model, 12 prompt recipes",
  models: "7 models × 12 recipes",
  humans: "5 human versions"
};

function range(values) {
  const v = values.filter(Number.isFinite);
  return Math.max(...v) - Math.min(...v);
}

function renderTrap() {
  const oc = state.outcome, m = state.model, d = state.design;
  const r = runs.filter((x) => x.outcome === oc);
  const cells = inst.filter((x) => x.outcome === oc && x.source === "llm");
  const humans = inst.filter((x) => x.outcome === oc && x.source === "human" && x.version !== "pooled");
  const dl = (id) => designOf[id]?.label;
  const rows = [
    ...r.filter((x) => x.model === m && x.design_id === d).map((x) => ({
      row: ROWS.runs, prev: x.prev, source: "llm", family: famOf[m], model: m,
      label: `${modelLabel(meta, m)} · ${dl(d)}`, detail: `Run ${x.run} · n = ${num(x.n)}`
    })),
    ...cells.filter((x) => x.model === m).map((x) => ({
      row: ROWS.designs, prev: x.raw_prev, source: "llm", family: famOf[m], model: m,
      label: x.label, detail: "mean of 3 runs", design: x.design_id
    })),
    ...cells.map((x) => ({
      row: ROWS.models, prev: x.raw_prev, source: "llm", family: famOf[x.model], model: x.model,
      label: x.label, detail: "mean of 3 runs"
    })),
    ...humans.map((x) => ({
      row: ROWS.humans, prev: x.raw_prev, source: "human", label: x.label,
      detail: `${num(x.raw_n)} ratings`
    }))
  ];
  const all = rows.map((x) => x.prev);
  const spreadOf = (row) => range(rows.filter((x) => x.row === row).map((x) => x.prev));
  const spreads = Object.values(ROWS).map((row) => [row, spreadOf(row)]);
  const noteFor = Object.fromEntries(spreads.map(([row, v]) => [row, `spread ${v < 0.1 ? (100 * v).toFixed(1) : Math.round(100 * v)} pts`]));

  stripPlot(document.getElementById("trap-plot"), rows, {
    rowOrder: Object.values(ROWS),
    xDomain: [Math.min(...all) - 0.02, Math.max(...all) + 0.02],
    highlight: (x) => x.row !== ROWS.models || x.model === m,
    xLabel: `Share of tweets labeled ${outcomeLabel(oc).toLowerCase()} →`,
    ariaLabel: `Four rows of dots on one axis. Each dot is one setup's share of ${outcomeLabel(oc).toLowerCase()} labels. ` +
      spreads.map(([row, v]) => `${row}: spread ${(100 * v).toFixed(1)} points.`).join(" "),
    annotations: noteFor
  });

  document.getElementById("trap-tiles").replaceChildren(...[
    ["Re-running one setup", spreadOf(ROWS.runs)],
    ["Switching prompt recipe", spreadOf(ROWS.designs)],
    ["Switching model or recipe", spreadOf(ROWS.models)],
    ["Switching questionnaire version", spreadOf(ROWS.humans)]
  ].map(([k, v]) =>
    h("div", { class: "tile" }, h("div", { class: "k" }, k),
      h("div", { class: "v" }, `${(100 * v).toFixed(1)} points`),
      h("div", { class: "s" }, "highest share minus lowest"))));

  // Computed takeaways, so the reader is not asked to derive them by eye.
  const runSpread = spreadOf(ROWS.runs);
  const allSpread = spreadOf(ROWS.models);
  const humanHi = Math.max(...humans.map((x) => x.raw_prev));
  const llmAbove = cells.filter((x) => x.raw_prev > humanHi).length;
  document.getElementById("trap-takeaway").replaceChildren(
    takeaway(`Re-running the same setup moves the share by ${(100 * runSpread).toFixed(1)} points. ` +
      `Changing the model or the prompt moves it by up to ${(100 * allSpread).toFixed(0)} points. ` +
      `Labels that repeat almost perfectly are not therefore stable.`),
    takeaway(`${llmAbove} of the ${cells.length} LLM setups call more tweets ${outcomeLabel(oc).toLowerCase()} ` +
      `than any of the five human versions did (the highest human version is ${pct(humanHi)}).`));

  document.getElementById("trap-note").textContent =
    `Each dot is one setup. LLM dots average 3 runs; larger dots in the third row are ${modelLabel(meta, m)}. ` +
    `Dots are nudged apart vertically where they would otherwise overlap.`;

  // Text alternative for the figure.
  document.getElementById("trap-table").replaceChildren(figureTable("Show these numbers as a table",
    spreads.map(([row, v]) => {
      const vals = rows.filter((x) => x.row === row).map((x) => x.prev);
      return { row, n: vals.length, lo: Math.min(...vals), hi: Math.max(...vals), spread: v };
    }), [
      { key: "row", label: "What changes" },
      { key: "n", label: "Setups" },
      { key: "lo", label: "Lowest share", format: (v) => pct(v) },
      { key: "hi", label: "Highest share", format: (v) => pct(v) },
      { key: "spread", label: "Spread", format: (v) => `${(100 * v).toFixed(1)} pts` }
    ]));

  // Presets. The partner recipe is derived by toggling one factor, so the
  // label always describes the contrast the link actually opens.
  const batchPartner = partnerDesign(d, meta, "batched");
  const confPartner = partnerDesign(d, meta, "confidence");
  const presets = [
    batchPartner && {
      label: `${modelLabel(meta, m)}: one tweet at a time vs. six at once`,
      a: llmId(m, designOf[d].batched ? batchPartner : d),
      b: llmId(m, designOf[d].batched ? d : batchPartner)
    },
    confPartner && {
      label: `${modelLabel(meta, m)}: with vs. without a confidence score`,
      a: llmId(m, designOf[d].confidence_requested ? confPartner : d),
      b: llmId(m, designOf[d].confidence_requested ? d : confPartner)
    },
    { label: "Same recipe, two models: GPT-4o-mini vs. Llama 3.1 8B", a: llmId("GPT-4o-mini", d), b: llmId("Llama-3.1-8B", d) },
    { label: "Human version A vs. the closest LLM recipe", a: humanId("A"), b: llmId(m, "joint_hs__base") },
    { label: "Human version A vs. human version D", a: humanId("A"), b: humanId("D") }
  ].filter(Boolean);
  document.getElementById("presets").replaceChildren(...presets.map((p) =>
    h("a", { class: "chip card", href: `compare.html${writeState({ outcome: oc, a: p.a, b: p.b }, ["outcome", "a", "b"], {})}` }, p.label)));
}

function sync() {
  state.outcome = outcomeSeg.value;
  state.model = modelSel.value;
  state.design = designSel.value;
  history.replaceState(null, "", writeState(state, ["outcome", "model", "design", "sel"],
    { outcome: "HS", model: "GPT-4o-mini", design: "joint_ol__base", sel: "" }) || location.pathname);
  renderTrap();
}
for (const el of [outcomeSeg, modelSel, designSel]) el.addEventListener("input", sync);
window.addEventListener("themechange", renderTrap);
let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderTrap, 150); });

humanFigure(document.getElementById("human-fig"));
llmFigure(document.getElementById("llm-fig"), meta);

sync();
