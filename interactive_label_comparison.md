# Annotation Sensitivity Interactive Website Plan

## Status (updated 2026-09-17)

| Phase | Status |
|---|---|
| 0. Launch prerequisites | Data rights confirmed. Choosing a host and a reuse license are still open. |
| 1. Web data package | **Done.** Python build and validation, 34/34 checks pass |
| 2. Vertical slice | **Done.** Overview, experiment maps, comparator, landscape, methods |
| 3. Item explorer | Not started |
| 4. Confidence and uncertainty | Not started |
| 5. Analysis builder | Not started |
| 6. Natural-language layer | Not started (optional) |

The code is in `website/`; see `website/README.md` for how to run it. Section 19 records the decisions made during the build, and section 20 lists the open items.

## Decision summary

Build a public, guided interactive website that lets readers reproduce the paper's main comparisons and run new analyses on the human and large language model (LLM) annotations. The site will use the same 3,000 tweets across both studies. It will combine a narrative explanation with an analysis laboratory, following the interaction model in the Little and Vartivarian explainer supplied by Stephanie Eckman.

The first release will focus on instrument selection, prevalence, agreement, label flips, the full model-by-design landscape, and item-level annotation patterns. It will include the 44,900 human ratings used in Kern et al. (2023) and the LLM annotations used in the current paper. It will not initially expose annotator demographics, fit arbitrary statistical models, or use a natural-language agent.

## 1. Purpose

The website will help readers answer one question:

> If the researcher had chosen another reasonable human or LLM annotation instrument, would the labels and substantive conclusion have changed?

The paper reports selected summaries from a large factorial experiment. The website will let readers inspect the underlying variation, compare configurations not shown in the manuscript, and identify the tweets for which instrument choice matters most.

The website will support three activities:

1. **Learn:** Follow a guided explanation of reliability, sensitivity, and instrument uncertainty.
2. **Compare:** Select two human or LLM instruments and calculate the difference between them.
3. **Explore:** Filter, group, visualize, and download results from the shared annotation dataset.

## 2. Audience

The primary audience is researchers who use human or LLM annotations in computational social science, natural language processing, survey research, and machine learning. The site should require no knowledge of mixed models. It should still expose enough detail for statisticians to inspect the estimand, sample size, statistic, and analysis population behind each result.

Secondary audiences include instructors, peer reviewers, and practitioners choosing an annotation workflow.

## 3. Product principles

### 3.1 Guided paper, not a dashboard wall

The site will present one argument in sequence. Each section will introduce a question, let the reader change the relevant choices, and explain the result. A shared analysis state will connect the controls and charts.

### 3.2 Deterministic analysis

Every displayed number will come from a documented data query or a precomputed result from the existing R pipeline. The website will not ask an LLM to calculate statistics or interpret raw data.

### 3.3 Overview first, detail on demand

The first view will show the contrast between repeated runs and alternative instruments. Readers can then open the experiment map, comparison laboratory, item explorer, confidence analysis, and methods.

### 3.4 Human and LLM results on one scale

The site will compare human and LLM labels because both studies used the same 3,000 tweets and the same two outcomes. It will also state where their instruments differ.

### 3.5 Reproducibility

Every analysis will have a shareable URL, visible filter definition, sample size, downloadable table, and source citation. The production build will verify selected website results against the paper's generated artifacts.

## 4. Scientific guardrails

The website must enforce the following rules in its calculations and explanatory text.

1. Repeated-run agreement measures reliability. It does not measure sensitivity to task design.
2. Human labels and original Davidson labels are benchmarks, not ground truth and not evidence of construct validity.
3. Item-level comparisons must use the same tweets on both sides.
4. Human prevalence based on individual ratings must not be silently compared with LLM prevalence based on modal labels. The interface must show the aggregation level.
5. Human item-level comparisons will use the majority of three ratings within a selected version. LLM item-level comparisons will use the modal label across three runs within a selected model-design cell.
6. The five human versions used different randomly assigned annotator panels. Across-version differences therefore include panel sampling variation. The website will report panel uncertainty separately when relevant.
7. Human and LLM instruments share design features, but they are not identical. The site will label comparisons as close matches, shared-feature comparisons, or comparisons with no direct analogue.
8. LLM structural zeroes for outcomes that were not elicited must be excluded with the existing `eligible()` rule. They must never be treated as negative labels.
9. Confidence calibration must name its target: another run, another task design, an individual human, or a human-majority label.
10. The 3,000 tweets were stratified from the Davidson corpus. Results do not estimate the prevalence of offensive language or hate speech on Twitter.
11. Demographic patterns, if added later, describe the recruited Prolific annotators. They do not estimate population differences.
12. The site will warn readers before displaying tweet text because the corpus contains hateful and offensive content.

