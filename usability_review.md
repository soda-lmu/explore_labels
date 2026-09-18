# Usability review: Annotation Sensitivity Explorer

Reviewed 2026-09-17 against the running dev build (localhost:5173) and the source in
`website/src`. The reader I held in mind throughout: someone who works with labeled data,
is interested in label variation, and has **not** read either paper.

---

## 1. What already works

Worth saying, because the fixes below should not disturb it.

- **The overview is correctly ordered.** Question → how humans labeled → how LLMs labeled →
  the strip plot. A newcomer can follow it without prior context.
- **The instrument diagrams carry the paper's Figure 1 better than the paper does.** Five
  versions as screen sequences is immediately legible.
- **The 2×2 transition table with shaded flip cells** is the clearest single object on the site.
- **The content-warning gate** is handled well — default hidden, explicit opt-in, reversible.
- **Craft details are in place**: Okabe-Ito palette, dark mode, `:focus-visible`,
  `prefers-reduced-motion`, URL state, CSV download, a methods page that documents tie rules
  and known discrepancies. The honesty of the methods page is unusual and worth keeping visible.

---

## 2. The central problem

The site is organized around **the structure of the experiments**. The target reader arrives
with **questions**. Those are not the same shape, and right now the reader has to do the
translation.

Specifically, four questions a label-variation person will have, and where the site leaves them:

| Their question | Status |
|---|---|
| How much does the setup move the answer? | **Answered well** (overview strip plot + spread tiles) |
| Which choice matters most — model, prompt format, batching, human vs LLM? | **Not answered anywhere.** The data is on the Landscape page; the reader must derive it by eye |
| Which tweets are contested, and which are easy? | **Not answered.** `item_profiles.parquet` is built, documented on the Methods page, and used by nothing |
| If agreement is high, can I trust the labels? | **Stated once, in one sentence, then dropped** — even though it is the thesis of the second paper |

The last two are where the "play with the data" promise in the project description is unfulfilled.

### 2.1 The reliability/sensitivity point is computed and then thrown away

`logic.js` has `classifyComparison()` — 50 lines that decide what kind of contrast A vs B is
and return `notes[]` and `level: "ok" | "caution"`, implementing plan guardrails 1, 3, 6, 7.
`ui.js` exports a matching `callout()` renderer.

**Neither is rendered.** `compare.js:96` calls `classifyComparison` and uses only `cls.title`,
as a CSV column. The reader never sees "these two differ in more than one feature", never sees
"the pooled majority contains this version's own ratings, so agreement is inflated by
construction", never sees "different annotator panels, so this includes sampling variation".

This is the single highest-value fix on the list: the interpretive scaffolding already exists,
is already correct, and is one `append` away from the page.

The same applies to the reliability-vs-sensitivity contrast. On the default comparison the
cards show Fleiss κ = .97 and .95 *within* each setup, and the tiles show Cohen's κ = .81
*between* them. Those three numbers sitting in different boxes **are** the paper's argument,
and nothing on the page connects them. Say it in a sentence, above the tiles:

> Re-running A gives nearly the same labels every time (κ .97). Switching from A to B
> changes the label on 265 of 3,000 tweets (8.8%). High repeat-reliability is not evidence
> that the labels are stable.

### 2.2 The biggest missing finding is one arithmetic step away

Computed from the Landscape table (hate speech, all 84 cells):

- Holding the prompt fixed and **switching model**: 17.4–34.7 points of prevalence, median ~23.
- Holding the model fixed and **switching prompt**: 7.7–33.0 points, median ~12.5.
- **Re-running the same setup**: ~0.4 pp.
- **Five human versions**: 6.7 points.

So: model choice typically moves prevalence about twice as much as prompt design — *except*
for Llama 3.1 8B, where prompt design alone moves it 33 points, as much as switching model
does. GPT-5.4 is nearly prompt-insensitive (7.7). And every LLM choice dwarfs the spread
across five human questionnaire versions.

That is a real, quotable result, it is fully supported by the data already in the browser,
and the site makes the reader squint at a heatmap to find it. **Propose: a "What moves the
label most?" section** — a small ranked bar chart (run → human version → prompt → model),
computed live from the same data, with the Llama 3.1 8B exception called out. This would do
more for the target reader than any other addition.

---

## 3. Language

### 3.1 Six words for one thing

Currently in the UI, all referring to "one way of producing labels":
**setup** (overview), **condition** (nav, both page titles), **instrument** (compare lede,
picker legends, method statement, CSV), **design** (heatmap, "All 12 designs", "task design"),
**version** (humans), **prompt condition** (overview control), plus **structure** and
**variant** as the two picker dropdowns.

A newcomer spends real effort building a synonym map. Propose collapsing to two words:

- **setup** — any way of producing labels (use this everywhere in UI chrome)
- its two kinds: **prompt recipe** (LLM) and **questionnaire version** (human)

Keep *instrument* on the Methods page and as CSV column names, where precision matters and
the audience is different. Rename the picker dropdowns from Task structure / Presentation to
something a reader can act on: **Questions asked** (both in one prompt, OL first / both, HS
first / separate prompts) and **How it was shown** (one tweet / six at once / ± confidence).

