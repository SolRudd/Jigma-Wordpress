export type Device = "desktop" | "tablet" | "mobile";

export type EditorKind = "html" | "css" | "js";

export type StylingMode = "bem-css" | "native-experimental";

export type ClassMode = "strict-bem" | "hybrid" | "preserve";

export type ExportMode =
  | "native-bem-classes"
  | "element-styles"
  | "structure-only"
  | "scoped-css-block"
  | "global-classes";

export interface OutputOptions {
  stylingMode: StylingMode;
  exportMode: ExportMode;
  classMode: ClassMode;
  projectPrefix: string;
  blockName: string;
  createGlobalClasses: boolean;
  includeExternalCss: boolean;
  includeExternalScripts: boolean;
  minifyElementCss: boolean;
}

export interface ParsedElement {
  tagName: string;
  attributes: Record<string, string>;
  children: ParsedElement[];
  textSegments: string[];
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
  dependencyWarningCount: number;
  jsWarningCount: number;
}

export interface BricksClassAuditEntry {
  className: string;
  classId: string;
  assignedElementIds: string[];
  nativeSettingsCount: number;
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
    stylingMode: StylingMode;
    notes: string[];
    classAudit?: BricksClassAuditEntry[];
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