## 5. Data sources and scope

### 5.1 LLM annotations

Source: the current project's raw and processed LLM files under `data_work/`.

The analysis population contains seven reported LLMs, 12 task designs, three runs, 3,000 tweets, and two outcomes. The designs cross:

- three task structures
- individual or six-tweet batch presentation
- confidence requested or not requested

The website will exclude the temporal re-collection and GPT-5.4-mini from reported analyses unless a later release adds a temporal-drift module.

### 5.2 Human annotations

Primary source: the exact Kern et al. subset in `data_work/processed/kern_full.csv` from the public reproducibility repository (https://github.com/AnonymousACLSubmission/llm-annotation-sensitivity). `website/pipeline/fetch_sources.sh` downloads it into `sources/`. The `Tweets_CK/` source files are not in the public repository and are not needed.

This subset contains 44,900 ratings from 917 annotators on the same 3,000 tweets, with three ratings per tweet in each of five versions except for 100 corrupted ratings omitted in the published study.

The five versions are:

| Version | Human instrument |
|---|---|
| A | OL and HS on one screen, HS shown first |
| B | Separate screens for each tweet, HS first |
| C | Separate screens for each tweet, OL first |
| D | A block of 50 HS judgments followed by the same 50 OL judgments |
| E | A block of 50 OL judgments followed by the same 50 HS judgments |

### 5.3 Original Davidson annotations

The Hugging Face file contains the original Davidson counts for hate speech, offensive language, and neither. The site may show these counts as a historical reference in the item explorer. It will not call them true labels.

### 5.4 Hugging Face discrepancy

The current Hugging Face CSV reports 89,150 rows, 1,841 annotators, and 3,050 tweets. Direct comparison shows that it contains all 44,900 published Kern records plus 44,250 additional ratings from 924 annotators on 50 additional tweets. The file does not contain an experiment indicator.

The first website release will use only the verified 44,900-record paper subset. The additional 50-tweet sample will remain excluded until its provenance and intended use are documented.

### 5.5 License and permission

**Resolved (2026-09-17).** Stephanie Eckman and her coauthors collected both the human and the LLM data and hold the rights needed to build and publish this tool. The site footer says that both datasets are published by the study authors.

Still open: the Hugging Face repository declares no license, and the site does not state reuse terms for the data it offers for download. Before launch, choose a license (for example, CC BY 4.0) and state it on the site and on Hugging Face.

## 6. Common human and LLM design features

The website will distinguish a close match from a shared-feature comparison.

| Human version | Closest LLM condition | Match status |
|---|---|---|
| A | Joint HS-first, individual, no confidence | Close match in structure |
| B | Separate, individual, no confidence | Shared separate and individual features; no LLM order analogue |
| C | Separate, individual, no confidence | Shared separate and individual features; no LLM order analogue |
| D | Separate, batched, no confidence | Shared separation and grouping; 50 sequential human items differ from six simultaneous LLM items |
| E | Separate, batched, no confidence | Shared separation and grouping; 50 sequential human items differ from six simultaneous LLM items |

The site will not label B and C as different LLM matches because the separate LLM calls do not preserve a cross-task order. It will not equate human blocks of 50 sequential judgments with LLM batches of six tweets in one prompt.

## 7. Normalized website data model

The current `df_long.csv` repeats tweet text and metadata across rows. The website build will create compressed, normalized Parquet files.

> **As built.** The files live in `website/src/public/data/` and use Snappy compression, which the browser Parquet reader supports. The differences from the list below are:
> - `items.parquet` has `tweet_id`, `text` (the masked text from the Kern data, with HTML entities decoded only for display) and `original_split`. Davidson counts are not included yet.
> - Design and version dictionaries are in `meta.json` rather than Parquet.
> - `instruments.parquet` has one row per outcome × instrument (84 LLM cells, 5 human versions, and the pooled 15-rating human reference). Each row holds label-level and item-level prevalence with intervals, reliability, Krippendorff's α (human versions), run SD, and confidence availability.
> - `item_labels.parquet` (long) plus `item_labels_wide_{OL,HS}.parquet` (one column per instrument, so the browser reads only two columns).
> - `pairwise.parquet` holds every instrument pair per outcome: n, agreement, κ, the four transition counts, and both prevalences.
> - `run_prevalence.parquet`, `item_profiles.parquet`, `llm_annotations.parquet`, `human_annotations.parquet`, and `manifest.json` (row counts, SHA-256 hashes, QC counts).
> - Not yet built: `confidence_calibration`, `variance_components`, `human_panel_uncertainty`.

### 7.1 `items.parquet`

One row per shared tweet:

- `tweet_id`
- `tweet_text_masked`
- `original_split`
- `davidson_hs_count`
- `davidson_ol_count`
- `davidson_neither_count`
- `content_warning` if a later classifier or manual rule is approved

### 7.2 `llm_designs.parquet`

One row per LLM task design:

- `design_id`
- `task_structure`
- `task_structure_label`
- `joint`
- `hs_first`
- `batched`
- `batch_size`
- `confidence_requested`
- `elicited_ol`
- `elicited_hs`
- `prompt_reference`

### 7.3 `llm_annotations.parquet`

One row per item, outcome, model, design, and run:

- `tweet_id`
- `outcome`
- `model`
- `design_id`
- `run`
- `label`
- `confidence_score`
- `confidence_valid`
- `source_file`

Only eligible outcome rows will enter analysis views. A separate quality-control table will retain counts of excluded structural rows and unusable responses.

### 7.4 `human_designs.parquet`

One row per human version:

- `version`
- `version_label`
- `joint`
- `hs_first`
- `blocked`
- `block_size`
- `screen_structure`
- `closest_llm_design_class`
- `match_status`

### 7.5 `human_annotations.parquet`

One row per human judgment:

- `tweet_id`
- `version`
- `annotator_id_hash`
- `outcome`
- `label`
- `rating_slot_within_tweet`

The public file will use a new website-specific annotator hash rather than the source identifier.

### 7.6 `human_annotators.parquet`

This file is deferred from the first release. If added, it will contain approved demographic, task-perception, device, and duration fields. A privacy review and minimum-cell rule must precede public use.

### 7.7 Precomputed result files

The build will also write:

- `instrument_prevalence.parquet`
- `within_instrument_agreement.parquet`
- `pairwise_instrument_agreement.parquet`
- `pairwise_label_flips.parquet`
- `item_profiles.parquet`
- `confidence_calibration.parquet`
- `variance_components.parquet`
- `human_panel_uncertainty.parquet`

Precomputation will keep the website responsive and will give tests stable reference values.

## 8. Statistical definitions

### 8.1 Prevalence

For raw labels, prevalence is the mean binary label among eligible annotations in the selected instrument. The site will report the numerator, denominator, percentage, and nominal binomial 95% interval.

For item summaries, prevalence is the mean human-majority or LLM-modal label across tweets. The label beside the estimate will state the aggregation rule.

### 8.2 Within-instrument reliability

- Humans: Fleiss' kappa and Krippendorff's alpha across the three ratings within each version.
- LLMs: Fleiss' kappa across the three runs within each model-design cell.

### 8.3 Across-instrument sensitivity

- Humans: Cohen's kappa between version-majority labels.
- LLMs: Cohen's kappa between design-modal labels within the same model, or between model-modal labels under the same design.
- Human versus LLM: Cohen's kappa between a selected human-version majority and selected LLM cell modal label.

Every result will also report raw agreement because kappa depends on marginal prevalence.

### 8.4 Label flips

For any two item-level instruments, report:

- number and percentage unchanged
- negative to positive flips
- positive to negative flips
- net prevalence difference in basis points
- a 2 by 2 transition table

### 8.5 Confidence

For confidence-eliciting LLM designs, calculate:

- valid-confidence rate
- mean and distribution of confidence
- agreement rate by confidence bin
- Expected Calibration Error for each named target
- disagreement or flip rate by confidence bin
- individual versus batched confidence difference

### 8.6 Instrument uncertainty

The full crossed variance decomposition and design effects will use the existing R implementation. The website will display precomputed variance components rather than refit mixed models in the browser.

### 8.7 Human annotator-panel uncertainty

The website will use the existing annotator-cluster bootstrap results. It will explain that human versions used different annotators, while the same LLM model was applied across its designs.

## 9. Shared application state

All primary components will read from one URL-encoded state object:

- `outcome`: OL or HS
- `source_a`: human, LLM, or Davidson reference
- `instrument_a`
- `source_b`
- `instrument_b`
- `aggregation`: raw labels or item summary
- `run_mode`: selected run or modal across runs
- `human_summary`: selected-version majority or pooled 15-rating majority
- `reference_instrument`
- `display_metric`
- `tweet_id`
- `show_text`: false by default

A copied URL must recreate the same controls and charts.

## 10. Guided page structure

### Section 1: The diagnostic trap

Question: Can a reliable annotation instrument still be sensitive to design choices?

Display:

- three run-level prevalence estimates for one default LLM cell
- the broader prevalence distribution across designs and models
- a short explanation of reliability versus sensitivity

Interaction:

- outcome toggle
- preset buttons for within-run, across-design, and across-model comparisons

### Section 2: How the annotations were collected

Question: Which choices define a human or LLM instrument?

Display:

- a visual map of the five human versions
- a visual map of the 12 LLM designs
- seven model selectors
- badges marking close matches and shared-feature comparisons

Interaction:

- clicking a human version or LLM design updates Instrument A
- a compare button sends the selection to the laboratory

### Section 3: Build an instrument

Question: What result does one selected instrument produce?

Display:

- prevalence and nominal interval
- positive and negative counts
- within-instrument reliability
- confidence availability and mean, when applicable
- location within the full prevalence distribution

Interaction:

- source selector
- human version or LLM model and design controls
- raw-label or item-summary toggle

### Section 4: Compare two instruments

Question: What changes when the instrument changes?

Display:

- side-by-side prevalence estimates
- difference in basis points
- Cohen's kappa and raw agreement
- transition matrix
- directional flip counts
- selected item examples after the content warning

Valid comparisons:

- human versus human
- LLM versus LLM
- human versus LLM
- selected instrument versus Davidson reference

The interface will show a warning when the two sides differ in aggregation level or lack an exact structural match.

### Section 5: The full instrument landscape

Question: How wide is the set of results across defensible choices?

Display:

- model by design prevalence heatmap
- human-version prevalence points on the same outcome scale
- three run dots inside or beside each LLM cell
- selected-reference deviations
- distribution of prevalence across runs, designs, and models

Interaction:

- outcome toggle
- absolute prevalence or reference difference
- all designs or no-confidence designs
- all models or selected models

### Section 6: Effects differ across models

Question: Does one task-design change have the same effect for every model?

Display:

- model-specific effects for batching, confidence elicitation, and task structure
- zero-centered dot plots with common axes
- direct labels for effect direction and magnitude

Interaction:

- choose outcome and design feature
- choose pooled or model-specific estimates

### Section 7: Human and LLM instrument sensitivity

Question: Which design features are shared, and how large are their effects?

Display:

- close-match comparison for Human A and LLM joint HS-first, individual, no confidence
- joint versus separate estimates
- order comparisons with the no-direct-analogue qualification
- grouped presentation comparisons with human-block and LLM-batch definitions
- human panel, human design, LLM run, LLM design, and LLM model variation on one scale

### Section 8: Confidence does not replace comparison

Question: What does stated confidence predict?

Display:

- target-specific calibration curves
- Expected Calibration Error by target
- confidence distributions under individual and batched presentation
- flip rates by confidence bin

Interaction:

- target selector
- model selector
- outcome selector
- individual or batch filter

### Section 9: Item explorer

Question: Which tweets are stable or sensitive across instruments?

Display for one tweet:

- five human-version rating groups
- human-majority label by version
- LLM model by design grid with three run indicators
- original Davidson counts
- confidence distributions
- human and LLM sensitivity summaries

Sorting presets:

- most stable across all instruments
- most human-sensitive
- most LLM-design-sensitive
- most model-sensitive
- human stable and LLM unstable
- human unstable and LLM stable
- strongest human-LLM disagreement

Tweet text will remain hidden until the reader acknowledges the content warning.

### Section 10: Build an analysis

Question: What comparison does the reader want to run?

Controls:

- filter by outcome, source, model, design feature, run, or human version
- group by model, design, version, run, batching, confidence request, or task structure
- select prevalence, agreement, kappa, flip rate, mean confidence, valid-confidence rate, or human agreement
- select table, dot plot, heatmap, or distribution

Outputs:

- result table and chart
- sample size and analysis population
- plain-language method statement
- downloadable CSV
- shareable URL
- generated R or Python reproduction snippet in a later release

### Section 11: Methods, data, and limitations

Include:

- study designs
- analysis definitions
- eligibility rules
- data provenance
- citations
- license
- content warning
- known limitations
- downloadable code and processed public data, if licensing permits

## 11. Visual design

The site will use a restrained, paper-like visual style rather than a product dashboard style.

- Use one stable color for humans and model-family colors for LLMs.
- Encode model family with color and model identity with shape or direct labels.
- Use a colorblind-safe palette.
- Use a diverging scale centered at zero for reference differences.
- Use the same prevalence axis across human and LLM panels.
- Label all intervals as sampling intervals, empirical instrument spread, or model-based intervals.
- Provide a data table and text summary for every chart.
- Make all controls keyboard accessible.
- Meet Web Content Accessibility Guidelines 2.1 AA contrast and navigation requirements.
- Avoid chart animation unless it communicates repeated outcomes and offers pause controls.

## 12. Technical architecture

### 12.1 Stack

**As built.** This replaces the originally recommended Quarto, Observable JavaScript and R data-prep stack.

- **Vite (multi-page) + plain JavaScript modules:** site structure, shared state, and controls. Observable Framework and Quarto were dropped: Framework fetches packages from jsDelivr at build time, which is blocked in the build sandboxes, and neither R nor Quarto was available there.
- **Observable Plot:** charts, bundled locally from npm.
- **hyparquet:** reads Parquet files in the browser.
- **DuckDB-Wasm:** deferred to Phase 5 (analysis builder).
- **Python (pandas, numpy, pyarrow):** data preparation and validation. This is a port of `process_raw_data.R`, `eligible()`, and the confidence parser.
- **R:** remains the source of mixed-model and bootstrap results. The site will read those as precomputed files.
- **pytest:** statistical unit tests.
- **node --test:** JavaScript unit tests.
- **Playwright:** used for screenshot and interaction checks during development. A committed end-to-end suite is still to do.

The first release will be a static website. It will not require an application server, database, account, or API key.

### 12.2 Directory structure

**As built:**

```text
label_explore/
├── interactive_label_comparison.md
├── sources/                     # downloaded paper repo (gitignored)
└── website/
    ├── package.json, vite.config.js, requirements.txt, README.md
    ├── pipeline/
    │   ├── fetch_sources.sh
    │   ├── config.py            # models, designs, human versions, match table
    │   ├── stats.py             # prevalence, Fleiss/Cohen κ, Krippendorff α, pairwise matrices
    │   ├── build_web_data.py
    │   └── validate_web_data.py # 34 checks; exits non-zero on failure
    ├── src/
    │   ├── index.html, compare.html, landscape.html, methods.html
    │   ├── styles/site.css
    │   ├── js/{logic,data,ui,charts}.js
    │   ├── js/pages/{index,compare,landscape,methods}.js
    │   └── public/data/         # web data package
    ├── tests/test_stats.py
    └── tests/js/logic.test.js
```

Originally proposed:

```text
website/
├── _quarto.yml
├── index.qmd
├── lab.qmd
├── items.qmd
├── methods.qmd
├── about.qmd
├── styles.css
├── js/
│   ├── state.js
│   ├── queries.js
│   ├── instrument-map.js
│   ├── comparator.js
│   ├── landscape.js
│   ├── confidence.js
│   └── item-explorer.js
├── data/
│   ├── public/
│   └── manifests/
├── src/
│   ├── 01_build_web_data.R
│   ├── 02_build_web_metrics.R
│   ├── 03_validate_web_data.R
│   └── run_all.R
└── tests/
    ├── reference-results/
    ├── unit/
    └── e2e/
```

### 12.3 Data build

The website data build will:

1. Read the existing processed human and LLM data.
2. Apply the canonical model and eligibility filters.
3. normalize model, design, version, outcome, and run identifiers.
4. Create item-level majority and modal labels.
5. Generate pairwise agreement and flip tables.
6. Generate prevalence, confidence, and uncertainty summaries.
7. Remove unapproved annotator fields.
8. Write compressed Parquet files and a data manifest.
9. Verify record counts, uniqueness, missingness, and expected cells.
10. Compare reference results with the paper outputs.

## 13. Data-quality checks

The build must stop if any required check fails. **As built:** `validate_web_data.py` implements the checks below, and all pass. The only documented exceptions are listed in section 19.

### LLM checks

- 3,000 shared tweets
- seven reported models
- 12 reported designs per model
- three expected runs per eligible cell, except the documented unusable response
- no not-elicited outcomes in analysis files
- binary labels only
- confidence present only when requested
- model and design labels match the manuscript

### Human checks

- 44,900 paper ratings
- 917 annotators
- 3,000 shared tweets
- five versions
- three ratings per tweet-version cell except the documented 100 missing ratings
- binary OL and HS labels
- version prevalence reproduces Kern et al. Table 1
- within-version agreement reproduces the published checks

### Cross-source checks

- identical 3,000 tweet IDs
- identical masked text after normalization
- no duplicate item-instrument-rating keys
- every human and LLM comparison uses shared tweets
- Davidson counts remain reference fields only

## 14. Testing plan

### 14.1 Statistical unit tests

Test each calculation against small hand-checked fixtures:

- prevalence
- nominal interval
- Fleiss' kappa
- Cohen's kappa
- Krippendorff's alpha
- majority and modal labels
- directional flips
- Expected Calibration Error
- human panel bootstrap loading
- crossed variance-component loading

### 14.2 Reference-result tests

The website must reproduce selected manuscript results, including:

- median within-design LLM agreement
- median across-design LLM agreement
- human-majority agreement summary
- OL and HS prevalence ranges
- model and task-design effect estimates
- human and LLM task-design standard deviations
- cumulative design effects
- confidence calibration summaries

The build should call or share reference files with `data_work/src/09_verify_paper_numbers.py` rather than maintain an unrelated second set of expected values.

### 14.3 Interaction tests

Test that:

- URL state recreates an analysis
- changing the outcome updates all linked charts
- selecting a preset loads the intended instruments
- invalid comparisons show a warning
- downloads match the visible table
- content remains hidden until warning acknowledgement
- keyboard users can operate every control
- mobile layouts preserve labels and tables

### 14.4 Performance tests

Targets for the production build:

- initial page data under 5 MB compressed
- first meaningful display within 3 seconds on a standard broadband connection
- control updates under 250 milliseconds for precomputed views
- item-detail data loaded only when requested

## 15. Phased implementation

### Phase 0: Resolve launch prerequisites

Deliverables:

- ~~confirmed dataset license or permission~~ (done: the authors hold the rights)
- ~~documented decision to exclude the 44,250 additional Hugging Face ratings~~ (done: the site uses only the 44,900-rating paper subset)
- approved tweet-text display policy (the current build shows masked text, hidden behind a content warning until the reader opts in; needs coauthor sign-off)
- selected public hosting location (open; the build is static, so a static host works)
- stated reuse license for the downloadable data (open)

Exit criterion: the team can state what data may be published and where.

### Phase 1: Build the web data package

Deliverables:

- normalized Parquet files
- design dictionaries
- precomputed metrics
- data manifest with row counts and hashes
- automated quality checks
- reference-result test fixtures

Exit criterion: all counts and selected paper results reproduce from the web data.

**Status: done.** Results reproduced exactly:
- per-cell prevalences;
- all 168 within-design Fleiss κ (except one documented cell);
- all 924 cross-design Cohen κ;
- κ against the human reference;
- per-model means;
- human pooled prevalence and design SD;
- Kern Table 1.

Reproduced only approximately: Kern Table 2 (see section 19).

### Phase 2: Build the vertical slice

Deliverables:

- guided opening
- human and LLM experiment maps
- Instrument A and Instrument B selector
- prevalence comparison
- kappa, raw agreement, and label-flip comparison
- model-by-design prevalence heatmap
- URL-encoded state

Exit criterion: a reader can compare Human A with the closest LLM condition and compare any two LLM designs without reloading the page.

**Status: done.** Also shipped:
- a raw-label vs. item-label toggle;
- comparison-type warnings;
- a transition matrix;
- flip examples behind the content warning;
- CSV downloads;
- copy-link;
- dark mode;
- a mobile layout;
- a methods page with the Kern Table 1 check and file hashes.

Not yet shipped: section 6 (model-specific effect plots) and section 7 (shared-feature effect table).

### Phase 3: Add the item explorer

Deliverables:

- sortable sensitivity index
- one-tweet annotation fingerprint
- human-version ratings
- LLM model-by-design grid
- Davidson reference counts
- content-warning flow

Exit criterion: a reader can identify and inspect tweets with contrasting human and LLM sensitivity patterns.

### Phase 4: Add confidence and uncertainty modules

Deliverables:

- target-specific calibration explorer
- individual versus batch confidence comparison
- instrument variance decomposition
- human annotator-panel uncertainty display
- human versus LLM uncertainty comparison

Exit criterion: all uncertainty displays name the included variance sources and their units.

### Phase 5: Add the constrained analysis builder

Deliverables:

- filter and group controls
- statistic selector
- table and chart outputs
- downloadable CSV
- shareable analysis URL
- method statement generated from the analysis specification

Exit criterion: every allowed filter, grouping, and statistic combination passes schema validation and returns a documented sample size.

### Phase 6: Optional natural-language layer

A later release may let readers type questions such as, "How much does batching change HS prevalence for Mistral Medium 3.5?" The assistant will map the question to the same validated analysis specification used by the controls. It will not execute arbitrary code or calculate statistics itself.

Exit criterion: every natural-language answer links to the visible analysis state and can be reproduced without the assistant.

## 16. Deployment and maintenance

The site will build from a pinned environment. The deployment workflow will:

1. run data-quality checks
2. run statistical unit tests
3. run reference-result tests
4. render the Quarto site
5. run browser interaction tests
6. scan for broken links and missing alt text
7. publish the static build
8. retain the build manifest and data hashes

A release will record the manuscript version, data hashes, R package versions, JavaScript dependency versions, and build date. Updating a model, prompt, or analysis result will require rebuilding the data package and rerunning all checks.

## 17. First-release acceptance criteria

The first public release is complete when:

1. It uses the verified 3,000-tweet overlap and 44,900 human ratings.
2. It includes all seven reported LLMs and 12 task designs.
3. It reproduces selected manuscript and Kern et al. results.
4. It supports human-human, LLM-LLM, and human-LLM comparisons.
5. It keeps raw-label and item-summary analyses distinct.
6. It reports prevalence, sample size, agreement, kappa, and directional flips.
7. It displays the full model-by-design prevalence landscape.
8. It provides an item-level human and LLM annotation fingerprint.
9. It hides tweet text behind a content warning.
10. It provides shareable URLs and downloadable result tables.
11. It passes accessibility, mobile, statistical, and browser tests.
12. It cites both papers and documents data provenance and limitations.
13. It publishes human data only after the license or permission is documented.

## 18. Immediate implementation sequence

**Steps 1–7 are done** (with the stack changes in section 12). **Step 8 is partly done:** reference-result checks and unit tests exist, but browser tests are not committed. **Next up are steps 9–10;** section 20 has the full list.

Original sequence:

1. Create the `website/` scaffold and pin the JavaScript and R environments.
2. Write `01_build_web_data.R` to normalize the existing human and LLM data.
3. Write `03_validate_web_data.R` before building any charts.
4. Generate the design dictionaries and precomputed comparison tables.
5. Build the shared state and experiment maps.
6. Build the A/B instrument comparator as the first complete analysis path.
7. Add the prevalence landscape using the same state.
8. Add reference-result and browser tests.
9. Review the vertical slice with paper coauthors.
10. Add the item explorer, confidence module, and analysis builder in that order.

## 19. Decisions log

| Date | Decision | Reason |
|---|---|---|
| 2026-09-17 | Data build in Python, not R | No R in the build environment; the outputs are validated against the R results |
| 2026-09-17 | Vite + Observable Plot + hyparquet instead of Quarto/Observable Framework | Framework and Quarto need jsDelivr or local tools that are unavailable in the build environment; this stack bundles everything locally into static files |
| 2026-09-17 | Build static now and keep the query layer swappable | Hosting is undecided |
| 2026-09-17 | Human data comes from `kern_full.csv` in the public paper repository | The file is the exact 44,900-rating subset and is public |
| 2026-09-17 | Data rights confirmed; both datasets may be published | The authors collected the data |
| 2026-09-17 | Human item label = majority of the valid ratings within a version; a 1–1 tie counts as positive | Matches `human_majority()` in the paper code |
| 2026-09-17 | LLM modal label uses round-half-to-even (a 1–1 tie with one missing run counts as negative) | Matches R `round()` in the paper code |
| 2026-09-17 | Fleiss κ is computed for the Llama 3.1 8B joint OL-first cell over its 2,999 complete tweets | `01_agreement.R` writes NA for this cell (OL and HS) to `outputs/ladder_fleiss_within.csv` because of one unparseable response (tweet 1129, run 1), and the agreement-ladder table silently drops those 2 of 168 values. Including them (OL .22, HS .79) leaves every printed number unchanged: Llama 3.1 8B .19–.80 (.46), all models .19–.99 (median .91). |
| 2026-09-17 | Humans are drawn in neutral ink with diamond marks; LLM families use the paper's Okabe-Ito colors (validated for colorblind separation), with shape distinguishing models | Keeps the site consistent with the paper's figures and readable in light and dark mode |
| 2026-09-17 | Human versions B/C map to "Separate · Base" and D/E to "Separate · Batch of 6" (shared features); A maps to "Joint, HS first · Base" (close match) | Implements section 6 |
| 2026-09-18 | Meta moves off Okabe-Ito orange (#e69f00) to wine (#882255 light, #cc7090 dark); OpenAI blue and Mistral green keep the paper's values | In dark mode the family orange (#c98500) and the hate-speech chip orange (#e0782a) simulated to ΔE2000 2.6 — below the just-noticeable threshold, so the two encodings were the same colour, not merely confusable. Worst-case pairwise ΔE across normal/deuteranopic/protanopic/tritanopic simulation, counting the OL and HS chips: dark 2.6 → 6.6; light unchanged at 11.7. Triads that dodge both the OL blue and the HS orange all scored the same or worse (purple/teal collides with OL blue under tritanopia; the best numeric triad puts Mistral on a pale yellow at 1.6:1 contrast on the light surface) |
| 2026-09-18 | **The OL and HS chip colours stay as they are** (OL #56b4e9 / #62b8ea, HS #c75400 / #e0782a). The residual similarity between OpenAI blue (#0072b2) and the OL chip is accepted | They match Kern et al. Fig. 1, which the diagrams are drawn after, and the chips carry their own "OL"/"HS" text, so hue is not load-bearing for identifying them. The two encodings never share a figure — the chips appear only in the instrument diagrams, family colour only in the charts — and a key on the overview states which is which. Closes the overload raised in the usability review |

### Discrepancies found in the paper and its repository

- Kern et al. Table 2 reports Krippendorff's α **between** version modal labels. The comment in `04_human_design.R` describes it as within-version α. Within-version α is actually OL .48–.63 and HS .35–.43. The site reproduces Table 2 only to within 0.025 (7 of 20 values exact); Kern's tie rule for tweets with two valid ratings is undocumented.
- Share of tweets whose majority label changes across human versions: HS is 38.5%; the paper says 39%.
- The design-effect figures are inconsistent across repository outputs:
  - `table_human_llm.tex`: 77/111 including model choice, 58/45 without;
  - `table_human_design.tex`: 16/13 for humans;
  - paper text: 80/114 and 13–15.
- `data_work/README.md` is out of date: it lists models and scripts that are not in the repository.
- The `BASEDIR` paths in the R scripts are hard-coded to a local Downloads folder.

## 20. Open items and to-dos

### Before public launch
- [ ] Choose a host (GitHub Pages, Netlify, or a university server); add a deploy workflow.
- [ ] Choose and state a data reuse license on the site and on Hugging Face.
- [ ] Get coauthor sign-off on the tweet-text display policy.
- [ ] Resolve the paper/repository discrepancies in section 19 and update the site's methods text to match the final paper.
- [ ] Replace the anonymous repository link and the "under review" citation once the paper is public. (The dead `href="#"` is now rendered as plain text rather than a broken link — v2-usability.)
- [ ] Commit a Playwright suite: URL state round-trip, outcome toggle, presets, warnings, CSV download, content-warning gate, keyboard use, mobile layout.
- [~] Accessibility pass: text alternatives added for the overview strip plot and the effect-size bars; every figure now has an aria-label; heatmap cells are keyboard-reachable buttons (v2-usability). Still to do: WCAG 2.1 AA contrast measurement, and a non-hover path to the tooltip detail.
- [ ] Add alt text and a broken-link scan to the build.
- [ ] Record the environment in the release manifest: Python and npm lockfiles, and the paper version.
- [ ] Coauthor review of the vertical slice (step 9).

### Phase 2 remainder
- [ ] Section 6: model-specific effects of batching, confidence and task structure (use `permodel_coefs.csv` and `pooled_coefs.csv`).
- [ ] Section 7: shared-feature effects for humans vs. LLMs, and all variance components on one scale.
- [ ] Landscape: show the human-version points in the heatmap figure itself, not only in the strip below.
- [x] Landscape: "What moves the label most?" — run / questionnaire version / prompt recipe / model effect sizes on one scale (v2-usability).

### Phase 3: item explorer

> Re-ranked in the 2026-09-17 usability review: this is the highest-value remaining
> addition for a reader who has not read the papers. `item_profiles.parquet` is now
> used on the compare page (per-tweet contestedness next to each flipped tweet), but
> there is still no per-tweet view.
- [ ] Add Davidson counts to `items.parquet`. They need a source: the Hugging Face file, which is blocked in the current build environments.
- [ ] Sortable sensitivity index from `item_profiles.parquet`, using the presets in section 10.9.
- [ ] One-tweet fingerprint: human ratings by version, and the LLM model × design grid with run dots.

### Phase 4: confidence and uncertainty
- [ ] Port or export `05_confidence.R` results: calibration against each of the four targets, and ECE.
- [ ] Export variance components and design effects from `03_deff.R` / `deff_components.csv`.
- [ ] Export the human panel bootstrap and replicate SDs from `04_human_design.R` (`human_llm_components.csv` is not in the public repository).

### Phase 5 and later
- [ ] Analysis builder with DuckDB-Wasm over `llm_annotations.parquet` and `human_annotations.parquet`.
- [ ] Generated R/Python reproduction snippets.
- [ ] Optional natural-language layer (Phase 6). This needs a server endpoint; revisit the hosting choice then.
