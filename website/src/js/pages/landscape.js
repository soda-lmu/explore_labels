import { loadMeta, loadInstruments, loadRunPrevalence, downloadText } from "../data.js";
import { h, initChrome, segmented, control, select, familyLegend, modelLabel, takeaway } from "../ui.js";
import { heatmap, stripPlot, table, effectBars, figureTable } from "../charts.js";
import { readState, writeState, pct, num, dec, llmId, humanId, toCSV } from "../logic.js";

initChrome();

const [meta, inst, runs] = await Promise.all([loadMeta(), loadInstruments(), loadRunPrevalence()]);
const DEF = { outcome: "HS", view: "abs", ref: "human:pooled", designs: "all", models: "", sort: "meta" };
const state = readState(location.search, DEF);
const famOf = Object.fromEntries(meta.models.map((m) => [m.id, m.family]));
const outcomeLabel = (oc) => meta.outcomes.find((o) => o.id === oc).label;
const range = (v) => Math.max(...v) - Math.min(...v);
const median = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const outcomeSeg = segmented(meta.outcomes.map((o) => ({ value: o.id, label: o.label })), state.outcome, "Label");
const viewSeg = segmented([{ value: "abs", label: "Prevalence" }, { value: "diff", label: "Difference from reference" }], state.view, "Display");
const refSel = select([
  { value: humanId("pooled"), label: "Human reference (all 15 ratings)" },
  ...meta.human_versions.map((v) => ({ value: humanId(v.version), label: `Human Version ${v.version}` })),
  { value: "model-mean", label: "Each model's own mean" }
], state.ref);
const designSeg = segmented([{ value: "all", label: "All 12 task designs" }, { value: "noconf", label: "No-confidence designs" }], state.designs, "Task designs");
const sortSel = select([
  { value: "meta", label: "Order in the paper" },
  { value: "prev", label: "Lowest to highest prevalence" },
  { value: "spread", label: "Least to most prompt-sensitive" }
], state.sort);
const modelBoxes = h("div", { class: "chips", role: "group", "aria-label": "Models" },
  meta.models.map((m) => h("label", { class: "chip card" },
    h("input", { type: "checkbox", value: m.id, checked: !state.models || state.models.split(",").includes(m.id) }), ` ${m.label}`)));
document.getElementById("controls").append(
  control("Label", outcomeSeg), control("Show", viewSeg), control("Reference", refSel),
  control("Task designs", designSeg), control("Sort models by", sortSel), control("Models", modelBoxes));
document.getElementById("dist-legend").append(familyLegend(meta));
for (const el of [outcomeSeg, viewSeg, refSel, designSeg, sortSel, modelBoxes]) el.addEventListener("input", render);
window.addEventListener("themechange", render);
let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });

let rowsForTable = [];

// ------------------------------------------------- what moves the label most
/**
 * Four effect sizes on one scale, each the spread in prevalence caused by
 * changing exactly one thing and holding everything else fixed.
 */
