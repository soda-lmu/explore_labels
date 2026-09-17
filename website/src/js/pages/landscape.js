import { loadMeta, loadInstruments, loadRunPrevalence, downloadText } from "../data.js";
import { h, initChrome, segmented, control, select, familyLegend, modelLabel } from "../ui.js";
import { heatmap, stripPlot, table } from "../charts.js";
import { readState, writeState, pct, num, llmId, humanId, toCSV } from "../logic.js";

initChrome();

const [meta, inst, runs] = await Promise.all([loadMeta(), loadInstruments(), loadRunPrevalence()]);
const DEF = { outcome: "HS", view: "abs", ref: "human:pooled", designs: "all", models: "" };
const state = readState(location.search, DEF);
const famOf = Object.fromEntries(meta.models.map((m) => [m.id, m.family]));

const outcomeSeg = segmented(meta.outcomes.map((o) => ({ value: o.id, label: o.label })), state.outcome, "Outcome");
const viewSeg = segmented([{ value: "abs", label: "Prevalence" }, { value: "diff", label: "Difference from reference" }], state.view, "Display");
const refSel = select([
  { value: humanId("pooled"), label: "Human reference (all 15 ratings)" },
  ...meta.human_versions.map((v) => ({ value: humanId(v.version), label: `Human Version ${v.version}` })),
  { value: "model-mean", label: "Each model's own mean" }
], state.ref);
const designSeg = segmented([{ value: "all", label: "All 12 designs" }, { value: "noconf", label: "No-confidence designs" }], state.designs, "Designs");
const modelBoxes = h("div", { class: "chips", role: "group", "aria-label": "Models" },
  meta.models.map((m) => h("label", { class: "chip card" },
    h("input", { type: "checkbox", value: m.id, checked: !state.models || state.models.split(",").includes(m.id) }), ` ${m.label}`)));
document.getElementById("controls").append(
  control("Outcome", outcomeSeg), control("Show", viewSeg), control("Reference", refSel),
  control("Designs", designSeg), control("Models", modelBoxes));
document.getElementById("dist-legend").append(familyLegend(meta));
for (const el of [outcomeSeg, viewSeg, refSel, designSeg, modelBoxes]) el.addEventListener("input", render);
window.addEventListener("themechange", render);
let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });

let rowsForTable = [];

