export type Device = "desktop" | "tablet" | "mobile";

export type EditorKind = "html" | "css" | "js";

export type StylingMode = "bem-css" | "native-experimental";

export type ClassMode = "strict-bem" | "hybrid" | "preserve";

export type ConversionProfile = "clean-native" | "fidelity";

export type ExportProfile = "bricks-compatibility" | "native-controls-experimental";

export type ExportMode =
  | "native-bem-classes"
  | "element-styles"
  | "structure-only"
  | "scoped-css-block"
  | "global-classes";

export interface OutputOptions {
  stylingMode: StylingMode;
  exportMode: ExportMode;
  exportProfile?: ExportProfile;
  classMode: ClassMode;
  conversionProfile?: ConversionProfile;
  projectPrefix: string;
  blockName: string;
  createGlobalClasses: boolean;
  includeExternalCss: boolean;
  includeExternalScripts: boolean;
  minifyElementCss: boolean;
  includeJavaScriptCode?: boolean;
}

export interface ParsedElement {
  tagName: string;
  attributes: Record<string, string>;
  children: ParsedElement[];
  textSegments: string[];
  contentParts: Array<
    | { type: "text"; value: string }
    | { type: "element"; element: ParsedElement }
  >;
  selfClosing: boolean;
  rawHtml?: string;
}

export interface LayerNode {
  id: string;
  tagName: string;
  label: string;
  text: string;
  classes: string[];
  elementId?: string;
  children: LayerNode[];
}

export interface CodeFormatResult {
  code: string;
  warnings: string[];
}

export type DependencyType =
  | "stylesheet"
  | "script"
  | "font"
  | "image"
  | "svg"
  | "css-variable"
  | "cdn"
  | "library";

export interface DependencyItem {
  id: string;
  type: DependencyType;
  label: string;
  value: string;
  source: "html" | "css" | "js";
  required: boolean;
  includable: boolean;
  warning?: string;
}

export type ConversionSeverity = "notice" | "info" | "warning" | "action-required" | "error";

export interface ConversionWarning {
  severity: ConversionSeverity;
  message: string;
  id?: string;
  code?: string;
  title?: string;
  summary?: string;
  count?: number;
  ownerElementId?: string;
  ownerLabel?: string;
  details?: string[];
  suggestedAction?: string;
}

export type AssetType =
  | "image"
  | "responsive-image"
  | "background-image"
  | "svg-inline"
  | "svg-file"
  | "font"
  | "stylesheet"
  | "script"
  | "video"
  | "iframe"
  | "data-uri"
  | "css-url";

export type AssetUsage =
  | "element"
  | "background"
  | "overlay"
  | "mask"
  | "pseudo-element"
  | "source-set"
  | "script"
  | "dependency";

export type AssetStatus =
  | "native"
  | "preserved"
  | "imported"
  | "action-required"
  | "unsupported"
  | "failed";

export interface AssetManifestItem {
  id: string;
  type: AssetType;
  source: "html" | "css" | "js";
  originalUrl: string;
  normalizedUrl: string;
  ownerNodeId?: string;
  ownerClass?: string;
  usage: AssetUsage;
  mimeType?: string;
  alt?: string;
  width?: number;
  height?: number;
  external: boolean;
  importable: boolean;
  status: AssetStatus;
  warnings: string[];
}

export interface AssetManifest {
  items: AssetManifestItem[];
  summary: {
    nativeImages: number;
    responsiveImages: number;
    backgroundImages: number;
    overlaysMapped: number;
    inlineSvgs: number;
    svgSignaturesRequired: number;
    codeElements: number;
    externalAssets: number;
    failedAssets: number;
  };
  warnings: ConversionWarning[];
}

export interface BricksElement {
  id: string;
  name: string;
  parent: string | 0;
  children: string[];
  settings: Record<string, unknown>;
  label?: string;
}

export interface BricksGlobalClass {
  id: string;
  name: string;
  settings: Record<string, unknown>;
}

