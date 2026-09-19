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
export function stripPlot(container, rows, { rowOrder, xDomain, highlight, xLabel, ariaLabel, annotations } = {}) {
  const w = width(container);
  const narrow = w < 560;
  const rowH = narrow ? 78 : 62;
  const note = annotations ?? {};
  const plot = Plot.plot({
    width: w,
    height: rowH * rowOrder.length + 64,
    marginBottom: 44,
    marginLeft: narrow ? 10 : 252,
    marginRight: narrow ? 20 : 100,
    marginTop: narrow ? 26 : 12,
    style: baseStyle,
    x: {
      domain: xDomain,
      label: xLabel ?? "Share labeled yes →",
      labelOffset: 34,
      tickFormat: (d) => `${Math.round(d * 100)}%`,
      grid: true,
      nice: true
    },
    y: { axis: null },
    fy: { domain: rowOrder, label: null, axis: narrow ? null : "left", padding: 0.18, tickSize: 0 },
    marks: [
      Plot.ruleY(rowOrder, { fy: (d) => d, y: 0, stroke: "var(--grid)" }),
      narrow
        ? Plot.text(rowOrder, { fy: (d) => d, text: (d) => d, frameAnchor: "top-left", dy: -4, fill: "var(--ink-2)", fontWeight: 500 })
        : null,
      // Dodge so that dense rows read as a distribution instead of one blob,
      // and so that rows whose points coincide still show every point.
      ...familyMarks(rows, (data, color, isLlm) => Plot.dot(data, Plot.dodgeY({ anchor: "middle" }, {
        x: "prev",
        fy: "row",
        symbol: isLlm ? (d) => MODEL_SYMBOL[d.model] : () => "diamond",
        r: (d) => (highlight && highlight(d) ? 6 : 4.5),
        fill: color,
        fillOpacity: (d) => (highlight && !highlight(d) ? 0.35 : 0.9),
        stroke: "var(--surface)",
        strokeWidth: 1.2,
        channels: { Setup: "label", Detail: "detail" },
        tip: { lineWidth: 30, format: { x: (d) => pct(d, 1), y: false, fy: false, symbol: false, r: false, fillOpacity: false } }
      }))),
      // Spread label at the right end of the row it describes, so the reader
      // does not have to match four tiles to four rows by reading.
      narrow || !Object.keys(note).length ? null : Plot.text(rowOrder.filter((r) => note[r]), {
        fy: (d) => d,
        frameAnchor: "right",
        dx: 92,
        text: (d) => note[d],
        fill: "var(--ink-2)",
        fontWeight: 500,
        textAnchor: "end"
      })
    ]
  });
  plot.setAttribute("role", "img");
  if (ariaLabel) plot.setAttribute("aria-label", ariaLabel);
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
export function heatmap(container, cells, { models, designs, mode, refLabel, extent, onPick, outcomeLabel }) {
  const w = width(container, 1100);
  const narrow = w < 700;
  const color = mode === "diff"
    ? { type: "linear", scheme: "BuRd", domain: [-extent, extent], pivot: 0, legend: true,
        label: `Difference from ${refLabel} (pp)`, tickFormat: (d) => `${d > 0 ? "+" : ""}${Math.round(d * 100)}` }
    : { type: "linear", scheme: "Blues", domain: extent, legend: true, label: "Prevalence",
        tickFormat: (d) => `${Math.round(d * 100)}%` };
  const plot = Plot.plot({
    width: w,
    height: 34 * designs.length + 130,
    marginLeft: narrow ? 150 : 210,
    marginTop: 96,
    marginBottom: 24,
    style: baseStyle,
    padding: 0.06,
    color,
    x: { domain: models.map((m) => m.id), tickFormat: (id) => models.find((m) => m.id === id)?.label, tickRotate: -35, label: null, axis: "top" },
    y: { domain: designs.map((d) => d.design_id), tickFormat: (id) => designs.find((d) => d.design_id === id)?.label, label: null },
    marks: [
      Plot.cell(cells, {
        x: "model", y: "design", fill: "value", rx: 3,
        channels: {
          Setup: "modelLabel", "Prompt recipe": "designLabel",
          Prevalence: (d) => pct(d.prev, 1),
          "Runs 1–3": (d) => d.runs ? d.runs.map((r) => pct(r, 1)).join(" · ") : "single value, all human raters",
          ...(mode === "diff" ? { Difference: (d) => `${d.value > 0 ? "+" : ""}${(100 * d.value).toFixed(1)} pp` } : {})
        },
        tip: { lineWidth: 30, format: { x: false, y: false, fill: false } }
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
  plot.setAttribute("role", "img");
  plot.setAttribute("aria-label",
    `Prevalence of ${outcomeLabel ?? "the label"} for each model and prompt recipe. Numbers are percent of tweets.`);
  // Plot draws one <rect> per datum in data order. Attaching handlers to those
  // rects gives a real click target (works on touch) and a keyboard path,
  // instead of depending on the hover tip having set plot.value.
  if (onPick) {
    const rects = plot.querySelectorAll('g[aria-label="cell"] rect');
    rects.forEach((rect, i) => {
      const d = cells[i];
      if (!d) return;
      rect.style.cursor = "pointer";
      rect.setAttribute("tabindex", "0");
      rect.setAttribute("role", "button");
      rect.setAttribute("aria-label", d.kind === "human"
        ? `${d.modelLabel}: ${pct(d.prev, 1)}. Compare this setup.`
        : `${d.modelLabel}, ${d.designLabel}: ${pct(d.prev, 1)}. Compare this setup.`);
      rect.addEventListener("click", () => onPick(d));
      rect.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(d); }
      });
    });
  }
  container.replaceChildren(plot);
  return plot;
}

/** Horizontal bars ranking how much each choice moves the label. */
export function effectBars(container, rows, { xLabel, ariaLabel } = {}) {
  const w = width(container, 760);
  // Below this width the labels do not fit in a left margin, so they go above
  // each bar instead of on an axis.
  const narrow = w < 560;
  const max = Math.max(...rows.map((r) => r.value));
  const plot = Plot.plot({
    width: w,
    height: (narrow ? 62 : 46) * rows.length + 62,
    marginLeft: narrow ? 8 : Math.min(280, Math.max(190, w * 0.34)),
    marginRight: narrow ? 20 : 64,
    marginTop: narrow ? 14 : 8,
    marginBottom: 42,
    style: baseStyle,
    x: { label: xLabel ?? "Percentage points →", labelOffset: 34, grid: true, nice: true, domain: [0, max * (narrow ? 1.06 : 1.14)] },
    y: { domain: rows.map((r) => r.label), label: null, tickSize: 0, axis: narrow ? null : "left" },
    marks: [
      narrow ? Plot.text(rows, {
        x: 0, y: "label", text: "label", frameAnchor: "left", textAnchor: "start",
        dy: -20, fill: "var(--ink-2)", fontWeight: 500
      }) : null,
      Plot.barX(rows, {
        x: "value", y: "label", fill: (d) => d.tone === "human" ? HUMAN_VAR : "var(--fam-openai)",
        fillOpacity: (d) => d.tone === "human" ? 0.85 : 0.9, rx: 3,
        insetTop: narrow ? 14 : 6, insetBottom: narrow ? 2 : 6,
        channels: {
          "Moves prevalence by": (d) => `${d.value.toFixed(1)} percentage points`,
          "Measured as": (d) => d.short ?? d.detail
        },
        tip: { lineWidth: 30, format: { x: false, y: false, fill: false, fillOpacity: false } }
      }),
      Plot.text(rows, {
        x: "value", y: "label", text: (d) => `${d.value.toFixed(1)}`,
        dx: 8, dy: narrow ? 7 : 0, textAnchor: "start", fill: "var(--ink)", fontWeight: 600
      }),
      Plot.ruleX([0], { stroke: "var(--grid)" })
    ]
  });
  plot.setAttribute("role", "img");
  if (ariaLabel) plot.setAttribute("aria-label", ariaLabel);
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

/**
 * Text alternative for a figure: the same numbers as a table, behind a
 * disclosure, so the chart is not the only way to reach the data.
 */
export function figureTable(summary, rows, cols) {
  return h("details", { class: "fig-table" },
    h("summary", {}, summary),
    table(rows, cols));
}