### 3.2 Statistics with no anchor

`κ .81`, `Fleiss κ (3 runs) .97`, `Krippendorff's α`, `0.12 pp`, `−563 bp`, `modal label`.

- **Delete `bp`.** Basis points are finance jargon; the tile already says −5.6 pp directly
  above. It adds nothing and costs credibility with a general reader.
- **Give every κ a gloss.** Not a lecture — one clause: `.81 — of 3,000 tweets, 265 get a
  different label`. The number the reader can actually use is the flip count; κ should
  ride along with it, not lead.
- **"Modal label across 3 runs"** → "the label given in at least 2 of 3 runs".
- **Stripped leading zeros** (`.81`, `.97`) are a journal convention and read as typos
  outside one. Use `0.81`.

### 3.3 Axis labels

`Share labeled yes →` appears on every strip plot. Yes to *what*? The outcome toggle is
several hundred pixels away and may have scrolled off. Make it follow the toggle:
`Share of tweets labeled hate speech →`.

---

## 4. Page-by-page

### 4.1 Overview

1. **Row 1 of the strip plot looks like one dot.** It is three, overlapping, because the
   run-to-run spread is 0.2 points — which is exactly the point being made, and the reader
   can't see it. Annotate in the plot: *3 runs, nearly on top of each other*.
2. **Row 3 (84 dots) is badly overplotted.** The `locator()` beeswarm on the compare page
   already solves this; reuse it here.
3. **The four spread tiles are the payoff and they are disconnected from the four rows.**
   Put each spread number at the right end of its own row inside the plot, so "0.2 points"
   sits next to the row it describes. Keep the tiles or drop them, but stop making the reader
   match four labels to four rows by reading.
4. **Humans sit visibly below almost every LLM** (26.8–33.5% vs up to 53%) and nothing says so.
   One sentence under the plot.
5. **The LLM factor diagram is missing its "2" badge.** `instruments.js:97` passes `""` as the
   number for "1 vs 6 tweets per prompt", so the figure reads 3 × _ × 2 while the caption
   below claims 12. The arithmetic is the whole point of the figure.
6. **Versions D and E show an unlabeled "…"** between screens 2 and 3. It stands for 48 more
   tweets; without a label the "block of 50" — the defining feature of D and E — is invisible.
   Label it *…48 more tweets…*.
7. **Color collision.** In the instrument diagrams orange = hate speech and blue = offensive
   language (`--hs`, `--ol`). In the charts on the same page orange = Meta models and
   blue = OpenAI models (`--fam-meta`, `--fam-openai`). Same page, same two colors, two
   meanings. Re-encode one of them — OL/HS could be a fill/outline distinction instead of hue.
8. **Preset bug** (see §6).

### 4.2 Compare

1. **Render the `classifyComparison` callout.** See §2.1.
2. **Reorder the tiles.** Current order: Prevalence A, Prevalence B, Difference, Cohen's κ,
   Raw agreement, Tweets that flip. The last one is the most concrete and the most
   interesting; lead with it. Proposed: Tweets that flip → Difference → Prevalence A →
   Prevalence B → Raw agreement → κ.
3. **"Prevalence based on" is the second control on the page**, above the pickers, before the
   reader knows what prevalence is. The item-vs-label distinction is a methodological
   subtlety. Move it below the cards, or into a disclosure, defaulting to item labels.
4. **The "Tweets that flip" list is the most engaging thing here and is underbuilt.**
   - It shows text only. Show **what each side said and by what margin** — `A: yes (3 of 3
     runs) · B: no (1 of 3 runs)`, or for humans `2 of 3 raters` vs `1 of 3`. "Why did this
     flip?" is the question, and the answer is already in the data.
   - Selection is *first six by tweet ID* — arbitrary. Offer "show six more" / shuffle, and
     ideally sort by how decisive the flip is.
   - Consider showing a few **non**-flipping tweets alongside, so the reader can calibrate.
5. **"How to read this" is a six-line wall of prose** in a box next to the transition matrix.
   Split it: one sentence inline under the tiles, the rest behind a disclosure.
6. **Landing on compare.html from the nav drops the reader into two dropdown pickers with no
   suggestion of what to try.** Put two or three of the overview presets at the top of this
   page too.
7. Minor: **"Swap A and B" is appended to the global controls row**, where it reads as a third
   control group next to Outcome and Prevalence basis. It belongs between the two pickers.

### 4.3 All Conditions

1. **Model names appear only at the bottom** of a 12-row heatmap. Scrolled to the top rows you
   cannot tell which column is which model. Put them on top, or on both edges.
2. **Cells are clickable but give no affordance**: `cursor: auto`, no focus ring, no visible
   hint except a line of text below the figure. Worse, the handler reads `plot.value`, which
   is set by the hover tip — so on touch devices the click either does nothing or opens
   whatever the last hover set. Add `cursor: pointer`, a keyboard path, and a touch-safe
   click target.
3. **Cell numbers have no unit.** `39` sits in a cell while the legend says "Prevalence
   20%–50%". Either add `%` or put "percent of tweets" in the figure subtitle.
