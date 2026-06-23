import type { BricksElement, BricksGlobalClass, ConversionWarning } from "../../types/jigma.ts";

// Bricks element custom CSS clipboard field. Keep isolated so manual paste testing
// can swap this key if a Bricks schema change proves a different field is honored.
export const BRICKS_ELEMENT_CUSTOM_CSS_FIELD = "_cssCustom";

export interface ElementCssTarget {
  element: BricksElement;
  bemClass: string;
  sourceClasses: string[];
  sourceId?: string;
}

export interface ClassCssTarget {
  globalClass: BricksGlobalClass;
  className: string;
  sourceClasses: string[];
  sourceId?: string;
}

export interface ElementCssResult {
  warnings: ConversionWarning[];
  attachedRuleCount: number;
  unmappedRuleCount: number;
  pseudoSelectorCount: number;
  nativeStyleMappedCount: number;
  customCssFallbackCount: number;
  blockScopedFallbackCount: number;
  literalFallbackRuleCount: number;
  responsiveRuleCount: number;
  pseudoRuleCount: number;
  unresolvedSelectorCount: number;
  styledClassIds: Set<string>;
  fallbackCss?: string;
  fallbackStrategy?: "bricks-class-root" | "literal-bem" | "none";
  fallbackRuleCountByClassName?: Map<string, number>;
}

export interface CssDeclarationConservationResult {
  sourceDeclarationCount: number;
  preservedDeclarationCount: number;
  pageLevelDeclarationCount: number;
  unsupportedDeclarationCount: number;
  missingDeclarations: string[];
  coveragePercentage: number;
  valid: boolean;
}

export interface ElementCssOptions {
  minify?: boolean;
  classFallbackStrategy?: "bricks-class-root" | "literal-bem";
  literalOnly?: boolean;
}

interface CssBlock {
  selector: string;
  body: string;
}

interface ElementCssBucket {
  root: Map<string, string[]>;
  media: Map<string, Map<string, string[]>>;
  raw: string[];
}

interface ClassCssBucket {
  root: Map<string, string[]>;
  media: Map<string, Map<string, string[]>>;
  raw: string[];
}

interface CssDeclaration {
  property: string;
  value: string;
  important: boolean;
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

function findMatchingBrace(css: string, openIndex: number) {
  let depth = 0;

  for (let index = openIndex; index < css.length; index += 1) {
    if (css[index] === "{") {
      depth += 1;
    } else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function parseTopLevelBlocks(css: string) {
  const normalizedCss = stripCssComments(css);
  const blocks: CssBlock[] = [];
  let index = 0;

  while (index < normalizedCss.length) {
    const openIndex = normalizedCss.indexOf("{", index);
    if (openIndex === -1) {
      break;
    }

    const closeIndex = findMatchingBrace(normalizedCss, openIndex);
    if (closeIndex === -1) {
      blocks.push({
        selector: normalizedCss.slice(index, openIndex).trim(),
        body: normalizedCss.slice(openIndex + 1).trim(),
      });
      break;
    }

    blocks.push({
      selector: normalizedCss.slice(index, openIndex).trim(),
      body: normalizedCss.slice(openIndex + 1, closeIndex).trim(),
    });
    index = closeIndex + 1;
  }

  return blocks.filter((block) => block.selector && block.body);
}

function stripCssComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function formatDeclarations(body: string) {
  return parseDeclarations(body).map(formatDeclaration).join("\n");
}

function minifyDeclarations(declarations: string) {
  return declarations
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/\s*:\s*/, ":"))
    .join("");
}

function indent(value: string, spaces: number) {
  const padding = " ".repeat(spaces);
  return value.split("\n").map((line) => `${padding}${line}`).join("\n");
}

function formatRootDeclarations(declarations: string, rootSuffix = "", minify = false) {
  if (minify) {
    return `%root%${rootSuffix}{${minifyDeclarations(declarations)}}`;
  }

  return `%root%${rootSuffix} {\n${indent(declarations, 2)}\n}`;
}

function formatMediaDeclarations(
  mediaSelector: string,
  declarations: string,
  rootSuffix = "",
  minify = false,
) {
  if (minify) {
    return `${mediaSelector}{${formatRootDeclarations(declarations, rootSuffix, true)}}`;
  }

  return `${mediaSelector} {\n${indent(formatRootDeclarations(declarations, rootSuffix), 2)}\n}`;
}

function formatLiteralDeclarations(selector: string, declarations: string, minify = false) {
  if (minify) {
    return `${selector}{${minifyDeclarations(declarations)}}`;
  }

  return `${selector} {\n${indent(declarations, 2)}\n}`;
}

function formatLiteralAtRule(
  atRuleSelector: string,
  selector: string,
  declarations: string,
  minify = false,
) {
  if (minify) {
    return `${atRuleSelector}{${formatLiteralDeclarations(selector, declarations, true)}}`;
  }

  return `${atRuleSelector} {\n${indent(formatLiteralDeclarations(selector, declarations), 2)}\n}`;
}

function getExistingElementCss(element: BricksElement) {
  const value = element.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD];
  return typeof value === "string" ? value.trim() : "";
}

