import type {
  BricksElement,
  BricksClassAuditEntry,
  BricksExport,
  BricksGlobalClass,
  ClassMode,
  CssPlacementMode,
  ConversionInput,
  ConversionWarning,
  OutputOptions,
  ParsedElement,
} from "../../types/jigma.ts";
import {
  getClassNames,
  getElementText,
  getOwnText,
  hasOnlyPhrasingContent,
  getRenderableRoots,
  serializeInlineContent,
  serializeElement,
} from "../parser/html.ts";
import { createAssetManifest } from "../assets/manifest.ts";
import { getImageDescriptor } from "../assets/images.ts";
import { createBricksImageSettings } from "../output/bricks/media.ts";
import { countSvgInternalNodes, sanitizeSvgMarkup } from "../svg/sanitize.ts";
import {
  createBemClassFactory,
  type BemClassAssignment,
} from "../bem/classes.ts";
import {
  applyBricksElementLabel,
  createBricksElementLabel,
} from "./labels.ts";
import { inspectDependencies } from "../dependencies/inspect.ts";
import {
  attachCssToGlobalClasses,
  attachCssToElements,
  attachCssToRootClass,
  auditCssDeclarationConservation,
  BRICKS_ELEMENT_CUSTOM_CSS_FIELD,
  componentCssToGeneratedSelectors,
  splitClassFirstCss,
  type ClassCssTarget,
  type ElementCssResult,
  type ElementCssTarget,
} from "../css/element.ts";
import { DEFAULT_CSS_PLACEMENT, partitionPageLevelCss } from "../css/placement.ts";
import { scopeCssToBem, type CssSelectorScopeMap } from "../css/scope.ts";
import { BRICKS_COMPATIBILITY_SCHEMA_VERSION } from "./compatibility-schema.ts";

export const TARGET_BRICKS_VERSION = "2.3.7";
export { BRICKS_COMPATIBILITY_SCHEMA_VERSION };

const HIDDEN_STRUCTURE_TAGS = new Set([
  "script",
  "style",
  "link",
  "meta",
  "title",
  "base",
  "template",
  "source",
]);

const TEXT_TAGS = new Set(["p", "span", "strong", "em", "small", "b", "i", "mark", "li", "blockquote"]);
const CLASS_OWNED_PHRASING_TAGS = new Set([
  "abbr",
  "b",
  "code",
  "em",
  "i",
  "mark",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
]);
const WRAPPER_TAGS = new Set(["div", "article", "header", "main", "footer", "nav", "aside", "ul", "ol"]);
const SEMANTIC_WRAPPER_TAGS = new Set(["header", "main", "footer", "nav", "article", "aside", "figure", "ul", "ol"]);
const NON_NESTABLE_BRICKS_ELEMENTS = new Set([
  "heading",
  "text-link",
  "button",
  "text-basic",
  "svg",
  "image",
  "rich-text",
]);
const SUPPORTED_TAGS = new Set([
  "section",
  "div",
  "header",
  "main",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "a",
  "button",
  "img",
  "picture",
  "iframe",
  "ul",
  "ol",
  "li",
  "span",
  "svg",
  "article",
  "nav",
  "aside",
  "strong",
  "em",
  "small",
  "b",
  "i",
  "mark",
  "pre",
  "code",
  "figure",
  "blockquote",
]);

const PRESERVED_ATTRIBUTE_NAMES = new Set([
  "decoding",
  "hidden",
  "loading",
  "role",
  "title",
  "width",
  "height",
]);

const CONSUMED_ATTRIBUTE_NAMES = new Set(["class", "href", "id", "rel", "target"]);

interface PendingElement {
  element: BricksElement;
  parsedElement: ParsedElement;
  assignment: BemClassAssignment;
  classList: string[];
  originalClasses: string[];
  path: string;
}

function makeStableId(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const id = (hash >>> 0).toString(36).padStart(6, "0").slice(0, 6);
  return /^[a-z]/.test(id) ? id : `j${id.slice(1)}`;
}

function makeGlobalClassId(className: string) {
  return makeStableId(`class:${className}`);
}

function makeUniqueGlobalClassId(className: string, usedIds: Set<string>) {
  let attempt = 0;
  let id = makeGlobalClassId(className);

  while (usedIds.has(id)) {
    attempt += 1;
    id = makeStableId(`class:${className}:${attempt}`);
  }

  usedIds.add(id);
  return id;
}

function isNativeBemClassMode(exportMode: OutputOptions["exportMode"]) {
  return exportMode === "native-bem-classes" || exportMode === "global-classes";
}

function pushWarning(
  warnings: ConversionWarning[],
  message: string,
  severity: ConversionWarning["severity"] = "warning",
) {
  if (!warnings.some((warning) => warning.message === message)) {
    warnings.push({ severity, message });
  }
}

function pushGroupedWarning(
  warnings: ConversionWarning[],
  warning: ConversionWarning,
) {
  const id = warning.id ??
    [warning.code, warning.ownerElementId, warning.ownerLabel, warning.message]
      .filter(Boolean)
      .join(":");
  const existing = warnings.find((item) => (item.id ?? item.message) === id);
  if (existing) {
    existing.count = (existing.count ?? 1) + (warning.count ?? 1);
    existing.details = Array.from(new Set([...(existing.details ?? []), ...(warning.details ?? [])]));
    return;
  }

  warnings.push({
    count: 1,
    ...warning,
    id,
  });
}

function isActionableCssWarning(warning: ConversionWarning) {
  if (warning.severity !== "info" && warning.severity !== "notice") {
    return true;
  }

  return /@font-face|could not|dropped|missing|failed|unresolved|not present|requires manual review/i
    .test(warning.message);
}

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function escapeHtmlText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodeComparableEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function normalizeComparableText(value: string) {
  return decodeComparableEntities(value)
    .replace(/\s+/g, " ")
    .trim();
}