function whatMoves(oc, allDesigns) {
  const byInst = new Map(inst.filter((r) => r.outcome === oc).map((r) => [r.instrument, r]));
  const runBy = new Map();
  for (const r of runs.filter((x) => x.outcome === oc)) {
    const k = llmId(r.model, r.design_id);
    if (!runBy.has(k)) runBy.set(k, []);
    runBy.get(k).push(r.prev);
  }
  const cellPrev = (m, d) => byInst.get(llmId(m, d)).raw_prev;
  const models = meta.models.map((m) => m.id);
  const designs = allDesigns.map((d) => d.design_id);

  const runSpreads = [...runBy.values()].map(range);
  // one model, every task design
  const promptSpreads = models.map((m) => range(designs.map((d) => cellPrev(m, d))));
  // one task design, every model
  const modelSpreads = designs.map((d) => range(models.map((m) => cellPrev(m, d))));
  const humanPrev = meta.human_versions.map((v) => byInst.get(humanId(v.version)).raw_prev);

  const worstPrompt = models
    .map((m) => ({ m, v: range(designs.map((d) => cellPrev(m, d))) }))
    .sort((a, b) => b.v - a.v)[0];
  const bestPrompt = models
    .map((m) => ({ m, v: range(designs.map((d) => cellPrev(m, d))) }))
    .sort((a, b) => a.v - b.v)[0];

  return {
    bars: [
      { label: "Re-running the same setup", value: 100 * median(runSpreads), short: "median spread across 3 runs", detail: "median spread across 3 runs of one setup" },
      { label: "Changing instrument version", value: 100 * range(humanPrev), tone: "human", short: "spread across the 5 versions", detail: "spread across the 5 human versions" },
      { label: "Changing the task design", value: 100 * median(promptSpreads), short: "median over the 7 models", detail: "median across models of the spread over 12 task designs" },
      { label: "Changing the model", value: 100 * median(modelSpreads), short: "median over the 12 task designs", detail: "median across task designs of the spread over 7 models" }
    ],
    worstPrompt, bestPrompt,
    promptSpreads, modelSpreads
  };
}

function renderWhatMoves(oc, designs) {
  const w = whatMoves(oc, designs);
  const bars = [...w.bars].sort((a, b) => a.value - b.value);
  effectBars(document.getElementById("what-moves-fig"), bars, {
    xLabel: `Percentage points of ${outcomeLabel(oc).toLowerCase()} prevalence →`,
    ariaLabel: `Bar chart ranking four choices by how much each moves prevalence. ` +
      bars.map((b) => `${b.label}: ${b.value.toFixed(1)} points.`).join(" ")
  });
  const modelEff = w.bars[3].value, promptEff = w.bars[2].value;
  document.getElementById("what-moves-takeaway").replaceChildren(
    takeaway(`Which model you pick typically moves prevalence about ${(modelEff / promptEff).toFixed(1)}× as much as ` +
      `which task design you use — and both dwarf re-running the same setup, which moves it by ` +
      `${w.bars[0].value.toFixed(1)} points.`),
    takeaway(`The averages hide a lot. For ${modelLabel(meta, w.worstPrompt.m)} the task design alone moves prevalence ` +
      `${(100 * w.worstPrompt.v).toFixed(0)} points — as much as switching model does. For ` +
      `${modelLabel(meta, w.bestPrompt.m)} it moves it only ${(100 * w.bestPrompt.v).toFixed(1)}. ` +
      `"How prompt-sensitive is this model?" has no single answer.`),
    takeaway(`Every LLM choice here moves the label more than the five human instrument versions did ` +
      `(${w.bars[1].value.toFixed(1)} points), even though those versions were designed to differ.`));
  document.getElementById("what-moves-table").replaceChildren(
    figureTable("Show these numbers as a table", bars.map((b) => ({ ...b, value: b.value })), [
      { key: "label", label: "What changes" },
      { key: "value", label: "Moves prevalence by", format: (v) => `${v.toFixed(1)} pts` },
      { key: "detail", label: "How it is measured" }
    ]));
}

