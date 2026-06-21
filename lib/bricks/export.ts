import type {
  BricksElement,
  BricksClassAuditEntry,
  BricksExport,
  BricksGlobalClass,
  ClassMode,
  ConversionInput,
  ConversionWarning,
  OutputOptions,
  ParsedElement,
} from "../../types/jigma.ts";
import {
  getClassNames,
  getElementText,
  getOwnText,
  getRenderableRoots,
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
  BRICKS_ELEMENT_CUSTOM_CSS_FIELD,
  type ClassCssTarget,
  type ElementCssTarget,
} from "../css/element.ts";
import { scopeCssToBem, type CssSelectorScopeMap } from "../css/scope.ts";

export const TARGET_BRICKS_VERSION = "2.3.7";

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

const TEXT_TAGS = new Set(["p", "span", "strong", "em", "small", "b", "i", "mark", "li"]);
const WRAPPER_TAGS = new Set(["div", "article", "header", "main", "footer", "nav", "aside", "ul", "ol"]);
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
]);

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

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function isValidClassName(className: string) {
  return /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(className);
}

function getBricksMapping(element: ParsedElement) {
  const tag = element.tagName;
  const text = getOwnText(element, 500);

  if (tag === "section") {
    return { name: "section", supported: true };
  }

  if (/^h[1-6]$/.test(tag)) {
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
    return { name: "text-link", supported: true };
  }

  if (tag === "button") {
    return { name: "button", supported: true };
  }

  if (tag === "svg") {
    return { name: "svg", supported: true };
  }

  if (TEXT_TAGS.has(tag) && element.children.length === 0 && text) {
    return { name: "text-basic", supported: true };
  }

  if (tag === "div" || WRAPPER_TAGS.has(tag)) {
    return { name: "div", supported: true };
  }

  return { name: "div", supported: false };
}

function getAttributeSettings(element: ParsedElement) {
  const settings: Record<string, unknown> = {};

  if (element.attributes.id) {
    settings._cssId = element.attributes.id;
  }

  return settings;
}