function stripInlineMarkup(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function isPreservedAttribute(name: string) {
  return PRESERVED_ATTRIBUTE_NAMES.has(name) ||
    name.startsWith("aria-") ||
    name.startsWith("data-");
}

function isValidClassName(className: string) {
  return /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(className);
}

function hasRenderableChildren(element: ParsedElement) {
  return element.children.some((child) => !HIDDEN_STRUCTURE_TAGS.has(child.tagName));
}

function hasOnlyMediaChildren(element: ParsedElement) {
  const children = element.children.filter((child) => !HIDDEN_STRUCTURE_TAGS.has(child.tagName));
  return children.length > 0 && children.every((child) => child.tagName === "img" || child.tagName === "picture");
}

function hasClassedPhrasingChild(element: ParsedElement): boolean {
  return element.children.some((child) =>
    !HIDDEN_STRUCTURE_TAGS.has(child.tagName) &&
    CLASS_OWNED_PHRASING_TAGS.has(child.tagName) &&
    (getClassNames(child).length > 0 || hasClassedPhrasingChild(child))
  );
}

function hasClassBearingPhrasingChild(element: ParsedElement): boolean {
  return element.children.some((child) =>
    !HIDDEN_STRUCTURE_TAGS.has(child.tagName) &&
    CLASS_OWNED_PHRASING_TAGS.has(child.tagName) &&
    (
      getClassNames(child).length > 0 ||
      Boolean(child.attributes.id) ||
      hasClassBearingPhrasingChild(child)
    )
  );
}

function shouldPreserveEmptyPhrasingElement(element: ParsedElement) {
  return CLASS_OWNED_PHRASING_TAGS.has(element.tagName) &&
    hasOnlyPhrasingContent(element) &&
    !serializeInlineContent(element).trim();
}

function shouldMapPhrasingContainerToText(element: ParsedElement, compatibilityProfile: boolean) {
  if (!compatibilityProfile || !hasOnlyPhrasingContent(element) || hasClassBearingPhrasingChild(element)) {
    return false;
  }

  if (!getClassNames(element).length && !element.attributes.id && element.tagName !== "blockquote") {
    return false;
  }

  const inlineHtml = serializeInlineContent(element);
  return inlineHtml.trim().length > 0;
}

function getBricksMapping(element: ParsedElement, compatibilityProfile = false) {
  const tag = element.tagName;
  const text = getOwnText(element, 500);
  const hasChildren = hasRenderableChildren(element);

  if (tag === "section") {
    return { name: "section", supported: true };
  }

  if (/^h[1-6]$/.test(tag)) {
    if (hasChildren && (!hasOnlyPhrasingContent(element) || hasClassedPhrasingChild(element))) {
      return { name: "div", supported: true, semanticTag: tag, generatedWrapper: true };
    }

    return { name: "heading", supported: true };
  }

  if (tag === "img") {
    return { name: "image", supported: true };
  }

  if (tag === "picture") {
    return { name: "image", supported: true };
  }

  if (tag === "iframe") {
    return { name: "code", supported: true };
  }

  if (tag === "a") {
    if (
      hasChildren &&
      ((!hasOnlyPhrasingContent(element) && !hasOnlyMediaChildren(element)) || hasClassedPhrasingChild(element))
    ) {
      return { name: "div", supported: true, semanticTag: "a", generatedWrapper: true };
    }

    return { name: "text-link", supported: true };
  }

  if (tag === "button") {
    if (hasChildren && (!hasOnlyPhrasingContent(element) || hasClassedPhrasingChild(element))) {
      return { name: "div", supported: true, semanticTag: "button", generatedWrapper: true };
    }

    return { name: "button", supported: true };
  }

  if (tag === "svg") {
    return { name: "svg", supported: true };
  }

  if (shouldMapPhrasingContainerToText(element, compatibilityProfile)) {
    return { name: "text-basic", supported: true, semanticTag: tag };
  }

  if (shouldPreserveEmptyPhrasingElement(element)) {
    return { name: "div", supported: true, semanticTag: tag };
  }

  if (TEXT_TAGS.has(tag) && hasOnlyPhrasingContent(element) && !hasClassedPhrasingChild(element) && text) {
    return { name: "text-basic", supported: true };
  }

  if (tag === "pre" || tag === "code") {
    return { name: "code", supported: true };
  }

  if (tag === "div" || WRAPPER_TAGS.has(tag)) {
    return {
      name: "div",
      supported: true,
      semanticTag: SEMANTIC_WRAPPER_TAGS.has(tag) ? tag : undefined,
    };
  }

  return { name: "div", supported: false };
}

function getAttributeSettings(element: ParsedElement) {
  const settings: Record<string, unknown> = {};

  if (element.attributes.id) {
    settings._cssId = element.attributes.id;
  }

  const attributes = Object.entries(element.attributes)
    .filter(([name, value]) =>
      value !== undefined &&
      !CONSUMED_ATTRIBUTE_NAMES.has(name) &&
      isPreservedAttribute(name)
    )
    .map(([name, value]) => ({ name, value }));

  if (attributes.length > 0) {
    settings._attributes = attributes;
  }

  return settings;
}

function getContentSettings(element: ParsedElement, name: string, semanticTag?: string) {
  const settings: Record<string, unknown> = {};
  const tag = element.tagName;
  const text = (
      (name === "heading" || name === "text-link" || name === "button" || name === "text-basic") &&
      hasOnlyPhrasingContent(element)
    )
    ? serializeInlineContent(element)
    : (name === "heading" || name === "text-link" || name === "button")
    ? getElementText(element).replace(/\s+/g, " ").trim()
    : getOwnText(element, 500);

  if (name === "heading") {
    settings.text = text;
    settings.tag = tag;
  }

  if (name === "text-basic") {
    settings.text = text;
    settings.tag = semanticTag ?? tag;
    if ((semanticTag ?? tag) !== "p") {
      settings.customTag = semanticTag ?? tag;
    }
  }

  if (name === "button" || name === "text-link") {
    settings.text = text;
  }

  if (name === "div" && semanticTag) {
    settings.tag = semanticTag;
    settings.customTag = semanticTag;
  }

  if (name === "button" || name === "text-link" || tag === "a") {
    const href = element.attributes.href;
    if (href) {
      settings.link = {
        type: href.startsWith("#") ? "internal" : "external",
        url: href,
        ...(element.attributes.target ? { target: element.attributes.target } : {}),
        ...(element.attributes.rel ? { rel: element.attributes.rel } : {}),
      };
    }
  }

  if (name === "image") {
    Object.assign(settings, createBricksImageSettings(getImageDescriptor(element)));
  }

  if (name === "code" && tag === "iframe") {
    settings.executeCode = false;
    settings.html = serializeElement(element, { path: "iframe", skipScripts: true });
  }

  if (name === "code" && (tag === "pre" || tag === "code")) {
    settings.executeCode = false;
    settings.html = `<pre>${escapeHtmlText(getElementText(element))}</pre>`;
  }

  if (name === "svg") {
    const rawSvg = element.rawHtml ?? serializeElement(element, { path: "svg", skipScripts: true });
    const sanitized = sanitizeSvgMarkup(rawSvg);
    settings.source = "code";
    settings.code = sanitized.svg;
  }

  return settings;
}

function makeCodeElement(
  id: string,
  label: string,
  settings: Record<string, unknown>,
): BricksElement {
  return {
    id,
    name: "code",
    parent: 0,
    children: [],
    label,
    settings,
  };
}

function titleCaseWords(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function makeJavaScriptCodeLabel(blockName: string) {
  const labelBase = titleCaseWords(blockName);
  return `${/^jigma\b/i.test(labelBase) ? labelBase : `Jigma ${labelBase || "Section"}`} JavaScript`;
}

function validateHierarchy(content: BricksElement[]) {
  const ids = new Set(content.map((element) => element.id));
  return content.every((element) =>
    (element.parent === 0 || ids.has(element.parent)) &&
    element.children.every((childId) => ids.has(childId))
  );
}

function collectSourceTextSegments(element: ParsedElement, segments: string[] = []) {
  if (HIDDEN_STRUCTURE_TAGS.has(element.tagName) || element.tagName === "svg") {
    return segments;
  }

  const parts = element.contentParts.length > 0
    ? element.contentParts
    : [
      ...element.textSegments.map((value) => ({ type: "text" as const, value })),
      ...element.children.map((child) => ({ type: "element" as const, element: child })),
    ];

  parts.forEach((part) => {
    if (part.type === "text") {
      const text = normalizeComparableText(part.value);
      if (text) {
        segments.push(text);
      }
      return;
    }

    collectSourceTextSegments(part.element, segments);
  });

  return segments;
}

function extractVisibleTextFromSetting(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return normalizeComparableText(stripInlineMarkup(value));
}

function collectPayloadTextSegments(content: BricksElement[]) {
  const byId = new Map(content.map((element) => [element.id, element]));
  const segments: string[] = [];
  const visit = (element: BricksElement) => {
    const text = extractVisibleTextFromSetting(element.settings.text);
    if (text) {
      segments.push(text);
    }

    element.children.forEach((childId) => {
      const child = byId.get(childId);
      if (child) {
        visit(child);
      }
    });
  };

  content
    .filter((element) => element.parent === 0)
    .forEach(visit);

  return segments;
}

function countOccurrences(haystack: string, needle: string) {
  if (!needle) {
    return 0;
  }

  let count = 0;
  let index = haystack.indexOf(needle);

  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }

  return count;
}

function countValues(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
}

function auditSourceTextCoverage(roots: ParsedElement[], content: BricksElement[]) {
  const sourceSegments = roots.flatMap((root) => collectSourceTextSegments(root));
  const payloadSegments = collectPayloadTextSegments(content);
  const payloadText = payloadSegments.join(" ");
  const expectedCounts = countValues(sourceSegments);
  const payloadExactCounts = countValues(payloadSegments);
  const missing: string[] = [];
  const duplicated: string[] = [];

  expectedCounts.forEach((expectedCount, segment) => {
    const actualCount = countOccurrences(payloadText, segment);
    if (actualCount < expectedCount) {
      for (let index = actualCount; index < expectedCount; index += 1) {
        missing.push(segment);
      }
    }

    const exactCount = payloadExactCounts.get(segment) ?? 0;
    if (exactCount > expectedCount) {
      for (let index = expectedCount; index < exactCount; index += 1) {
        duplicated.push(segment);
      }
    }
  });

  let cursor = 0;
  const reordered: string[] = [];
  sourceSegments.forEach((segment) => {
    const index = payloadText.indexOf(segment, cursor);
    if (index === -1) {
      if (!missing.includes(segment)) {
        reordered.push(segment);
      }
      return;
    }
    cursor = index + segment.length;
  });

  return {
    sourceSegments,
    missing,
    duplicated,
    reordered,
    valid: missing.length === 0 && duplicated.length === 0 && reordered.length === 0,
  };
}

function collectSourceHrefs(element: ParsedElement, hrefs: string[] = []) {
  if (HIDDEN_STRUCTURE_TAGS.has(element.tagName)) {
    return hrefs;
  }

  if (element.tagName === "a" && element.attributes.href) {
    hrefs.push(element.attributes.href);
  }

  element.children.forEach((child) => collectSourceHrefs(child, hrefs));
  return hrefs;
}

function collectPayloadHrefs(content: BricksElement[]) {
  return content
    .map((element) => element.settings.link)
    .filter((link): link is Record<string, unknown> => Boolean(link) && typeof link === "object")
    .map((link) => typeof link.url === "string" ? link.url : "")
    .filter(Boolean);
}

function auditHrefCoverage(roots: ParsedElement[], content: BricksElement[]) {
  const sourceHrefs = roots.flatMap((root) => collectSourceHrefs(root));
  const payloadHrefs = collectPayloadHrefs(content);
  const payloadCounts = countValues(payloadHrefs);
  const missing: string[] = [];

  countValues(sourceHrefs).forEach((expectedCount, href) => {
    const actualCount = payloadCounts.get(href) ?? 0;
    for (let index = actualCount; index < expectedCount; index += 1) {
      missing.push(href);
    }
  });

  return {
    sourceHrefs,
    missing,
    valid: missing.length === 0,
  };
}

function collectSourceImages(element: ParsedElement, images: Array<{ src: string; alt?: string }> = []) {
  if (HIDDEN_STRUCTURE_TAGS.has(element.tagName)) {
    return images;
  }

  if (element.tagName === "img" && element.attributes.src) {
    images.push({ src: element.attributes.src, alt: element.attributes.alt });
  }

  element.children.forEach((child) => collectSourceImages(child, images));
  return images;
}

function collectPayloadImageUrls(content: BricksElement[]) {
  return content
    .map((element) => element.settings.image)
    .filter((image): image is Record<string, unknown> => Boolean(image) && typeof image === "object")
    .map((image) => typeof image.url === "string" ? image.url : "")
    .filter(Boolean);
}

function auditImageCoverage(roots: ParsedElement[], content: BricksElement[]) {
  const sourceImages = roots.flatMap((root) => collectSourceImages(root));
  const payloadUrls = collectPayloadImageUrls(content);
  const payloadCounts = countValues(payloadUrls);
  const missing: string[] = [];

  countValues(sourceImages.map((image) => image.src)).forEach((expectedCount, src) => {
    const actualCount = payloadCounts.get(src) ?? 0;
    for (let index = actualCount; index < expectedCount; index += 1) {
      missing.push(src);
    }
  });

  return {
    sourceImages,
    missing,
    valid: missing.length === 0,
  };
}

const CLIPBOARD_PAYLOAD_KEYS = [
  "content",
  "globalClasses",
  "globalElements",
  "source",
  "sourceUrl",
  "version",
];

export function validateBricksClipboardPayloadSchema(payload: unknown) {
  const errors: string[] = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, errors: ["Clipboard payload is not an object."] };
  }

  const value = payload as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  const expectedKeys = [...CLIPBOARD_PAYLOAD_KEYS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    errors.push(`Clipboard payload keys must be exactly ${expectedKeys.join(", ")}.`);
  }
  if (!Array.isArray(value.content)) errors.push("content must be an array.");
  if (!Array.isArray(value.globalClasses)) errors.push("globalClasses must be an array.");
  if (!Array.isArray(value.globalElements)) errors.push("globalElements must be an array.");
  if (value.source !== "bricksCopiedElements") errors.push("source must be bricksCopiedElements.");
  if (typeof value.sourceUrl !== "string") errors.push("sourceUrl must be a string.");
  if (typeof value.version !== "string") errors.push("version must be a string.");
  if (Array.isArray(value.content) && Array.isArray(value.globalClasses)) {
    const classIds = new Set(value.globalClasses
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map((entry) => typeof entry.id === "string" ? entry.id : "")
      .filter(Boolean));
    const referencesValid = value.content
      .filter((entry): entry is BricksElement => Boolean(entry) && typeof entry === "object")
      .every((entry) => {
        const ids = Array.isArray(entry.settings?._cssGlobalClasses)
          ? entry.settings._cssGlobalClasses.map((id) => `${id}`)
          : [];
        return ids.every((id) => classIds.has(id));
      });
    if (!referencesValid) {
      errors.push("All _cssGlobalClasses references must resolve to globalClasses records.");
    }
  }

  return { valid: errors.length === 0, errors };
}

