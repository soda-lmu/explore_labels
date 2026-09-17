#!/usr/bin/env bash
# Clone (or update) the paper's reproducibility repo next to website/.
# Human ratings come from its data_work/processed/kern_full.csv (the exact
# 44,900-rating subset used in Kern et al. 2023).
set -euo pipefail
here="$(cd "$(dirname "$0")/../.." && pwd)"
dest="$here/sources/llm-annotation-sensitivity"
mkdir -p "$here/sources"
if [ -d "$dest/.git" ]; then
  git -C "$dest" pull --ff-only
else
  git clone --depth 1 https://github.com/AnonymousACLSubmission/llm-annotation-sensitivity.git "$dest"
fi
echo "Source data in $dest/data_work"
