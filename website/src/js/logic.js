// Pure functions shared by the pages. No DOM, no fetch: unit-tested in tests/js.

export const OUTCOMES = ["OL", "HS"];

/** Parse an instrument id: "llm:<model>:<design>", "human:<version>", "human:pooled". */
export function parseInstrument(id) {
  const [source, a, b] = String(id).split(":");
  if (source === "llm" && a && b) return { source, model: a, design: b };
  if (source === "human" && a) return { source, version: a };
  return null;
}

export const llmId = (model, design) => `llm:${model}:${design}`;
export const humanId = (version) => `human:${version}`;

/**
 * Describe what kind of comparison A vs B is, and what the reader must know.
 * Implements plan guardrails 1, 3, 6 and 7.
 * @returns {{kind: string, title: string, notes: string[], level: "ok"|"caution"}}
 */
export function classifyComparison(a, b, meta) {
  const A = parseInstrument(a);
  const B = parseInstrument(b);
  const notes = [];
  if (!A || !B) return { kind: "invalid", title: "Choose two instruments", notes, level: "caution" };
  if (a === b) {
    return {
      kind: "same",
      title: "Same instrument on both sides",
      notes: ["Pick a different instrument for B. Repeat-run reliability for one instrument is shown in its card."],
      level: "caution"
    };
  }
  const versions = Object.fromEntries(meta.human_versions.map((v) => [v.version, v]));
  if (A.source === "llm" && B.source === "llm") {
    if (A.model === B.model) {
      return { kind: "llm-design", title: "Task-design contrast (same model)", notes, level: "ok" };
    }
    if (A.design === B.design) {
      return { kind: "llm-model", title: "Model contrast (same task design)", notes, level: "ok" };
    }
    notes.push("Both the model and the task design differ, so the difference mixes two sources of variation.");
    return { kind: "llm-both", title: "Model and task design both differ", notes, level: "caution" };
  }
  if (A.source === "human" && B.source === "human") {
    if (A.version === "pooled" || B.version === "pooled") {
      notes.push("The pooled 15-rating majority includes this version's own ratings, so agreement is inflated by construction.");
      return { kind: "human-pooled", title: "Human version vs. pooled human majority", notes, level: "caution" };
    }
    notes.push("Each version was rated by a different, randomly assigned annotator panel. The difference includes panel sampling variation, not only questionnaire design.");
    return { kind: "human-design", title: "Questionnaire-version contrast", notes, level: "caution" };
  }
  // human vs LLM
  const H = A.source === "human" ? A : B;
  const L = A.source === "human" ? B : A;
  notes.push("Human labels are a benchmark, not ground truth.");
  if (H.version === "pooled") {
    return { kind: "human-llm-reference", title: "LLM vs. human reference (all 15 ratings)", notes, level: "ok" };
  }
  const v = versions[H.version];
  if (v && v.closest_llm_design === L.design) {
    notes.push(v.match_note);
    const close = v.match_status === "close";
    return {
      kind: close ? "human-llm-close" : "human-llm-shared",
      title: close ? "Close structural match" : "Shared-feature comparison",
      notes,
      level: close ? "ok" : "caution"
    };
  }
  notes.push(`This LLM design is not the closest analogue of human Version ${H.version}; the two instruments differ in more than one feature.`);
  return { kind: "human-llm-none", title: "No direct design analogue", notes, level: "caution" };
}

/** Transition counts between two aligned label arrays (null/NaN = missing). */
export function transitions(a, b) {
  let n11 = 0, n10 = 0, n01 = 0, n00 = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x == null || y == null || Number.isNaN(x) || Number.isNaN(y)) continue;
    if (x === 1 && y === 1) n11++;
    else if (x === 1) n10++;
    else if (y === 1) n01++;
    else n00++;
  }
  const n = n11 + n10 + n01 + n00;
  const po = n ? (n11 + n00) / n : NaN;
  const pa = n ? (n11 + n10) / n : NaN;
  const pb = n ? (n11 + n01) / n : NaN;
  const pe = pa * pb + (1 - pa) * (1 - pb);
  const kappa = Math.abs(1 - pe) < 1e-12 ? NaN : (po - pe) / (1 - pe);
  return { n, n11, n10, n01, n00, agree: po, prevA: pa, prevB: pb, kappa };
}

/** Look up a precomputed pair in either orientation, flipping directional counts if needed. */
export function lookupPair(index, outcome, a, b) {
  const r = index.get(`${outcome}|${a}|${b}`);
  if (r) return { ...r };
  const s = index.get(`${outcome}|${b}|${a}`);
  if (!s) return null;
  return { ...s, a, b, n10: s.n01, n01: s.n10, prev_a: s.prev_b, prev_b: s.prev_a };
}

export function pairIndex(rows) {
  const m = new Map();
  for (const r of rows) m.set(`${r.outcome}|${r.a}|${r.b}`, r);
  return m;
}

// ------------------------------------------------------------------ format
export const pct = (x, d = 1) => (x == null || Number.isNaN(x) ? "—" : `${(100 * x).toFixed(d)}%`);
export const num = (x) => (x == null || Number.isNaN(x) ? "—" : Number(x).toLocaleString("en-US"));
export const dec = (x, d = 2) => {
  if (x == null || Number.isNaN(x)) return "—";
  const s = Number(x).toFixed(d);
  return s.replace(/^(-?)0\./, "$1.");
};
export function signedPp(diff, d = 1) {
  if (diff == null || Number.isNaN(diff)) return "—";
  const pp = 100 * diff;
  const sign = pp > 0 ? "+" : pp < 0 ? "−" : "±";
  return `${sign}${Math.abs(pp).toFixed(d)} pp`;
}
export function bp(diff) {
  if (diff == null || Number.isNaN(diff)) return "—";
  const v = Math.round(10000 * diff);
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toLocaleString("en-US")} bp`;
}

// ------------------------------------------------------------------- state
export const DEFAULT_STATE = {
  outcome: "HS",
  a: "llm:GPT-4o-mini:joint_ol__base",
  b: "llm:GPT-4o-mini:joint_ol__batch",
  agg: "item", // "item" (modal/majority per tweet) | "raw" (every label)
  model: "GPT-4o-mini",
  view: "abs", // landscape: "abs" | "diff"
  ref: "human:pooled",
  designs: "all", // "all" | "noconf"
  show_text: "0"
};

export function readState(search, defaults = DEFAULT_STATE) {
  const p = new URLSearchParams(search);
  const out = { ...defaults };
  for (const k of Object.keys(defaults)) if (p.has(k)) out[k] = p.get(k);
  if (!OUTCOMES.includes(out.outcome)) out.outcome = defaults.outcome;
  if (!["item", "raw"].includes(out.agg)) out.agg = defaults.agg;
  return out;
}

export function writeState(state, keys, defaults = DEFAULT_STATE) {
  const p = new URLSearchParams();
  for (const k of keys) if (state[k] != null && state[k] !== defaults[k]) p.set(k, state[k]);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Build a CSV string from an array of flat objects. */
export function toCSV(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null || (typeof v === "number" && Number.isNaN(v))) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}
