import {
  BRICKS_COMPATIBILITY_SCHEMA_VERSION,
  createBricksExport,
  getBricksExportBlockingMessages,
  serializeBricksClipboardPayload,
  serializeBricksClipboardPayloadJson,
  TARGET_BRICKS_VERSION,
} from "../bricks/export.ts";
import {
  CSS_PLACEMENT_LABELS,
  DEFAULT_CSS_PLACEMENT,
  normalizeCssPlacement,
  partitionPageLevelCss,
} from "../css/placement.ts";
import type {
  ConversionWarning,
  CssPlacementMode,
  OutputOptions,
} from "../../types/jigma.ts";
import type { PageLevelCssGroup, PageLevelCssReview } from "../css/placement.ts";

// Re-export the shared CSS routing surface so plugin consumers have a single import point.
export {
  CSS_PLACEMENT_LABELS,
  DEFAULT_CSS_PLACEMENT,
  detectPageLevelCss,
  normalizeCssPlacement,
} from "../css/placement.ts";
export type { PageLevelCssGroup, PageLevelCssReview } from "../css/placement.ts";
export type { CssPlacementMode } from "../../types/jigma.ts";

export interface JigmaPluginCoreInput {
  html: string;
  css: string;
  js: string;
  projectPrefix?: string;
  blockName?: string;
  includeJavaScriptCode?: boolean;
  cssPlacement?: CssPlacementMode;
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
  cssPlacement: CssPlacementMode;
  cssPlacementLabel: string;
  // Page/global CSS routed to the reusable Jigma Page Styles element. Inserted
  // automatically; the user never needs to re-paste it.
  pageStylesCss: string;
  pageLevelCss: PageLevelCssReview;
}

const pluginCompatibilityOptions = (
  input: JigmaPluginCoreInput,
  cssPlacement: CssPlacementMode,
): OutputOptions => ({
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
  cssPlacement,
});

export function convertToBricksCompatibility(input: JigmaPluginCoreInput): JigmaPluginCoreResult {
  const cssPlacement = normalizeCssPlacement(input.cssPlacement, DEFAULT_CSS_PLACEMENT);
  const exportResult = createBricksExport({
    html: input.html,
    css: input.css,
    js: input.js,
    options: pluginCompatibilityOptions(input, cssPlacement),
  });
  const blockingErrors = getBricksExportBlockingMessages(exportResult);
  const partition = partitionPageLevelCss(input.css);

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
    cssPlacement,
    cssPlacementLabel: CSS_PLACEMENT_LABELS[cssPlacement],
    // Reflects what was actually routed to the Page Styles element for this mode.
    pageStylesCss: exportResult.pageStylesCss ?? "",
    pageLevelCss: partition.review,
  };
}