function makeClassList(
  mode: ClassMode,
  bemClass: string,
  originalClasses: string[],
  warnings: ConversionWarning[],
  blockName?: string,
) {
  const validOriginalClasses = originalClasses.filter((className) => {
    const valid = isValidClassName(className);
    if (!valid && mode !== "strict-bem") {
      pushWarning(
        warnings,
        `Original class "${className}" is invalid and was not preserved.`,
      );
    }
    return valid;
  });

  const strictBemClasses = bemClass.includes("__") && bemClass.includes("--")
    ? [bemClass.split("--")[0], bemClass]
    : [bemClass];

  if (mode === "strict-bem") {
    const sourceBemClasses = blockName
      ? validOriginalClasses.filter((className) =>
        className === blockName ||
        className.startsWith(`${blockName}__`) ||
        className.startsWith(`${blockName}--`)
      )
      : [];

    if (sourceBemClasses.length > 0) {
      return Array.from(new Set(sourceBemClasses.flatMap((className) => {
        if (className.includes("--")) {
          return [className.split("--")[0], className];
        }
        return [className];
      })));
    }

    return strictBemClasses;
  }

  return Array.from(new Set([...strictBemClasses, ...validOriginalClasses]));
}

function makePreservedOriginalClassList(originalClasses: string[], warnings: ConversionWarning[]) {
  return originalClasses.filter((className) => {
    const valid = isValidClassName(className);
    if (!valid) {
      pushWarning(
        warnings,
        `Original class "${className}" is invalid and was not preserved.`,
      );
    }
    return valid;
  });
}

function makeCompatibilityClassList(originalClasses: string[], warnings: ConversionWarning[]) {
  return Array.from(new Set(makePreservedOriginalClassList(originalClasses, warnings)));
}

function normalizeStepNumber(value: string) {
  const numeric = value.match(/\d+/)?.[0] ?? "";
  return numeric ? `${Number(numeric)}` : "";
}

function findFirstDescendant(element: ParsedElement, predicate: (child: ParsedElement) => boolean): ParsedElement | undefined {
  for (const child of element.children) {
    if (predicate(child)) {
      return child;
    }

    const nested = findFirstDescendant(child, predicate);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

function getOriginalClassesForExport(element: ParsedElement) {
  const classes = getClassNames(element);
  if (element.tagName !== "picture") {
    return Array.from(new Set(classes));
  }

  const image = findFirstDescendant(element, (child) => child.tagName === "img");
  return Array.from(new Set([
    ...classes,
    ...(image ? getClassNames(image) : []),
  ]));
}

function findProcessCardContext(element: ParsedElement, ancestors: ParsedElement[]) {
  const card = [element, ...[...ancestors].reverse()].find((candidate) =>
    getClassNames(candidate).some((className) => className === "lit-process-light__card")
  );

  if (!card) {
    return {};
  }

  const marker = findFirstDescendant(card, (child) =>
    getClassNames(child).some((className) => className === "lit-process-light__marker")
  );
  const title = findFirstDescendant(card, (child) =>
    getClassNames(child).some((className) => className === "lit-process-light__card-title")
  );
  const step = normalizeStepNumber(card.attributes["data-step"] ?? getElementText(marker ?? card));
  const titleText = getElementText(title ?? card).replace(/\s+/g, " ").trim();

  return {
    step,
    title: titleText,
  };
}

function createProcessCompatibilityLabel(
  element: ParsedElement,
  bricksName: string,
  ancestors: ParsedElement[],
  parentLabel?: string,
) {
  const classes = getClassNames(element);
  const processClass = classes.find((className) =>
    className === "lit-process-light" || className.startsWith("lit-process-light__")
  );

  if (!processClass && element.tagName !== "svg") {
    return undefined;
  }

  const part = processClass?.split("__")[1]?.split("--")[0] ?? "";
  const context = findProcessCardContext(element, ancestors);
  const stepLabel = context.step ? `Step ${context.step}` : "Step";
  const titleLabel = context.title || stepLabel;

  if (element.tagName === "svg" || bricksName === "svg" || part === "icon-svg") {
    if (parentLabel && /icon$/i.test(parentLabel)) {
      return `${parentLabel} SVG`;
    }

    return `${titleLabel} Icon SVG`;
  }

  if (!part) {
    return "Process Section";
  }

  const labelsByPart: Record<string, string> = {
    shell: "Process Shell",
    header: "Process Header",
    title: "Process Title",
    intro: "Process Intro",
    track: "Process Track",
    grid: "Process Grid",
    card: context.step ? `Process Step ${context.step}` : `${titleLabel} Card`,
    marker: `${stepLabel} Marker`,
    icon: `${titleLabel} Icon`,
    "card-title": `${titleLabel} Card Title`,
    "card-text": `${titleLabel} Card Text`,
  };

  return labelsByPart[part];
}

function createCompatibilityElementLabel(
  element: ParsedElement,
  bricksName: string,
  ancestors: ParsedElement[] = [],
  parentLabel?: string,
) {
  const processLabel = createProcessCompatibilityLabel(element, bricksName, ancestors, parentLabel);
  if (processLabel) {
    return processLabel;
  }

  if (element.attributes.id) {
    return `#${element.attributes.id}`;
  }

  const firstClass = getClassNames(element).find(isValidClassName);
  if (firstClass) {
    return `.${firstClass}`;
  }

  if (bricksName === "heading" && /^h[1-6]$/.test(element.tagName)) {
    return `Heading ${element.tagName.slice(1)}`;
  }

  if (bricksName === "text-link" || element.tagName === "a") {
    return "Link";
  }

  if (bricksName === "text-basic" || element.tagName === "p") {
    return "Paragraph";
  }

  if (element.tagName === "section") {
    return "Section";
  }

  if (element.tagName === "div") {
    return "Div";
  }

  return titleCaseWords(element.tagName || bricksName || "Element");
}

function buildExternalCode(
  options: OutputOptions,
  html: string,
  css: string,
  js: string,
  warnings: ConversionWarning[],
  suppressDependencyWarnings = false,
) {
  const dependencies = inspectDependencies(html, css, js);
  const lines: string[] = [];

  dependencies.forEach((dependency) => {
    if (dependency.warning && !suppressDependencyWarnings) {
      pushWarning(warnings, dependency.warning, "info");
    }

    if (
      (dependency.type === "stylesheet" || dependency.type === "font") &&
      options.includeExternalCss
    ) {
      lines.push(`<link rel="stylesheet" href="${escapeAttribute(dependency.value)}">`);
    }

    if (dependency.type === "script" && options.includeExternalScripts) {
      lines.push(`<script src="${escapeAttribute(dependency.value)}"></script>`);
    }
  });

  return {
    dependencies,
    element: lines.length > 0
      ? makeCodeElement("jigma-external-dependencies", "External dependencies", {
        executeCode: false,
        html: lines.join("\n"),
      })
      : null,
  };
}

function addSelectorMapping(
  scopeMap: CssSelectorScopeMap,
  sourceClassNames: string[],
  sourceId: string | undefined,
  bemClass: string,
) {
  sourceClassNames.forEach((className) => {
    const existing = scopeMap.classes.get(className) ?? [];
    scopeMap.classes.set(className, Array.from(new Set([...existing, bemClass])));
  });

  if (sourceId) {
    scopeMap.ids.set(sourceId, bemClass);
  }
}

function createGlobalClasses(classNames: string[]) {
  const seen = new Set<string>();
  const usedIds = new Set<string>();
  const globalClasses: BricksGlobalClass[] = [];

  classNames.forEach((className) => {
    if (seen.has(className)) {
      return;
    }

    seen.add(className);
    globalClasses.push({
      id: makeUniqueGlobalClassId(className, usedIds),
      name: className,
      settings: {},
    });
  });

  return globalClasses;
}

function getGlobalClassIdMap(globalClasses: BricksGlobalClass[]) {
  return new Map(globalClasses.map((entry) => [entry.name, entry.id]));
}

function getNativeSettingCount(settings: Record<string, unknown>) {
  return Object.keys(settings).filter((key) => key !== BRICKS_ELEMENT_CUSTOM_CSS_FIELD)
    .length;
}

function getStringClasses(value: unknown) {
  return typeof value === "string"
    ? value.split(/\s+/).map((className) => className.trim()).filter(Boolean)
    : [];
}

function auditBricksClassReferences(
  content: BricksElement[],
  globalClasses: BricksGlobalClass[],
  styledClassIds: Set<string>,
  fallbackRuleCountByClassName: Map<string, number> = new Map(),
  fallbackStrategy: BricksClassAuditEntry["fallbackStrategy"] = "none",
) {
  const classById = new Map<string, BricksGlobalClass>();
  const entriesById = new Map<string, BricksClassAuditEntry>();
  const duplicateIds = new Set<string>();
  const seenIds = new Set<string>();
  const idsByName = new Map<string, Set<string>>();
  const managedClassNames = new Set(globalClasses.map((globalClass) => globalClass.name));
  let missingClassReferenceCount = 0;
  let emptyStyledClassCount = 0;
  let generatedClassOnlyInElementClassesCount = 0;

  globalClasses.forEach((globalClass) => {
    if (seenIds.has(globalClass.id)) {
      duplicateIds.add(globalClass.id);
    }
    seenIds.add(globalClass.id);
    classById.set(globalClass.id, globalClass);
    entriesById.set(globalClass.id, {
      className: globalClass.name,
      classId: globalClass.id,
      assignedElementIds: [],
      nativeSettingsCount: getNativeSettingCount(globalClass.settings),
      fallbackCssRuleCount: fallbackRuleCountByClassName.get(globalClass.name) ?? 0,
      fallbackStrategy: fallbackRuleCountByClassName.has(globalClass.name) ? fallbackStrategy : "none",
      customCssPresent: typeof globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] === "string" &&
        `${globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD]}`.trim().length > 0,
      missingReferences: [],
      conflicts: [],
    });

    const ids = idsByName.get(globalClass.name) ?? new Set<string>();
    ids.add(globalClass.id);
    idsByName.set(globalClass.name, ids);
  });

  const entries = [...entriesById.values()];

  idsByName.forEach((ids, name) => {
    if (ids.size <= 1) {
      return;
    }

    ids.forEach((id) => {
      entriesById.get(id)?.conflicts.push(
        `Duplicate class name "${name}" is associated with multiple class IDs.`,
      );
    });
  });

  content.forEach((element) => {
    const classIds = Array.isArray(element.settings._cssGlobalClasses)
      ? element.settings._cssGlobalClasses.map((classId) => `${classId}`).filter(Boolean)
      : [];

    classIds.forEach((classId) => {
      const entry = entriesById.get(classId);
      if (!entry) {
        missingClassReferenceCount += 1;
        entries.push({
          className: "(missing class record)",
          classId,
          assignedElementIds: [element.id],
          nativeSettingsCount: 0,
          fallbackCssRuleCount: 0,
          fallbackStrategy: "none",
          customCssPresent: false,
          missingReferences: [classId],
          conflicts: [`Element "${element.id}" references a class ID that is missing from globalClasses.`],
        });
        return;
      }

      entry.assignedElementIds.push(element.id);
    });

    getStringClasses(element.settings._cssClasses).forEach((className) => {
      if (!managedClassNames.has(className)) {
        return;
      }

      generatedClassOnlyInElementClassesCount += 1;
      const classRecord = globalClasses.find((globalClass) => globalClass.name === className);
      const entry = classRecord ? entriesById.get(classRecord.id) : undefined;
      entry?.conflicts.push(
        `Generated class "${className}" also appears in _cssClasses instead of only _cssGlobalClasses.`,
      );
    });
  });

  styledClassIds.forEach((classId) => {
    const globalClass = classById.get(classId);
    const entry = entriesById.get(classId);
    if (!globalClass || !entry) {
      return;
    }

    if (
      getNativeSettingCount(globalClass.settings) === 0 &&
      (fallbackRuleCountByClassName.get(globalClass.name) ?? 0) === 0 &&
      !(typeof globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] === "string" &&
        globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD].trim())
    ) {
      emptyStyledClassCount += 1;
      entry.conflicts.push("CSS matched this generated class, but no native settings or custom CSS were saved.");
    }
  });

  const duplicateClassNameCount = [...idsByName.values()].filter((ids) => ids.size > 1).length;
  const valid = missingClassReferenceCount === 0 &&
    duplicateIds.size === 0 &&
    duplicateClassNameCount === 0 &&
    emptyStyledClassCount === 0 &&
    generatedClassOnlyInElementClassesCount === 0;

  return {
    entries,
    valid,
    missingClassReferenceCount,
    duplicateClassIdCount: duplicateIds.size,
    duplicateClassNameCount,
    emptyStyledClassCount,
    generatedClassOnlyInElementClassesCount,
  };
}

