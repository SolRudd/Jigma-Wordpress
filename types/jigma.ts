export type Device = "desktop" | "tablet" | "mobile";

export type EditorKind = "html" | "css" | "js";

export type StylingMode = "bem-css" | "native-experimental";

export type ClassMode = "strict-bem" | "hybrid" | "preserve";

export type ExportMode =
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

export interface ConversionWarning {
  severity: "info" | "warning" | "error";
  message: string;
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
  _exists: false;
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
  dependencyWarningCount: number;
  jsWarningCount: number;
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
