// Observable Plot figures. Colors come from CSS tokens so light/dark both work.
import * as Plot from "@observablehq/plot";
import { FAMILY_VAR, HUMAN_VAR, MODEL_SYMBOL, h } from "./ui.js";
import { pct } from "./logic.js";

const baseStyle = { background: "transparent", color: "var(--ink)", fontSize: "12px", overflow: "visible" };
const width = (el, max = 1000) => Math.max(300, Math.min(max, (el?.clientWidth || 800)));

function familyMarks(rows, fn) {
  const fams = Object.keys(FAMILY_VAR);
  return [
    ...fams.map((f) => fn(rows.filter((r) => r.source === "llm" && r.family === f), FAMILY_VAR[f], true)),
    fn(rows.filter((r) => r.source === "human"), HUMAN_VAR, false)
  ];
}

/**
 * Rows of prevalence dots on one shared axis ("the diagnostic trap").
 * rows: {row, prev, source, family, model, label, detail}
 */
export function stripPlot(container, rows, { rowOrder, xDomain, highlight } = {}) {
  const w = width(container);
  const narrow = w < 560;
  const plot = Plot.plot({
    width: w,
    height: (narrow ? 70 : 46) * rowOrder.length + 60,
    marginBottom: 40,
    marginLeft: narrow ? 10 : 230,
    marginRight: 20,
    marginTop: narrow ? 24 : 10,
    style: baseStyle,
    x: { domain: xDomain, label: "Share labeled yes →", labelOffset: 34, tickFormat: (d) => `${Math.round(d * 100)}%`, grid: true, nice: true },
    r: { type: "identity" },
    fy: narrow ? { domain: rowOrder, label: null, axis: null, padding: 0.1 } : undefined,
    y: narrow ? { axis: null } : { domain: rowOrder, label: null, tickSize: 0 },
    marks: [
      Plot.ruleY(rowOrder, narrow ? { fy: (d) => d, y: 0, stroke: "var(--grid)" } : { y: (d) => d, stroke: "var(--grid)" }),
      narrow ? Plot.text(rowOrder, { fy: (d) => d, text: (d) => d, frameAnchor: "top-left", dy: -2, fill: "var(--ink-2)", fontWeight: 500 }) : null,
      ...familyMarks(rows, (data, color, isLlm) => Plot.dot(data, {
        x: "prev",
        ...(narrow ? { fy: "row" } : { y: "row" }),
        symbol: isLlm ? (d) => MODEL_SYMBOL[d.model] : () => "diamond",
        r: (d) => (highlight && highlight(d) ? 7 : 5),
        fill: color,
        fillOpacity: (d) => (highlight && !highlight(d) ? 0.35 : 0.9),
        stroke: "var(--surface)",
        strokeWidth: 1.5,
        channels: { Instrument: "label", Detail: "detail" },
        tip: { format: { x: (d) => pct(d, 1), y: false, fy: false, symbol: false, r: false, fillOpacity: false } }
      }))
    ]
  });
  plot.setAttribute("role", "img");
  container.replaceChildren(plot);
  return plot;
}

/** Prevalence of A and B. */
export function pairPlot(container, items) {
  const w = width(container, 700);
  const plot = Plot.plot({
    width: w,
    height: 40 * items.length + 50,
    marginLeft: 36,
    marginRight: 30,
    marginBottom: 40,
    style: baseStyle,
    x: { label: "Share labeled yes →", labelOffset: 34, tickFormat: (d) => `${Math.round(d * 100)}%`, grid: true, nice: true },
    y: { domain: items.map((d) => d.side), label: null },
    marks: [
      ...items.map((d) => Plot.dot([d], {
        x: "prev", y: "side", r: 6, fill: d.color, stroke: "var(--surface)", strokeWidth: 2,
        symbol: d.symbol,
        channels: { Instrument: "label", n: "n" },
        tip: { format: { x: (v) => pct(v, 2), y: false, symbol: false } }
      }))
    ]
  });
  container.replaceChildren(plot);
  return plot;
}

/**
 * Model x design heatmap. cells: {model, modelLabel, design, designLabel, value, prev, runs, runSd}
 * mode "abs" (sequential) or "diff" (diverging around 0).
 */