function auditLiteralFallbackCss(fallbackCss: string, globalClasses: BricksGlobalClass[]) {
  const managedClassNames = new Set(globalClasses.map((entry) => entry.name));
  const missingClassNames = new Set<string>();
  let elementIdSelectorCount = 0;

  fallbackCss.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed.endsWith("{") || trimmed.startsWith("@") || /^\d/.test(trimmed)) {
      return;
    }

    const selector = trimmed.slice(0, -1).trim();
    const classMatches = selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g);
    for (const match of classMatches) {
      const className = match[1];
      if (!managedClassNames.has(className)) {
        missingClassNames.add(className);
      }
    }

    if (/#-?[_a-zA-Z]+[_a-zA-Z0-9-]*/.test(selector)) {
      elementIdSelectorCount += 1;
    }
  });

  return {
    missingClassSelectorCount: missingClassNames.size,
    elementIdSelectorCount,
  };
}

function createGeneratedTextClass(blockName: string, assignment: BemClassAssignment) {
  const parentRole = assignment.role;
  const suffix = parentRole &&
      !["block", "element", "root", "section"].includes(parentRole)
    ? `${parentRole}-text`
    : "text";

  return `${blockName}__${suffix}`;
}

function shouldSkipGeneratedClass(element: ParsedElement, mappingName: string, originalClasses: string[]) {
  if (originalClasses.length > 0) {
    return false;
  }

  return mappingName === "text-basic";
}

function getLabelClass(assignment: BemClassAssignment, classList: string[]) {
  const modifierClass = [...classList]
    .reverse()
    .find((className) => className.includes("__") && className.includes("--"));
  if (modifierClass) {
    return modifierClass;
  }

  const sourceElementClass = [...classList].reverse().find((className) => className.includes("__"));
  return sourceElementClass ?? assignment.className;
}

function validateBricksStructure(content: BricksElement[]) {
  const ids = new Set(content.map((element) => element.id));
  let invalidNestingCount = 0;
  let parentChildMismatchCount = 0;

  content.forEach((element) => {
    if (NON_NESTABLE_BRICKS_ELEMENTS.has(element.name) && element.children.length > 0) {
      invalidNestingCount += 1;
    }

    element.children.forEach((childId) => {
      const child = content.find((item) => item.id === childId);
      if (!child || child.parent !== element.id || !ids.has(childId)) {
        parentChildMismatchCount += 1;
      }
    });
  });

  return {
    invalidNestingCount,
    parentChildMismatchCount,
    valid: invalidNestingCount === 0 && parentChildMismatchCount === 0,
  };
}

function getModifier(className: string) {
  return className.includes("--") ? className.split("--").at(-1) ?? "" : "";
}

function getSourceClassesForGeneratedClass(
  originalClasses: string[],
  generatedClass: string,
  classList: string[],
) {
  if (originalClasses.includes(generatedClass)) {
    return [generatedClass];
  }

  const sourceClasses = new Set<string>([generatedClass]);
  const modifier = getModifier(generatedClass);
  const modifiers = classList.map(getModifier).filter(Boolean);
  const hasModifierClass = modifiers.length > 0;

  originalClasses.forEach((className) => {
    const lowerClassName = className.toLowerCase();
    if (modifier) {
      if (
        lowerClassName.includes(`--${modifier}`) ||
        lowerClassName === modifier ||
        lowerClassName.endsWith(`-${modifier}`)
      ) {
        sourceClasses.add(className);
      }
      return;
    }

    if (
      !hasModifierClass ||
      (!lowerClassName.includes("--") && !modifiers.some((item) =>
        lowerClassName === item || lowerClassName.endsWith(`-${item}`)
      ))
    ) {
      sourceClasses.add(className);
    }
  });

  return [...sourceClasses];
}

function createClassCssTargets(
  pendingElements: PendingElement[],
  globalClassIdMap: Map<string, string>,
  globalClassById: Map<string, BricksGlobalClass>,
) {
  const targets: ClassCssTarget[] = [];

  pendingElements.forEach((pending) => {
    pending.classList.forEach((className) => {
      const globalClassId = globalClassIdMap.get(className);
      const globalClass = globalClassId ? globalClassById.get(globalClassId) : undefined;

      if (!globalClass) {
        return;
      }

      targets.push({
        globalClass,
        className,
        sourceClasses: getSourceClassesForGeneratedClass(
          pending.originalClasses,
          className,
          pending.classList,
        ),
        sourceId: className === pending.assignment.className
          ? pending.parsedElement.attributes.id
          : undefined,
      });
    });
  });

  return targets;
}

function mergeCssResults(a: ElementCssResult, b: ElementCssResult): ElementCssResult {
  const styledClassIds = new Set<string>([...a.styledClassIds, ...b.styledClassIds]);
  const fallbackRuleCountByClassName = new Map<string, number>(a.fallbackRuleCountByClassName ?? []);
  (b.fallbackRuleCountByClassName ?? new Map()).forEach((count, name) => {
    fallbackRuleCountByClassName.set(name, (fallbackRuleCountByClassName.get(name) ?? 0) + count);
  });

  return {
    warnings: [...a.warnings, ...b.warnings],
    attachedRuleCount: a.attachedRuleCount + b.attachedRuleCount,
    unmappedRuleCount: a.unmappedRuleCount + b.unmappedRuleCount,
    pseudoSelectorCount: a.pseudoSelectorCount + b.pseudoSelectorCount,
    nativeStyleMappedCount: a.nativeStyleMappedCount + b.nativeStyleMappedCount,
    customCssFallbackCount: a.customCssFallbackCount + b.customCssFallbackCount,
    blockScopedFallbackCount: a.blockScopedFallbackCount + b.blockScopedFallbackCount,
    literalFallbackRuleCount: a.literalFallbackRuleCount + b.literalFallbackRuleCount,
    responsiveRuleCount: a.responsiveRuleCount + b.responsiveRuleCount,
    pseudoRuleCount: a.pseudoRuleCount + b.pseudoRuleCount,
    unresolvedSelectorCount: a.unresolvedSelectorCount + b.unresolvedSelectorCount,
    styledClassIds,
    fallbackCss: "",
    fallbackStrategy: a.fallbackStrategy === "literal-bem" || b.fallbackStrategy === "literal-bem"
      ? "literal-bem"
      : a.fallbackStrategy ?? b.fallbackStrategy ?? "none",
    fallbackRuleCountByClassName,
  };
}