export function attachElementCss(element: BricksElement, css: string) {
  const existing = getExistingElementCss(element);
  const nextCss = existing ? `${existing}\n\n${css}` : css;

  element.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] = nextCss;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function splitCssList(value: string, separator = /\s+/) {
  const parts: string[] = [];
  let current = "";
  let quote = "";
  let depth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];

    if (quote) {
      current += char;
      if (char === quote && previous !== "\\") {
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }

    if (depth === 0 && separator.test(char)) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function parseDeclarations(body: string): CssDeclaration[] {
  const rawDeclarations: string[] = [];
  let current = "";
  let quote = "";
  let depth = 0;

  const normalizedBody = stripCssComments(body);

  for (let index = 0; index < normalizedBody.length; index += 1) {
    const char = normalizedBody[index];
    const previous = normalizedBody[index - 1];

    if (quote) {
      current += char;
      if (char === quote && previous !== "\\") {
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }

    if (char === ";" && depth === 0) {
      if (current.trim()) {
        rawDeclarations.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    rawDeclarations.push(current.trim());
  }

  return rawDeclarations.map((declaration) => {
    const colonIndex = declaration.indexOf(":");
    if (colonIndex === -1) {
      return null;
    }

    const property = declaration.slice(0, colonIndex).trim().toLowerCase();
    const rawValue = declaration.slice(colonIndex + 1).trim();
    const important = /!\s*important$/i.test(rawValue);
    const value = rawValue.replace(/!\s*important$/i, "").trim();

    if (!property || !value) {
      return null;
    }

    return { property, value, important };
  }).filter((declaration): declaration is CssDeclaration => Boolean(declaration));
}

function formatDeclaration(declaration: CssDeclaration) {
  return `${declaration.property}: ${declaration.value}${declaration.important ? " !important" : ""};`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getSettingsObject(settings: Record<string, unknown>, key: string) {
  const existing = settings[key];
  if (isPlainObject(existing)) {
    return existing;
  }

  const next: Record<string, unknown> = {};
  settings[key] = next;
  return next;
}

function mergeObjectSetting(
  settings: Record<string, unknown>,
  key: string,
  value: Record<string, unknown>,
) {
  settings[key] = {
    ...getSettingsObject(settings, key),
    ...value,
  };
}

function makeColorValue(value: string) {
  return { raw: value };
}

function isSimpleColorValue(value: string) {
  const lowerValue = value.trim().toLowerCase();
  return !/(gradient|url)\s*\(/i.test(lowerValue) &&
    (
      /^#([0-9a-f]{3,8})$/i.test(lowerValue) ||
      /^(rgb|rgba|hsl|hsla|color|color-mix|var)\(/i.test(lowerValue) ||
      /^(currentcolor|transparent|inherit|initial|unset|[a-z]+)$/.test(lowerValue)
    );
}

function extractSingleUrl(value: string) {
  const matches = [...value.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^"')\s]+))\s*\)/gi)];
  if (matches.length !== 1) {
    return "";
  }

  return (matches[0][1] ?? matches[0][2] ?? matches[0][3] ?? "").trim();
}

function isSimpleGradientValue(value: string) {
  return /^(linear-gradient|radial-gradient|conic-gradient)\(/i.test(value.trim()) &&
    !/url\(/i.test(value);
}

function parseBackgroundMediaValue(value: string) {
  const trimmed = value.trim();
  const url = extractSingleUrl(trimmed);
  if (url && trimmed.replace(/url\(\s*(?:"[^"]+"|'[^']+'|[^"')\s]+)\s*\)/i, "").trim() === "") {
    return { image: { url } };
  }

  if (isSimpleGradientValue(trimmed)) {
    return { gradient: { value: trimmed } };
  }

  return null;
}

function spacingFromShorthand(value: string) {
  const parts = splitCssList(value);
  const [top, right = top, bottom = top, left = right] = parts;

  return {
    top,
    right,
    bottom,
    left,
  };
}

function mergeSpacingSide(
  settings: Record<string, unknown>,
  key: string,
  side: "top" | "right" | "bottom" | "left",
  value: string,
) {
  mergeObjectSetting(settings, key, { [side]: value });
}

function makeSettingKey(baseKey: string, breakpoint?: string, state?: string) {
  return [baseKey, breakpoint, state].filter(Boolean).join(":");
}

function getBreakpointFromMedia(mediaSelector?: string) {
  if (!mediaSelector) {
    return undefined;
  }

  const maxWidth = mediaSelector.match(/max-width\s*:\s*(\d+(?:\.\d+)?)px/i);
  if (!maxWidth) {
    return undefined;
  }

  const value = Number(maxWidth[1]);
  if (Number.isNaN(value)) {
    return undefined;
  }

  if (value <= 478) {
    return "mobile_portrait";
  }

  if (value <= 767) {
    return "mobile_landscape";
  }

  return "tablet_portrait";
}

function getStateFromPseudo(rootSuffix: string) {
  const normalized = rootSuffix.replace(/^:/, "").trim();
  return ["hover", "focus", "focus-visible", "active"].includes(normalized)
    ? normalized
    : undefined;
}

function parseBorderValue(value: string) {
  const styleWords = new Set([
    "none",
    "solid",
    "dashed",
    "dotted",
    "double",
    "groove",
    "ridge",
    "inset",
    "outset",
  ]);
  const parts = splitCssList(value);
  const styleIndex = parts.findIndex((part) => styleWords.has(part.toLowerCase()));
  if (styleIndex === -1) {
    return null;
  }

  const width = parts.slice(0, styleIndex).join(" ").trim();
  const style = parts[styleIndex];
  const color = parts.slice(styleIndex + 1).join(" ").trim();

  return {
    ...(width ? { width: spacingFromShorthand(width) } : {}),
    style,
    ...(color ? { color: makeColorValue(color) } : {}),
  };
}

function mergeBorderSetting(
  settings: Record<string, unknown>,
  key: string,
  value: Record<string, unknown>,
) {
  mergeObjectSetting(settings, key, value);
}

function applyNativeSetting(
  settings: Record<string, unknown>,
  declaration: CssDeclaration,
  breakpoint?: string,
  state?: string,
) {
  if (declaration.important) {
    return false;
  }

  const key = (baseKey: string) => makeSettingKey(baseKey, breakpoint, state);
  const property = declaration.property;
  const value = declaration.value;

  if (property === "display") {
    settings[key("_display")] = value;
    return true;
  }

  if (property === "flex-direction") {
    settings[key("_direction")] = value;
    return true;
  }

  if (property === "flex-wrap") {
    settings[key("_flexWrap")] = value;
    return true;
  }

  if (property === "align-items") {
    settings[key("_alignItems")] = value;
    return true;
  }

  if (property === "align-content") {
    settings[key("_alignContent")] = value;
    return true;
  }

  if (property === "justify-content") {
    settings[key("_justifyContent")] = value;
    return true;
  }

  if (property === "grid-template-columns") {
    settings[key("_gridTemplateColumns")] = value;
    return true;
  }

  if (property === "grid-template-rows") {
    settings[key("_gridTemplateRows")] = value;
    return true;
  }

  if (property === "grid-auto-flow") {
    settings[key("_gridAutoFlow")] = value;
    return true;
  }

  if (property === "gap") {
    settings[key("_gap")] = value;
    return true;
  }

  if (property === "row-gap") {
    settings[key("_rowGap")] = value;
    return true;
  }

  if (property === "column-gap") {
    settings[key("_columnGap")] = value;
    return true;
  }

  if (property === "grid-gap") {
    settings[key("_gridGap")] = value;
    return true;
  }

  if (property === "width") {
    settings[key("_width")] = value;
    return true;
  }

  if (property === "min-width") {
    settings[key("_widthMin")] = value;
    return true;
  }

  if (property === "max-width") {
    settings[key("_widthMax")] = value;
    return true;
  }

  if (property === "height") {
    settings[key("_height")] = value;
    return true;
  }

  if (property === "min-height") {
    settings[key("_heightMin")] = value;
    return true;
  }

  if (property === "max-height") {
    settings[key("_heightMax")] = value;
    return true;
  }

  if (property === "position") {
    settings[key("_position")] = value;
    return true;
  }

  if (property === "overflow") {
    settings[key("_overflow")] = value;
    return true;
  }

  if (property === "overflow-x") {
    settings[key("_overflowX")] = value;
    return true;
  }

  if (property === "overflow-y") {
    settings[key("_overflowY")] = value;
    return true;
  }

  if (property === "z-index") {
    settings[key("_zIndex")] = value;
    return true;
  }

  if (property === "inset") {
    mergeObjectSetting(settings, key("_inset"), spacingFromShorthand(value));
    return true;
  }

  const insetSide = property.match(/^(top|right|bottom|left)$/);
  if (insetSide) {
    mergeSpacingSide(settings, key("_inset"), insetSide[1] as "top" | "right" | "bottom" | "left", value);
    return true;
  }

  if (property === "margin") {
    mergeObjectSetting(settings, key("_margin"), spacingFromShorthand(value));
    return true;
  }

  if (property === "padding") {
    mergeObjectSetting(settings, key("_padding"), spacingFromShorthand(value));
    return true;
  }

  const marginSide = property.match(/^margin-(top|right|bottom|left)$/);
  if (marginSide) {
    mergeSpacingSide(settings, key("_margin"), marginSide[1] as "top" | "right" | "bottom" | "left", value);
    return true;
  }

  const paddingSide = property.match(/^padding-(top|right|bottom|left)$/);
  if (paddingSide) {
    mergeSpacingSide(settings, key("_padding"), paddingSide[1] as "top" | "right" | "bottom" | "left", value);
    return true;
  }

  const typographyPropertyMap = new Set([
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "letter-spacing",
    "text-align",
    "text-transform",
    "text-decoration",
    "text-indent",
    "white-space",
    "word-break",
  ]);
  if (typographyPropertyMap.has(property)) {
    mergeObjectSetting(settings, key("_typography"), { [property]: value });
    return true;
  }

  if (property === "color") {
    mergeObjectSetting(settings, key("_typography"), { color: makeColorValue(value) });
    return true;
  }

  if (property === "background-color") {
    mergeObjectSetting(settings, key("_background"), { color: makeColorValue(value) });
    return true;
  }

  if (property === "background-image") {
    const background = parseBackgroundMediaValue(value);
    if (!background) {
      return false;
    }

    mergeObjectSetting(settings, key("_background"), background);
    return true;
  }

  if (property === "background" && isSimpleColorValue(value)) {
    mergeObjectSetting(settings, key("_background"), { color: makeColorValue(value) });
    return true;
  }

  if (property === "background" && !value.includes(",")) {
    const background = parseBackgroundMediaValue(value);
    if (background) {
      mergeObjectSetting(settings, key("_background"), background);
      return true;
    }
  }

  if (property === "background-position") {
    mergeObjectSetting(settings, key("_background"), { position: value });
    return true;
  }

  if (property === "background-size") {
    mergeObjectSetting(settings, key("_background"), { size: value });
    return true;
  }

  if (property === "background-repeat") {
    mergeObjectSetting(settings, key("_background"), { repeat: value });
    return true;
  }

  if (property === "background-attachment") {
    mergeObjectSetting(settings, key("_background"), { attachment: value });
    return true;
  }

  if (property === "background-blend-mode") {
    mergeObjectSetting(settings, key("_background"), { blendMode: value });
    return true;
  }

  if (property === "background-clip") {
    mergeObjectSetting(settings, key("_background"), { clip: value });
    return true;
  }

  if (property === "background-origin") {
    mergeObjectSetting(settings, key("_background"), { origin: value });
    return true;
  }

  if (property === "object-fit") {
    settings[key("_objectFit")] = value;
    return true;
  }

  if (property === "object-position") {
    settings[key("_objectPosition")] = value;
    return true;
  }

  if (property === "border") {
    const border = parseBorderValue(value);
    if (!border) {
      return false;
    }

    mergeBorderSetting(settings, key("_border"), border);
    return true;
  }

  if (property === "border-width") {
    mergeBorderSetting(settings, key("_border"), { width: spacingFromShorthand(value) });
    return true;
  }

  if (property === "border-style") {
    mergeBorderSetting(settings, key("_border"), { style: value });
    return true;
  }

  if (property === "border-color") {
    mergeBorderSetting(settings, key("_border"), { color: makeColorValue(value) });
    return true;
  }

  if (property === "border-radius") {
    mergeBorderSetting(settings, key("_border"), { radius: spacingFromShorthand(value) });
    return true;
  }

  if (property === "box-shadow") {
    settings[key("_boxShadow")] = { values: [value] };
    return true;
  }

  if (property === "opacity") {
    settings[key("_opacity")] = value;
    return true;
  }

  if (property === "transform") {
    settings[key("_transform")] = value;
    return true;
  }

  return false;
}

function countNativeSettings(settings: Record<string, unknown>) {
  return Object.keys(settings).filter((key) =>
    key !== BRICKS_ELEMENT_CUSTOM_CSS_FIELD &&
    key.startsWith("_")
  ).length;
}

function getBemAliases(bemClass: string) {
  const aliases = [bemClass];
  const withoutPrefix = bemClass.replace(/^[a-z][a-z0-9]*-/, "");
  aliases.push(withoutPrefix);

  const [blockPart, elementPart] = withoutPrefix.split("__");
  if (!blockPart || !elementPart) {
    return unique(aliases.filter(Boolean));
  }

  const [role, modifier] = elementPart.split("--");
  aliases.push(`${blockPart}-${role}`);
  aliases.push(`${blockPart}__${role}`);
  aliases.push(role);

  if (modifier) {
    aliases.push(`${blockPart}-${role}--${modifier}`);
    aliases.push(`${blockPart}__${role}--${modifier}`);
    aliases.push(`${role}--${modifier}`);
    aliases.push(modifier);
  }

  return unique(aliases.filter(Boolean));
}

function getClassAliases(target: ElementCssTarget) {
  return unique([...target.sourceClasses, ...getBemAliases(target.bemClass)]);
}

function getLastCompoundSelector(selector: string) {
  return selector
    .trim()
    .split(/\s+|>|\+|~/)
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1) ?? "";
}

function getPseudoSuffix(selector: string) {
  const compound = getLastCompoundSelector(selector);
  const pseudoPattern = /(:{1,2}[a-zA-Z-]+(?:\([^)]*\))?)+$/;
  const pseudoMatch = compound.match(pseudoPattern);

  if (!pseudoMatch) {
    return {
      suffix: "",
      unsupported: false,
    };
  }

  const suffix = pseudoMatch[0];
  const unsupported = /:(?:not|has|is|where|nth-|root\b)/i.test(suffix);

  return {
    suffix,
    unsupported,
  };
}

function getSelectorParts(selector: string) {
  const compound = getLastCompoundSelector(selector);
  const classes: string[] = [];
  const ids: string[] = [];
  let match: RegExpExecArray | null;

  const classPattern = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g;
  while ((match = classPattern.exec(compound)) !== null) {
    classes.push(match[1]);
  }

  const idPattern = /#(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g;
  while ((match = idPattern.exec(compound)) !== null) {
    ids.push(match[1]);
  }

  return {
    classes: unique(classes),
    ids: unique(ids),
    compound,
  };
}

function intersectTargets(groups: Set<ElementCssTarget>[]) {
  if (groups.length === 0) {
    return new Set<ElementCssTarget>();
  }

  return groups.slice(1).reduce((current, group) => {
    return new Set([...current].filter((target) => group.has(target)));
  }, new Set(groups[0]));
}

function resolveSelectorTargets(
  selector: string,
  classMap: Map<string, Set<ElementCssTarget>>,
  idMap: Map<string, Set<ElementCssTarget>>,
) {
  const parts = getSelectorParts(selector);
  const groups: Set<ElementCssTarget>[] = [];
  const missingNames: string[] = [];

  parts.classes.forEach((className) => {
    const matches = classMap.get(className);
    if (matches) {
      groups.push(matches);
    } else {
      missingNames.push(`.${className}`);
    }
  });

  parts.ids.forEach((id) => {
    const matches = idMap.get(id);
    if (matches) {
      groups.push(matches);
    } else {
      missingNames.push(`#${id}`);
    }
  });

  return {
    targets: intersectTargets(groups),
    missingNames,
    hasTargetableSelector: parts.classes.length > 0 || parts.ids.length > 0,
  };
}

function addMapEntry(
  map: Map<string, Set<ElementCssTarget>>,
  key: string | undefined,
  target: ElementCssTarget,
) {
  if (!key) {
    return;
  }

  const existing = map.get(key) ?? new Set<ElementCssTarget>();
  existing.add(target);
  map.set(key, existing);
}

function addClassMapEntry(
  map: Map<string, Set<ClassCssTarget>>,
  key: string | undefined,
  target: ClassCssTarget,
) {
  if (!key) {
    return;
  }

  const existing = map.get(key) ?? new Set<ClassCssTarget>();
  existing.add(target);
  map.set(key, existing);
}

function resolveClassSelectorTargets(
  selector: string,
  classMap: Map<string, Set<ClassCssTarget>>,
  idMap: Map<string, Set<ClassCssTarget>>,
) {
  const parts = getSelectorParts(selector);
  const missingNames: string[] = [];
  const matchedByClass = parts.classes.map((className) => ({
    className,
    matches: classMap.get(className),
  }));
  const matchedById = parts.ids.map((id) => ({
    id,
    matches: idMap.get(id),
  }));

  matchedByClass.forEach((entry) => {
    if (!entry.matches) {
      missingNames.push(`.${entry.className}`);
    }
  });
  matchedById.forEach((entry) => {
    if (!entry.matches) {
      missingNames.push(`#${entry.id}`);
    }
  });

  const classTarget = [...matchedByClass].reverse().find((entry) => entry.matches);
  if (classTarget?.matches) {
    return {
      targets: classTarget.matches,
      missingNames,
      hasTargetableSelector: true,
    };
  }

  const idTarget = matchedById.find((entry) => entry.matches);
  if (idTarget?.matches) {
    return {
      targets: idTarget.matches,
      missingNames,
      hasTargetableSelector: true,
    };
  }

  return {
    targets: new Set<ClassCssTarget>(),
    missingNames,
    hasTargetableSelector: parts.classes.length > 0 || parts.ids.length > 0,
  };
}

function getSelectorClassTokens(selector: string) {
  const tokens: { className: string; index: number }[] = [];
  const classPattern = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g;
  let match: RegExpExecArray | null;

  while ((match = classPattern.exec(selector)) !== null) {
    tokens.push({
      className: match[1],
      index: match.index,
    });
  }

  return tokens;
}

function getPreferredClassTarget(
  className: string,
  classMap: Map<string, Set<ClassCssTarget>>,
) {
  const matches = classMap.get(className);
  if (!matches || matches.size === 0) {
    return null;
  }

  return [...matches].find((target) => target.className === className) ?? [...matches][0];
}

function selectorNeedsScopedFallback(selector: string) {
  const trimmed = selector.trim();
  return trimmed !== getLastCompoundSelector(trimmed) ||
    /[\[\]>+~]|\s+|:(?:has|is|where|not|nth-)/i.test(trimmed);
}

function getOwningClassTarget(
  selector: string,
  classMap: Map<string, Set<ClassCssTarget>>,
) {
  const tokens = getSelectorClassTokens(selector);
  const matchedTargets = tokens
    .map((token) => getPreferredClassTarget(token.className, classMap))
    .filter((target): target is ClassCssTarget => Boolean(target));

  const modifier = matchedTargets.find((target) => target.className.includes("--"));
  if (modifier) {
    return modifier;
  }

  return matchedTargets[0] ?? null;
}

function normalizeCssSearchText(value: string) {
  return stripCssComments(value)
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>+~])\s*/g, "$1")
    .trim();
}

function collectConservationDeclarations(
  css: string,
  contexts: string[] = [],
): Array<{
  selector: string;
  declaration: string;
  contexts: string[];
  classification: "class-owned" | "page-level" | "unsupported";
}> {
  const records: Array<{
    selector: string;
    declaration: string;
    contexts: string[];
    classification: "class-owned" | "page-level" | "unsupported";
  }> = [];

  parseTopLevelBlocks(css).forEach((block) => {
    if (/^@(?:media|container|supports)\b/i.test(block.selector)) {
      records.push(...collectConservationDeclarations(block.body, [...contexts, block.selector]));
      return;
    }

    if (/^@(?:-\w+-)?keyframes\b/i.test(block.selector)) {
      records.push({
        selector: block.selector,
        declaration: block.body.trim(),
        contexts,
        classification: "page-level",
      });
      return;
    }

    const declarations = parseDeclarations(block.body).map(formatDeclaration);
    if (declarations.length === 0) {
      return;
    }

    if (
      block.selector === ":root" ||
      /^@(?:font-face|property|import|layer|page|charset)\b/i.test(block.selector)
    ) {
      // Page/global CSS routed to the reusable Jigma Page Styles element.
      declarations.forEach((declaration) => {
        records.push({
          selector: block.selector,
          declaration,
          contexts,
          classification: "page-level",
        });
      });
      return;
    }

    if (/^@/.test(block.selector)) {
      declarations.forEach((declaration) => {
        records.push({
          selector: block.selector,
          declaration,
          contexts,
          classification: "unsupported",
        });
      });
      return;
    }

    block.selector.split(",").forEach((selector) => {
      const trimmedSelector = selector.trim();
      if (!trimmedSelector) {
        return;
      }

      declarations.forEach((declaration) => {
        records.push({
          selector: trimmedSelector,
          declaration,
          contexts,
          classification: "class-owned",
        });
      });
    });
  });

  return records;
}

function outputContainsDeclaration(
  outputCss: string,
  selector: string,
  declaration: string,
  contexts: string[],
) {
  const normalizedOutput = normalizeCssSearchText(outputCss);
  const normalizedSelector = normalizeCssSearchText(selector);
  const normalizedDeclaration = normalizeCssSearchText(declaration);
  const selectorNeedle = `${normalizedSelector}{`;
  let selectorIndex = normalizedOutput.indexOf(selectorNeedle);

  while (selectorIndex !== -1) {
    const declarationIndex = normalizedOutput.indexOf(normalizedDeclaration, selectorIndex + selectorNeedle.length);
    const nextSelectorIndex = normalizedOutput.indexOf("{", selectorIndex + selectorNeedle.length);
    const declarationBelongsToSelector = declarationIndex !== -1 &&
      (nextSelectorIndex === -1 || declarationIndex < nextSelectorIndex);
    const contextMatches = contexts.every((context) => {
      const contextIndex = normalizedOutput.lastIndexOf(normalizeCssSearchText(context), selectorIndex);
      return contextIndex !== -1;
    });

    if (declarationBelongsToSelector && contextMatches) {
      return true;
    }

    selectorIndex = normalizedOutput.indexOf(selectorNeedle, selectorIndex + selectorNeedle.length);
  }

  return false;
}

export function auditCssDeclarationConservation(
  sourceCss: string,
  outputCss: string,
): CssDeclarationConservationResult {
  const records = collectConservationDeclarations(sourceCss);
  let preservedDeclarationCount = 0;
  let pageLevelDeclarationCount = 0;
  let unsupportedDeclarationCount = 0;
  const missingDeclarations: string[] = [];

  records.forEach((record) => {
    if (record.classification === "page-level") {
      pageLevelDeclarationCount += 1;
      return;
    }

    if (
      record.classification === "class-owned" &&
      outputContainsDeclaration(outputCss, record.selector, record.declaration, record.contexts)
    ) {
      preservedDeclarationCount += 1;
      return;
    }

    unsupportedDeclarationCount += 1;
    missingDeclarations.push([
      ...record.contexts,
      record.selector,
      record.declaration,
    ].join(" | "));
  });

  const accountedCount = preservedDeclarationCount + pageLevelDeclarationCount;
  const coveragePercentage = records.length > 0
    ? Math.round((accountedCount / records.length) * 100)
    : 100;

  return {
    sourceDeclarationCount: records.length,
    preservedDeclarationCount,
    pageLevelDeclarationCount,
    unsupportedDeclarationCount,
    missingDeclarations,
    coveragePercentage,
    valid: unsupportedDeclarationCount === 0,
  };
}

function mapSelectorToGeneratedBem(
  selector: string,
  owner: ClassCssTarget,
  classMap: Map<string, Set<ClassCssTarget>>,
) {
  let ownerReplaced = false;
  const mappedSelector = selector.replace(
    /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g,
    (match, className: string) => {
      const target = getPreferredClassTarget(className, classMap);
      if (!target) {
        return match;
      }

      if (!ownerReplaced && target.className === owner.className) {
        ownerReplaced = true;
        return "%root%";
      }

      return `.${target.className}`;
    },
  );

  return ownerReplaced ? mappedSelector : `%root% ${mappedSelector}`;
}

function mapSelectorToLiteralBem(
  selector: string,
  classMap: Map<string, Set<ClassCssTarget>>,
  idMap: Map<string, Set<ClassCssTarget>>,
) {
  let unresolved = false;
  const mappedSelector = selector
    .replace(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g, (match, className: string) => {
      const target = getPreferredClassTarget(className, classMap);
      if (!target) {
        unresolved = true;
        return match;
      }

      return `.${target.className}`;
    })
    .replace(/#(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g, (match, id: string) => {
      const matches = idMap.get(id);
      const target = matches && matches.size > 0 ? [...matches][0] : null;
      if (!target) {
        unresolved = true;
        return match;
      }

      return `.${target.className}`;
    });

  return unresolved ? null : mappedSelector;
}

function scopedSelectorSuffix(scopedSelector: string) {
  return scopedSelector.startsWith("%root%")
    ? scopedSelector.slice("%root%".length)
    : ` ${scopedSelector}`;
}

function formatRawAtRule(selector: string, body: string) {
  return `${selector} {\n${indent(body.trim(), 2)}\n}`;
}

function formatCssBucket(
  bucket: ElementCssBucket | ClassCssBucket,
  minify?: boolean,
) {
  const snippets: string[] = [];

  bucket.root.forEach((declarationList, rootSuffix) => {
    snippets.push(formatRootDeclarations(
      declarationList.join("\n"),
      rootSuffix,
      minify,
    ));
  });

  bucket.media.forEach((mediaBucket, mediaSelector) => {
    mediaBucket.forEach((declarationList, rootSuffix) => {
      snippets.push(formatMediaDeclarations(
        mediaSelector,
        declarationList.join("\n"),
        rootSuffix,
        minify,
      ));
    });
  });

  bucket.raw.forEach((rawCss) => {
    if (rawCss.trim()) {
      snippets.push(rawCss.trim());
    }
  });

  return snippets.join("\n\n");
}

export function attachCssToElements(
  css: string,
  targets: ElementCssTarget[],
  options: ElementCssOptions = {},
): ElementCssResult {
  const warnings: ConversionWarning[] = [];
  const classMap = new Map<string, Set<ElementCssTarget>>();
  const idMap = new Map<string, Set<ElementCssTarget>>();
  const attachmentBuckets = new Map<ElementCssTarget, ElementCssBucket>();
  let attachedRuleCount = 0;
  let unmappedRuleCount = 0;
  let pseudoSelectorCount = 0;
  let customCssFallbackCount = 0;
  let responsiveRuleCount = 0;
  let pseudoRuleCount = 0;

  targets.forEach((target) => {
    getClassAliases(target).forEach((className) => addMapEntry(classMap, className, target));
    addMapEntry(idMap, target.sourceId, target);
  });

  const addDeclarations = (
    target: ElementCssTarget,
    declarations: string,
    rootSuffix: string,
    mediaSelector?: string,
  ) => {
    const bucket = attachmentBuckets.get(target) ?? {
      root: new Map<string, string[]>(),
      media: new Map<string, Map<string, string[]>>(),
      raw: [],
    };

    if (mediaSelector) {
      const mediaBucket = bucket.media.get(mediaSelector) ?? new Map<string, string[]>();
      mediaBucket.set(rootSuffix, [...(mediaBucket.get(rootSuffix) ?? []), declarations]);
      bucket.media.set(mediaSelector, mediaBucket);
    } else {
      bucket.root.set(rootSuffix, [...(bucket.root.get(rootSuffix) ?? []), declarations]);
    }

    attachmentBuckets.set(target, bucket);
  };

  const processBlocks = (inputCss: string, mediaSelector?: string) => {
    const blocks = parseTopLevelBlocks(inputCss);

    blocks.forEach((block) => {
      if (/^@media\b/i.test(block.selector)) {
        processBlocks(block.body, block.selector);
        responsiveRuleCount += 1;
        pushWarning(
          warnings,
          `CSS media query "${block.selector}" was attached to matching elements using element custom CSS.`,
          "info",
        );
        return;
      }

      if (/^@/.test(block.selector) || block.selector === ":root") {
        unmappedRuleCount += 1;
        pushWarning(warnings, `Dropped unsupported CSS block "${block.selector}" for element-level export.`);
        return;
      }

      const declarations = formatDeclarations(block.body);
      if (!declarations) {
        return;
      }

      block.selector.split(",").forEach((rawSelector) => {
        const selector = rawSelector.trim();
        if (!selector) {
          return;
        }

        if (selector.includes("[") || selector.includes("]")) {
          unmappedRuleCount += 1;
          pushWarning(warnings, `Dropped unsupported selector "${selector}"; it could not be attached to a single exported element.`);
          return;
        }

        const pseudo = getPseudoSuffix(selector);
        if (pseudo.unsupported) {
          pseudoSelectorCount += 1;
          pushWarning(warnings, `Dropped pseudo selector "${selector}"; it could not be safely attached to a single Bricks element.`);
          return;
        }
        if (pseudo.suffix) {
          pseudoRuleCount += 1;
        }

        const resolved = resolveSelectorTargets(selector, classMap, idMap);
        if (!resolved.hasTargetableSelector) {
          unmappedRuleCount += 1;
          pushWarning(warnings, `Dropped unsupported selector "${selector}"; it could not be mapped to generated BEM element styles.`);
          return;
        }

        if (resolved.missingNames.length > 0 || resolved.targets.size === 0) {
          unmappedRuleCount += 1;
          pushWarning(
            warnings,
            `Dropped selector "${selector}" because it references classes or IDs not present in exported layers.`,
          );
          return;
        }

        resolved.targets.forEach((target) => {
          addDeclarations(target, declarations, pseudo.suffix, mediaSelector);
        });
        attachedRuleCount += resolved.targets.size;
      });
    });

    if (!mediaSelector && blocks.length === 0 && inputCss.trim()) {
      unmappedRuleCount += 1;
      pushWarning(warnings, "CSS could not be parsed into rules and was not attached.");
    }
  };

  processBlocks(css);

  attachmentBuckets.forEach((bucket, target) => {
    const css = formatCssBucket(bucket, options.minify);

    if (css) {
      attachElementCss(target.element, css);
      customCssFallbackCount += 1;
    }
  });

  return {
    warnings,
    attachedRuleCount,
    unmappedRuleCount,
    pseudoSelectorCount,
    nativeStyleMappedCount: 0,
    customCssFallbackCount,
    blockScopedFallbackCount: 0,
    literalFallbackRuleCount: 0,
    responsiveRuleCount,
    pseudoRuleCount,
    unresolvedSelectorCount: unmappedRuleCount,
    styledClassIds: new Set(),
    fallbackStrategy: "none",
  };
}

export function attachCssToGlobalClasses(
  css: string,
  targets: ClassCssTarget[],
  options: ElementCssOptions = {},
): ElementCssResult {
  const warnings: ConversionWarning[] = [];
  const classMap = new Map<string, Set<ClassCssTarget>>();
  const idMap = new Map<string, Set<ClassCssTarget>>();
  const attachmentBuckets = new Map<ClassCssTarget, ClassCssBucket>();
  const literalFallbackBuckets = new Map<ClassCssTarget, string[]>();
  const literalFallbackKeys = new Set<string>();
  const fallbackRuleCountByClassName = new Map<string, number>();
  const classFallbackStrategy = options.classFallbackStrategy ?? "literal-bem";
  let attachedRuleCount = 0;
  let unmappedRuleCount = 0;
  let pseudoSelectorCount = 0;
  let nativeStyleMappedCount = 0;
  let customCssFallbackCount = 0;
  let blockScopedFallbackCount = 0;
  let literalFallbackRuleCount = 0;
  let responsiveRuleCount = 0;
  let pseudoRuleCount = 0;
  const keyframesByName = new Map<string, string>();
  const styledClassIds = new Set<string>();

  targets.forEach((target) => {
    unique([...target.sourceClasses, target.className]).forEach((className) =>
      addClassMapEntry(classMap, className, target)
    );
    addClassMapEntry(idMap, target.sourceId, target);
  });

  const rootTarget = targets.find((target) => !target.className.includes("__")) ?? targets[0];

  const addDeclarations = (
    target: ClassCssTarget,
    declarations: string,
    rootSuffix: string,
    mediaSelector?: string,
  ) => {
    const bucket = attachmentBuckets.get(target) ?? {
      root: new Map<string, string[]>(),
      media: new Map<string, Map<string, string[]>>(),
      raw: [],
    };

    if (mediaSelector) {
      const mediaBucket = bucket.media.get(mediaSelector) ?? new Map<string, string[]>();
      mediaBucket.set(rootSuffix, [...(mediaBucket.get(rootSuffix) ?? []), declarations]);
      bucket.media.set(mediaSelector, mediaBucket);
    } else {
      bucket.root.set(rootSuffix, [...(bucket.root.get(rootSuffix) ?? []), declarations]);
    }

    attachmentBuckets.set(target, bucket);
  };

  const incrementFallbackRuleCount = (target: ClassCssTarget) => {
    fallbackRuleCountByClassName.set(
      target.className,
      (fallbackRuleCountByClassName.get(target.className) ?? 0) + 1,
    );
    literalFallbackRuleCount += 1;
  };

  const addLiteralFallback = (
    target: ClassCssTarget,
    selector: string,
    declarations: string,
    mediaSelector?: string,
  ) => {
    const cssBlock = mediaSelector
      ? formatLiteralAtRule(mediaSelector, selector, declarations, options.minify)
      : formatLiteralDeclarations(selector, declarations, options.minify);
    const key = `${mediaSelector ?? ""}\n${selector}\n${declarations}`;

    if (literalFallbackKeys.has(key)) {
      return;
    }

    literalFallbackKeys.add(key);
    literalFallbackBuckets.set(target, [...(literalFallbackBuckets.get(target) ?? []), cssBlock]);
    incrementFallbackRuleCount(target);
  };

  const addLiteralRawFallback = (
    target: ClassCssTarget,
    rawCss: string,
  ) => {
    const key = `raw\n${rawCss.trim()}`;
    if (literalFallbackKeys.has(key)) {
      return;
    }

    literalFallbackKeys.add(key);
    literalFallbackBuckets.set(target, [...(literalFallbackBuckets.get(target) ?? []), rawCss.trim()]);
    incrementFallbackRuleCount(target);
  };

  const addClassFallback = (
    target: ClassCssTarget,
    declarations: string,
    rootSuffix: string,
    mediaSelector?: string,
    literalSelector?: string,
  ) => {
    if (classFallbackStrategy === "bricks-class-root") {
      addDeclarations(target, declarations, rootSuffix, mediaSelector);
      return;
    }

    addLiteralFallback(
      target,
      literalSelector ?? `.${target.className}${rootSuffix}`,
      declarations,
      mediaSelector,
    );
  };

  const addRawCss = (
    target: ClassCssTarget,
    rawCss: string,
  ) => {
    if (classFallbackStrategy === "literal-bem") {
      addLiteralRawFallback(target, rawCss);
      return;
    }

    const bucket = attachmentBuckets.get(target) ?? {
      root: new Map<string, string[]>(),
      media: new Map<string, Map<string, string[]>>(),
      raw: [],
    };

    if (!bucket.raw.includes(rawCss)) {
      bucket.raw.push(rawCss);
    }

    attachmentBuckets.set(target, bucket);
  };

  const processBlocks = (inputCss: string, mediaSelector?: string) => {
    const blocks = parseTopLevelBlocks(inputCss);

    blocks.forEach((block) => {
      if (/^@media\b/i.test(block.selector)) {
        responsiveRuleCount += 1;
        processBlocks(block.body, block.selector);
        return;
      }

      if (/^@(?:container|supports)\b/i.test(block.selector)) {
        processBlocks(block.body, block.selector);
        return;
      }

      if (/^@(?:-\w+-)?keyframes\b/i.test(block.selector)) {
        const name = block.selector.replace(/^@(?:-\w+-)?keyframes\s+/i, "").trim();
        const rawCss = formatRawAtRule(block.selector, block.body);
        if (keyframesByName.has(name) && keyframesByName.get(name) !== rawCss) {
          pushWarning(
            warnings,
            `Keyframes "${name}" has conflicting definitions. The first definition was preserved on ${rootTarget?.className ?? "the root class"}.`,
          );
          return;
        }

        if (!keyframesByName.has(name) && rootTarget) {
          keyframesByName.set(name, rawCss);
          addRawCss(rootTarget, rawCss);
          styledClassIds.add(rootTarget.globalClass.id);
          customCssFallbackCount += 1;
          blockScopedFallbackCount += 1;
          pushWarning(
            warnings,
            `Keyframes "${name}" were preserved once in class-owned fallback CSS for ${rootTarget.className}.`,
            "info",
          );
        }
        return;
      }

      if (/^@font-face\b/i.test(block.selector)) {
        unmappedRuleCount += 1;
        pushWarning(
          warnings,
          "@font-face was detected and listed as a font dependency instead of being duplicated into Bricks class CSS.",
          "info",
        );
        return;
      }

      if (block.selector === ":root") {
        unmappedRuleCount += 1;
        pushWarning(warnings, "CSS :root variables were detected. Variable references are preserved, but variable import is not implemented yet.", "info");
        return;
      }

      if (/^@/.test(block.selector)) {
        if (rootTarget) {
          addRawCss(rootTarget, formatRawAtRule(block.selector, block.body));
          styledClassIds.add(rootTarget.globalClass.id);
          customCssFallbackCount += 1;
          blockScopedFallbackCount += 1;
          pushWarning(
            warnings,
            `Unsupported at-rule "${block.selector}" was preserved in class-owned fallback CSS for ${rootTarget.className}; fidelity may differ.`,
          );
        } else {
          unmappedRuleCount += 1;
          pushWarning(warnings, `Unsupported at-rule "${block.selector}" could not be attached because no owning class exists.`);
        }
        return;
      }

      const declarations = parseDeclarations(block.body);
      if (declarations.length === 0) {
        return;
      }

      block.selector.split(",").forEach((rawSelector) => {
        const selector = rawSelector.trim();
        if (!selector) {
          return;
        }

        const pseudo = getPseudoSuffix(selector);
        if (pseudo.suffix) {
          pseudoSelectorCount += 1;
          pseudoRuleCount += 1;
        }

        if (options.literalOnly) {
          const owner = getOwningClassTarget(selector, classMap);
          const tokens = getSelectorClassTokens(selector);
          const missingTokens = tokens.filter((token) => !getPreferredClassTarget(token.className, classMap));
          if (!owner || missingTokens.length > 0) {
            unmappedRuleCount += 1;
            pushWarning(
              warnings,
              `Selector "${selector}" could not be assigned to a preserved Bricks class. Missing: ${missingTokens.map((token) => `.${token.className}`).join(", ") || "owning class"}.`,
            );
            return;
          }

          addLiteralFallback(
            owner,
            selector,
            declarations.map(formatDeclaration).join("\n"),
            mediaSelector,
          );
          customCssFallbackCount += declarations.length;
          styledClassIds.add(owner.globalClass.id);
          attachedRuleCount += 1;
          return;
        }

        if (selectorNeedsScopedFallback(selector) || pseudo.unsupported) {
          const owner = getOwningClassTarget(selector, classMap);
          const tokens = getSelectorClassTokens(selector);
          const missingTokens = tokens.filter((token) => !getPreferredClassTarget(token.className, classMap));
          if (!owner || missingTokens.length > 0) {
            unmappedRuleCount += 1;
            pushWarning(
              warnings,
              `Selector "${selector}" could not be safely mapped to generated classes. Missing: ${missingTokens.map((token) => `.${token.className}`).join(", ") || "owning class"}.`,
            );
            return;
          }

          const scopedSelector = mapSelectorToGeneratedBem(selector, owner, classMap);
          const literalSelector = mapSelectorToLiteralBem(selector, classMap, idMap);
          if (!literalSelector) {
            unmappedRuleCount += 1;
            pushWarning(
              warnings,
              `Selector "${selector}" could not be rewritten to generated BEM fallback CSS.`,
            );
            return;
          }

          addClassFallback(
            owner,
            declarations.map(formatDeclaration).join("\n"),
            scopedSelectorSuffix(scopedSelector),
            mediaSelector,
            literalSelector,
          );
          customCssFallbackCount += declarations.length;
          blockScopedFallbackCount += 1;
          styledClassIds.add(owner.globalClass.id);
          attachedRuleCount += 1;
          pushWarning(
            warnings,
            `"${selector}" was scoped to the "${owner.className}" class using "${scopedSelector}".`,
            "info",
          );
          return;
        }

        const resolved = resolveClassSelectorTargets(selector, classMap, idMap);
        if (!resolved.hasTargetableSelector) {
          unmappedRuleCount += 1;
          pushWarning(warnings, `Selector "${selector}" could not be mapped to a generated Bricks class.`);
          return;
        }

        if (resolved.missingNames.length > 0 || resolved.targets.size === 0) {
          unmappedRuleCount += 1;
          pushWarning(
            warnings,
            `Selector "${selector}" references classes or IDs not present in exported layers: ${resolved.missingNames.join(", ")}.`,
          );
          return;
        }

        resolved.targets.forEach((target) => {
          const breakpoint = getBreakpointFromMedia(mediaSelector);
          const state = getStateFromPseudo(pseudo.suffix);
          const canMapNatively = (!mediaSelector || Boolean(breakpoint)) &&
            (!pseudo.suffix || Boolean(state));
          const fallbackDeclarations: CssDeclaration[] = [];

          declarations.forEach((declaration) => {
            const mapped = canMapNatively &&
              applyNativeSetting(target.globalClass.settings, declaration, breakpoint, state);
            if (mapped) {
              nativeStyleMappedCount += 1;
              return;
            }

            fallbackDeclarations.push(declaration);
          });

          if (fallbackDeclarations.length > 0) {
            const literalSelector = mapSelectorToLiteralBem(selector, classMap, idMap);
            if (!literalSelector) {
              unmappedRuleCount += 1;
              pushWarning(
                warnings,
                `Selector "${selector}" could not be rewritten to generated BEM fallback CSS.`,
              );
              return;
            }

            addClassFallback(
              target,
              fallbackDeclarations.map(formatDeclaration).join("\n"),
              pseudo.suffix,
              mediaSelector,
              literalSelector,
            );
            customCssFallbackCount += fallbackDeclarations.length;
            fallbackDeclarations.forEach((declaration) => {
              pushWarning(
                warnings,
                `"${declaration.property}" from "${selector}" was preserved in class-owned fallback CSS for "${target.className}".`,
                "info",
              );
            });
          }

          styledClassIds.add(target.globalClass.id);
        });
        attachedRuleCount += resolved.targets.size;
      });
    });

    if (!mediaSelector && blocks.length === 0 && inputCss.trim()) {
      unmappedRuleCount += 1;
      pushWarning(warnings, "CSS could not be parsed into rules and was not attached.");
    }
  };

  processBlocks(css);

  attachmentBuckets.forEach((bucket, target) => {
    const cssValue = formatCssBucket(bucket, options.minify);
    if (cssValue) {
      target.globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] = cssValue;
    }
  });

  literalFallbackBuckets.forEach((blocks, target) => {
    const existing = typeof target.globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] === "string"
      ? `${target.globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD]}`.trim()
      : "";
    const cssValue = blocks.join("\n\n");
    target.globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] = existing
      ? `${existing}\n\n${cssValue}`
      : cssValue;
  });

  return {
    warnings,
    attachedRuleCount,
    unmappedRuleCount,
    pseudoSelectorCount,
    nativeStyleMappedCount,
    customCssFallbackCount,
    blockScopedFallbackCount,
    literalFallbackRuleCount,
    responsiveRuleCount,
    pseudoRuleCount,
    unresolvedSelectorCount: unmappedRuleCount,
    styledClassIds,
    fallbackCss: "",
    fallbackStrategy: classFallbackStrategy === "literal-bem" && literalFallbackBuckets.size > 0
      ? "literal-bem"
      : classFallbackStrategy === "bricks-class-root" && attachmentBuckets.size > 0
      ? "bricks-class-root"
      : "none",
    fallbackRuleCountByClassName,
  };
}

function buildTargetMaps(targets: ClassCssTarget[]) {
  const classMap = new Map<string, Set<ClassCssTarget>>();
  const idMap = new Map<string, Set<ClassCssTarget>>();
  targets.forEach((target) => {
    unique([...target.sourceClasses, target.className]).forEach((className) =>
      addClassMapEntry(classMap, className, target)
    );
    addClassMapEntry(idMap, target.sourceId, target);
  });
  return { classMap, idMap };
}

function pickRootTarget(targets: ClassCssTarget[]) {
  return targets.find((target) => !target.className.includes("__")) ?? targets[0];
}

function emptyElementCssResult(warnings: ConversionWarning[]): ElementCssResult {
  return {
    warnings,
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
}

// Root/component placement (Mode A). Preserves the full component CSS on the root
// component class for maximum visual parity: selectors are rewritten to the generated
// Bricks class names where they map, and kept verbatim otherwise. Descendant selectors,
// pseudo selectors and media queries stay in their original context (no splitting).
export function attachCssToRootClass(
  css: string,
  targets: ClassCssTarget[],
  options: ElementCssOptions = {},
): ElementCssResult {
  const warnings: ConversionWarning[] = [];
  const result = emptyElementCssResult(warnings);
  const rootTarget = targets.length > 0 ? pickRootTarget(targets) : null;
  if (!css.trim() || !rootTarget) {
    return result;
  }

  const { classMap, idMap } = buildTargetMaps(targets);
  let attachedRuleCount = 0;
  let responsiveRuleCount = 0;
  let pseudoRuleCount = 0;

  const rewriteBlocks = (inputCss: string): string[] => {
    const out: string[] = [];
    parseTopLevelBlocks(inputCss).forEach((block) => {
      if (/^@(?:media|container|supports)\b/i.test(block.selector)) {
        const inner = rewriteBlocks(block.body);
        if (inner.length === 0) {
          return;
        }
        responsiveRuleCount += 1;
        out.push(
          options.minify
            ? `${block.selector}{${inner.join("")}}`
            : `${block.selector} {\n${indent(inner.join("\n\n"), 2)}\n}`,
        );
        return;
      }

      if (/^@/.test(block.selector)) {
        out.push(formatRawAtRule(block.selector, block.body));
        attachedRuleCount += 1;
        return;
      }

      const declarations = parseDeclarations(block.body);
      if (declarations.length === 0) {
        return;
      }
      const declText = declarations.map(formatDeclaration).join("\n");

      const rewrittenSelector = block.selector
        .split(",")
        .map((raw) => {
          const selector = raw.trim();
          if (!selector) {
            return "";
          }
          if (/:{1,2}[a-z-]/i.test(selector)) {
            pseudoRuleCount += 1;
          }
          // Best-effort fidelity: keep the original selector when it cannot be mapped
          // to a generated class so nothing is dropped.
          return mapSelectorToLiteralBem(selector, classMap, idMap) ?? selector;
        })
        .filter(Boolean)
        .join(", ");

      if (!rewrittenSelector) {
        return;
      }
      attachedRuleCount += 1;
      out.push(
        options.minify
          ? `${rewrittenSelector}{${minifyDeclarations(declText)}}`
          : `${rewrittenSelector} {\n${indent(declText, 2)}\n}`,
      );
    });
    return out;
  };

  const snippets = rewriteBlocks(css);
  if (snippets.length > 0) {
    const existing = typeof rootTarget.globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] === "string"
      ? `${rootTarget.globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD]}`.trim()
      : "";
    const cssValue = snippets.join("\n\n");
    rootTarget.globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] = existing
      ? `${existing}\n\n${cssValue}`
      : cssValue;
    result.styledClassIds.add(rootTarget.globalClass.id);
  }

  result.attachedRuleCount = attachedRuleCount;
  result.customCssFallbackCount = attachedRuleCount;
  result.literalFallbackRuleCount = attachedRuleCount;
  result.responsiveRuleCount = responsiveRuleCount;
  result.pseudoRuleCount = pseudoRuleCount;
  result.fallbackStrategy = "literal-bem";
  return result;
}

// Class-first split for the auto mode. A block goes to the class stream only when every
// comma selector is a single, simple class selector that maps to a generated class
// (priority 1). Anything that cannot be split without changing cascade/descendant
// behaviour - descendant combinators, pseudo selectors, media queries, at-rules, ids,
// or unmapped classes - goes to the root/component stream (priority 2).
export function splitClassFirstCss(
  css: string,
  targets: ClassCssTarget[],
): { classCss: string; rootCss: string } {
  if (!css.trim() || targets.length === 0) {
    return { classCss: "", rootCss: css.trim() };
  }

  const { classMap } = buildTargetMaps(targets);
  const classBlocks: string[] = [];
  const rootBlocks: string[] = [];

  const isSimpleMappedClass = (selector: string) => {
    const trimmed = selector.trim();
    if (!/^\.[-_a-zA-Z][-_a-zA-Z0-9-]*$/.test(trimmed)) {
      return false;
    }
    return Boolean(getPreferredClassTarget(trimmed.slice(1), classMap));
  };

  const blockIsClassFirst = (block: CssBlock): boolean => {
    if (/^@/.test(block.selector)) {
      return false;
    }
    return block.selector
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean)
      .every(isSimpleMappedClass);
  };

  parseTopLevelBlocks(css).forEach((block) => {
    const text = `${block.selector} {\n${block.body}\n}`;
    if (blockIsClassFirst(block)) {
      classBlocks.push(text);
    } else {
      rootBlocks.push(text);
    }
  });

  return {
    classCss: classBlocks.join("\n\n"),
    rootCss: rootBlocks.join("\n\n"),
  };
}

// Rewrites component CSS selectors to the generated Bricks class names (keeping unmapped
// selectors verbatim) and returns it as a CSS string. Used by the page-stylesheet mode so
// the routed CSS still targets the rendered generated classes.
function rewriteComponentCss(
  inputCss: string,
  classMap: Map<string, Set<ClassCssTarget>>,
  idMap: Map<string, Set<ClassCssTarget>>,
  minify = false,
): string {
  const out: string[] = [];
  parseTopLevelBlocks(inputCss).forEach((block) => {
    if (/^@(?:media|container|supports)\b/i.test(block.selector)) {
      const inner = rewriteComponentCss(block.body, classMap, idMap, minify);
      if (!inner.trim()) {
        return;
      }
      out.push(minify ? `${block.selector}{${inner}}` : `${block.selector} {\n${indent(inner, 2)}\n}`);
      return;
    }
    if (/^@/.test(block.selector)) {
      out.push(formatRawAtRule(block.selector, block.body));
      return;
    }

    const declarations = parseDeclarations(block.body);
    if (declarations.length === 0) {
      return;
    }
    const declText = declarations.map(formatDeclaration).join("\n");
    const rewrittenSelector = block.selector
      .split(",")
      .map((raw) => {
        const selector = raw.trim();
        if (!selector) {
          return "";
        }
        return mapSelectorToLiteralBem(selector, classMap, idMap) ?? selector;
      })
      .filter(Boolean)
      .join(", ");
    if (!rewrittenSelector) {
      return;
    }
    out.push(
      minify
        ? `${rewrittenSelector}{${minifyDeclarations(declText)}}`
        : `${rewrittenSelector} {\n${indent(declText, 2)}\n}`,
    );
  });
  return out.join("\n\n");
}

export function componentCssToGeneratedSelectors(
  css: string,
  targets: ClassCssTarget[],
  minify = false,
): string {
  if (!css.trim() || targets.length === 0) {
    return css.trim();
  }
  const { classMap, idMap } = buildTargetMaps(targets);
  return rewriteComponentCss(css, classMap, idMap, minify);
}
