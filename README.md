# Annotation Sensitivity Explorer

An interactive explorer for two annotation experiments run on the **same 3,000 tweets**:

- **44,900 human ratings** from 917 crowd annotators across five instrument versions
  (Kern et al., 2023);
- **755,999 LLM labels per outcome** from seven models under twelve task designs, three
  runs each (Reiter et al.).

Both experiments label the same tweets for **offensive language** and **hate speech**, so
every one of the **90 labeling setups** — 84 model × task-design combinations plus the five
human instrument versions — can be put on one prevalence scale and compared directly.

A hosted build is at **<https://labels.stepheckman.com>**. This repository is the durable
copy: if that site is ever down, everything here still builds and runs locally.

## What you can do with it

- **Overview** — how humans and LLMs were each asked to label, and how far the resulting
  prevalence estimates spread.
- **Compare two setups** — pick any two of the 90, see how many of the 3,000 tweets get a
  different label, with guardrail notes when the contrast confounds more than one feature.
- **Every setup** — all 90 in one heatmap, and a ranking of how much re-running a setup,
  changing the instrument version, changing the task design, and changing the model each
  move the estimate.
- **Item explorer** — all 3,000 tweets ranked by how contested they are, with the full
  human and LLM label grid for any one of them.
- **Methods** — definitions, eligibility and tie rules, and the known limitations of the
  data package.

## Quick start

```bash
cd website
npm install
npm run dev          # http://localhost:5173
```

The prepared data package is committed in `website/src/public/data/`, so this works without
rebuilding it. To rebuild from the raw sources, run tests, or produce a static build, see
[`website/README.md`](website/README.md).

## Layout

| Path | What it is |
|---|---|
| `website/src/` | The site: four pages, chart and logic modules, the committed Parquet data package |
| `website/pipeline/` | Raw labels → Parquet, plus 34 validation checks that stop the build if the published numbers do not reproduce |
| `website/tests/` | Python and JavaScript unit tests |
| `netlify.toml` | Build configuration for the hosted copy |

## Reproducing the papers

This repository is an **explorer**, not a reproduction. Its build validates against the
published figures, but the analysis scripts that produce every number in the papers live in
a separate repository: `<reproduction repo URL>`.

## Data and provenance

The tweets come from Davidson et al. (2017), reaching this project through the annotation
experiment of Kern et al. (2023), whose annotators were recruited on Prolific in late 2022.
The LLM labels were collected for Reiter et al. Some tweets contain slurs and abusive
language: the hosted site keeps tweet text behind an explicit content warning, and so does a
local build.

### The human ratings: which 44,900

The full human collection is public on Hugging Face as
[`soda-lmu/tweet-annotation-sensitivity-2`](https://huggingface.co/datasets/soda-lmu/tweet-annotation-sensitivity-2):
89,150 ratings from 1,841 annotators on 3,050 tweets, unpruned. Both papers, and this site,
use a fixed subset of it:

| | Hugging Face (full) | Subset used here |
|---|---|---|
| Ratings | 89,150 | 44,900 |
| Annotators | 1,841 | 917 |
| Tweets | 3,050 | 3,000 |
| Instrument versions | A–E | A–E |

The subset is the **first three ratings per tweet in each instrument version, ordered by
annotator ID** (not by completion time). There are two ways to get it:

1. **Directly**, from the Kern et al. replication repository:
   [`full_train_s.csv`](https://raw.githubusercontent.com/chkern/tweet-annotation-sensitivity/main/data/full_train_s.csv)
   (33,683 ratings) and
   [`full_test_s.csv`](https://raw.githubusercontent.com/chkern/tweet-annotation-sensitivity/main/data/full_test_s.csv)
   (11,217). Concatenated, these are the `kern_full.csv` that this site's pipeline reads
   from the Reiter et al. repository.
2. **From Hugging Face**, by applying the selection rule:

   ```python
   from datasets import load_dataset

   df = load_dataset("soda-lmu/tweet-annotation-sensitivity-2", split="train").to_pandas()
   df = df[df["tweet_hashed"].notna()
           & ~(df["hate_speech"].isna() & df["offensive_language"].isna())]
   subset = (df.sort_values(["condition", "tweet_id", "annotator_id"])
               .groupby(["condition", "tweet_id"]).head(3))      # 44,900 rows
   ```

   Hugging Face's `condition` is the instrument version, `annotator_id` is the annotator,
   and `tweet_batch` is the tweet's position in the annotator's batch; the replication CSVs
   call these `version`, `id` and `batch.tweet`. Tweet text on Hugging Face uses `\r\n` line
   breaks; normalize them to `\n` to match the CSVs.

## License

- **Code** — MIT, see [`LICENSE`](LICENSE).
- **Data** — CC BY 4.0, see [`LICENSE-DATA.md`](LICENSE-DATA.md), which also records the
  upstream terms that travel with the tweet text.

## Citation

> Reiter, T., Kern, C., Miasnikov, F., Nikolenko, S., Chew, R., Eckman, S., & Kreuter, F.
> Reliable but Design-Sensitive: Instrument Uncertainty in LLM Annotation.
> `<venue and year>`

> Kern, C., Eckman, S., Beck, J., Chew, R., Ma, B., & Kreuter, F. (2023).
> Annotation Sensitivity: Training Data Collection Methods Affect Model Performance.
> *Findings of EMNLP 2023*.