// Expands comma-grouped selectors ("a, b { ... }" -> "a { ... } b { ... }") so the
// declaration-conservation audit can match each individual selector. Brace-aware and
// recurses into at-rule bodies (e.g. @media). Used only to build the audit's reference
// output, never to build the actual Bricks payload.
function expandCommaSelectors(css: string): string {
  const out: string[] = [];
  let index = 0;

  while (index < css.length) {
    const open = css.indexOf("{", index);
    if (open === -1) {
      break;
    }

    let depth = 0;
    let close = -1;
    for (let cursor = open; cursor < css.length; cursor += 1) {
      if (css[cursor] === "{") {
        depth += 1;
      } else if (css[cursor] === "}") {
        depth -= 1;
        if (depth === 0) {
          close = cursor;
          break;
        }
      }
    }
    if (close === -1) {
      break;
    }

    const selector = css.slice(index, open).trim();
    const body = css.slice(open + 1, close);

    if (/^@(?:media|container|supports|layer)\b/i.test(selector)) {
      // Conditional group rules wrap nested rules: recurse to expand those.
      out.push(`${selector} {\n${expandCommaSelectors(body)}\n}`);
    } else if (/^@/.test(selector)) {
      // Declaration at-rules (@property, @font-face, @keyframes, ...): keep verbatim.
      out.push(`${selector} {${body}}`);
    } else {
      selector
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => out.push(`${part} {${body}}`));
    }

    index = close + 1;
  }

  return out.join("\n");
}

// Routes component (non page/global) CSS to classes and/or the root component class
// according to the selected placement mode. Page/global CSS is handled separately.
function routeComponentCss(
  mode: CssPlacementMode,
  componentCss: string,
  targets: ClassCssTarget[],
  options: { minify?: boolean; literalOnly?: boolean },
): ElementCssResult {
  if (mode === "scope-to-section") {
    return attachCssToRootClass(componentCss, targets, options);
  }

  if (mode === "auto-class-first") {
    // Priority 1: clear single-class rules -> Bricks global classes.
    // Priority 2: descendant/pseudo/media rules that cannot split safely -> root class.
    const { classCss, rootCss } = splitClassFirstCss(componentCss, targets);
    const distributed = attachCssToGlobalClasses(classCss, targets, options);
    if (!rootCss.trim()) {
      return distributed;
    }
    return mergeCssResults(distributed, attachCssToRootClass(rootCss, targets, options));
  }

  // attach-to-classes (and the unset legacy default): distribute across global classes.
  return attachCssToGlobalClasses(componentCss, targets, options);
}

