import { loadMeta, loadInstruments, loadRunPrevalence } from "../data.js";
import { h, initChrome, segmented, control, select, familyLegend, modelLabel } from "../ui.js";
import { humanFigure, llmFigure } from "../instruments.js";
import { stripPlot } from "../charts.js";
import { readState, writeState, num, llmId, humanId } from "../logic.js";

initChrome();

const [meta, inst, runs] = await Promise.all([loadMeta(), loadInstruments(), loadRunPrevalence()]);
const state = readState(location.search, { outcome: "HS", model: "GPT-4o-mini", design: "joint_ol__base", sel: "" });
const famOf = Object.fromEntries(meta.models.map((m) => [m.id, m.family]));
const designOf = Object.fromEntries(meta.designs.map((d) => [d.design_id, d]));

// ---------------------------------------------------------------- section 1
const outcomeSeg = segmented(meta.outcomes.map((o) => ({ value: o.id, label: o.label })), state.outcome, "Outcome");
const modelSel = select(meta.models.map((m) => ({ value: m.id, label: m.label })), state.model);
const designSel = select(meta.designs.map((d) => ({ value: d.design_id, label: d.label })), state.design);
document.getElementById("trap-controls").append(
  control("Label", outcomeSeg), control("Model", modelSel), control("Prompt condition (top row)", designSel));
document.getElementById("trap-legend").append(familyLegend(meta));

const ROWS = {
  runs: "Same model and prompt, 3 runs",
  designs: "Same model, 12 prompt conditions",
  models: "All 7 models × 12 conditions",
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
  stripPlot(document.getElementById("trap-plot"), rows, {
    rowOrder: Object.values(ROWS),
    xDomain: [Math.min(...all) - 0.02, Math.max(...all) + 0.02],
    highlight: (x) => x.row !== ROWS.models || x.model === m
  });
  const spreads = [
    ["Across 3 runs of one setup", range(rows.filter((x) => x.row === ROWS.runs).map((x) => x.prev))],
    ["Across 12 prompt conditions", range(rows.filter((x) => x.row === ROWS.designs).map((x) => x.prev))],
    ["Across all models and conditions", range(rows.filter((x) => x.row === ROWS.models).map((x) => x.prev))],
    ["Across 5 human versions", range(rows.filter((x) => x.row === ROWS.humans).map((x) => x.prev))]
  ];
  document.getElementById("trap-tiles").replaceChildren(...spreads.map(([k, v]) =>
    h("div", { class: "tile" }, h("div", { class: "k" }, k),
      h("div", { class: "v" }, `${(100 * v).toFixed(1)} points`),
      h("div", { class: "s" }, "highest share minus lowest"))));
  document.getElementById("trap-note").textContent =
    `Share of all labels that say ${meta.outcomes.find((o) => o.id === oc).label.toLowerCase()}. ` +
    `LLM dots average 3 runs; larger dots in the third row are ${modelLabel(meta, m)}. Hover a dot for details.`;

  // presets
  const presets = [
    { label: `${modelLabel(meta, m)}: one tweet vs. six at once`, a: llmId(m, d), b: llmId(m, d.replace(/__.*/, "__batch")) === llmId(m, d) ? llmId(m, d.replace(/__.*/, "__base")) : llmId(m, d.replace(/__.*/, "__batch")) },
    { label: "GPT-4o-mini vs. Llama 3.1 8B", a: llmId("GPT-4o-mini", d), b: llmId("Llama-3.1-8B", d) },
    { label: "Human version A vs. the most similar LLM prompt", a: humanId("A"), b: llmId(m, "joint_hs__base") },
    { label: `${modelLabel(meta, m)} vs. all human labels`, a: llmId(m, d), b: humanId("pooled") },
    { label: "Human version A vs. version D", a: humanId("A"), b: humanId("D") }
  ];
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

humanFigure(document.getElementById("human-fig"));
llmFigure(document.getElementById("llm-fig"), meta);

sync();
