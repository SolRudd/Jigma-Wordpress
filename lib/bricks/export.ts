import type {
  BricksElement,
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
  attachCssToElements,
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
  originalClasses: string[];
  path: string;
}

function makeStableId(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `jg${(hash >>> 0).toString(36).padStart(8, "0").slice(0, 8)}`;
}

function makeGlobalClassId(className: string) {
  return `jg_cls_${className.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase()}_${makeStableId(className).slice(2, 6)}`;
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
  const attributes = Object.entries(element.attributes).filter(([name]) =>
    name !== "class"
  );

  if (element.attributes.id) {
    settings._cssId = element.attributes.id;
  }

  if (attributes.length > 0) {
    settings._jigmaAttributes = attributes.map(([name, value]) => ({
      name,
      value,
    }));
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
    const src = element.attributes.src;
    if (src) {
      settings.image = { url: src };
    }
    if (element.attributes.alt) {
      settings.altText = element.attributes.alt;
    }
  }

  if (name === "svg") {
    settings.svg = serializeElement(element, { path: "svg", skipScripts: true });
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
        _jigmaReviewRequired: true,
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
  const globalClasses: BricksGlobalClass[] = [];

  classNames.forEach((className) => {
    if (seen.has(className)) {
      return;
    }

    seen.add(className);
    globalClasses.push({
      id: makeGlobalClassId(className),
      name: className,
      settings: {
        _jigmaGeneratedBem: true,
      },
      _exists: false,
    });
  });

  return globalClasses;
}

function getGlobalClassIdMap(globalClasses: BricksGlobalClass[]) {
  return new Map(globalClasses.map((entry) => [entry.name, entry.id]));
}

function createGeneratedTextClass(blockName: string, assignment: BemClassAssignment) {
  const parentRole = assignment.role;
  const suffix = parentRole &&
      !["block", "element", "root", "section"].includes(parentRole)
    ? `${parentRole}-text`
    : "text";

  return `${blockName}__${suffix}`;
}

export function createBricksExport(input: ConversionInput): BricksExport {
  const warnings: ConversionWarning[] = [];
  const exportMode = input.options.exportMode;
  const shouldAttachElementCss = exportMode === "element-styles" ||
    exportMode === "global-classes";
  const shouldCreateGlobalClasses = exportMode === "global-classes";
  const shouldCreateScopedCssBlock = exportMode === "scoped-css-block";
  const parsed = getRenderableRoots(input.html);
  const deletedLayerIds = input.deletedLayerIds ?? new Set<string>();
  const excludedLayerIds = input.excludedLayerIds ?? new Set<string>();
  const content: BricksElement[] = [];
  const contentById = new Map<string, BricksElement>();
  const pendingElements: PendingElement[] = [];
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
    const settings: Record<string, unknown> = {
      ...getAttributeSettings(element),
      ...getContentSettings(element, mapping.name),
      _cssClasses: classList.join(" "),
      _jigmaBemClass: assignment.className,
      _jigmaClassMode: input.options.classMode,
    };
    classAttachmentCount += classList.length;

    if (input.options.classMode !== "strict-bem" && originalClasses.length > 0) {
      settings._jigmaOriginalClasses = originalClasses;
    }

    if (!mapping.supported) {
      settings._jigmaOriginalTag = element.tagName;
    } else if (
      WRAPPER_TAGS.has(element.tagName) &&
      mapping.name === "div" &&
      element.tagName !== "div"
    ) {
      settings._jigmaOriginalTag = element.tagName;
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
    generatedClassNames.push(assignment.className);
    pendingElements.push({
      element: bricksElement,
      parsedElement: element,
      assignment,
      originalClasses,
      path,
    });
    addSelectorMapping(scopeMap, originalClasses, element.attributes.id, assignment.className);

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
          _cssClasses: textClass,
          _jigmaBemClass: textClass,
          _jigmaGeneratedFrom: element.tagName,
        },
      }, createBricksElementLabel({
        bemClass: textClass,
        tagName: "span",
        parentLabel: bricksElement.label,
      }));
      content.push(textElement);
      contentById.set(textId, textElement);
      generatedClassNames.push(textClass);
      bricksElement.children.push(textId);
      generatedTextElementCount += 1;
      classAttachmentCount += 1;
    }

    let visibleChildIndex = 0;
    element.children.forEach((child) => {
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
  if (shouldCreateGlobalClasses) {
    content.forEach((element) => {
      const bemClass = element.settings._jigmaBemClass;
      if (typeof bemClass !== "string") {
        return;
      }

      const globalClassId = globalClassIdMap.get(bemClass);
      if (globalClassId) {
        element.settings._cssGlobalClasses = [globalClassId];
      }
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
      _jigmaMode: "bem-css",
    }));
  }

  const externalCode = buildExternalCode(input.options, input.html, input.css, input.js, warnings);
  if (externalCode.element) {
    content.unshift(externalCode.element);
  }

  let jsWarningCount = 0;
  if (input.js.trim()) {
    jsWarningCount += 1;
    pushWarning(
      warnings,
      "JavaScript was detected but not converted. Rebuild behavior manually in Bricks or review it as custom code.",
    );
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
      notes: [
        `Generated BEM block: ${bemFactory.blockName}.`,
        shouldCreateGlobalClasses
          ? "Generated BEM classes are also registered as Bricks global classes."
          : "Generated BEM classes are attached directly as element classes.",
        shouldCreateScopedCssBlock
          ? "CSS was exported as a scoped generated CSS block."
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
      cssAttachedRuleCount: elementCss.attachedRuleCount,
      cssScopedRuleCount: scopedCss.scopedRuleCount,
      cssUnmappedRuleCount: scopedCss.unmappedRuleCount + elementCss.unmappedRuleCount,
      unusedSelectorCount: scopedCss.unusedSelectorCount,
      nativeStyleMappedCount: 0,
      customCssFallbackCount: shouldCreateScopedCssBlock && scopedCss.css.trim() ? 1 : 0,
      dependencyWarningCount: externalCode.dependencies.length,
      jsWarningCount,
    },
  };
}