export function createBricksExport(input: ConversionInput): BricksExport {
  const warnings: ConversionWarning[] = [];
  const conversionProfile = input.options.conversionProfile ?? "clean-native";
  const exportProfile = input.options.exportProfile ?? "native-controls-experimental";
  const compatibilityProfile = exportProfile === "bricks-compatibility";
  // CSS placement mode. Unset keeps the legacy class-distribution behaviour so existing
  // low-level callers are unaffected; product entry points pass an explicit mode.
  const cssPlacement: CssPlacementMode = input.options.cssPlacement ?? "attach-to-classes";
  const exportMode = input.options.exportMode;
  const shouldCreateNativeBemClasses = compatibilityProfile || isNativeBemClassMode(exportMode);
  const shouldAttachElementCss = !compatibilityProfile && exportMode === "element-styles";
  const shouldCreateGlobalClasses = compatibilityProfile || shouldCreateNativeBemClasses;
  const shouldCreateScopedCssBlock = !compatibilityProfile && exportMode === "scoped-css-block";
  const assetManifest = createAssetManifest(input);
  const parsed = getRenderableRoots(input.html);
  const deletedLayerIds = input.deletedLayerIds ?? new Set<string>();
  const excludedLayerIds = input.excludedLayerIds ?? new Set<string>();
  const content: BricksElement[] = [];
  const contentById = new Map<string, BricksElement>();
  const pendingElements: PendingElement[] = [];
  const classListByElementId = new Map<string, string[]>();
  const generatedClassNames: string[] = [];
  const scopeMap: CssSelectorScopeMap = {
    classes: new Map(),
    ids: new Map(),
  };
  const bemFactory = createBemClassFactory({
    projectPrefix: input.options.projectPrefix,
    blockName: input.options.blockName,
  });
  let skippedLayerCount = 0;
  let unsupportedElementCount = 0;
  let generatedTextElementCount = 0;
  let classAttachmentCount = 0;
  let unsignedSvgCodeCount = 0;
  let unsignedJavaScriptCodeCount = 0;
  let generatedWrapperCount = 0;

  assetManifest.warnings
    .filter((warning) =>
      !compatibilityProfile ||
      warning.severity === "error" ||
      warning.severity === "action-required" ||
      warning.code === "code.inline_event_handler"
    )
    .forEach((warning) => pushGroupedWarning(warnings, warning));
  parsed.warnings.forEach((warning) => pushWarning(warnings, warning));

  if (input.options.stylingMode === "native-experimental") {
    pushWarning(
      warnings,
      "Native/GUI style mapping is disabled for the MVP. Export uses generated BEM CSS instead.",
      "info",
    );
  }

  const walkElement = (
    element: ParsedElement,
    parent: string | 0,
    path: string,
    ancestors: ParsedElement[] = [],
  ): string | null => {
    if (HIDDEN_STRUCTURE_TAGS.has(element.tagName)) {
      return null;
    }

    if (excludedLayerIds.has(path) || deletedLayerIds.has(path)) {
      skippedLayerCount += 1;
      return null;
    }

    const mapping = getBricksMapping(element, compatibilityProfile);
    if (!SUPPORTED_TAGS.has(element.tagName) || !mapping.supported) {
      unsupportedElementCount += 1;
      pushWarning(
        warnings,
        `<${element.tagName}> was converted to a Bricks Div fallback.`,
      );
    }

    const originalClasses = getOriginalClassesForExport(element);
    const assignment = bemFactory.create(element, path, parent);
    const id = makeStableId(`${path}:${element.tagName}:${assignment.className}:${getOwnText(element, 64)}`);
    const classList = compatibilityProfile
      ? makeCompatibilityClassList(originalClasses, warnings)
      : makeClassList(
        input.options.classMode,
        assignment.className,
        originalClasses,
        warnings,
        bemFactory.blockName,
      ).filter((className) =>
        conversionProfile === "fidelity" ||
        !shouldSkipGeneratedClass(element, mapping.name, originalClasses) ||
        originalClasses.includes(className)
      );
    const svgSanitization = mapping.name === "svg"
      ? sanitizeSvgMarkup(element.rawHtml ?? serializeElement(element, { path: "svg", skipScripts: true }))
      : null;
    const settings: Record<string, unknown> = {
      ...getAttributeSettings(element),
      ...getContentSettings(element, mapping.name, mapping.semanticTag),
    };

    if (mapping.generatedWrapper) {
      generatedWrapperCount += 1;
    }

    if (shouldCreateNativeBemClasses) {
      const preservedClasses = input.options.classMode === "strict-bem"
        ? []
        : makePreservedOriginalClassList(originalClasses, warnings);
      if (!compatibilityProfile && preservedClasses.length > 0) {
        settings._cssClasses = preservedClasses.join(" ");
      }
    } else {
      settings._cssClasses = classList.join(" ");
    }

    classAttachmentCount += classList.length;

    if (!compatibilityProfile && input.options.classMode !== "strict-bem" && originalClasses.length > 0) {
      pushWarning(warnings, "Original classes were preserved in _cssClasses because strict BEM mode is off.", "info");
    }

    if (!mapping.supported) {
      pushWarning(warnings, `<${element.tagName}> was converted to a Bricks Div fallback.`);
    }

    const parentElement = parent === 0 ? undefined : contentById.get(parent);
    const elementLabel = compatibilityProfile
      ? createCompatibilityElementLabel(element, mapping.name, ancestors, parentElement?.label)
      : createBricksElementLabel({
        bemClass: getLabelClass(assignment, classList),
        tagName: element.tagName,
        parentLabel: parentElement?.label,
      });
    const bricksElement: BricksElement = applyBricksElementLabel({
      id,
      name: mapping.name,
      parent,
      children: [],
      settings,
    }, elementLabel);
    content.push(bricksElement);
    contentById.set(id, bricksElement);
    classListByElementId.set(id, classList);
    generatedClassNames.push(...classList);
    pendingElements.push({
      element: bricksElement,
      parsedElement: element,
      assignment,
      classList,
      originalClasses,
      path,
    });
    classList.forEach((className) => {
      addSelectorMapping(
        scopeMap,
        getSourceClassesForGeneratedClass(originalClasses, className, classList)
          .filter((sourceClassName) => sourceClassName !== className),
        element.attributes.id,
        className,
      );
    });

    if (mapping.name === "svg") {
      unsignedSvgCodeCount += 1;
      const internalNodeCount = countSvgInternalNodes(element.rawHtml ?? "");
      const report = svgSanitization?.report;
      const signatureDetails = [
        internalNodeCount > 0
          ? `Inline SVG contains ${internalNodeCount} internal SVG node${internalNodeCount === 1 ? "" : "s"} and was exported as one Bricks SVG element.`
          : "Inline SVG was exported as one Bricks SVG element.",
        ...(report?.malformed ? ["SVG markup could not be parsed and requires manual review."] : []),
      ];
      const sanitizationDetails = [
        ...(report?.removedTags.length ? [`Removed tags: ${report.removedTags.join(", ")}`] : []),
        ...(report?.removedAttributes.length ? [`Removed attributes: ${report.removedAttributes.join(", ")}`] : []),
        ...(report?.externalReferences.length ? [`External references: ${report.externalReferences.join(", ")}`] : []),
        ...(report?.malformed ? ["SVG markup could not be parsed and requires manual review."] : []),
      ];

      pushGroupedWarning(warnings, {
        id: "svg-signature:inline-svg",
        code: "svg.signature_required",
        severity: report?.malformed ? "error" : "action-required",
        title: "Inline SVG signatures required",
        summary: "Inline SVG elements were preserved as atomic SVG elements. Bricks signatures required.",
        message: "Inline SVG elements were preserved as atomic SVG elements. Bricks signatures required.",
        ownerElementId: id,
        ownerLabel: bricksElement.label,
        details: [`${bricksElement.label ?? "Inline SVG"}: ${signatureDetails.join(" ")}`],
        suggestedAction: "After pasting into Bricks, review and sign this SVG through Bricks' code signature workflow.",
      });

      if (sanitizationDetails.length > 0) {
        pushGroupedWarning(warnings, {
          id: `svg-sanitized:${id}:html`,
          code: "svg.sanitized",
          severity: report?.malformed ? "error" : "warning",
          title: "SVG markup sanitized",
          summary: `${bricksElement.label ?? "Inline SVG"} had unsafe or review-required SVG markup sanitized.`,
          message: `${bricksElement.label ?? "Inline SVG"} had unsafe or review-required SVG markup sanitized.`,
          ownerElementId: id,
          ownerLabel: bricksElement.label,
          details: sanitizationDetails,
          suggestedAction: "Review the sanitized SVG markup before signing the SVG in Bricks.",
        });
      }
    }

    const directText = getOwnText(element, 500);
    const isTextElement = ["heading", "text-basic", "button", "text-link"].includes(mapping.name);
    const shouldCreateDirectTextElements =
      !isTextElement &&
      directText &&
      (conversionProfile === "fidelity" || compatibilityProfile);
    const addDirectTextElement = (text: string, sequence: number) => {
      const normalizedText = text.replace(/\s+/g, " ").trim();
      if (!normalizedText) {
        return;
      }
      const textId = makeStableId(`${path}:direct-text:${sequence}:${normalizedText}`);
      const textClass = conversionProfile === "fidelity"
        ? createGeneratedTextClass(bemFactory.blockName, assignment)
        : "";
      const textClassList = textClass ? [textClass] : [];
      const textElement = applyBricksElementLabel({
        id: textId,
        name: "text-basic",
        parent: id,
        children: [],
        settings: {
          text: normalizedText,
          tag: "span",
          ...(!shouldCreateNativeBemClasses && textClass ? { _cssClasses: textClass } : {}),
        },
      }, textClass
        ? createBricksElementLabel({
          bemClass: textClass,
          tagName: "span",
          parentLabel: bricksElement.label,
        })
        : `${bricksElement.label ?? "Element"} Text`);
      content.push(textElement);
      contentById.set(textId, textElement);
      classListByElementId.set(textId, textClassList);
      generatedClassNames.push(...textClassList);
      bricksElement.children.push(textId);
      generatedTextElementCount += 1;
      classAttachmentCount += textClassList.length;
    };

    let visibleChildIndex = 0;
    let directTextIndex = 0;
    if (!NON_NESTABLE_BRICKS_ELEMENTS.has(mapping.name)) {
      const walkChild = (child: ParsedElement) => {
        if (element.tagName === "picture" || HIDDEN_STRUCTURE_TAGS.has(child.tagName)) {
          return;
        }

        const childPath = `${path}-${visibleChildIndex}`;
        visibleChildIndex += 1;
        const childId = walkElement(child, id, childPath, [...ancestors, element]);
        if (childId) {
          bricksElement.children.push(childId);
        }
      };

      if (shouldCreateDirectTextElements && element.contentParts.length > 0) {
        element.contentParts.forEach((part) => {
          if (part.type === "text") {
            addDirectTextElement(part.value, directTextIndex);
            directTextIndex += 1;
            return;
          }

          walkChild(part.element);
        });
      } else {
        if (shouldCreateDirectTextElements) {
          addDirectTextElement(directText, directTextIndex);
        }
        element.children.forEach(walkChild);
      }
    }

    return id;
  };

  parsed.roots.forEach((element, index) => walkElement(element, 0, `${index}`));

  const elementCssTargets: ElementCssTarget[] = pendingElements.map((pending) => ({
    element: pending.element,
    bemClass: pending.assignment.className,
    sourceClasses: pending.originalClasses,
    sourceId: pending.parsedElement.attributes.id,
  }));
  const elementCss = input.css.trim() && shouldAttachElementCss
    ? attachCssToElements(input.css, elementCssTargets, {
      minify: input.options.minifyElementCss,
    })
    : {
      warnings: [],
      attachedRuleCount: 0,
      unmappedRuleCount: 0,
      pseudoSelectorCount: 0,
      nativeStyleMappedCount: 0,
      customCssFallbackCount: 0,
      blockScopedFallbackCount: 0,
      literalFallbackRuleCount: 0,
      responsiveRuleCount: 0,
      pseudoRuleCount: 0,
      unresolvedSelectorCount: 0,
      styledClassIds: new Set<string>(),
      fallbackCss: "",
      fallbackStrategy: "none" as const,
      fallbackRuleCountByClassName: new Map<string, number>(),
    };
  elementCss.warnings
    .filter(isActionableCssWarning)
    .forEach((warning) => pushWarning(warnings, warning.message, warning.severity));

  if (input.css.trim() && shouldAttachElementCss && elementCss.attachedRuleCount === 0) {
    pushWarning(
      warnings,
      "Input CSS did not contain selectors that could be safely attached to exported elements.",
    );
  }

  const globalClasses = shouldCreateGlobalClasses
    ? createGlobalClasses(generatedClassNames)
    : [];
  const globalClassIdMap = getGlobalClassIdMap(globalClasses);
  const globalClassById = new Map(globalClasses.map((entry) => [entry.id, entry]));

  if (shouldCreateGlobalClasses) {
    content.forEach((element) => {
      const elementClassList = classListByElementId.get(element.id) ?? [];
      const classIds = elementClassList
        .map((className) => globalClassIdMap.get(className))
        .filter((classId): classId is string => typeof classId === "string");
      if (classIds.length > 0) {
        element.settings._cssGlobalClasses = classIds;
      }
    });
  }

  // Split source CSS into page/global CSS (routed to the reusable Jigma Page Styles
  // element) and component CSS (routed to classes/root per the selected placement mode).
  // Partition runs only when a placement mode is explicitly chosen; unset low-level callers
  // keep the original CSS untouched for back-compat. The page-stylesheet mode routes every
  // rule to the Page Styles element.
  const partition = partitionPageLevelCss(input.css);
  const usePagePartition = input.options.cssPlacement !== undefined;
  const pageStylesheetMode = cssPlacement === "page-stylesheet";
  const componentCss = !usePagePartition
    ? input.css
    : pageStylesheetMode
    ? ""
    : partition.componentCss;
  const cssTargets = shouldCreateNativeBemClasses
    ? createClassCssTargets(pendingElements, globalClassIdMap, globalClassById)
    : [];
  // Page/global CSS routed to Jigma Page Styles. In page-stylesheet mode the entire
  // stylesheet is routed there, with component selectors rewritten to the generated classes
  // so the page-level CSS still targets the rendered elements.
  const pageLevelCss = !usePagePartition
    ? ""
    : pageStylesheetMode
    ? [
      partition.pageLevelCss,
      componentCssToGeneratedSelectors(partition.componentCss, cssTargets, input.options.minifyElementCss),
    ].filter((part) => part && part.trim().length > 0).join("\n\n")
    : partition.pageLevelCss;
  const emptyClassCssResult: ElementCssResult = {
    warnings: [],
    attachedRuleCount: 0,
    unmappedRuleCount: 0,
    pseudoSelectorCount: 0,
    nativeStyleMappedCount: 0,
    customCssFallbackCount: 0,
    blockScopedFallbackCount: 0,
    literalFallbackRuleCount: 0,
    responsiveRuleCount: 0,
    pseudoRuleCount: 0,
    unresolvedSelectorCount: 0,
    styledClassIds: new Set<string>(),
    fallbackCss: "",
    fallbackStrategy: "none",
    fallbackRuleCountByClassName: new Map<string, number>(),
  };
  const classCss = componentCss.trim() && shouldCreateNativeBemClasses
    ? routeComponentCss(
      cssPlacement,
      componentCss,
      cssTargets,
      { minify: input.options.minifyElementCss, literalOnly: compatibilityProfile },
    )
    : emptyClassCssResult;
  classCss.warnings
    .filter(isActionableCssWarning)
    .forEach((warning) => pushWarning(warnings, warning.message, warning.severity));

  if (input.css.trim() && shouldCreateNativeBemClasses && classCss.attachedRuleCount === 0) {
    pushWarning(
      warnings,
      "Input CSS did not contain selectors that could be safely attached to generated Bricks classes.",
    );
  }

  const classAudit = shouldCreateGlobalClasses
    ? auditBricksClassReferences(
      content,
      globalClasses,
      classCss.styledClassIds,
      classCss.fallbackRuleCountByClassName,
      classCss.fallbackStrategy,
    )
    : {
      entries: [],
      valid: true,
      missingClassReferenceCount: 0,
      duplicateClassIdCount: 0,
      duplicateClassNameCount: 0,
      emptyStyledClassCount: 0,
      generatedClassOnlyInElementClassesCount: 0,
    };

  if (!classAudit.valid) {
    pushWarning(
      warnings,
      "Generated Bricks class references failed validation. Review the class audit before paste testing.",
      "error",
    );
  }

  if (classAudit.generatedClassOnlyInElementClassesCount > 0) {
    pushWarning(
      warnings,
      "One or more generated Bricks classes were found in _cssClasses instead of native _cssGlobalClasses.",
      "error",
    );
  }

  const classCustomCss = globalClasses
    .map((globalClass) => `${globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] ?? ""}`)
    .filter((css) => css.trim().length > 0)
    .join("\n\n");
  const fallbackCssAudit = auditLiteralFallbackCss(classCustomCss, globalClasses);
  if (fallbackCssAudit.missingClassSelectorCount > 0 || fallbackCssAudit.elementIdSelectorCount > 0) {
    pushWarning(
      warnings,
      "Literal BEM fallback CSS failed ownership validation. Review fallback selectors before paste testing.",
      "error",
    );
  }
  // Conservation runs against everything we actually emit: class-owned CSS, the page/global
  // CSS routed to Jigma Page Styles, and (for the root/auto modes) the component CSS that is
  // preserved verbatim on the root class. This keeps the "no CSS silently disappears" guarantee.
  // Conservation runs against the source CSS we actually emit: class-owned CSS, plus (when a
  // mode is active) the true-global CSS routed to Page Styles and the component CSS preserved
  // verbatim-equivalent on the root/Page Styles (every mode except plain class distribution).
  const conservationOutputCss = [
    classCustomCss,
    usePagePartition && partition.pageLevelCss.trim() ? expandCommaSelectors(partition.pageLevelCss) : "",
    usePagePartition && cssPlacement !== "attach-to-classes" && partition.componentCss.trim()
      ? expandCommaSelectors(partition.componentCss)
      : "",
  ].filter((part) => part && part.trim().length > 0).join("\n\n");
  const cssConservationAudit = input.css.trim() && shouldCreateNativeBemClasses
    ? auditCssDeclarationConservation(input.css, conservationOutputCss)
    : {
      sourceDeclarationCount: 0,
      preservedDeclarationCount: 0,
      pageLevelDeclarationCount: 0,
      unsupportedDeclarationCount: 0,
      missingDeclarations: [],
      coveragePercentage: 100,
      valid: true,
    };
  if (!cssConservationAudit.valid) {
    pushGroupedWarning(warnings, {
      id: "source-css-conservation",
      code: "source.css_loss",
      severity: "error",
      title: "Source CSS coverage failed",
      message: "Generated Bricks payload does not account for every source CSS declaration.",
      details: cssConservationAudit.missingDeclarations.slice(0, 12).map((entry) => `Missing CSS: ${entry}`),
      suggestedAction: "Review class-owned CSS before copying or inserting into Bricks.",
    });
  }

  const scopedCss = input.css.trim() && shouldCreateScopedCssBlock
    ? scopeCssToBem(input.css, scopeMap)
    : {
      css: "",
      warnings: [],
      scopedRuleCount: 0,
      unmappedRuleCount: 0,
      unusedSelectorCount: 0,
      pseudoSelectorCount: 0,
    };
  scopedCss.warnings.forEach((warning) => pushWarning(warnings, warning.message, warning.severity));

  if (input.css.trim() && shouldCreateScopedCssBlock && !scopedCss.css.trim()) {
    pushWarning(
      warnings,
      "Input CSS did not contain selectors that could be safely scoped to generated BEM classes.",
    );
  }

  if (shouldCreateScopedCssBlock && scopedCss.css.trim()) {
    content.unshift(makeCodeElement("jigma-bem-css", "Generated BEM CSS", {
      executeCode: false,
      css: scopedCss.css,
      cssCode: scopedCss.css,
    }));
  }

  const externalCode = buildExternalCode(input.options, input.html, input.css, input.js, warnings, compatibilityProfile);
  if (externalCode.element) {
    content.unshift(externalCode.element);
  }

  let jsWarningCount = 0;
  if (input.js.trim()) {
    jsWarningCount += 1;
    if (input.options.includeJavaScriptCode) {
      unsignedJavaScriptCodeCount += 1;
      content.push(makeCodeElement("jigma-javascript-review", makeJavaScriptCodeLabel(bemFactory.blockName), {
        executeCode: false,
        javascriptCode: input.js,
      }));
    }
    pushGroupedWarning(warnings, {
      id: "javascript-review-required",
      code: "javascript.review_required",
      severity: "action-required",
      title: input.options.includeJavaScriptCode ? "JavaScript signature required" : "JavaScript detected",
      summary: input.options.includeJavaScriptCode
        ? "Included as one unsigned Bricks Code element. Review and sign after import."
        : "Excluded from Bricks export. The source remains saved in Jigma.",
      message: input.options.includeJavaScriptCode
        ? "Included as one unsigned Bricks Code element. Review and sign after import."
        : "Excluded from Bricks export. The source remains saved in Jigma.",
      details: [
        input.options.includeJavaScriptCode
          ? "This section contains one unsigned Bricks Code element. Review and sign it inside Bricks before enabling execution."
          : "Jigma kept the JavaScript in the editor and did not add a Bricks Code element.",
        "Execution is disabled by default.",
      ],
      suggestedAction: input.options.includeJavaScriptCode
        ? "Review and sign the Code element inside Bricks before enabling execution."
        : "Turn on Include JavaScript in Bricks when you want one disabled Code element created.",
    });
  }

  if (!compatibilityProfile && externalCode.dependencies.length > 0) {
    pushWarning(
      warnings,
      `${externalCode.dependencies.length} dependency item(s) were detected. Review before pasting into Bricks.`,
    );
  }

  const hierarchyValid = validateHierarchy(content);
  if (!hierarchyValid) {
    pushWarning(warnings, "Generated Bricks hierarchy failed ID validation.", "error");
  }

  const structureValidation = validateBricksStructure(content);
  if (!structureValidation.valid) {
    pushGroupedWarning(warnings, {
      id: "bricks-structure-schema",
      code: "bricks.invalid_structure",
      severity: "error",
      title: "Invalid Bricks structure",
      message: "Generated Bricks structure contains invalid parent/child relationships or non-nestable children.",
      details: [
        `${structureValidation.invalidNestingCount} non-nestable element(s) contain children.`,
        `${structureValidation.parentChildMismatchCount} parent/child mismatch(es) found.`,
      ],
      suggestedAction: "Review the generated hierarchy before paste testing.",
    });
  }

  const sourceTextAudit = auditSourceTextCoverage(parsed.roots, content);
  if (!sourceTextAudit.valid) {
    pushGroupedWarning(warnings, {
      id: "source-content-conservation",
      code: "source.content_loss",
      severity: "error",
      title: "Source text coverage failed",
      message: "Generated Bricks payload does not preserve all visible source text exactly once in source order.",
      details: [
        ...sourceTextAudit.missing.slice(0, 8).map((text) => `Missing: ${text}`),
        ...sourceTextAudit.duplicated.slice(0, 8).map((text) => `Duplicated: ${text}`),
        ...sourceTextAudit.reordered.slice(0, 8).map((text) => `Reordered: ${text}`),
      ],
      suggestedAction: "Review the generated structure before copying or inserting into Bricks.",
    });
  }

  const hrefAudit = auditHrefCoverage(parsed.roots, content);
  if (!hrefAudit.valid) {
    pushGroupedWarning(warnings, {
      id: "source-href-coverage",
      code: "source.link_loss",
      severity: "error",
      title: "Source link coverage failed",
      message: "Generated Bricks payload does not preserve every source anchor href.",
      details: hrefAudit.missing.slice(0, 8).map((href) => `Missing href: ${href}`),
      suggestedAction: "Review link elements before copying or inserting into Bricks.",
    });
  }

  const imageAudit = auditImageCoverage(parsed.roots, content);
  if (!imageAudit.valid) {
    pushGroupedWarning(warnings, {
      id: "source-image-coverage",
      code: "source.image_loss",
      severity: "error",
      title: "Source image coverage failed",
      message: "Generated Bricks payload does not preserve every source image URL.",
      details: imageAudit.missing.slice(0, 8).map((src) => `Missing image: ${src}`),
      suggestedAction: "Review image elements before copying or inserting into Bricks.",
    });
  }

  const clipboardSchemaAudit = validateBricksClipboardPayloadSchema({
    content,
    source: "bricksCopiedElements",
    sourceUrl: "jigma.local",
    version: TARGET_BRICKS_VERSION,
    globalClasses: globalClasses ?? [],
    globalElements: [],
  });
  if (!clipboardSchemaAudit.valid) {
    pushGroupedWarning(warnings, {
      id: "clipboard-schema",
      code: "clipboard.invalid_schema",
      severity: "error",
      title: "Clipboard payload schema failed",
      message: "Generated clipboard payload does not match the raw Bricks JSON schema.",
      details: clipboardSchemaAudit.errors,
      suggestedAction: "Do not paste this payload into Bricks until the schema is valid.",
    });
  }

  const mappedRuleCount = elementCss.nativeStyleMappedCount + classCss.nativeStyleMappedCount;
  const fallbackCssCount = elementCss.customCssFallbackCount + classCss.customCssFallbackCount +
    (shouldCreateScopedCssBlock && scopedCss.css.trim() ? 1 : 0);
  const cssRuleWorkCount = mappedRuleCount + fallbackCssCount + elementCss.unmappedRuleCount +
    classCss.unmappedRuleCount;
  const nativeCssMappingPercentage = cssRuleWorkCount > 0
    ? Math.round((mappedRuleCount / cssRuleWorkCount) * 100)
    : 100;
  const actionRequiredWarningCount = warnings.filter((warning) =>
    warning.severity === "action-required" || warning.severity === "error"
  ).length;
  const cleanNativeThresholdsExceeded = [
    content.length > 40 ? "element-count" : "",
    globalClasses.length > 25 ? "class-count" : "",
    unsignedSvgCodeCount > 4 ? "unsigned-svg-count" : "",
    classAudit.missingClassReferenceCount > 0 ? "missing-class-reference" : "",
    classAudit.duplicateClassIdCount > 0 ? "duplicate-class-id" : "",
    structureValidation.invalidNestingCount > 0 ? "invalid-nesting" : "",
  ].filter(Boolean);

  if (!compatibilityProfile && conversionProfile === "clean-native" && cleanNativeThresholdsExceeded.length > 0) {
    pushGroupedWarning(warnings, {
      id: "clean-native-complexity",
      code: "conversion.complexity",
      severity: "warning",
      title: "Section complexity exceeds Clean Native targets",
      summary: "This section is complex. Clean Native may simplify decorative details. Use Fidelity mode to preserve the full source structure.",
      message: "This section is complex. Clean Native may simplify decorative details. Use Fidelity mode to preserve the full source structure.",
      details: cleanNativeThresholdsExceeded,
      suggestedAction: "Review the hierarchy and switch to Fidelity mode only when visual detail matters more than editability.",
    });
  }

  const finalActionRequiredWarningCount = warnings.filter((warning) =>
    warning.severity === "action-required" || warning.severity === "error"
  ).length;

  return {
    content,
    source: "bricksCopiedElements",
    sourceUrl: "jigma.local",
    version: TARGET_BRICKS_VERSION,
    ...(shouldCreateGlobalClasses ? { globalClasses } : {}),
    ...(pageLevelCss.trim() ? { pageStylesCss: pageLevelCss } : {}),
    jigmaMeta: {
      label: "Jigma strict BEM Bricks structure",
      targetBricksVersion: TARGET_BRICKS_VERSION,
      stylingMode: shouldCreateNativeBemClasses ? "native-bricks-classes" : input.options.stylingMode,
      exportProfile,
      conversionProfile,
      complexity: {
        elementCount: content.length,
        nativeClassCount: globalClasses.length,
        generatedWrapperCount,
        unsignedSvgCount: unsignedSvgCodeCount,
        javascriptCodeCount: unsignedJavaScriptCodeCount,
        unresolvedSelectorCount: elementCss.unresolvedSelectorCount + classCss.unresolvedSelectorCount,
        actionRequiredWarningCount: finalActionRequiredWarningCount,
        nativeCssMappingPercentage,
        fallbackCssCount,
        cleanNativeThresholdsExceeded,
      },
      classAudit: classAudit.entries,
      assetManifest,
      notes: [
        `Generated BEM block: ${bemFactory.blockName}.`,
        shouldCreateNativeBemClasses
          ? compatibilityProfile
            ? "Source classes are preserved as Bricks classes assigned by ID."
            : "Generated BEM classes are native editable Bricks classes assigned by ID."
          : "Generated BEM classes are attached directly as element classes.",
        shouldCreateScopedCssBlock
          ? "CSS was exported as a scoped generated CSS block."
          : shouldCreateNativeBemClasses
          ? classCustomCss
            ? "Matching CSS declarations are owned by generated Bricks class records; unsupported declarations use literal BEM Custom CSS on the owning class."
            : "Matching CSS declarations are owned by generated Bricks class records."
          : shouldAttachElementCss
          ? "Matching CSS declarations were attached directly to exported elements."
          : "CSS output was disabled for structure-only export.",
        "JavaScript and external dependencies require manual Bricks review.",
      ],
    },
    warnings,
    validation: {
      targetBricksVersion: TARGET_BRICKS_VERSION,
      rootCount: content.filter((element) => element.parent === 0).length,
      totalElements: content.length,
      hierarchyValid,
      skippedLayerCount,
      deletedLayerCount: deletedLayerIds.size,
      unsupportedElementCount,
      generatedTextElementCount,
      generatedWrapperCount,
      classAttachmentCount,
      globalClassCount: globalClasses.length,
      bemClassCount: pendingElements.length + generatedTextElementCount,
      cssAttachedRuleCount: elementCss.attachedRuleCount + classCss.attachedRuleCount,
      cssScopedRuleCount: scopedCss.scopedRuleCount,
      cssUnmappedRuleCount: scopedCss.unmappedRuleCount + elementCss.unmappedRuleCount +
        classCss.unmappedRuleCount,
      unusedSelectorCount: scopedCss.unusedSelectorCount,
      nativeStyleMappedCount: elementCss.nativeStyleMappedCount + classCss.nativeStyleMappedCount,
      customCssFallbackCount: fallbackCssCount,
      blockScopedFallbackCount: elementCss.blockScopedFallbackCount + classCss.blockScopedFallbackCount,
      literalFallbackRuleCount: elementCss.literalFallbackRuleCount + classCss.literalFallbackRuleCount,
      classFallbackStrategy: classCss.fallbackStrategy ?? "none",
      responsiveRuleCount: elementCss.responsiveRuleCount + classCss.responsiveRuleCount,
      pseudoRuleCount: elementCss.pseudoRuleCount + classCss.pseudoRuleCount,
      unresolvedSelectorCount: elementCss.unresolvedSelectorCount + classCss.unresolvedSelectorCount,
      externalDependencyCount: externalCode.dependencies.length,
      unsignedSvgCodeCount,
      unsignedJavaScriptCodeCount,
      groupedWarningCount: warnings.length,
      classReferenceValid: classAudit.valid,
      missingClassReferenceCount: classAudit.missingClassReferenceCount,
      duplicateClassIdCount: classAudit.duplicateClassIdCount,
      duplicateClassNameCount: classAudit.duplicateClassNameCount,
      emptyStyledClassCount: classAudit.emptyStyledClassCount,
      fallbackCssMissingClassSelectorCount: fallbackCssAudit.missingClassSelectorCount,
      fallbackCssElementIdSelectorCount: fallbackCssAudit.elementIdSelectorCount,
      dependencyWarningCount: externalCode.dependencies.length,
      jsWarningCount,
      nativeImageCount: assetManifest.summary.nativeImages,
      responsiveImageCount: assetManifest.summary.responsiveImages,
      backgroundImageCount: assetManifest.summary.backgroundImages,
      overlayMappedCount: assetManifest.summary.overlaysMapped,
      failedAssetCount: assetManifest.summary.failedAssets,
      conversionProfile,
      exportProfile,
      actionRequiredWarningCount: finalActionRequiredWarningCount,
      nativeCssMappingPercentage,
      complexityWarningCount: warnings.filter((warning) => warning.code === "conversion.complexity").length,
      invalidNestingCount: structureValidation.invalidNestingCount,
      sourceTextCount: sourceTextAudit.sourceSegments.length,
      sourceTextCoverageValid: sourceTextAudit.valid,
      missingSourceTextCount: sourceTextAudit.missing.length,
      duplicatedSourceTextCount: sourceTextAudit.duplicated.length,
      reorderedSourceTextCount: sourceTextAudit.reordered.length,
      hrefCoverageValid: hrefAudit.valid,
      sourceHrefCount: hrefAudit.sourceHrefs.length,
      missingHrefCount: hrefAudit.missing.length,
      imageCoverageValid: imageAudit.valid,
      sourceImageCount: imageAudit.sourceImages.length,
      missingImageCount: imageAudit.missing.length,
      clipboardSchemaValid: clipboardSchemaAudit.valid,
      cssDeclarationCoverageValid: cssConservationAudit.valid,
      sourceCssDeclarationCount: cssConservationAudit.sourceDeclarationCount,
      preservedCssDeclarationCount: cssConservationAudit.preservedDeclarationCount +
        cssConservationAudit.pageLevelDeclarationCount,
      missingCssDeclarationCount: cssConservationAudit.unsupportedDeclarationCount,
      cssConservationPercentage: cssConservationAudit.coveragePercentage,
    },
  };
}

