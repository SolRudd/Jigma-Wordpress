import type { BricksElement } from "../../types/jigma.ts";

export const BRICKS_ELEMENT_LABEL_FIELD = "label";

const LABEL_PREFIX_WORDS = new Set([
  "acme",
  "c",
  "demo",
  "jg",
  "jig",
  "jigma",
  "lit",
  "prefix",
  "ui",
]);

const ROOT_SUFFIX_BY_TAG: Record<string, string> = {
  article: "Card",
  aside: "Aside",
  footer: "Footer",
  header: "Header",
  main: "Main",
  nav: "Nav",
  section: "Section",
  svg: "SVG",
};

interface LabelOptions {
  bemClass: string;
  tagName: string;
  parentLabel?: string;
}

function titleCaseWord(word: string) {
  if (!word) {
    return "";
  }

  if (word.toLowerCase() === "cta") {
    return "CTA";
  }

  if (word.toLowerCase() === "svg") {
    return "SVG";
  }

  return `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`;
}

function wordsFromPart(part: string) {
  return part
    .split("-")
    .map((word) => word.trim())
    .filter(Boolean);
}

function trimPrefixWords(words: string[]) {
  const next = [...words];

  while (next.length > 1 && LABEL_PREFIX_WORDS.has(next[0].toLowerCase())) {
    next.shift();
  }

  return next;
}

function formatWords(words: string[]) {
  return words.map(titleCaseWord).filter(Boolean).join(" ");
}

function parseBemClass(bemClass: string) {
  const [blockPart, rawElementPart = ""] = bemClass.split("__");
  const [elementPart = "", modifierPart = ""] = rawElementPart.split("--");

  return {
    blockWords: trimPrefixWords(wordsFromPart(blockPart)),
    elementWords: wordsFromPart(elementPart),
    modifierWords: wordsFromPart(modifierPart),
  };
}

export function createBricksElementLabel(options: LabelOptions) {
  const parsed = parseBemClass(options.bemClass);
  const blockLabel = formatWords(parsed.blockWords);

  if (parsed.elementWords.length === 0) {
    const suffix = ROOT_SUFFIX_BY_TAG[options.tagName] ?? "Element";
    return `${blockLabel} ${suffix}`.trim();
  }

  const elementLabel = formatWords([
    ...parsed.blockWords,
    ...parsed.elementWords,
    ...parsed.modifierWords,
  ]);

  if (
    options.tagName === "svg" &&
    parsed.elementWords.length === 1 &&
    parsed.elementWords[0].toLowerCase() === "svg" &&
    options.parentLabel
  ) {
    return `${options.parentLabel} SVG`;
  }

  return elementLabel || `${blockLabel} Element`.trim();
}

export function applyBricksElementLabel(element: BricksElement, label: string) {
  element[BRICKS_ELEMENT_LABEL_FIELD] = label;
  return element;
}
