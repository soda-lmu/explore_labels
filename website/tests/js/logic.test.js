import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseInstrument, classifyComparison, transitions, lookupPair, pairIndex,
  readState, writeState, signedPp, dec, toCSV, DEFAULT_STATE, partnerDesign
} from "../../src/js/logic.js";

const meta = JSON.parse(readFileSync(new URL("../../src/public/data/meta.json", import.meta.url)));

test("parseInstrument", () => {
  assert.deepEqual(parseInstrument("llm:GPT-5.4:separate__batch"), { source: "llm", model: "GPT-5.4", design: "separate__batch" });
  assert.deepEqual(parseInstrument("human:pooled"), { source: "human", version: "pooled" });
  assert.equal(parseInstrument("nonsense"), null);
});

test("classifyComparison follows the match table", () => {
  const k = (a, b) => classifyComparison(a, b, meta).kind;
  assert.equal(k("human:A", "llm:Llama-4:joint_hs__base"), "human-llm-close");
  assert.equal(k("llm:Llama-4:joint_hs__base", "human:A"), "human-llm-close");
  assert.equal(k("human:B", "llm:Llama-4:separate__base"), "human-llm-shared");
  assert.equal(k("human:D", "llm:Llama-4:separate__batch"), "human-llm-shared");
  assert.equal(k("human:A", "llm:Llama-4:joint_ol__base"), "human-llm-none");
  assert.equal(k("human:A", "human:C"), "human-design");
  assert.equal(k("human:A", "human:pooled"), "human-pooled");
  assert.equal(k("llm:GPT-5.4:joint_ol__base", "llm:GPT-5.4:separate__base"), "llm-design");
  assert.equal(k("llm:GPT-5.4:joint_ol__base", "llm:Llama-4:joint_ol__base"), "llm-model");
  assert.equal(k("llm:GPT-5.4:joint_ol__base", "llm:Llama-4:separate__base"), "llm-both");
  assert.equal(k("human:A", "human:A"), "same");
  // Human panels differ: always carries the panel note
  assert.match(classifyComparison("human:A", "human:C", meta).notes.join(" "), /annotator panel/);
});

test("transitions and kappa", () => {
  const a = [...Array(25).fill(1), ...Array(25).fill(0), null];
  const b = [...Array(20).fill(1), ...Array(5).fill(0), ...Array(10).fill(1), ...Array(15).fill(0), 1];
  const t = transitions(a, b);
  assert.deepEqual([t.n, t.n11, t.n10, t.n01, t.n00], [50, 20, 5, 10, 15]);
  assert.ok(Math.abs(t.kappa - 0.4) < 1e-12);
});

test("lookupPair flips direction", () => {
  const idx = pairIndex([{ outcome: "OL", a: "x", b: "y", n10: 3, n01: 7, prev_a: 0.1, prev_b: 0.2, kappa: 0.5 }]);
  const r = lookupPair(idx, "OL", "y", "x");
  assert.equal(r.n10, 7); assert.equal(r.n01, 3); assert.equal(r.prev_a, 0.2); assert.equal(r.kappa, 0.5);
  assert.equal(lookupPair(idx, "HS", "x", "y"), null);
});

test("URL state round-trips and rejects bad values", () => {
  const s = { ...DEFAULT_STATE, outcome: "OL", a: "human:A" };
  const q = writeState(s, ["outcome", "a", "b"]);
  assert.equal(q, "?outcome=OL&a=human%3AA");
  const back = readState(q);
  assert.equal(back.outcome, "OL"); assert.equal(back.a, "human:A"); assert.equal(back.b, DEFAULT_STATE.b);
  assert.equal(readState("?outcome=XX&agg=zzz").outcome, DEFAULT_STATE.outcome);
  assert.equal(readState("?agg=zzz").agg, DEFAULT_STATE.agg);
});

test("formatters", () => {
  assert.equal(signedPp(0.0123), "+1.2 pp");
  assert.equal(signedPp(-0.05), "−5.0 pp");
  assert.equal(dec(0.756), "0.76");
  assert.equal(dec(-0.1), "-0.10");
  assert.equal(toCSV([{ a: 1, b: 'x,"y"' }, { a: NaN, b: null }]), 'a,b\n1,"x,""y"""\n,\n');
});

test("partnerDesign toggles exactly one factor", () => {
  // The bug this replaces: string surgery on the id turned "batch_conf" into
  // "batch", producing a confidence contrast labelled as a batching contrast.
  assert.equal(partnerDesign("joint_ol__base", meta, "batched"), "joint_ol__batch");
  assert.equal(partnerDesign("joint_ol__batch", meta, "batched"), "joint_ol__base");
  assert.equal(partnerDesign("joint_ol__batch_conf", meta, "batched"), "joint_ol__conf");
  assert.equal(partnerDesign("joint_ol__conf", meta, "batched"), "joint_ol__batch_conf");
  assert.equal(partnerDesign("separate__base", meta, "confidence"), "separate__conf");
  assert.equal(partnerDesign("separate__batch_conf", meta, "confidence"), "separate__batch");
  // structure is never changed
  for (const d of meta.designs) {
    for (const f of ["batched", "confidence"]) {
      const out = partnerDesign(d.design_id, meta, f);
      assert.equal(out.split("__")[0], d.structure);
      assert.notEqual(out, d.design_id);
    }
  }
  assert.equal(partnerDesign("nope", meta, "batched"), null);
});