export function serializeBricksClipboardPayload(exportResult: BricksExport) {
  return {
    content: exportResult.content,
    source: exportResult.source,
    sourceUrl: exportResult.sourceUrl,
    version: exportResult.version,
    globalClasses: exportResult.globalClasses ?? [],
    globalElements: [],
  };
}

export function serializeBricksClipboardPayloadJson(exportResult: BricksExport) {
  return JSON.stringify(serializeBricksClipboardPayload(exportResult));
}

// Builds the single reusable "Jigma Page Styles" element that carries page/global CSS.
// Mirrors the WordPress plugin's PHP element shape so both front-ends stay consistent.
export function buildJigmaPageStylesElement(
  pageStylesCss: string,
  usedIds: Set<string> = new Set(),
): BricksElement {
  let id = makeStableId("jigma-page-styles");
  let salt = 0;
  while (usedIds.has(id)) {
    salt += 1;
    id = makeStableId(`jigma-page-styles-${salt}`);
  }

  return {
    id,
    name: "code",
    parent: 0,
    children: [],
    settings: {
      executeCode: false,
      css: pageStylesCss,
      cssCode: pageStylesCss,
    },
    label: "Jigma Page Styles",
  };
}

// Clipboard payload that includes the routed page/global CSS as one Jigma Page Styles
// element so a paste applies it without manual steps. Used by the standalone web app;
// the WordPress plugin adds the same element server-side from pageStylesCss instead.
export function serializeBricksClipboardPayloadWithPageStyles(exportResult: BricksExport) {
  const payload = serializeBricksClipboardPayload(exportResult);
  const pageStylesCss = (exportResult.pageStylesCss ?? "").trim();
  if (!pageStylesCss) {
    return payload;
  }

  const usedIds = new Set(payload.content.map((element) => `${element.id}`));
  return {
    ...payload,
    content: [...payload.content, buildJigmaPageStylesElement(pageStylesCss, usedIds)],
  };
}

