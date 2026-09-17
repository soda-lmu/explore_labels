// Diagrams of the human and LLM labeling setups (after Kern et al. 2023, Fig. 1).
import { h } from "./ui.js";

const chip = (x, y, w, q) =>
  `<rect x="${x}" y="${y}" width="${w}" height="18" rx="3" class="q-${q.toLowerCase()}"/>` +
  `<text x="${x + w / 2}" y="${y + 13}" text-anchor="middle" class="q-t q-t-${q.toLowerCase()}">${q}</text>`;

const tweetBox = (x, y, w, label, hgt = 26) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="4" class="tw"/>` +
  (label ? `<text x="${x + w / 2}" y="${y + hgt / 2 + 4}" text-anchor="middle" class="tw-t">${label}</text>` : "");

// ------------------------------------------------------------------ humans
const SW = 66, GAP = 20, SH = 92;
const HUMAN = {
  A: { screens: [[1, "HS", "OL"], [2, "HS", "OL"], [3, "HS", "OL"], [4, "HS", "OL"]],
       text: "Both questions on one screen, hate speech listed first." },
  B: { screens: [[1, "HS"], [1, "OL"], [2, "HS"], [2, "OL"]],
       text: "One question per screen. Each tweet is shown twice: hate speech, then offensive language." },
  C: { screens: [[1, "OL"], [1, "HS"], [2, "OL"], [2, "HS"]],
       text: "Same as B, but offensive language comes first." },
  D: { screens: [[1, "HS"], [2, "HS"], [1, "OL"], [2, "OL"]], gap: true,
       text: "Hate speech for all of the person's tweets first, then offensive language for the same tweets." },
  E: { screens: [[1, "OL"], [2, "OL"], [1, "HS"], [2, "HS"]], gap: true,
       text: "Same as D, but offensive language comes first." }
};

function screensSvg({ screens, gap }) {
  const w = 4 * SW + 3 * GAP;
  const parts = screens.map(([t, ...qs], i) => {
    const x = i * (SW + GAP);
    return `<rect x="${x + 0.75}" y="0.75" width="${SW - 1.5}" height="${SH - 1.5}" rx="6" class="scr"/>` +
      tweetBox(x + 7, 7, SW - 14, `Tweet ${t}`) +
      qs.map((q, j) => chip(x + 7, 42 + j * 22, SW - 14, q)).join("");
  });
  if (gap) parts.push(`<text x="${2 * SW + GAP * 1.5}" y="${SH / 2 + 5}" text-anchor="middle" class="dots">…</text>`);
  return `<svg viewBox="0 0 ${w} ${SH}" width="${w}" height="${SH}" aria-hidden="true">${parts.join("")}</svg>`;
}

export function humanFigure(container) {
  const rows = Object.entries(HUMAN).map(([v, d]) =>
    h("div", { class: "inst-row" },
      h("div", { class: "inst-letter" }, v),
      h("div", { class: "inst-svg", html: screensSvg(d) }),
      h("p", { class: "inst-text" }, h("strong", {}, `Version ${v}. `), d.text)));
  const w = 4 * SW + 3 * GAP;
  const arrow = h("div", { class: "inst-row inst-axis" }, h("div"),
    h("div", { class: "inst-svg", html:
      `<svg viewBox="0 0 ${w} 22" width="${w}" height="22" aria-hidden="true">` +
      `<line x1="0" y1="6" x2="${w - 8}" y2="6" class="axis-line"/><path d="M${w - 9} 1 L${w} 6 L${w - 9} 11 Z" class="axis-head"/>` +
      `<text x="${w}" y="20" text-anchor="end" class="tw-t">screens, in the order the person saw them</text></svg>` }),
    h("div"));
  container.replaceChildren(
    h("div", { class: "inst-fig", role: "img", "aria-label": "Diagram of the five human labeling versions, A to E" }, rows, arrow));
}

// ------------------------------------------------------------------ LLMs
const card = (inner, w = 104, hgt = 104) =>
  `<svg viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}" aria-hidden="true">${inner}</svg>`;
const promptFrame = (x, w, hgt) =>
  `<rect x="${x + 0.75}" y="0.75" width="${w - 1.5}" height="${hgt - 1.5}" rx="6" class="scr"/>` +
  `<text x="${x + 8}" y="14" class="lab">Prompt</text>`;

function jointPrompt(first, second) {
  return card(promptFrame(0, 104, 104) + tweetBox(8, 22, 88, "Tweet") +
    chip(8, 56, 88, first) + chip(8, 78, 88, second));
}
function separatePrompts() {
  const one = (x, q) => promptFrame(x, 50, 104) + tweetBox(x + 6, 22, 38, "Tweet") + chip(x + 6, 56, 38, q);
  return card(one(0, "OL") + one(54, "HS"));
}
function tweetsPerPrompt(n) {
  if (n === 1) return card(promptFrame(0, 104, 104) + tweetBox(8, 22, 88, "Tweet 1", 70));
  const rows = Array.from({ length: n }, (_, i) => tweetBox(8, 22 + i * 12.5, 88, "", 9.5) +
    `<text x="14" y="${22 + i * 12.5 + 8}" class="tw-n">${i + 1}</text>`).join("");
  return card(promptFrame(0, 104, 104) + rows);
}
function answer(conf) {
  const reply = conf ? "OL: yes · 90%" : "OL: yes";
  return card(`<text x="4" y="30" class="lab">Model answers</text>` +
    `<rect x="0.75" y="38" width="102.5" height="30" rx="14" class="reply"/>` +
    `<text x="52" y="58" text-anchor="middle" class="reply-t">${reply}</text>`, 104, 104);
}

export function llmFigure(container, meta) {
  const factor = (n, title, opts) => h("div", { class: "factor" },
    h("h4", {}, h("span", { class: "fn" }, n), title),
    h("div", { class: "opts" }, opts.map(([svg, cap]) =>
      h("figure", { class: "opt" }, h("div", { html: svg }), h("figcaption", {}, cap)))));
  const times = () => h("div", { class: "times", "aria-hidden": "true" }, "×");
  container.replaceChildren(
    h("div", { class: "factors" },
      factor("3", "ways to ask the two questions", [
        [jointPrompt("OL", "HS"), "Both in one prompt, OL first"],
        [jointPrompt("HS", "OL"), "Both in one prompt, HS first"],
        [separatePrompts(), "A separate prompt for each question"]]),
      times(),
      factor("2", "numbers of tweets per prompt", [
        [tweetsPerPrompt(1), "One tweet"],
        [tweetsPerPrompt(6), "Six tweets at once"]]),
      times(),
      factor("2", "answer formats", [
        [answer(false), "Label only"],
        [answer(true), "Label plus confidence (0–100%)"]])),
    h("p", { class: "factors-sum" },
      h("strong", {}, "= 12 conditions. "),
      `Every condition was run 3 times with each of ${meta.models.length} models: `,
      meta.models.map((m) => m.label).join(", "), "."));
}
