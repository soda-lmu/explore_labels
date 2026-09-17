"""Stop the build if the web data do not match the paper's structure and numbers.

Usage: python pipeline/validate_web_data.py [--source PATH_TO/data_work]
Exit code 1 on any failed check.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402

TOL = 1e-6
results: list[tuple[bool, str]] = []


def check(ok, msg):
    results.append((bool(ok), msg))


def cond_to_design():
    m = {}
    for d in C.designs():
        for oc in C.OUTCOMES:
            m[(d[f"condition_{oc}"], oc)] = d["design_id"]
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=C.SOURCE)
    ap.add_argument("--data", type=Path, default=C.OUT)
    a = ap.parse_args()
    D, S = a.data, a.source
    rd = lambda n: pd.read_parquet(D / n)  # noqa: E731

    items = rd("items.parquet")
    inst = rd("instruments.parquet")
    il = rd("item_labels.parquet")
    pw = rd("pairwise.parquet")
    llm = rd("llm_annotations.parquet")
    hum = rd("human_annotations.parquet")
    rp = rd("run_prevalence.parquet")
    meta = json.loads((D / "meta.json").read_text())

    # ------------------------------------------------------------ structure
    check(len(items) == 3000 and items.tweet_id.is_unique, "3,000 unique tweets")
    check(set(llm.tweet_id) == set(items.tweet_id), "LLM tweets == item set")
    check(set(hum.tweet_id) == set(items.tweet_id), "human tweets == item set")
    check(sorted(llm.model.unique()) == sorted(C.MODEL_IDS), "exactly the seven reported models")
    check(llm.groupby("model", observed=True).design_id.nunique().eq(12).all(), "12 designs per model")
    cells = llm.groupby(["outcome", "model", "design_id"], observed=True).run.nunique()
    check((cells == 3).all() and len(cells) == 2 * 7 * 12, "3 runs in all 168 outcome x model x design cells")
    check(set(llm.label.dropna().unique()) <= {0, 1}, "LLM labels binary")
    for oc in C.OUTCOMES:
        n = llm[(llm.outcome == oc)].label.notna().sum()
        check(n == 755_999, f"{oc}: 755,999 eligible LLM labels (paper count), got {n:,}")
    na = llm[llm.label.isna()]
    check(len(na) == 2 and set(na.model) == {"Llama-3.1-8B"},
          f"only the documented Llama 3.1 8B response is unusable (rows: {len(na)})")
    dmeta = {d["design_id"]: d for d in meta["designs"]}
    conf_rows = llm[llm.confidence.notna()]
    check(all(dmeta[d]["confidence_requested"] for d in conf_rows.design_id.unique()),
          "confidence present only where requested")
    check(not llm.duplicated(["tweet_id", "outcome", "model", "design_id", "run"]).any(),
          "no duplicate LLM label keys")

    check(len(hum) == 2 * 44_900, "44,900 human ratings (x2 outcomes)")
    check(hum.annotator.nunique() == 917, "917 annotators")
    check(sorted(hum.version.unique()) == list("ABCDE"), "five human versions")
    per = hum[hum.outcome == "OL"].groupby(["version", "tweet_id"]).size()
    check(((per == 3).sum() == 14_900) and ((per == 3) | (per < 3)).all()
          and (3 * 15_000 - per.sum()) == 100, "3 ratings per tweet-version except 100 missing")
    check(set(hum.label.dropna().unique()) <= {0, 1}, "human labels binary")
    check(pw.n.max() <= 3000, "pairwise comparisons use shared tweets only")

    # ------------------------------------------ paper: run-level prevalences
    ps = pd.read_parquet(Path(__file__).parent / "_cache" / "paper_style_prevalences.parquet")
    ref = pd.read_csv(S / "processed" / "prevalences.csv")
    m = ref.merge(ps, on=["model", "condition"], suffixes=("_ref", ""))
    m = m[m.model.isin(C.MODEL_IDS)]
    check(len(m) == 7 * 16, f"prevalences.csv rows matched: {len(m)}")
    check(np.allclose(m.OL_prev, m.OL, atol=TOL) and np.allclose(m.HS_prev, m.HS, atol=TOL),
          "per model x condition prevalences reproduce processed/prevalences.csv")

    # ---------------------------------------------- paper: agreement ladder
    c2d = cond_to_design()
    out = S / "outputs"
    fw = pd.read_csv(out / "ladder_fleiss_within.csv")
    fw["instrument"] = [f"llm:{m}:{c2d[(c, o)]}" for m, c, o in zip(fw.model, fw.condition, fw.outcome)]
    x = fw.merge(inst.drop(columns=["model"]), on=["instrument", "outcome"])
    diff = (x.kappa - x.reliability).abs()
    bad = x[~(diff < TOL)]
    # Known, intentional difference: the paper's R code returns NA for the one
    # cell containing the unusable Llama 3.1 8B response; the site computes
    # kappa over the 2,999 items with three valid runs.
    known = (bad.model == "Llama-3.1-8B") & (bad.condition == "A") & bad.kappa.isna()
    check(len(x) == 168 and known.all(),
          f"Fleiss within-design kappa reproduces ladder_fleiss_within.csv "
          f"({len(x) - len(bad)}/168 exact; {int(known.sum())} documented NA cell(s) filled)")

    ca = pd.read_csv(out / "ladder_cohen_across.csv")
    ca["a"] = [f"llm:{m}:{c2d[(c, o)]}" for m, c, o in zip(ca.model, ca.cond_a, ca.outcome)]
    ca["b"] = [f"llm:{m}:{c2d[(c, o)]}" for m, c, o in zip(ca.model, ca.cond_b, ca.outcome)]
    both = pd.concat([pw, pw.rename(columns={"a": "b", "b": "a"})])
    x = ca.merge(both, on=["outcome", "a", "b"], suffixes=("_ref", ""))
    check(len(x) == len(ca) == 2 * 7 * 66, f"cross-design pairs matched ({len(x)}/{len(ca)})")
    check(np.allclose(x.kappa_ref, x.kappa, atol=TOL),
          f"cross-design Cohen kappa reproduces ladder_cohen_across.csv (max diff {np.nanmax((x.kappa_ref-x.kappa).abs()):.2e})")
    med = np.median(ca.kappa)

    ch = pd.read_csv(out / "ladder_cohen_human.csv")
    ch["a"] = [f"llm:{m}:{c2d[(c, o)]}" for m, c, o in zip(ch.model, ch.condition, ch.outcome)]
    ch["b"] = "human:pooled"
    x = ch.merge(both, on=["outcome", "a", "b"], suffixes=("_ref", ""))
    check(len(x) == len(ch), "human-reference pairs matched")
    check(np.allclose(x.kappa_ref, x.kappa, atol=TOL), "Cohen kappa vs human majority reproduces ladder_cohen_human.csv")

    lp = pd.read_csv(out / "ladder_per_model.csv")
    wm = fw.groupby("model").kappa.mean()
    check(np.allclose(lp.set_index("model").within_mean.loc[wm.index], wm, atol=TOL), "per-model within means match")

    # --------------------------------------------------- paper: human side
    raw = inst[inst.source == "human"].set_index(["outcome", "version"])
    for oc, prev, sd in [("OL", 56.5, 3.31), ("HS", 30.0, 2.70)]:
        p = raw.loc[(oc, "pooled"), "raw_prev"] * 100
        check(round(p, 1) == prev, f"{oc}: pooled human prevalence {p:.2f}% ≈ {prev}%")
        v = raw.loc[oc].drop("pooled").raw_prev * 100
        check(round(v.std(ddof=1), 2) == sd, f"{oc}: human design SD {v.std(ddof=1):.3f} pp ≈ {sd}")
    for oc, share in [("OL", 31), ("HS", 39)]:
        w = il[(il.outcome == oc) & il.instrument.isin([f"human:{v}" for v in "ABCDE"])]
        w = w.pivot(index="tweet_id", columns="instrument", values="label").astype(float)
        s = (w.std(axis=1, ddof=1) > 0).mean() * 100
        check(abs(s - share) <= 0.5, f"{oc}: majority changes across versions for {s:.1f}% of tweets ≈ {share}%")
    # Kern et al. (2023) Table 1: ratings, annotators, OL %, HS % by version.
    t1 = {"A": (9000, 184, 51.6, 26.8), "B": (9000, 183, 58.8, 29.6), "C": (8950, 182, 58.5, 28.2),
          "D": (8950, 179, 54.4, 33.5), "E": (9000, 189, 59.0, 31.8)}
    ho = hum[hum.outcome == "OL"]
    ok = all(
        (ho.version == v).sum() == n and ho[ho.version == v].annotator.nunique() == na_
        and round(raw.loc[("OL", v), "raw_prev"] * 100, 1) == ol
        and round(raw.loc[("HS", v), "raw_prev"] * 100, 1) == hs
        for v, (n, na_, ol, hs) in t1.items())
    check(ok, "Kern et al. Table 1 (ratings, annotators, OL %, HS % by version) reproduced exactly")
    # Kern et al. Table 2: Krippendorff alpha between version modal labels.
    # Kern's tie rule for tweets with two valid ratings is undocumented, so this
    # is an approximate check; the paper's rule (ties -> positive) is kept.
    t2 = {"OL": {"AB": .653, "AC": .646, "BC": .731, "AD": .629, "BD": .695, "CD": .707,
                 "AE": .655, "BE": .740, "CE": .740, "DE": .724},
          "HS": {"AB": .596, "AC": .545, "BC": .536, "AD": .559, "BD": .579, "CD": .539,
                 "AE": .477, "BE": .505, "CE": .484, "DE": .510}}
    import stats as ST
    errs = []
    for oc, ref in t2.items():
        w = il[(il.outcome == oc) & il.instrument.str.match(r"human:[A-E]$")]
        w = w.pivot(index="tweet_id", columns="instrument", values="label").astype(float)
        for pr, r in ref.items():
            errs.append(abs(ST.krippendorff_alpha_binary(w[[f"human:{pr[0]}", f"human:{pr[1]}"]].to_numpy()) - r))
    check(max(errs) < 0.03, f"Kern et al. Table 2 cross-version alphas within 0.03 "
                            f"(max diff {max(errs):.3f}; {sum(e < .0015 for e in errs)}/20 exact to 3 dp)")

    # --------------------------------------------------------------- report
    fails = [m for ok, m in results if not ok]
    for ok, msg in results:
        print(("  PASS  " if ok else "  FAIL  ") + msg)
    print(f"\n{len(results) - len(fails)}/{len(results)} checks passed. "
          f"(median cross-design kappa in reference file: {med:.3f})")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
