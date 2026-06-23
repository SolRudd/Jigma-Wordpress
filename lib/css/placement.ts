import type { CssPlacementMode } from "../../types/jigma.ts";

// Single source of truth for CSS placement routing shared by the standalone web app
// and the WordPress plugin. There must not be two separate CSS routing systems.

export const CSS_PLACEMENT_MODES: CssPlacementMode[] = [
  "auto-class-first",
  "attach-to-classes",
  "scope-to-section",
  "page-stylesheet",
];

// Product default. The low-level exporter keeps legacy behaviour when cssPlacement
// is unset; the product entry points resolve to this default.
export const DEFAULT_CSS_PLACEMENT: CssPlacementMode = "auto-class-first";

export const CSS_PLACEMENT_LABELS: Record<CssPlacementMode, string> = {
  "auto-class-first": "Auto — class-first",
  "attach-to-classes": "Attach to classes",
  "scope-to-section": "Scope to section",
  "page-stylesheet": "Page stylesheet",
};

export const CSS_PLACEMENT_DESCRIPTIONS: Record<CssPlacementMode, string> = {
  "auto-class-first":
    "Clear class rules go to Bricks classes; descendant/pseudo/media rules stay on the section; true globals go to Page Styles.",
  "attach-to-classes":
    "Split CSS across Bricks global classes so each class owns its relevant CSS.",
  "scope-to-section":
    "Preserve the full original CSS on the root component class. Best for visual parity.",
  "page-stylesheet":
    "Route all CSS to the reusable Jigma Page Styles element.",
};

export function normalizeCssPlacement(
  value: unknown,
  fallback: CssPlacementMode = DEFAULT_CSS_PLACEMENT,
): CssPlacementMode {
  return CSS_PLACEMENT_MODES.includes(value as CssPlacementMode)
    ? (value as CssPlacementMode)
    : fallback;
}

export type PageLevelCssType =
  | "root"
  | "document"
  | "font-face"
  | "property"
  | "keyframes"
  | "layer"
  | "import"
  | "reset"
  | "global";

export interface PageLevelCssGroup {
  type: PageLevelCssType;
  label: string;
  count: number;
}

export interface PageLevelCssReview {
  css: string;
  ruleCount: number;
  groups: PageLevelCssGroup[];
}

export interface CssPartition {
  // Page/global CSS routed to the reusable Jigma Page Styles element.
  pageLevelCss: string;
  // Component CSS that stays with the section (class/element routing happens later).
  componentCss: string;
  review: PageLevelCssReview;
}

const PAGE_LEVEL_LABELS: Record<PageLevelCssType, string> = {
  root: ":root variables",
  document: "document styles",
  "font-face": "@font-face",
  property: "@property",
  keyframes: "shared @keyframes",
  layer: "unscoped @layer",
  import: "@import",
  reset: "global reset",
  global: "global selector",
};

// Reads top-level CSS blocks and standalone at-statements (e.g. @import "...";)
// without splitting nested braces, quotes, or descendant rules.
function readTopLevelBlocks(css: string): string[] {
  const blocks: string[] = [];
  let index = 0;

  while (index < css.length) {
    while (index < css.length && /\s/.test(css[index])) index += 1;
    if (index >= css.length) break;

    const start = index;
    let quote = "";
    let depth = 0;

    while (index < css.length) {
      const char = css[index];
      const previous = css[index - 1];

      if (quote) {
        if (char === quote && previous !== "\\") quote = "";
        index += 1;
        continue;
      }

      if (char === "\"" || char === "'") {
        quote = char;
        index += 1;
        continue;
      }

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          index += 1;
          blocks.push(css.slice(start, index).trim());
          break;
        }
      } else if (char === ";" && depth === 0) {
        index += 1;
        blocks.push(css.slice(start, index).trim());
        break;
      }

      index += 1;
    }

    if (index >= css.length && start < css.length) {
      const rest = css.slice(start).trim();
      if (rest) blocks.push(rest);
    }
  }

  return blocks.filter(Boolean);
}

function selectorList(header: string): string[] {
  return header
    .split(",")
    .map((selector) => selector.trim().toLowerCase())
    .filter(Boolean);
}

// Classifies a top-level block as page/global CSS, or null when it belongs to the
// component (class/element) stream.
export function classifyPageLevelCss(block: string): PageLevelCssType | null {
  const header = block.split("{")[0].trim();
  const lower = header.toLowerCase();

  if (lower.startsWith("@import")) return "import";
  if (lower.startsWith("@font-face")) return "font-face";
  if (lower.startsWith("@property")) return "property";
  if (lower.startsWith("@keyframes") || lower.startsWith("@-webkit-keyframes")) return "keyframes";
  if (lower.startsWith("@layer") && !lower.includes(".")) return "layer";

  // @media / @container / @supports wrap component rules; keep them in the component stream.
  if (lower.startsWith("@")) return null;

  const selectors = selectorList(header);
  if (selectors.length === 0) return null;
  if (selectors.every((selector) => selector === ":root")) return "root";
  if (selectors.every((selector) => selector === "html" || selector === "body" || selector === "html body")) {
    return "document";
  }
  if (selectors.some((selector) => selector === "*" || selector.startsWith("*::") || selector.startsWith("*,"))) {
    return "reset";
  }
  if (selectors.some((selector) => selector.startsWith("html ") || selector.startsWith("body "))) {
    return "global";
  }

  return null;
}

// Splits raw CSS into a page/global stream and a component stream, and produces a
// deduplicated review of the page-level groups. This is the only place that decides
// what counts as page/global CSS.
export function partitionPageLevelCss(css: string): CssPartition {
  const seenPageLevel = new Set<string>();
  const pageBlocks: string[] = [];
  const componentBlocks: string[] = [];
  const groups = new Map<PageLevelCssType, number>();

  readTopLevelBlocks(css).forEach((block) => {
    const type = classifyPageLevelCss(block);
    if (!type) {
      componentBlocks.push(block);
      return;
    }

    const normalized = block.replace(/\s+/g, " ").trim();
    if (seenPageLevel.has(normalized)) {
      return;
    }

    seenPageLevel.add(normalized);
    pageBlocks.push(block);
    groups.set(type, (groups.get(type) || 0) + 1);
  });

  return {
    pageLevelCss: pageBlocks.join("\n\n"),
    componentCss: componentBlocks.join("\n\n"),
    review: {
      css: pageBlocks.join("\n\n"),
      ruleCount: pageBlocks.length,
      groups: Array.from(groups.entries()).map(([type, count]) => ({
        type,
        label: PAGE_LEVEL_LABELS[type],
        count,
      })),
    },
  };
}

// Back-compatible review-only helper.
export function detectPageLevelCss(css: string): PageLevelCssReview {
  return partitionPageLevelCss(css).review;
}