function getContentSettings(element: ParsedElement, name: string) {
  const settings: Record<string, unknown> = {};
  const tag = element.tagName;
  const text = (name === "heading" || name === "text-link" || name === "button")
    ? getElementText(element).replace(/\s+/g, " ").trim()
    : getOwnText(element, 500);

  if (name === "heading") {
    settings.text = text;
    settings.tag = tag;
  }

  if (name === "text-basic" || name === "button" || name === "text-link") {
    settings.text = text;
  }

  if (name === "button" || name === "text-link") {
    const href = element.attributes.href;
    if (href) {
      settings.link = {
        type: href.startsWith("#") ? "internal" : "external",
        url: href,
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

function validateHierarchy(content: BricksElement[]) {
  const ids = new Set(content.map((element) => element.id));
  return content.every((element) =>
    (element.parent === 0 || ids.has(element.parent)) &&
    element.children.every((childId) => ids.has(childId))
  );
}

function makeClassList(
  mode: ClassMode,
  bemClass: string,
  originalClasses: string[],
  warnings: ConversionWarning[],
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

function buildExternalCode(
  options: OutputOptions,
  html: string,
  css: string,
  js: string,
  warnings: ConversionWarning[],
) {
  const dependencies = inspectDependencies(html, css, js);
  const lines: string[] = [];

  dependencies.forEach((dependency) => {
    if (dependency.warning) {
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

function getModifier(className: string) {
  return className.includes("--") ? className.split("--").at(-1) ?? "" : "";
}

function getSourceClassesForGeneratedClass(
  originalClasses: string[],
  generatedClass: string,
  classList: string[],
) {
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

export function createBricksExport(input: ConversionInput): BricksExport {
  const warnings: ConversionWarning[] = [];
  const exportMode = input.options.exportMode;
  const shouldCreateNativeBemClasses = isNativeBemClassMode(exportMode);
  const shouldAttachElementCss = exportMode === "element-styles";
  const shouldCreateGlobalClasses = shouldCreateNativeBemClasses;
  const shouldCreateScopedCssBlock = exportMode === "scoped-css-block";
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

  assetManifest.warnings.forEach((warning) => pushGroupedWarning(warnings, warning));
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
  ): string | null => {
    if (HIDDEN_STRUCTURE_TAGS.has(element.tagName)) {
      return null;
    }

    if (excludedLayerIds.has(path) || deletedLayerIds.has(path)) {
      skippedLayerCount += 1;
      return null;
    }

    const mapping = getBricksMapping(element);
    if (!SUPPORTED_TAGS.has(element.tagName) || !mapping.supported) {
      unsupportedElementCount += 1;
      pushWarning(
        warnings,
        `<${element.tagName}> was converted to a Bricks Div fallback.`,
      );
    }

    const originalClasses = Array.from(new Set(getClassNames(element)));
    const assignment = bemFactory.create(element, path, parent);
    const id = makeStableId(`${path}:${element.tagName}:${assignment.className}:${getOwnText(element, 64)}`);
    const classList = makeClassList(
      input.options.classMode,
      assignment.className,
      originalClasses,
      warnings,
    );
    const svgSanitization = mapping.name === "svg"
      ? sanitizeSvgMarkup(element.rawHtml ?? serializeElement(element, { path: "svg", skipScripts: true }))
      : null;
    const settings: Record<string, unknown> = {
      ...getAttributeSettings(element),
      ...getContentSettings(element, mapping.name),
    };

    if (shouldCreateNativeBemClasses) {
      const preservedClasses = input.options.classMode === "strict-bem"
        ? []
        : makePreservedOriginalClassList(originalClasses, warnings);
      if (preservedClasses.length > 0) {
        settings._cssClasses = preservedClasses.join(" ");
      }
    } else {
      settings._cssClasses = classList.join(" ");
    }

    classAttachmentCount += classList.length;

    if (input.options.classMode !== "strict-bem" && originalClasses.length > 0) {
      pushWarning(warnings, "Original classes were preserved in _cssClasses because strict BEM mode is off.", "info");
    }

    if (!mapping.supported) {
      pushWarning(warnings, `<${element.tagName}> was converted to a Bricks Div fallback.`);
    } else if (
      WRAPPER_TAGS.has(element.tagName) &&
      mapping.name === "div" &&
      element.tagName !== "div"
    ) {
      pushWarning(warnings, `<${element.tagName}> was exported as a Bricks Div.`, "info");
    }

    const parentElement = parent === 0 ? undefined : contentById.get(parent);
    const bricksElement: BricksElement = applyBricksElementLabel({
      id,
      name: mapping.name,
      parent,
      children: [],
      settings,
    }, createBricksElementLabel({
      bemClass: assignment.className,
      tagName: element.tagName,
      parentLabel: parentElement?.label,
    }));
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
        id: `svg-signature:${id}:html`,
        code: "svg.signature_required",
        severity: report?.malformed ? "error" : "action-required",
        title: "Signature required after import",
        summary: `${bricksElement.label ?? "Inline SVG"} was preserved as one inline SVG element. Bricks signature required.`,
        message: `${bricksElement.label ?? "Inline SVG"} was preserved as one inline SVG element. Bricks signature required.`,
        ownerElementId: id,
        ownerLabel: bricksElement.label,
        details: signatureDetails,
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
    if (!isTextElement && directText) {
      const textId = makeStableId(`${path}:direct-text:${directText}`);
      const textClass = createGeneratedTextClass(bemFactory.blockName, assignment);
      const textElement = applyBricksElementLabel({
        id: textId,
        name: "text-basic",
        parent: id,
        children: [],
        settings: {
          text: directText,
          ...(shouldCreateNativeBemClasses ? {} : { _cssClasses: textClass }),
        },
      }, createBricksElementLabel({
        bemClass: textClass,
        tagName: "span",
        parentLabel: bricksElement.label,
      }));
      content.push(textElement);
      contentById.set(textId, textElement);
      classListByElementId.set(textId, [textClass]);
      generatedClassNames.push(textClass);
      bricksElement.children.push(textId);
      generatedTextElementCount += 1;
      classAttachmentCount += 1;
    }

    let visibleChildIndex = 0;
    element.children.forEach((child) => {
      if (element.tagName === "picture") {
        return;
      }

      if (HIDDEN_STRUCTURE_TAGS.has(child.tagName)) {
        return;
      }

      const childPath = `${path}-${visibleChildIndex}`;
      visibleChildIndex += 1;
      const childId = walkElement(child, id, childPath);
      if (childId) {
        bricksElement.children.push(childId);
      }
    });

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
  elementCss.warnings.forEach((warning) => pushWarning(warnings, warning.message, warning.severity));

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

  const classCss = input.css.trim() && shouldCreateNativeBemClasses
    ? attachCssToGlobalClasses(
      input.css,
      createClassCssTargets(pendingElements, globalClassIdMap, globalClassById),
      { minify: input.options.minifyElementCss },
    )
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
  classCss.warnings.forEach((warning) => pushWarning(warnings, warning.message, warning.severity));

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

  const externalCode = buildExternalCode(input.options, input.html, input.css, input.js, warnings);
  if (externalCode.element) {
    content.unshift(externalCode.element);
  }

  let jsWarningCount = 0;
  if (input.js.trim()) {
    jsWarningCount += 1;
    unsignedJavaScriptCodeCount += 1;
    if (input.options.includeJavaScriptCode) {
      content.push(makeCodeElement("jigma-javascript-review", `${bemFactory.blockName} JavaScript`, {
        executeCode: false,
        javascript: input.js,
        js: input.js,
      }));
    }
    pushGroupedWarning(warnings, {
      id: "javascript-review-required",
      code: "javascript.review_required",
      severity: "action-required",
      title: "JavaScript review required",
      summary: input.options.includeJavaScriptCode
        ? "JavaScript was included as one disabled unsigned Code element for review."
        : "JavaScript was detected but not converted into builder-native behavior.",
      message: input.options.includeJavaScriptCode
        ? "JavaScript was included as one disabled unsigned Code element for review."
        : "JavaScript was detected but not converted into builder-native behavior.",
      details: [
        input.options.includeJavaScriptCode
          ? "Jigma created one disabled Bricks Code element and did not fabricate a signature."
          : "Jigma does not silently insert JavaScript into the default Bricks structure.",
        "Review behavior manually before enabling custom code in Bricks.",
      ],
      suggestedAction: "Rebuild interactions with Bricks-native controls where possible, or add reviewed JavaScript manually.",
    });
  }

  if (externalCode.dependencies.length > 0) {
    pushWarning(
      warnings,
      `${externalCode.dependencies.length} dependency item(s) were detected. Review before pasting into Bricks.`,
    );
  }

  const hierarchyValid = validateHierarchy(content);
  if (!hierarchyValid) {
    pushWarning(warnings, "Generated Bricks hierarchy failed ID validation.", "error");
  }

  return {
    content,
    source: "bricksCopiedElements",
    sourceUrl: "jigma.local",
    version: TARGET_BRICKS_VERSION,
    ...(shouldCreateGlobalClasses ? { globalClasses } : {}),
    jigmaMeta: {
      label: "Jigma strict BEM Bricks structure",
      targetBricksVersion: TARGET_BRICKS_VERSION,
      stylingMode: "bem-css",
      classAudit: classAudit.entries,
      assetManifest,
      notes: [
        `Generated BEM block: ${bemFactory.blockName}.`,
        shouldCreateNativeBemClasses
          ? "Generated BEM classes are native editable Bricks classes assigned by ID."
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
      classAttachmentCount,
      globalClassCount: globalClasses.length,
      bemClassCount: pendingElements.length + generatedTextElementCount,
      cssAttachedRuleCount: elementCss.attachedRuleCount + classCss.attachedRuleCount,
      cssScopedRuleCount: scopedCss.scopedRuleCount,
      cssUnmappedRuleCount: scopedCss.unmappedRuleCount + elementCss.unmappedRuleCount +
        classCss.unmappedRuleCount,
      unusedSelectorCount: scopedCss.unusedSelectorCount,
      nativeStyleMappedCount: elementCss.nativeStyleMappedCount + classCss.nativeStyleMappedCount,
      customCssFallbackCount: elementCss.customCssFallbackCount + classCss.customCssFallbackCount +
        (shouldCreateScopedCssBlock && scopedCss.css.trim() ? 1 : 0),
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
    },
  };
}