function render() {
  state.outcome = outcomeSeg.value;
  state.view = viewSeg.value;
  state.ref = refSel.value;
  state.designs = designSeg.value;
  state.sort = sortSel.value;
  const chosen = [...modelBoxes.querySelectorAll("input:checked")].map((i) => i.value);
  state.models = chosen.length === meta.models.length ? "" : chosen.join(",");
  // Disabled rather than hidden, so the control row does not jump.
  refSel.disabled = state.view !== "diff";
  refSel.closest("label").classList.toggle("is-disabled", refSel.disabled);
  history.replaceState(null, "", writeState(state, Object.keys(DEF), DEF) || location.pathname);

  const oc = state.outcome;
  const designs = meta.designs.filter((d) => state.designs === "all" || !d.confidence_requested);
  const byInst = new Map(inst.filter((r) => r.outcome === oc).map((r) => [r.instrument, r]));

  renderWhatMoves(oc, designs);

  let models = meta.models.filter((m) => chosen.includes(m.id));
  const meanOf = (m) => designs.reduce((a, d) => a + byInst.get(llmId(m, d.design_id)).raw_prev, 0) / designs.length;
  const spreadOf = (m) => {
    const v = designs.map((d) => byInst.get(llmId(m, d.design_id)).raw_prev);
    return Math.max(...v) - Math.min(...v);
  };
  if (state.sort === "prev") models = [...models].sort((a, b) => meanOf(a.id) - meanOf(b.id));
  if (state.sort === "spread") models = [...models].sort((a, b) => spreadOf(a.id) - spreadOf(b.id));

  const runMap = new Map();
  for (const r of runs.filter((x) => x.outcome === oc)) {
    const k = llmId(r.model, r.design_id);
    if (!runMap.has(k)) runMap.set(k, []);
    runMap.get(k)[r.run - 1] = r.prev;
  }
  const modelMean = Object.fromEntries(meta.models.map((m) => [m.id, meanOf(m.id)]));
  const refLabel = state.ref === "model-mean" ? "model mean" : (state.ref === "human:pooled" ? "human reference" : `human Version ${state.ref.split(":")[1]}`);

  const humans = meta.human_versions.map((v) => byInst.get(humanId(v.version)));
  const overallModelMean = models.length
    ? models.reduce((a, m) => a + modelMean[m.id], 0) / models.length : NaN;
  const refValFor = (id) => state.ref === "model-mean" ? (modelMean[id] ?? overallModelMean) : byInst.get(state.ref).raw_prev;

  const cells = [];
  for (const m of models) for (const d of designs) {
    const r = byInst.get(llmId(m.id, d.design_id));
    const prev = r.raw_prev;
    cells.push({
      model: m.id, modelLabel: m.label, design: d.design_id, designLabel: d.label,
      prev, runs: runMap.get(llmId(m.id, d.design_id)), runSd: r.run_sd,
      value: state.view === "diff" ? prev - refValFor(m.id) : prev,
      reliability: r.reliability, kind: "llm"
    });
  }
  const el = document.getElementById("heatmap");
  const empty = !cells.length;
  if (empty) el.replaceChildren(h("p", { class: "muted" }, "Select at least one model."));
  const vals = cells.map((c) => c.value);
  const extent = state.view === "diff"
    ? Math.max(0.05, ...vals.map(Math.abs))
    : [Math.min(...vals), Math.max(...vals)];
  if (!empty) {
    heatmap(el, cells, {
      models, designs, mode: state.view, refLabel, extent, outcomeLabel: outcomeLabel(oc),
      onPick: (v) => {
        location.href = `compare.html?${new URLSearchParams({ outcome: oc, a: llmId(v.model, v.design), b: humanId("pooled") })}`;
      }
    });
    const lo = cells.reduce((a, b) => (a.prev < b.prev ? a : b));
    const hi = cells.reduce((a, b) => (a.prev > b.prev ? a : b));
    const humanLo = humans.reduce((a, b) => (a.raw_prev < b.raw_prev ? a : b));
    const humanHi = humans.reduce((a, b) => (a.raw_prev > b.raw_prev ? a : b));
    const humansInside = humanLo.raw_prev >= lo.prev && humanHi.raw_prev <= hi.prev;
    document.getElementById("heatmap-takeaway").replaceChildren(takeaway(
      `Columns differ more than rows: the choice of model moves prevalence further than the choice of task design. ` +
      `The extremes here are ${hi.modelLabel} · ${hi.designLabel} at ${pct(hi.prev)} and ` +
      `${lo.modelLabel} · ${lo.designLabel} at ${pct(lo.prev)} — on the same 3,000 tweets.`),
      takeaway(`The five human versions (${humanLo.label} at ${pct(humanLo.raw_prev)} to ${humanHi.label} at ${pct(humanHi.raw_prev)}) ` +
        `${humansInside ? "sit inside the range of the LLM setups shown" : "reach outside the range of the LLM setups shown"} — see them plotted below.`));
  } else {
    document.getElementById("heatmap-takeaway").replaceChildren();
  }

  // distribution strip: every cell and every human version on one axis
  const rows = [
    ...cells.map((c) => ({
      row: "LLM setups (model × task design)", prev: c.prev, source: "llm", family: famOf[c.model], model: c.model,
      label: `${c.modelLabel} · ${c.designLabel}`, detail: `runs ${c.runs.map((x) => pct(x)).join(" · ")}`
    })),
    ...cells.flatMap((c) => c.runs.map((p, i) => ({
      row: "Individual runs (3 per setup)", prev: p, source: "llm", family: famOf[c.model], model: c.model,
      label: `${c.modelLabel} · ${c.designLabel}`, detail: `run ${i + 1}`
    }))),
    ...humans.map((r) => ({
      row: "Human versions (5)", prev: r.raw_prev, source: "human", label: r.label,
      detail: `${num(r.raw_n)} ratings`
    }))
  ];
  const all = rows.map((r) => r.prev);
  stripPlot(document.getElementById("dist"), rows, {
    rowOrder: ["Human versions (5)", "LLM setups (model × task design)", "Individual runs (3 per setup)"],
    xDomain: [Math.min(...all) - 0.02, Math.max(...all) + 0.02],
    xLabel: `Share of tweets labeled ${outcomeLabel(oc).toLowerCase()} →`,
    ariaLabel: `Every selected LLM setup, every individual run, and the five human versions on one prevalence axis.`
  });
  const hv = humans.map((r) => r.raw_prev);
  const cellTiles = empty ? [["LLM setups shown", "—"]] : [
    ["LLM setups shown", `${pct(Math.min(...cells.map((c) => c.prev)))}–${pct(Math.max(...cells.map((c) => c.prev)))}`],
    ["Typical run-to-run SD", `${(100 * Math.sqrt(cells.reduce((a, c) => a + c.runSd ** 2, 0) / cells.length)).toFixed(2)} pp`]
  ];
  document.getElementById("spread").replaceChildren(...[
    ...cellTiles,
    ["Human versions", `${pct(Math.min(...hv))}–${pct(Math.max(...hv))}`]
  ].map(([k, v]) => h("div", { class: "tile" }, h("div", { class: "k" }, k), h("div", { class: "v" }, v))));

  rowsForTable = cells.map((c) => ({
    outcome: oc, model: c.model, design: c.design, design_label: c.designLabel,
    prevalence: c.prev, run1: c.runs[0], run2: c.runs[1], run3: c.runs[2],
    run_sd_pp: 100 * c.runSd, fleiss_kappa: c.reliability,
    ...(state.view === "diff" ? { reference: refLabel, diff_pp: 100 * c.value } : {})
  }));
  document.getElementById("table").replaceChildren(table(rowsForTable, [
    { key: "model", label: "Model", format: (v) => modelLabel(meta, v) },
    { key: "design_label", label: "Task design" },
    { key: "prevalence", label: "Prevalence", format: (v) => pct(v) },
    { key: "run1", label: "Run 1", format: (v) => pct(v) },
    { key: "run2", label: "Run 2", format: (v) => pct(v) },
    { key: "run3", label: "Run 3", format: (v) => pct(v) },
    { key: "fleiss_kappa", label: "Repeat-run agreement (Fleiss κ)", format: (v) => dec(v) },
    ...(state.view === "diff" ? [{ key: "diff_pp", label: `vs ${refLabel}`, format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} pp` }] : [])
  ]));
}

document.getElementById("download").addEventListener("click", () =>
  downloadText(`landscape_${state.outcome}.csv`, toCSV(rowsForTable)));

render();
