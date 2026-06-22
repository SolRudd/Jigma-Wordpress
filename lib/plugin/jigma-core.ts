import {
  BRICKS_COMPATIBILITY_SCHEMA_VERSION,
  createBricksExport,
  getBricksExportBlockingMessages,
  serializeBricksClipboardPayload,
  serializeBricksClipboardPayloadJson,
  TARGET_BRICKS_VERSION,
} from "../bricks/export.ts";
import type { ConversionWarning, OutputOptions } from "../../types/jigma.ts";

export interface PageLevelCssGroup {
  type: "root" | "document" | "font-face" | "property" | "keyframes" | "layer" | "import" | "reset" | "global";
  label: string;
  count: number;
}

export interface PageLevelCssReview {
  css: string;
  ruleCount: number;
  groups: PageLevelCssGroup[];
}

export interface JigmaPluginCoreInput {
  html: string;
  css: string;
  js: string;
  projectPrefix?: string;
  blockName?: string;
  includeJavaScriptCode?: boolean;
}

export interface JigmaPluginCoreResult {
  schemaVersion: typeof BRICKS_COMPATIBILITY_SCHEMA_VERSION;
  targetBricksVersion: typeof TARGET_BRICKS_VERSION;
  payload: ReturnType<typeof serializeBricksClipboardPayload>;
  payloadJson: string;
  diagnostics: {
    warnings: ConversionWarning[];
    blocked: boolean;
    blockingErrors: string[];
    elementCount: number;
    classCount: number;
    unsignedJavaScriptCount: number;
    unresolvedSelectorCount: number;
    missingSourceTextCount: number;
    duplicatedSourceTextCount: number;
    missingHrefCount: number;
    missingImageCount: number;
  };
  pageLevelCss: PageLevelCssReview;
}

const pluginCompatibilityOptions = (input: JigmaPluginCoreInput): OutputOptions => ({
  stylingMode: "bem-css",
  exportMode: "native-bem-classes",
  exportProfile: "bricks-compatibility",
  classMode: "strict-bem",
  projectPrefix: input.projectPrefix || "jg",
  blockName: input.blockName || "section",
  createGlobalClasses: true,
  includeExternalCss: false,
  includeExternalScripts: false,
  minifyElementCss: false,
  includeJavaScriptCode: Boolean(input.includeJavaScriptCode),
});

function readTopLevelCssBlocks(css: string) {
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

function selectorList(header: string) {
  return header
    .split(",")
    .map((selector) => selector.trim().toLowerCase())
    .filter(Boolean);
}

function classifyPageLevelCss(block: string): PageLevelCssGroup["type"] | null {
  const header = block.split("{")[0].trim();
  const lower = header.toLowerCase();

  if (lower.startsWith("@import")) return "import";
  if (lower.startsWith("@font-face")) return "font-face";
  if (lower.startsWith("@property")) return "property";
  if (lower.startsWith("@keyframes") || lower.startsWith("@-webkit-keyframes")) return "keyframes";
  if (lower.startsWith("@layer") && !lower.includes(".")) return "layer";

  const selectors = selectorList(header);
  if (selectors.length === 0) return null;
  if (selectors.every((selector) => selector === ":root")) return "root";
  if (selectors.every((selector) => selector === "html" || selector === "body" || selector === "html body")) {
    return "document";
  }
  if (selectors.some((selector) => selector === "*" || selector.startsWith("*::") || selector.includes("*, *"))) {
    return "reset";
  }
  if (selectors.some((selector) => selector.startsWith("html ") || selector.startsWith("body "))) {
    return "global";
  }

  return null;
}

const pageLevelLabels: Record<PageLevelCssGroup["type"], string> = {
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

export function detectPageLevelCss(css: string): PageLevelCssReview {
  const seen = new Set<string>();
  const blocks: string[] = [];
  const groups = new Map<PageLevelCssGroup["type"], number>();

  readTopLevelCssBlocks(css).forEach((block) => {
    const type = classifyPageLevelCss(block);
    const normalized = block.replace(/\s+/g, " ").trim();
    if (!type || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    blocks.push(block);
    groups.set(type, (groups.get(type) || 0) + 1);
  });

  return {
    css: blocks.join("\n\n"),
    ruleCount: blocks.length,
    groups: Array.from(groups.entries()).map(([type, count]) => ({
      type,
      label: pageLevelLabels[type],
      count,
    })),
  };
}

export function convertToBricksCompatibility(input: JigmaPluginCoreInput): JigmaPluginCoreResult {
  const exportResult = createBricksExport({
    html: input.html,
    css: input.css,
    js: input.js,
    options: pluginCompatibilityOptions(input),
  });
  const blockingErrors = getBricksExportBlockingMessages(exportResult);

  return {
    schemaVersion: BRICKS_COMPATIBILITY_SCHEMA_VERSION,
    targetBricksVersion: TARGET_BRICKS_VERSION,
    payload: serializeBricksClipboardPayload(exportResult),
    payloadJson: serializeBricksClipboardPayloadJson(exportResult),
    diagnostics: {
      warnings: exportResult.warnings,
      blocked: blockingErrors.length > 0,
      blockingErrors,
      elementCount: exportResult.validation.totalElements,
      classCount: exportResult.validation.globalClassCount,
      unsignedJavaScriptCount: exportResult.validation.unsignedJavaScriptCodeCount,
      unresolvedSelectorCount: exportResult.validation.unresolvedSelectorCount,
      missingSourceTextCount: exportResult.validation.missingSourceTextCount ?? 0,
      duplicatedSourceTextCount: exportResult.validation.duplicatedSourceTextCount ?? 0,
      missingHrefCount: exportResult.validation.missingHrefCount ?? 0,
      missingImageCount: exportResult.validation.missingImageCount ?? 0,
    },
    pageLevelCss: detectPageLevelCss(input.css),
  };
}
