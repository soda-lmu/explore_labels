# v2-usability

Branched from `main` at `7f2b22a`. Addresses the findings of an internal usability review.
No pipeline or data changes: `src/public/data/` is untouched, so every number on the
site still comes from the validated build.

## Defects fixed

1. **Preset mislabelled its contrast.** `index.js` derived the partner recipe by string
   surgery on the design id (`d.replace(/__.*/, "__batch")`), so with *Batch of 6 +
   Confidence* selected the preset labelled "one tweet vs. six at once" actually opened a
   confidence contrast with both sides batched. Replaced with `partnerDesign(id, meta,
   factor)`, which toggles one factor via `meta.variants`. Regression test added covering
   every design and both factors.
2. **`classifyComparison` guardrails were computed and discarded.** `compare.js` used only
   `cls.title`, as a CSV column. The callout now renders above the two cards, so the reader
   sees "different annotator panels, so this includes sampling variation", "the pooled
   majority contains this version's own ratings", and the rest.
3. **Heatmap clicks depended on hover state.** The handler read `plot.value`, set by the tip
   interaction, so it was unreliable on touch and unreachable by keyboard. Each cell is now a
   real `role="button"` target with `tabindex`, an aria-label, `cursor: pointer` and Enter support.
4. **LLM factor diagram was missing its number**, so it read 3 × _ × 2 while the caption
   claimed 12.
5. **`role="img"` with no `aria-label`** on the strip plots — hid the figure from assistive
   tech without substituting anything. All figures now carry a description, and the overview
   and "what moves the label most" figures have table alternatives.

## Structure

- **New: "What moves the label most?"** (`landscape.html#what-moves`). Four effect sizes on
  one scale — re-running a setup, changing questionnaire version, changing prompt recipe,
  changing model — each computed live from the loaded data, with three computed takeaway
  sentences. For hate speech: 0.4 / 6.7 / 12.5 / 24.0 points. This was derivable from the
  heatmap by eye and is now stated.
- **New: "If you collect or evaluate labels"** on the overview. Three consequences for a
  reader who works with labeled data, which is the audience the site had no ending for.
- **Reliability vs. sensitivity** is now stated on the compare page with that comparison's
  own numbers, and phrased to match them — a setup with low within-agreement gets a
  different sentence, not the "repeats itself almost exactly" one.

## Language

- One word for one thing. **Setup** = any way of producing labels; **prompt recipe** = one of
  the 12 LLM task designs; **questionnaire version** = one of the human instruments A–E.
  *Instrument*, *condition* and *design* are gone from the UI and kept where they are precise:
  the Methods page, the data dictionary and the CSV column names. A "Words used on this site"
  list was added to Methods.
- Picker dropdowns are now "Questions asked" and "How it was shown" rather than "Task
  structure" and "Presentation".
- Dropped basis points (`bp`) — finance jargon, and redundant next to the pp tile.
- Restored leading zeros: `0.81`, not `.81`.
- "Modal label across 3 runs" → "the label given in at least 2 of the 3 runs".
- Axis labels follow the outcome toggle: "Share of tweets labeled hate speech →".

## Figures

- **Strip plots use a per-row dodge.** The top row previously looked like one dot; it is three,
  0.2 points apart, which is the point being made. The 84-dot row is now a readable
  distribution instead of a blob.
- **Spread labels sit at the end of the row they describe**, instead of four tiles below the
  figure that the reader had to match up by reading.
- **Heatmap model names moved to the top.** With 12 rows, reading the top rows previously
  meant scrolling to the bottom for the column headings. Cell numbers now have a stated unit.
- **Model sort control** on the heatmap: paper order, prevalence, or prompt-sensitivity.
- **Computed takeaway under the heatmap** naming the two extreme setups.
- **Version D/E ellipsis is labelled** "48 more tweets" — the block of 50 was otherwise invisible.
- **Key added to the instrument diagrams** noting that the OL/HS colours mark the two
  questions there, while colour marks model family in the charts. (The hue collision is real;
  both palettes are recorded decisions, so this labels rather than overturns them.)

## Compare page

- Starter comparisons at the top — landing from the nav dropped the reader into two dropdowns.
- Tiles reordered: **tweets that get a different label** first, κ last.
- "Prevalence based on" moved below the cards and relabelled "Count prevalence over"; it was
  the second control on the page, before the reader knew what prevalence was.
