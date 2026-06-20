import type { BricksElement, ConversionWarning } from "../../types/jigma.ts";

export const BRICKS_ELEMENT_CUSTOM_CSS_FIELD = "_cssCustom";

export interface ElementCssTarget {
  element: BricksElement;
  bemClass: string;
  sourceClasses: string[];
  sourceId?: string;
}

export interface ElementCssResult {
  warnings: ConversionWarning[];
  attachedRuleCount: number;
  unmappedRuleCount: number;
  pseudoSelectorCount: number;
}

export interface ElementCssOptions {
  minify?: boolean;
}

interface CssBlock {
  selector: string;
  body: string;
}

interface ElementCssBucket {
  root: Map<string, string[]>;
  media: Map<string, Map<string, string[]>>;
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
  const blocks: CssBlock[] = [];
  let index = 0;

  while (index < css.length) {
    const openIndex = css.indexOf("{", index);
    if (openIndex === -1) {
      break;
    }

    const closeIndex = findMatchingBrace(css, openIndex);
    if (closeIndex === -1) {
      blocks.push({
        selector: css.slice(index, openIndex).trim(),
        body: css.slice(openIndex + 1).trim(),
      });
      break;
    }

    blocks.push({
      selector: css.slice(index, openIndex).trim(),
      body: css.slice(openIndex + 1, closeIndex).trim(),
    });
    index = closeIndex + 1;
  }

  return blocks.filter((block) => block.selector && block.body);
}

function formatDeclarations(body: string) {
  return body
    .split(";")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.endsWith(";") ? line : `${line};`)
    .join("\n");
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

function getExistingElementCss(element: BricksElement) {
  const value = element.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD];
  return typeof value === "string" ? value.trim() : "";
}

export function attachElementCss(element: BricksElement, css: string) {
  const existing = getExistingElementCss(element);
  const nextCss = existing ? `${existing}\n\n${css}` : css;

  element.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] = nextCss;
  element.settings._jigmaElementCss = nextCss;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
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
    const snippets: string[] = [];

    bucket.root.forEach((declarationList, rootSuffix) => {
      snippets.push(formatRootDeclarations(
        declarationList.join("\n"),
        rootSuffix,
        options.minify,
      ));
    });

    bucket.media.forEach((mediaBucket, mediaSelector) => {
      mediaBucket.forEach((declarationList, rootSuffix) => {
        snippets.push(formatMediaDeclarations(
          mediaSelector,
          declarationList.join("\n"),
          rootSuffix,
          options.minify,
        ));
      });
    });

    if (snippets.length > 0) {
      attachElementCss(target.element, snippets.join("\n\n"));
    }
  });

  return {
    warnings,
    attachedRuleCount,
    unmappedRuleCount,
    pseudoSelectorCount,
  };
}
