"""Build the website data package from the paper's reproducibility repo.

Usage:  python pipeline/build_web_data.py [--source PATH_TO/data_work]

Reads the raw LLM CSVs and processed/kern_full.csv, applies the paper's
parsing and eligibility rules (process_raw_data.R, 00_utils.R, 05_confidence.R)
and writes Parquet + JSON into src/data/ for the site.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402
import stats as S  # noqa: E402

RUNS = ["R1", "R2", "R3"]
OL_TOKENS = {"OL", "NO"}
HS_TOKENS = {"HS", "NH"}
_ol_re = re.compile(r"(?<!N)OL")
_hs_re = re.compile(r"(?<!N)HS")


def split_literal(x) -> list[str]:
    if not isinstance(x, str):
        return []
    x = re.sub(r"^\s*\[|\]\s*$", "", x)
    return [re.sub(r"['\"]", "", t).strip() for t in re.split(r"\s*,\s*", x)]


def parse_label(label):
    """process_raw_data.R::parse_label -> (OL, HS) with NaN for a missing response."""
    if not isinstance(label, str):
        return np.nan, np.nan
    s = re.sub(r"\[|\]|'", "", label)
    return float(bool(_ol_re.search(s))), float(bool(_hs_re.search(s)))


def parse_scores(label, score):
    """05_confidence.R::parse_scores -> (conf_OL, conf_HS), aligned on the token."""
    toks = [t.upper() for t in split_literal(label)]
    if not isinstance(score, str):
        return np.nan, np.nan
    vals = []
    for v in split_literal(score):
        try:
            vals.append(float(v))
        except ValueError:
            vals.append(np.nan)
    if len(toks) != len(vals):
        return np.nan, np.nan
    pairs = [(t, v) for t, v in zip(toks, vals) if np.isfinite(v) and 0 <= v <= 100]
    c_ol = next((v for t, v in pairs if t in OL_TOKENS), np.nan)
    c_hs = next((v for t, v in pairs if t in HS_TOKENS), np.nan)
    return c_ol, c_hs


# --------------------------------------------------------------------------- LLM

def load_llm(source: Path) -> tuple[pd.DataFrame, dict]:
    designs = C.designs()
    # condition -> {outcome: design_id} for the outcomes that condition elicits
    cond_to_design: dict[str, dict[str, str]] = {}
    for d in designs:
        for oc in C.OUTCOMES:
            cond_to_design.setdefault(d[f"condition_{oc}"], {})[oc] = d["design_id"]

    frames, files = [], []
    for folder, model in C.MODEL_DIRS.items():
        for f in sorted((source / "raw" / folder).glob("*.csv")):
            raw = pd.read_csv(f, dtype=str)
            files.append({"model": model, "file": f"raw/{folder}/{f.name}", "rows": len(raw),
                          "sha256": hashlib.sha256(f.read_bytes()).hexdigest()})
            for r in RUNS:
                lab = raw[f"{r}_label"]
                sc = raw[f"{r}_score"] if f"{r}_score" in raw else pd.Series([None] * len(raw))
                parsed = [parse_label(x) for x in lab]
                conf = [parse_scores(l, s) for l, s in zip(lab, sc)]
                frames.append(pd.DataFrame({
                    "tweet_id": raw["tweet_id"].astype(int),
                    "condition": raw["condition"],
                    "model": model,
                    "run": int(r[1]),
                    "batch_id": pd.to_numeric(raw.get("batch_id"), errors="coerce"),
                    "OL": [p[0] for p in parsed], "HS": [p[1] for p in parsed],
                    "conf_OL": [c[0] for c in conf], "conf_HS": [c[1] for c in conf],
                }))
    wide = pd.concat(frames, ignore_index=True)
    qc = {"raw_files": files, "raw_response_rows": int(len(wide))}

    # Long by outcome, keeping only elicited outcomes (the eligible() rule).
    longs = []
    for oc in C.OUTCOMES:
        m = wide["condition"].map(lambda c: oc in cond_to_design.get(c, {}))
        d = wide.loc[m, ["tweet_id", "condition", "model", "run", "batch_id", oc, f"conf_{oc}"]].copy()
        d.columns = ["tweet_id", "condition", "model", "run", "batch_id", "label", "confidence"]
        d["outcome"] = oc
        d["design_id"] = d["condition"].map(lambda c: cond_to_design[c][oc])
        longs.append(d)
        qc[f"structural_rows_excluded_{oc}"] = int((~m).sum())
    llm = pd.concat(longs, ignore_index=True)
    unknown = set(wide["condition"]) - set(cond_to_design)
    if unknown:
        raise SystemExit(f"Unknown conditions in raw data: {unknown}")
    qc["unusable_labels"] = {oc: int(llm.loc[llm.outcome == oc, "label"].isna().sum()) for oc in C.OUTCOMES}
    return llm, qc, wide


# ------------------------------------------------------------------------- human

def load_human(source: Path) -> pd.DataFrame:
    k = pd.read_csv(source / "processed" / "kern_full.csv")
    return k


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=C.SOURCE)
    ap.add_argument("--out", type=Path, default=C.OUT)
    args = ap.parse_args()
    src, out = args.source, args.out
    if not (src / "raw").exists():
        raise SystemExit(f"Source data not found at {src}. Run pipeline/fetch_sources.sh first.")
    out.mkdir(parents=True, exist_ok=True)

    print("Loading LLM annotations ...")
    llm, qc, wide = load_llm(src)
    for oc in C.OUTCOMES:
        print(f"  eligible LLM labels, {oc}: {llm.loc[llm.outcome == oc, 'label'].notna().sum():,}")
    print("Loading human annotations ...")
    kern = load_human(src)

    designs = C.designs()
    design_order = [d["design_id"] for d in designs]

    # ---------------------------------------------------------------- items
    txt = kern.groupby("tweet_id").agg(text=("tweet_hashed", "first"),
                                       original_split=("original_split", "first")).reset_index()
    items = txt.sort_values("tweet_id").reset_index(drop=True)

    # ------------------------------------------------------ human annotations
    ann_ids = {a: i + 1 for i, a in enumerate(sorted(kern["id"].unique(),
               key=lambda v: hashlib.sha256(f"label-explore:{v}".encode()).hexdigest()))}
    kern = kern.assign(annotator=kern["id"].map(ann_ids))
    kern["slot"] = kern.groupby(["version", "tweet_id"]).cumcount() + 1
    human = pd.concat([
        pd.DataFrame({"tweet_id": kern["tweet_id"], "version": kern["version"],
                      "annotator": kern["annotator"], "slot": kern["slot"],
                      "outcome": oc, "label": kern[col]})
        for oc, col in [("OL", "offensive_language"), ("HS", "hate_speech")]
    ], ignore_index=True)

    # ------------------------------------------------ item-level instruments
    tweet_ids = items["tweet_id"].to_numpy()
    tix = pd.Index(tweet_ids)
    instruments, item_rows, run_prev_rows = [], [], []
    label_mats = {oc: [] for oc in C.OUTCOMES}
    inst_order = {oc: [] for oc in C.OUTCOMES}
    model_meta = {m[0]: m for m in C.MODELS}

    for oc in C.OUTCOMES:
        # LLM cells
        d_oc = llm[llm["outcome"] == oc]
        g = d_oc.groupby(["model", "design_id", "tweet_id"])["label"]
        cell = pd.DataFrame({"mean": g.mean(), "n_pos": g.sum(min_count=1), "n": g.count()}).reset_index()
        for mid in C.MODEL_IDS:
            for did in design_order:
                c = cell[(cell.model == mid) & (cell.design_id == did)].set_index("tweet_id").reindex(tix)
                lab = S.modal(c["mean"].to_numpy())
                iid = f"llm:{mid}:{did}"
                label_mats[oc].append(lab)
                inst_order[oc].append(iid)
                raw = d_oc[(d_oc.model == mid) & (d_oc.design_id == did)]
                pr_raw = S.prevalence(raw["label"])
                pr_item = S.prevalence(lab)
                full = c[c["n"] == 3]
                kappa = S.fleiss_kappa_binary(full["n_pos"].to_numpy(), 3)
                runs = raw.groupby("run")["label"].agg(["mean", "count"])
                for r, row in runs.iterrows():
                    run_prev_rows.append({"outcome": oc, "model": mid, "design_id": did, "run": int(r),
                                          "prev": row["mean"], "n": int(row["count"])})
                conf = raw["confidence"]
                dz = next(x for x in designs if x["design_id"] == did)
                instruments.append({
                    "instrument": iid, "outcome": oc, "source": "llm", "model": mid, "design_id": did,
                    "version": None, "label": f"{model_meta[mid][1]} · {dz['label']}",
                    "raw_n": pr_raw["n"], "raw_pos": pr_raw["n_pos"], "raw_prev": pr_raw["prev"],
                    "raw_lo": pr_raw["lo"], "raw_hi": pr_raw["hi"],
                    "item_n": pr_item["n"], "item_pos": pr_item["n_pos"], "item_prev": pr_item["prev"],
                    "item_lo": pr_item["lo"], "item_hi": pr_item["hi"],
                    "reliability_stat": "Fleiss κ (3 runs)", "reliability": kappa,
                    "reliability_n": int(len(full)), "alpha": np.nan,
                    "run_sd": float(runs["mean"].std(ddof=1)),
                    "conf_requested": dz["confidence_requested"],
                    "conf_valid_rate": float(conf.notna().mean()) if dz["confidence_requested"] else np.nan,
                    "conf_mean": float(conf.mean()) if dz["confidence_requested"] else np.nan,
                    "summary_rule": "modal label across 3 runs",
                    "raw_rule": "all eligible run-level labels",
                })

        # Human versions
        h_oc = human[human["outcome"] == oc]
        for v in C.HUMAN_VERSIONS:
            ver = v["version"]
            hv = h_oc[h_oc.version == ver]
            g = hv.groupby("tweet_id")["label"]
            c = pd.DataFrame({"mean": g.mean(), "n_pos": g.sum(min_count=1), "n": g.count()}).reindex(tix)
            lab = S.human_majority(c["mean"].to_numpy())
            iid = f"human:{ver}"
            label_mats[oc].append(lab)
            inst_order[oc].append(iid)
            pr_raw = S.prevalence(hv["label"])
            pr_item = S.prevalence(lab)
            full = c[c["n"] == 3]
            M = hv.pivot_table(index="tweet_id", columns="slot", values="label", aggfunc="first").to_numpy()
            instruments.append({
                "instrument": iid, "outcome": oc, "source": "human", "model": None, "design_id": None,
                "version": ver, "label": f"Human · {v['label']}",
                "raw_n": pr_raw["n"], "raw_pos": pr_raw["n_pos"], "raw_prev": pr_raw["prev"],
                "raw_lo": pr_raw["lo"], "raw_hi": pr_raw["hi"],
                "item_n": pr_item["n"], "item_pos": pr_item["n_pos"], "item_prev": pr_item["prev"],
                "item_lo": pr_item["lo"], "item_hi": pr_item["hi"],
                "reliability_stat": "Fleiss κ (3 annotators)",
                "reliability": S.fleiss_kappa_binary(full["n_pos"].to_numpy(), 3),
                "reliability_n": int(len(full)), "alpha": S.krippendorff_alpha_binary(M),
                "run_sd": np.nan, "conf_requested": 0, "conf_valid_rate": np.nan, "conf_mean": np.nan,
                "summary_rule": "majority of 3 ratings in this version (ties → positive)",
                "raw_rule": "all individual ratings in this version",
            })

        # Human pooled 15-rating majority (the paper's human reference)
        g = h_oc.groupby("tweet_id")["label"]
        c = pd.DataFrame({"mean": g.mean()}).reindex(tix)
        lab = S.human_majority(c["mean"].to_numpy())
        label_mats[oc].append(lab)
        inst_order[oc].append("human:pooled")
        pr_raw = S.prevalence(h_oc["label"])
        pr_item = S.prevalence(lab)
        instruments.append({
            "instrument": "human:pooled", "outcome": oc, "source": "human", "model": None,
            "design_id": None, "version": "pooled", "label": "Human · all 15 ratings",
            "raw_n": pr_raw["n"], "raw_pos": pr_raw["n_pos"], "raw_prev": pr_raw["prev"],
            "raw_lo": pr_raw["lo"], "raw_hi": pr_raw["hi"],
            "item_n": pr_item["n"], "item_pos": pr_item["n_pos"], "item_prev": pr_item["prev"],
            "item_lo": pr_item["lo"], "item_hi": pr_item["hi"],
            "reliability_stat": None, "reliability": np.nan, "reliability_n": 0, "alpha": np.nan,
            "run_sd": np.nan, "conf_requested": 0, "conf_valid_rate": np.nan, "conf_mean": np.nan,
            "summary_rule": "majority of all 15 ratings across versions (ties → positive)",
            "raw_rule": "all individual ratings across versions",
        })

    inst = pd.DataFrame(instruments)

    # --------------------------------------------- item labels and pairwise
    pair_rows = []
    for oc in C.OUTCOMES:
        L = np.column_stack(label_mats[oc])
        ids = inst_order[oc]
        il = pd.DataFrame(L, columns=ids)
        il.insert(0, "tweet_id", tweet_ids)
        item_rows.append(il.melt(id_vars="tweet_id", var_name="instrument", value_name="label")
                         .assign(outcome=oc))
        P = S.pairwise_matrix(L)
        iu, ju = np.triu_indices(len(ids), k=1)
        pair_rows.append(pd.DataFrame({
            "outcome": oc, "a": np.array(ids)[iu], "b": np.array(ids)[ju],
            **{k: P[k][iu, ju] for k in ["n", "agree", "kappa", "n11", "n10", "n01", "n00",
                                          "prev_a", "prev_b"]},
        }))
    item_labels = pd.concat(item_rows, ignore_index=True)
    item_labels["label"] = item_labels["label"].astype("Int8")
    pairwise = pd.concat(pair_rows, ignore_index=True)
    for k in ["n", "n11", "n10", "n01", "n00"]:
        pairwise[k] = pairwise[k].astype("int32")

    # Human-version item fingerprints and per-tweet sensitivity summaries
    wide_items = item_labels.pivot_table(index=["outcome", "tweet_id"], columns="instrument",
                                         values="label", aggfunc="first")
    prof = []
    for oc in C.OUTCOMES:
        w = wide_items.loc[oc].astype(float)
        hcols = [f"human:{v['version']}" for v in C.HUMAN_VERSIONS]
        lcols = [c for c in w.columns if c.startswith("llm:")]
        prof.append(pd.DataFrame({
            "outcome": oc, "tweet_id": w.index,
            "human_share_pos": w[hcols].mean(axis=1),
            "llm_share_pos": w[lcols].mean(axis=1),
            "human_pooled": w["human:pooled"],
        }))
    item_profiles = pd.concat(prof, ignore_index=True)
    for c in ["human_share_pos", "llm_share_pos"]:
        p = item_profiles[c]
        item_profiles[c.replace("share_pos", "instability")] = 1 - (2 * (p - 0.5)).abs()

    run_prev = pd.DataFrame(run_prev_rows)

    # ---------------------------------------------------------------- write
    llm_out = llm[["tweet_id", "outcome", "model", "design_id", "run", "label", "confidence"]].copy()
    llm_out["label"] = llm_out["label"].astype("Int8")
    llm_out["confidence"] = llm_out["confidence"].astype("Float32")
    for c in ["outcome", "model", "design_id"]:
        llm_out[c] = llm_out[c].astype("category")
    human_out = human.copy()
    human_out["label"] = human_out["label"].astype("Int8")

    files = {
        "items.parquet": items,
        "instruments.parquet": inst,
        "item_labels.parquet": item_labels,
        "pairwise.parquet": pairwise,
        "run_prevalence.parquet": run_prev,
        "item_profiles.parquet": item_profiles,
        "llm_annotations.parquet": llm_out,
        "human_annotations.parquet": human_out,
    }
    # Wide per-outcome label matrices: the browser reads only the columns it needs.
    for oc in C.OUTCOMES:
        w = pd.DataFrame(np.column_stack(label_mats[oc]), columns=inst_order[oc]).astype("Int8")
        w.insert(0, "tweet_id", tweet_ids)
        files[f"item_labels_wide_{oc}.parquet"] = w
    manifest = {"built": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "source_repo": C.SOURCE_REPO, "files": {}, "qc": qc}
    for name, df in files.items():
        p = out / name
        df = df.copy()
        for col in df.columns:  # avoid BigInt columns in the browser
            if str(df[col].dtype) == "int64":
                df[col] = df[col].astype("int32")
        df.to_parquet(p, index=False, compression="snappy")
        manifest["files"][name] = {"rows": int(len(df)), "bytes": p.stat().st_size,
                                   "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
        print(f"  wrote {name:28s} {len(df):>9,} rows  {p.stat().st_size/1e6:6.2f} MB")

    meta = {
        "models": [{"id": m, "label": l, "family": f} for m, l, f in C.MODELS],
        "designs": designs,
        "structures": [{"id": s["id"], "label": s["label"]} for s in C.STRUCTURES.values()],
        "variants": [{"id": v[1], "label": v[2], "batched": v[3], "confidence": v[4]} for v in C.VARIANTS],
        "human_versions": C.HUMAN_VERSIONS,
        "outcomes": [{"id": k, "label": v} for k, v in C.OUTCOME_LABELS.items()],
        "counts": {
            "tweets": int(len(items)),
            "llm_labels_per_outcome": {oc: int(llm.loc[llm.outcome == oc, "label"].notna().sum()) for oc in C.OUTCOMES},
            "human_ratings": int(len(kern)),
            "human_annotators": int(kern["id"].nunique()),
        },
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=1))
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1))

    # Intermediate for validation: paper-style prevalences incl. structural zeros.
    val = C.ROOT / "pipeline" / "_cache"
    val.mkdir(exist_ok=True)
    (wide.groupby(["model", "condition"])[["OL", "HS"]].mean()
         .assign(n=wide.groupby(["model", "condition"]).size())
         .reset_index().to_parquet(val / "paper_style_prevalences.parquet"))
    print("Done.")


if __name__ == "__main__":
    main()