4. **No sorting.** Let the reader order models by mean prevalence or by spread; the pattern
   (GPT-5.4 lowest everywhere, Llama 3.1 8B most variable) would fall out immediately.
5. **No takeaway line.** Add one computed sentence under the figure — see §2.2.
6. Human versions are absent from the heatmap itself (already on the to-do list; agreed, and
   I would raise its priority — it is the one comparison the target reader most wants).
7. The "Reference" select appears and disappears with the Show toggle, shifting the layout.
   Disable it instead of hiding it.

### 4.4 Methods & Data

Substantively strong — the eligibility rules, tie rules, and the "known limitations" section
are better documented than most published companion sites. Two notes:

- The **"Comparing humans and LLMs"** section is the conceptual heart of the site and is
  buried on the last page as prose. Its content is what `classifyComparison` encodes; once
  the callouts render on the Compare page, link back here from each one.
- **Human labels are a benchmark, not ground truth** currently appears as a small italic line
  under the Compare lede and as a `notes[]` entry that never renders. For this audience it
  deserves to be a callout, not a whisper.

---

## 5. Cross-cutting

- **Placeholder links.** `href="#"` for Reiter et al. appears in the footer of all four pages
  and twice on the Methods page. Before this is shown to anyone outside the author group,
  either link the preprint or render it as plain text rather than a dead link.
- **Nav labels.** "Compare 2 Conditions" / "All Conditions" — a numeral in a nav item is
  unusual and the two are not parallel. Suggest "Compare two setups" / "Every setup".
- **Tooltips are hover-only.** Every "hover for details" instruction is inert on touch. The
  strip plots and heatmap all depend on tips for their detail layer.
- **Charts have no text alternative** on Overview and Compare (Landscape has its table). Already
  on the to-do list. `stripPlot` sets `role="img"` with no `aria-label`, which is worse than
  leaving it off — it hides the content from assistive tech without providing a substitute.
- **No "what this means for me" section.** The reader interested in label variation wants to
  know what to do differently. Three bullets would close the loop: report the prompt recipe,
  don't treat repeat-run agreement as a quality claim, and expect model choice to dominate.

---

## 6. Defects found

1. **Overview preset mislabels its contrast.** `pages/index.js:78`:
   ```js
   b: llmId(m, d.replace(/__.*/, "__batch")) === llmId(m, d) ? ... : llmId(m, d.replace(/__.*/, "__batch"))
   ```
   With the prompt condition set to *Batch of 6 + Confidence*, the preset labeled
   **"one tweet vs. six at once"** produces `joint_ol__batch_conf` vs `joint_ol__batch` —
   both batched. It is a confidence contrast. Verified live:
   `compare.html?outcome=HS&a=llm:GPT-4o-mini:joint_ol__batch_conf&b=llm:GPT-4o-mini:joint_ol__batch`.
   Same class of error with *+ Confidence* selected. Fix: derive the partner design by
   toggling the `batched` flag in `meta.variants`, not by string replacement.

2. **`classifyComparison` guardrails never render** (`pages/compare.js:96`). See §2.1.

3. **Heatmap click depends on hover state** (`pages/landscape.js:88`), so it is unreliable on
   touch and unavailable from the keyboard.

4. **Missing factor number** in the LLM diagram (`instruments.js:97`). See §4.1.5.

5. **`role="img"` without `aria-label`** on `stripPlot` (`charts.js:56`).

---

## 7. Suggested order

Cheap and high-value first.

**Tier 1 — hours, large effect**
1. Render the `classifyComparison` callout on Compare.
2. Add the reliability-vs-sensitivity sentence above the Compare tiles; reorder the tiles.
3. Fix the preset bug; add the missing "2" badge; label the D/E ellipsis.
4. Drop `bp`; restore leading zeros; gloss every κ with a flip count.
5. Heatmap: model names on top, `cursor: pointer`, `%` on the cells.
6. Terminology sweep to "setup".

**Tier 2 — a day or two, largest effect on the target reader**
7. "What moves the label most?" ranked comparison (§2.2).
8. Rebuild the flipped-tweets list to show each side's vote and margin, with paging.
9. One computed takeaway line under each of the three main figures.
10. Presets at the top of the Compare page; move "Prevalence based on" out of the way.

**Tier 3 — already on your roadmap, but I would re-rank**
11. Promote **Phase 3 (item explorer)** above Phases 4–5. "Which tweets are contested" is the
    most intuitive door into label variation for this audience, `item_profiles.parquet` is
    already built and currently unused, and it is the part of the project description —
    *play with all the cool data* — that nothing on the site currently delivers.
12. Human versions inside the heatmap (already listed).
13. Accessibility pass: chart tables, tip alternatives for touch, `aria-label` audit.
14. Resolve the placeholder links before any external sharing.

---

## 8. Things I did not check

- Light theme (reviewed in dark only).
- Screen-reader behavior; contrast was read from the CSS tokens, not measured.
- The Python pipeline and its 34 validation checks.
- Whether the statistics are correct — this is a usability review, not a numerical audit.
