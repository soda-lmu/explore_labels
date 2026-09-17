# Annotation Sensitivity Explorer (local build)

Interactive site for the human (Kern et al. 2023) and LLM annotations of the
same 3,000 tweets. Implements Phases 1–2 of `../interactive_label_comparison.md`.

## Run it

```bash
cd website
./pipeline/fetch_sources.sh              # clones the paper repo into ../sources/
pip install -r requirements.txt
npm install
npm run data                             # build Parquet into src/public/data + run all checks
npm test                                 # Python + JS unit tests
npm run dev                              # http://localhost:5173
npm run build && npm run preview         # static build in dist/
```

The data package is already committed in `src/public/data/`, so `npm install && npm run dev`
works without rebuilding it.

## Layout

| Path | What it is |
|---|---|
| `pipeline/build_web_data.py` | Raw LLM CSVs + `kern_full.csv` → Parquet/JSON. Python port of `process_raw_data.R`, `eligible()`, and the confidence parser |
| `pipeline/validate_web_data.py` | Stops the build unless structure and paper numbers reproduce (34 checks) |
| `pipeline/stats.py` | Prevalence, Fleiss κ, Cohen κ, Krippendorff α, pairwise matrices |
| `src/*.html`, `src/js/pages/` | Overview, Compare, Landscape, Methods pages |
| `src/js/logic.js` | Pure logic: comparison classification (guardrails), URL state, formatting |
| `src/public/data/` | Web data package + `manifest.json` (row counts, hashes, QC) |
| `tests/` | `pytest` for statistics, `node --test` for page logic |

## Stack

Vite + Observable Plot + hyparquet. Everything is bundled locally; the build output is
static files that can go on any static host (GitHub Pages, Netlify, a university server)
or behind a server later. Observable Framework was the first choice, but it loads packages
from jsDelivr at build time, which is blocked in the sandboxes used to build this.

## Deviations from the plan

- Data build in Python instead of R (no R available in the build environment). It
  reproduces the R outputs exactly (see validation list).
- Dictionaries (`meta.json`) are JSON rather than Parquet.
- Item labels are also written as one wide file per outcome so the browser reads two columns, not 540k rows.
- DuckDB-Wasm is deferred to Phase 5 (analysis builder); Phases 1–2 only need precomputed tables.