- **The flipped-tweet list was rebuilt.** Each entry now shows what A said, what B said, the
  text, and how contested the tweet is (share of all 15 human ratings and of all 84 LLM setups
  that said yes, from `item_profiles.parquet`, which nothing used before). Default order is
  most-contested-first rather than tweet-ID order, and there is a "show 6 more".
- "How to read this" split: one sentence inline, the rest behind a disclosure.
- Reference select on the landscape page is disabled rather than hidden, so the row stops jumping.

## Tooltips and palette (second pass)

- **Every tooltip on the site was unreadable in dark mode.** Observable Plot draws the tip
  box with `--plot-background`, which its own generated rule pins to white regardless of
  theme, while the text inherits `var(--ink)` — light text on a white box. The rule is
  `:where(.plot-xxxx)`, zero specificity but applied to the element itself, so inheritance
  cannot override it; a direct element selector now binds it to `var(--surface)`. This
  affected the strip plots, the heatmap and the locator, not only the new bar chart.
- **The effect-size tip also showed the wrong content**: its first row was the long x-axis
  label, and the method text was truncated with an ellipsis. It now has its own short
  channels, and all tips get `lineWidth: 30` so long setup names wrap instead of truncating.
- **Meta moves off orange, to wine** (`#882255` light, `#cc7090` dark). Measured rather than
  guessed: worst-case pairwise ΔE2000 across normal, deuteranopic, protanopic and tritanopic
  simulation, counting the OL and HS chips as additional colours —

  | | within families | vs OL/HS | worst |
  |---|---|---|---|
  | light, before | 11.7 | 13.7 | 11.7 |
  | light, after | 11.7 | 13.7 | 11.7 |
  | **dark, before** | 6.6 | **2.6** | **2.6** |
  | **dark, after** | 6.6 | 8.0 | **6.6** |

  The dark-mode figure is the finding: family orange `#c98500` and hate-speech orange
  `#e0782a` simulated to ΔE 2.6, which is below the just-noticeable threshold — in dark mode
  the two encodings were not merely confusable, they were the same colour. Wine keeps blue
  and green as the paper has them and costs nothing in light mode.

  Searched alternatives first. Triads that dodge *both* the OL blue and the HS orange while
  staying categorically distinct and legible on both surfaces all scored the same or worse:
  pushing families toward purple/teal collides with OL blue under tritanopia, and the best
  scoring triad numerically (blue / sand / wine, worst-case 20.2) puts Mistral on a pale
  yellow with 1.6:1 contrast on the light surface. Moving one hue was the best available trade.

  Residual: OpenAI blue `#0072b2` and the OL chip `#56b4e9` are still the same hue family,
  separated mainly by lightness. **Decided 2026-09-18: the OL/HS chip colours stay.** They
  match Kern et al. Fig. 1, the chips carry their own "OL"/"HS" text so hue is not load-bearing,
  and the two encodings never share a figure — chips appear only in the instrument diagrams,
  family colour only in the charts. The key on the overview states which is which.

## Also

- The Reiter et al. placeholder `href="#"` on all four pages is now plain text rather than a
  dead link, pending the public URL.
- Nav: "Compare two setups" / "Every setup".

## Verified

- `npm run test:js` — 7 pass (6 existing plus the `partnerDesign` regression test).
- `npm run build` — clean; run in a Linux container because `node_modules` here is a macOS
  install and rollup's platform binary does not match. **Re-run `npm run build` on the Mac.**
- All four pages walked at 800px and 390px, light and dark, no console errors, no horizontal
  overflow, URL state still round-trips.
- `npm run test:py` not run: pytest is not installed in the environment used here. The pipeline
  is untouched, so those tests are unaffected, but run them before merging.

## Not done

- **Phase 3, the item explorer.** Reviewed as the highest-value remaining addition for this
  audience: `item_profiles.parquet` is now used on the compare page but there is still no
  per-tweet view or sortable sensitivity index. Left as its own piece of work.
- Human versions inside the heatmap itself (plan §20).
- Full WCAG contrast measurement; tooltips are still hover-only, so touch users lose the
  detail layer on the strip plots and heatmap.
- The placeholder citation still needs the real URL.