function render() {
  state.outcome = outcomeSeg.value;
  state.view = viewSeg.value;
  state.ref = refSel.value;
  state.designs = designSeg.value;
  const chosen = [...modelBoxes.querySelectorAll("input:checked")].map((i) => i.value);
  state.models = chosen.length === meta.models.length ? "" : chosen.join(",");
  refSel.closest("label").hidden = state.view !== "diff";
  history.replaceState(null, "", writeState(state, Object.keys(DEF), DEF) || location.pathname);

  const oc = state.outcome;
  const models = meta.models.filter((m) => chosen.includes(m.id));
  const designs = meta.designs.filter((d) => state.designs === "all" || !d.confidence_requested);
  const byInst = new Map(inst.filter((r) => r.outcome === oc).map((r) => [r.instrument, r]));
  const runMap = new Map();
  for (const r of runs.filter((x) => x.outcome === oc)) {
    const k = llmId(r.model, r.design_id);
    if (!runMap.has(k)) runMap.set(k, []);
    runMap.get(k)[r.run - 1] = r.prev;
  }
  const modelMean = Object.fromEntries(meta.models.map((m) => {
    const v = designs.map((d) => byInst.get(llmId(m.id, d.design_id)).raw_prev);
    return [m.id, v.reduce((a, b) => a + b, 0) / v.length];
  }));
  const refVal = (m) => state.ref === "model-mean" ? modelMean[m] : byInst.get(state.ref).raw_prev;
  const refLabel = state.ref === "model-mean" ? "model mean" : (state.ref === "human:pooled" ? "human reference" : `human Version ${state.ref.split(":")[1]}`);

  const cells = [];
  for (const m of models) for (const d of designs) {
    const r = byInst.get(llmId(m.id, d.design_id));
    const prev = r.raw_prev;
    cells.push({
      model: m.id, modelLabel: m.label, design: d.design_id, designLabel: d.label,
      prev, runs: runMap.get(llmId(m.id, d.design_id)), runSd: r.run_sd,
      value: state.view === "diff" ? prev - refVal(m.id) : prev,
      reliability: r.reliability
    });
  }
  const el = document.getElementById("heatmap");
  if (!cells.length) { el.replaceChildren(h("p", { class: "muted" }, "Select at least one model.")); return; }
  const vals = cells.map((c) => c.value);
  const extent = state.view === "diff"
    ? Math.max(0.05, ...vals.map(Math.abs))
    : [Math.min(...vals), Math.max(...vals)];
  const plot = heatmap(el, cells, { models, designs, mode: state.view, refLabel, extent });
  plot.addEventListener("click", () => {
    const v = plot.value; // the datum under the pointer (set by the tip interaction)
    if (v) location.href = `compare.html?${new URLSearchParams({ outcome: oc, a: llmId(v.model, v.design), b: humanId("pooled") })}`;
  });

  // distribution strip: every cell and every human version on one axis
  const humans = meta.human_versions.map((v) => byInst.get(humanId(v.version)));
  const rows = [
    ...cells.map((c) => ({
      row: "LLM cells (model × design)", prev: c.prev, source: "llm", family: famOf[c.model], model: c.model,
      label: `${c.modelLabel} · ${c.designLabel}`, detail: `runs ${c.runs.map((x) => pct(x)).join(" · ")}`
    })),
    ...cells.flatMap((c) => c.runs.map((p, i) => ({
      row: "LLM runs (3 per cell)", prev: p, source: "llm", family: famOf[c.model], model: c.model,
      label: `${c.modelLabel} · ${c.designLabel}`, detail: `run ${i + 1}`
    }))),
    ...humans.map((r) => ({
      row: "Human questionnaire versions", prev: r.raw_prev, source: "human", label: r.label,
      detail: `${num(r.raw_n)} ratings`
    }))
  ];
  const all = rows.map((r) => r.prev);
  stripPlot(document.getElementById("dist"), rows, {
    rowOrder: ["Human questionnaire versions", "LLM cells (model × design)", "LLM runs (3 per cell)"],
    xDomain: [Math.min(...all) - 0.02, Math.max(...all) + 0.02]
  });
  const range = (v) => Math.max(...v) - Math.min(...v);
  const sd = (v) => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)); };
  const hv = humans.map((r) => r.raw_prev);
  document.getElementById("spread").replaceChildren(...[
    ["LLM cells shown", `${pct(Math.min(...cells.map((c) => c.prev)))}–${pct(Math.max(...cells.map((c) => c.prev)))}`, `${cells.length} cells · range ${(100 * range(cells.map((c) => c.prev))).toFixed(1)} pp`],
    ["Human versions", `${pct(Math.min(...hv))}–${pct(Math.max(...hv))}`, `5 versions · SD ${(100 * sd(hv)).toFixed(2)} pp`],
    ["Typical run-to-run SD", `${(100 * Math.sqrt(cells.reduce((a, c) => a + c.runSd ** 2, 0) / cells.length)).toFixed(2)} pp`, "root mean square over the cells shown"]
  ].map(([k, v, s]) => h("div", { class: "tile" }, h("div", { class: "k" }, k), h("div", { class: "v" }, v), h("div", { class: "s" }, s))));

  rowsForTable = cells.map((c) => ({
    outcome: oc, model: c.model, design: c.design, design_label: c.designLabel,
    prevalence: c.prev, run1: c.runs[0], run2: c.runs[1], run3: c.runs[2],
    run_sd_pp: 100 * c.runSd, fleiss_kappa: c.reliability,
    ...(state.view === "diff" ? { reference: refLabel, diff_pp: 100 * c.value } : {})
  }));
  document.getElementById("table").replaceChildren(table(rowsForTable, [
    { key: "model", label: "Model", format: (v) => modelLabel(meta, v) },
    { key: "design_label", label: "Design" },
    { key: "prevalence", label: "Prevalence", format: (v) => pct(v) },
    { key: "run1", label: "Run 1", format: (v) => pct(v) },
    { key: "run2", label: "Run 2", format: (v) => pct(v) },
    { key: "run3", label: "Run 3", format: (v) => pct(v) },
    { key: "fleiss_kappa", label: "Fleiss κ", format: (v) => v.toFixed(2) },
    ...(state.view === "diff" ? [{ key: "diff_pp", label: `vs ${refLabel}`, format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} pp` }] : [])
  ]));
}

document.getElementById("download").addEventListener("click", () =>
  downloadText(`landscape_${state.outcome}.csv`, toCSV(rowsForTable)));

render();
