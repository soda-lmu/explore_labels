"""Dictionaries shared by the data build. Mirrors data_work/src/00_utils.R."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]           # website/
SOURCE = ROOT.parent / "sources" / "llm-annotation-sensitivity" / "data_work"
OUT = ROOT / "src" / "public" / "data"

SOURCE_REPO = "https://github.com/T-Reiter/llm-annotation-sensitivity"

# folder -> canonical model id. Only the seven reported models are loaded;
# GPT-4o-mini_run2 (temporal re-collection) and GPT-5.4-mini are excluded.
MODEL_DIRS = {
    "GPT4o_mini": "GPT-4o-mini",
    "GPT5.4": "GPT-5.4",
    "MistralLarge3": "Mistral-Large-3",
    "MistralMedium3.5_new": "Mistral-Medium-3.5",
    "Llama3.1_8B_new": "Llama-3.1-8B",
    "Llama3.1_70B_new": "Llama-3.1-70B",
    "Llama4": "Llama-4",
}
MODELS = [
    # id, label, family, order within family
    ("GPT-4o-mini", "GPT-4o-mini", "OpenAI"),
    ("GPT-5.4", "GPT-5.4", "OpenAI"),
    ("Mistral-Large-3", "Mistral Large 3", "Mistral"),
    ("Mistral-Medium-3.5", "Mistral Medium 3.5", "Mistral"),
    ("Llama-3.1-8B", "Llama 3.1 8B", "Meta"),
    ("Llama-3.1-70B", "Llama 3.1 70B", "Meta"),
    ("Llama-4", "Llama 4", "Meta"),
]
MODEL_IDS = [m[0] for m in MODELS]

OUTCOMES = ["OL", "HS"]
OUTCOME_LABELS = {"OL": "Offensive language", "HS": "Hate speech"}

# LLM task structures. The paper's letters A/B/C are unrelated to Kern's
# version letters, so the website uses descriptive ids.
STRUCTURES = {
    "A": {"id": "joint_ol", "label": "Joint, OL first", "joint": 1, "hs_first": 0},
    "B": {"id": "joint_hs", "label": "Joint, HS first", "joint": 1, "hs_first": 1},
    "C": {"id": "separate", "label": "Separate calls", "joint": 0, "hs_first": None},
}
VARIANTS = [
    ("", "base", "Base", 0, 0),
    ("_conf", "conf", "+ Confidence", 0, 1),
    ("_batch", "batch", "Batch of 6", 1, 0),
    ("_batch_conf", "batch_conf", "Batch of 6 + Confidence", 1, 1),
]


def designs():
    """The 12 LLM designs: 3 structures x individual/batch x confidence."""
    out = []
    for letter, s in STRUCTURES.items():
        for suffix, vid, vlabel, batched, conf in VARIANTS:
            out.append({
                "design_id": f"{s['id']}__{vid}",
                "structure": s["id"],
                "structure_label": s["label"],
                "variant": vid,
                "variant_label": vlabel,
                "label": f"{s['label']} · {vlabel}",
                "joint": s["joint"],
                "hs_first": s["hs_first"],
                "batched": batched,
                "batch_size": 6 if batched else 1,
                "confidence_requested": conf,
                # raw condition strings, per outcome
                "condition_OL": ("C.OL" if letter == "C" else letter) + suffix,
                "condition_HS": ("C.HS" if letter == "C" else letter) + suffix,
            })
    return out


# Kern et al. (2023) questionnaire versions, from 04_human_design.R.
HUMAN_VERSIONS = [
    {"version": "A", "label": "Version A", "description": "OL and HS on one screen, HS shown first",
     "joint": 1, "hs_first": 1, "blocked": 0, "block_size": None,
     "closest_llm_design": "joint_hs__base", "match_status": "close",
     "match_note": "Close structural match: both constructs in one judgment, HS first, one item at a time."},
    {"version": "B", "label": "Version B", "description": "Separate screens for each tweet, HS first",
     "joint": 0, "hs_first": 1, "blocked": 0, "block_size": None,
     "closest_llm_design": "separate__base", "match_status": "shared",
     "match_note": "Shares separate, one-at-a-time judgments. Separate LLM calls keep no cross-task order, so HS-first has no LLM analogue."},
    {"version": "C", "label": "Version C", "description": "Separate screens for each tweet, OL first",
     "joint": 0, "hs_first": 0, "blocked": 0, "block_size": None,
     "closest_llm_design": "separate__base", "match_status": "shared",
     "match_note": "Shares separate, one-at-a-time judgments. Separate LLM calls keep no cross-task order, so OL-first has no LLM analogue."},
    {"version": "D", "label": "Version D", "description": "Block of 50 HS judgments, then the same 50 for OL",
     "joint": 0, "hs_first": 1, "blocked": 1, "block_size": 50,
     "closest_llm_design": "separate__batch", "match_status": "shared",
     "match_note": "Shares separation and grouping, but 50 sequential human judgments differ from 6 tweets shown at once in one LLM prompt."},
    {"version": "E", "label": "Version E", "description": "Block of 50 OL judgments, then the same 50 for HS",
     "joint": 0, "hs_first": 0, "blocked": 1, "block_size": 50,
     "closest_llm_design": "separate__batch", "match_status": "shared",
     "match_note": "Shares separation and grouping, but 50 sequential human judgments differ from 6 tweets shown at once in one LLM prompt."},
]