export function getBricksExportBlockingMessages(exportResult: BricksExport) {
  const messages: string[] = [];
  const validation = exportResult.validation;

  if (!validation.sourceTextCoverageValid) {
    messages.push("Visible source text was not fully preserved.");
  }
  if (!validation.hrefCoverageValid) {
    messages.push("One or more source links lost their href.");
  }
  if (!validation.imageCoverageValid) {
    messages.push("One or more source images lost their URL.");
  }
  if (!validation.hierarchyValid) {
    messages.push("Generated hierarchy has invalid parent/child references.");
  }
  if (!validation.classReferenceValid) {
    messages.push("Generated class references do not all resolve.");
  }
  if ((validation.invalidNestingCount ?? 0) > 0) {
    messages.push("Generated output has unsupported non-nestable children.");
  }
  if (!validation.clipboardSchemaValid) {
    messages.push("Clipboard payload schema is invalid.");
  }
  if (!validation.cssDeclarationCoverageValid) {
    messages.push("Source CSS declarations were not fully preserved or classified.");
  }

  return messages;
}

export function serializeJigmaDebugReport(exportResult: BricksExport) {
  return {
    validation: exportResult.validation,
    assetManifest: exportResult.jigmaMeta.assetManifest,
    classAudit: exportResult.jigmaMeta.classAudit ?? [],
    warnings: exportResult.warnings,
    complexity: exportResult.jigmaMeta.complexity,
    mappingMetrics: {
      nativeStyleMappedCount: exportResult.validation.nativeStyleMappedCount,
      customCssFallbackCount: exportResult.validation.customCssFallbackCount,
      literalFallbackRuleCount: exportResult.validation.literalFallbackRuleCount,
      unresolvedSelectorCount: exportResult.validation.unresolvedSelectorCount,
    },
  };
}