export function heatmap(container, cells, { models, designs, mode, refLabel, extent }) {
  const w = width(container, 1100);
  const narrow = w < 700;
  const color = mode === "diff"
    ? { type: "linear", scheme: "BuRd", domain: [-extent, extent], pivot: 0, legend: true,
        label: `Difference from ${refLabel} (pp)`, tickFormat: (d) => `${d > 0 ? "+" : ""}${Math.round(d * 100)}` }
    : { type: "linear", scheme: "Blues", domain: extent, legend: true, label: "Prevalence",
        tickFormat: (d) => `${Math.round(d * 100)}%` };
  const plot = Plot.plot({
    width: w,
    height: 34 * designs.length + 120,
    marginLeft: narrow ? 150 : 210,
    marginBottom: 90,
    style: baseStyle,
    padding: 0.06,
    color,
    x: { domain: models.map((m) => m.id), tickFormat: (id) => models.find((m) => m.id === id)?.label, tickRotate: -35, label: null, axis: "bottom" },
    y: { domain: designs.map((d) => d.design_id), tickFormat: (id) => designs.find((d) => d.design_id === id)?.label, label: null },
    marks: [
      Plot.cell(cells, {
        x: "model", y: "design", fill: "value", rx: 3,
        channels: {
          Model: "modelLabel", Design: "designLabel",
          Prevalence: (d) => pct(d.prev, 1),
          "Runs 1–3": (d) => d.runs.map((r) => pct(r, 1)).join(" · "),
          ...(mode === "diff" ? { Difference: (d) => `${d.value > 0 ? "+" : ""}${(100 * d.value).toFixed(1)} pp` } : {})
        },
        tip: { format: { x: false, y: false, fill: false } }
      }),
      Plot.text(cells, {
        x: "model", y: "design",
        text: (d) => mode === "diff" ? `${d.value > 0 ? "+" : ""}${(100 * d.value).toFixed(0)}` : (100 * d.prev).toFixed(0),
        fill: (d) => (Math.abs(mode === "diff" ? d.value / extent : (d.value - extent[0]) / (extent[1] - extent[0])) > (mode === "diff" ? 0.55 : 0.6) ? "white" : "black"),
        fontSize: 11,
        pointerEvents: "none"
      })
    ]
  });
  container.replaceChildren(plot);
  return plot;
}

/** Tiny strip placing the selected conditions (rows with .side "A"/"B") among all conditions. */
export function locator(container, rows) {
  const w = width(container, 700);
  const R = 4, LANES = 9, LANE_PX = 9;
  const plotW = w - 30; // minus margins below
  const xs = rows.map((d) => d.prev);
  const span = Math.max(1e-6, Math.max(...xs) - Math.min(...xs)) * 1.08;
  const minGap = span * ((2 * R + 1) / plotW);
  // Deterministic beeswarm: sweep left to right, take the lane closest to the middle that is free.
  const lastX = new Map();
  const laid = [...rows].sort((a, b) => a.prev - b.prev).map((d) => {
    let lane = 0;
    for (let k = 0; k < LANES; k++) {
      const cand = k % 2 ? Math.ceil(k / 2) : -Math.ceil(k / 2);
      if (!lastX.has(cand) || d.prev - lastX.get(cand) >= minGap) { lane = cand; break; }
      lane = cand;
    }
    lastX.set(lane, d.prev);
    return { ...d, lane };
  });
  const picks = ["A", "B"].map((side) => laid.filter((d) => d.side === side));
  const color = (side) => `var(--pick-${side.toLowerCase()})`;
  const plot = Plot.plot({
    width: w, height: LANES * LANE_PX + 74,
    marginLeft: 10, marginRight: 20, marginTop: 30, marginBottom: 44,
    style: baseStyle,
    x: {
      label: "Where A and B sit among all 90 conditions for this outcome",
      labelAnchor: "center", labelArrow: false, labelOffset: 36,
      tickFormat: (d) => `${Math.round(d * 100)}%`, nice: true
    },
    y: { axis: null, domain: [-(LANES - 1) / 2 - 0.5, (LANES - 1) / 2 + 0.5] },
    marks: [
      Plot.dot(laid.filter((d) => !d.side), { x: "prev", y: "lane", r: R, fill: "var(--ink-3)", fillOpacity: 0.35 }),
      ...picks.map((rs) => Plot.dot(rs, {
        x: "prev", y: "lane", r: R + 2.5, fill: color(rs[0]?.side ?? "A"),
        stroke: "var(--surface)", strokeWidth: 1.5
      })),
      ...picks.map((rs) => Plot.text(rs, {
        x: "prev", y: "lane", text: "side", dy: -14, fontWeight: 600, fill: color(rs[0]?.side ?? "A")
      }))
    ]
  });
  container.replaceChildren(plot);
  return plot;
}

export function table(rows, cols) {
  return h("div", { class: "table-wrap" }, h("table", {},
    h("thead", {}, h("tr", {}, cols.map((c) => h("th", { scope: "col" }, c.label)))),
    h("tbody", {}, rows.map((r) => h("tr", {}, cols.map((c) => h("td", {}, c.format ? c.format(r[c.key], r) : r[c.key])))))));
}
