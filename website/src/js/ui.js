// Shared DOM helpers: theme, encodings, controls.
import { parseInstrument, llmId, humanId } from "./logic.js";

export const FAMILY_VAR = { OpenAI: "var(--fam-openai)", Meta: "var(--fam-meta)", Mistral: "var(--fam-mistral)" };
export const HUMAN_VAR = "var(--human)";
// Within a family: first model circle, second square, third triangle (as in the paper).
export const MODEL_SYMBOL = {
  "GPT-4o-mini": "circle", "GPT-5.4": "square",
  "Mistral-Large-3": "circle", "Mistral-Medium-3.5": "square",
  "Llama-3.1-8B": "circle", "Llama-3.1-70B": "square", "Llama-4": "triangle"
};

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

export function initChrome() {
  const btn = document.querySelector(".theme-toggle");
  const root = document.documentElement;
  const saved = (() => { try { return localStorage.getItem("theme"); } catch { return null; } })();
  if (saved) root.dataset.theme = saved;
  const label = () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    btn.textContent = dark ? "Light theme" : "Dark theme";
    return dark;
  };
  if (btn) {
    label();
    btn.addEventListener("click", () => {
      root.dataset.theme = label() ? "light" : "dark";
      try { localStorage.setItem("theme", root.dataset.theme); } catch { /* ignore */ }
      label();
      window.dispatchEvent(new Event("themechange"));
    });
  }
  const here = location.pathname.split("/").pop() || "index.html";
  for (const a of document.querySelectorAll(".site-header nav a")) {
    if (a.getAttribute("href").split("?")[0] === here) a.setAttribute("aria-current", "page");
  }
}

/** Segmented button group. Returns element with .value and dispatches "input". */
export function segmented(options, value, label) {
  const el = h("div", { class: "seg", role: "group", "aria-label": label });
  el.value = value;
  const render = () => {
    for (const b of el.children) b.setAttribute("aria-pressed", String(b.dataset.value === el.value));
  };
  for (const o of options) {
    el.append(h("button", {
      type: "button", "data-value": o.value,
      onclick: () => { el.value = o.value; render(); el.dispatchEvent(new Event("input", { bubbles: true })); }
    }, o.label));
  }
  render();
  el.set = (v) => { el.value = v; render(); };
  return el;
}

export function control(label, input) {
  return h("label", { class: "control" }, h("span", {}, label), input);
}

export function select(options, value, attrs = {}) {
  const el = h("select", attrs, options.map((o) => h("option", { value: o.value, selected: o.value === value }, o.label)));
  return el;
}

export function modelLabel(meta, id) {
  return meta.models.find((m) => m.id === id)?.label ?? id;
}

export function instrumentLabel(meta, id) {
  const p = parseInstrument(id);
  if (!p) return id;
  if (p.source === "human") {
    return p.version === "pooled" ? "People · majority of all 15 ratings" : `Humans · Version ${p.version}`;
  }
  const d = meta.designs.find((x) => x.design_id === p.design);
  return `${modelLabel(meta, p.model)} · ${d ? d.label : p.design}`;
}

export function instrumentColor(meta, id) {
  const p = parseInstrument(id);
  if (!p || p.source === "human") return HUMAN_VAR;
  const fam = meta.models.find((m) => m.id === p.model)?.family;
  return FAMILY_VAR[fam] ?? "currentColor";
}

/**
 * Instrument picker: source (Humans/LLM) + version, or model + structure + variant.
 * Emits "input" with .value = instrument id.
 */
export function instrumentPicker(meta, value, name) {
  const wrap = h("fieldset", { class: "card picker" });
  wrap.append(h("legend", { class: "small muted" }, name));
  const p = parseInstrument(value) ?? { source: "llm", model: meta.models[0].id, design: meta.designs[0].design_id };
  const src = segmented([{ value: "human", label: "Humans" }, { value: "llm", label: "LLM" }], p.source, `${name} source`);
  const version = select([
    ...meta.human_versions.map((v) => ({ value: v.version, label: `Version ${v.version}: ${v.description}` })),
    { value: "pooled", label: "All 15 ratings (paper's human reference)" }
  ], p.version ?? "A");
  const d0 = meta.designs.find((d) => d.design_id === p.design) ?? meta.designs[0];
  const model = select(meta.models.map((m) => ({ value: m.id, label: m.label })), p.model ?? meta.models[0].id);
  const structure = select(meta.structures.map((s) => ({ value: s.id, label: s.label })), d0.structure);
  const variant = select(meta.variants.map((v) => ({ value: v.id, label: v.label })), d0.variant);
  const humanRow = h("div", { class: "controls" }, control("Questionnaire version", version));
  const llmRow = h("div", { class: "controls" },
    control("Model", model), control("Questions asked", structure), control("How it was shown", variant));
  wrap.append(h("div", { class: "controls" }, src), humanRow, llmRow);

  const compute = () => (src.value === "human"
    ? humanId(version.value)
    : llmId(model.value, `${structure.value}__${variant.value}`));
  const sync = () => {
    humanRow.hidden = src.value !== "human";
    llmRow.hidden = src.value !== "llm";
    wrap.value = compute();
  };
  // Child selects and the segmented control fire bubbling "input" events; this
  // listener is registered first, so wrap.value is current for page listeners.
  wrap.addEventListener("input", (e) => { if (e.target !== wrap) sync(); });
  wrap.set = (id) => {
    const q = parseInstrument(id);
    if (!q) return;
    src.set(q.source);
    if (q.source === "human") version.value = q.version;
    else {
      const d = meta.designs.find((x) => x.design_id === q.design);
      model.value = q.model;
      if (d) { structure.value = d.structure; variant.value = d.variant; }
    }
    sync();
  };
  sync();
  return wrap;
}

export function legend(items) {
  return h("div", { class: "legend" }, items.map((it) =>
    h("span", {}, h("span", { class: `sw ${it.shape ?? ""}`, style: `background:${it.color}` }), it.label)));
}

export function familyLegend(meta, withHuman = true) {
  const fams = [...new Set(meta.models.map((m) => m.family))];
  return legend([
    ...fams.map((f) => ({ label: `${f} models`, color: FAMILY_VAR[f], shape: "circle" })),
    ...(withHuman ? [{ label: "Humans", color: HUMAN_VAR, shape: "diamond" }] : [])
  ]);
}

/** One computed sentence under a figure: what the reader should notice. */
export function takeaway(text) {
  return h("p", { class: "takeaway" }, text);
}

export function callout(level, title, notes = []) {
  return h("div", { class: `callout ${level === "ok" ? "ok" : "caution"}`, role: "note" },
    h("strong", {}, title),
    notes.length ? h("ul", {}, notes.map((n) => h("li", {}, n))) : null);
}

/** Read the current value of a CSS custom property (for canvas-free fallbacks). */
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function contentWarning(onAccept) {
  const box = h("div", { class: "callout caution" },
    h("strong", {}, "Content warning. "),
    "The tweets in this corpus include slurs, hateful and offensive language. Text stays hidden until you choose to show it. ",
    h("button", { type: "button", onclick: () => onAccept() }, "Show tweet text"));
  return box;
}