export interface BricksExportValidation {
  targetBricksVersion: string;
  rootCount: number;
  totalElements: number;
  hierarchyValid: boolean;
  skippedLayerCount: number;
  deletedLayerCount: number;
  unsupportedElementCount: number;
  generatedTextElementCount: number;
  classAttachmentCount: number;
  globalClassCount: number;
  bemClassCount: number;
  cssAttachedRuleCount: number;
  cssScopedRuleCount: number;
  cssUnmappedRuleCount: number;
  unusedSelectorCount: number;
  nativeStyleMappedCount: number;
  customCssFallbackCount: number;
  blockScopedFallbackCount: number;
  literalFallbackRuleCount: number;
  classFallbackStrategy: "bricks-class-root" | "literal-bem" | "none";
  responsiveRuleCount: number;
  pseudoRuleCount: number;
  unresolvedSelectorCount: number;
  externalDependencyCount: number;
  unsignedSvgCodeCount: number;
  unsignedJavaScriptCodeCount: number;
  groupedWarningCount: number;
  classReferenceValid: boolean;
  missingClassReferenceCount: number;
  duplicateClassIdCount: number;
  duplicateClassNameCount: number;
  emptyStyledClassCount: number;
  fallbackCssMissingClassSelectorCount: number;
  fallbackCssElementIdSelectorCount: number;
  dependencyWarningCount: number;
  jsWarningCount: number;
  nativeImageCount?: number;
  responsiveImageCount?: number;
  backgroundImageCount?: number;
  overlayMappedCount?: number;
  failedAssetCount?: number;
  conversionProfile?: ConversionProfile;
  exportProfile?: ExportProfile;
  generatedWrapperCount?: number;
  actionRequiredWarningCount?: number;
  nativeCssMappingPercentage?: number;
  complexityWarningCount?: number;
  invalidNestingCount?: number;
  sourceTextCount?: number;
  sourceTextCoverageValid?: boolean;
  missingSourceTextCount?: number;
  duplicatedSourceTextCount?: number;
  reorderedSourceTextCount?: number;
  hrefCoverageValid?: boolean;
  sourceHrefCount?: number;
  missingHrefCount?: number;
  imageCoverageValid?: boolean;
  sourceImageCount?: number;
  missingImageCount?: number;
  clipboardSchemaValid?: boolean;
  cssDeclarationCoverageValid?: boolean;
  sourceCssDeclarationCount?: number;
  preservedCssDeclarationCount?: number;
  missingCssDeclarationCount?: number;
  cssConservationPercentage?: number;
}

export interface BricksClassAuditEntry {
  className: string;
  classId: string;
  assignedElementIds: string[];
  nativeSettingsCount: number;
  fallbackCssRuleCount: number;
  fallbackStrategy: "bricks-class-root" | "literal-bem" | "none";
  customCssPresent: boolean;
  missingReferences: string[];
  conflicts: string[];
}

export interface BricksExport {
  content: BricksElement[];
  source: "bricksCopiedElements";
  sourceUrl: "jigma.local";
  version: string;
  globalClasses?: BricksGlobalClass[];
  jigmaMeta: {
    label: string;
    targetBricksVersion: string;
    stylingMode: StylingMode | "native-bricks-classes";
    exportProfile?: ExportProfile;
    conversionProfile?: ConversionProfile;
    complexity?: {
      elementCount: number;
      nativeClassCount: number;
      generatedWrapperCount: number;
      unsignedSvgCount: number;
      javascriptCodeCount: number;
      unresolvedSelectorCount: number;
      actionRequiredWarningCount: number;
      nativeCssMappingPercentage: number;
      fallbackCssCount: number;
      cleanNativeThresholdsExceeded: string[];
    };
    notes: string[];
    classAudit?: BricksClassAuditEntry[];
    assetManifest?: AssetManifest;
  };
  warnings: ConversionWarning[];
  validation: BricksExportValidation;
}

export interface ConversionInput {
  html: string;
  css: string;
  js: string;
  options: OutputOptions;
  excludedLayerIds?: Set<string>;
  deletedLayerIds?: Set<string>;
}
