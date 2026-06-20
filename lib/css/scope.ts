import type { ConversionWarning } from "../../types/jigma.ts";

export interface CssSelectorScopeMap {
  classes: Map<string, string[]>;
  ids: Map<string, string>;
}

export interface ScopedCssResult {
  css: string;
  warnings: ConversionWarning[];
  scopedRuleCount: number;
  unmappedRuleCount: number;
  unusedSelectorCount: number;
  pseudoSelectorCount: number;
}

interface CssBlock {
  selector: string;
  body: string;
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

function formatRule(selector: string, body: string) {
  const declarations = body
    .split(";")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `  ${line.endsWith(";") ? line : `${line};`}`)
    .join("\n");

  return `${selector} {\n${declarations}\n}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expandReplacement(
  selectors: string[],
  pattern: RegExp,
  sigil: "." | "#",
  lookup: (name: string) => string[] | undefined,
  usedNames: Set<string>,
  missingNames: Set<string>,
) {
  let expanded = selectors;
  const names = new Set<string>();
  let match: RegExpExecArray | null;

  pattern.lastIndex = 0;
  while ((match = pattern.exec(selectors[0] ?? "")) !== null) {
    names.add(match[1]);
  }

  names.forEach((name) => {
    const replacements = lookup(name);
    if (!replacements || replacements.length === 0) {
      missingNames.add(name);
      return;
    }

    usedNames.add(name);
    const tokenPattern = new RegExp(
      `${sigil === "." ? "\\." : "#"}${escapeRegExp(name)}(?![_a-zA-Z0-9-])`,
      "g",
    );
    expanded = expanded.flatMap((selector) =>
      replacements.map((replacement) =>
        selector.replace(tokenPattern, `.${replacement}`)
      )
    );
  });

  return expanded;
}

function scopeSelector(
  selector: string,
  scopeMap: CssSelectorScopeMap,
  usedClassNames: Set<string>,
  usedIds: Set<string>,
) {
  const trimmed = selector.trim();
  const missingNames = new Set<string>();

  if (!trimmed || trimmed.includes("[") || trimmed.includes("]")) {
    return { selectors: [], missingNames, unsupported: true, pseudo: false };
  }

  if (/:{1,2}(?!root\b)[a-zA-Z-]+/.test(trimmed)) {
    return { selectors: [], missingNames, unsupported: true, pseudo: true };
  }

  if (!/[.#]/.test(trimmed)) {
    return { selectors: [], missingNames, unsupported: true, pseudo: false };
  }

  let selectors = [trimmed];
  selectors = expandReplacement(
    selectors,
    /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g,
    ".",
    (name) => scopeMap.classes.get(name),
    usedClassNames,
    missingNames,
  );
  selectors = expandReplacement(
    selectors,
    /#(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g,
    "#",
    (name) => {
      const mapped = scopeMap.ids.get(name);
      return mapped ? [mapped] : undefined;
    },
    usedIds,
    missingNames,
  );

  if (missingNames.size > 0) {
    return { selectors: [], missingNames, unsupported: true, pseudo: false };
  }

  const scopedSelectors = selectors.map((item) => item.trim()).filter(Boolean);
  const stillUsesOriginalSelector = scopedSelectors.some((item) =>
    [...scopeMap.classes.keys()].some((className) => item.includes(`.${className}`)) ||
    [...scopeMap.ids.keys()].some((id) => item.includes(`#${id}`))
  );

  return {
    selectors: stillUsesOriginalSelector ? [] : Array.from(new Set(scopedSelectors)),
    missingNames,
    unsupported: stillUsesOriginalSelector,
    pseudo: false,
  };
}

export function scopeCssToBem(css: string, scopeMap: CssSelectorScopeMap): ScopedCssResult {
  const warnings: ConversionWarning[] = [];
  const output: string[] = [];
  const usedClassNames = new Set<string>();
  const usedIds = new Set<string>();
  let scopedRuleCount = 0;
  let unmappedRuleCount = 0;
  let unusedSelectorCount = 0;
  let pseudoSelectorCount = 0;

  const processBlocks = (inputCss: string, insideAtRule = false) => {
    const blocks = parseTopLevelBlocks(inputCss);
    const scopedBlocks: string[] = [];

    blocks.forEach((block) => {
      if (block.selector === ":root") {
        scopedBlocks.push(formatRule(":root", block.body));
        scopedRuleCount += 1;
        return;
      }

      if (/^@media\b/i.test(block.selector)) {
        const inner = processBlocks(block.body, true);
        if (inner.trim()) {
          scopedBlocks.push(`${block.selector} {\n${inner.split("\n").map((line) => `  ${line}`).join("\n")}\n}`);
          pushWarning(warnings, "CSS media query was preserved only where inner selectors mapped to generated BEM classes.", "info");
        } else {
          pushWarning(warnings, `Dropped media query "${block.selector}" because none of its selectors mapped to exported BEM classes.`);
        }
        return;
      }

      if (/^@(font-face|keyframes|supports|layer)\b/i.test(block.selector)) {
        unmappedRuleCount += 1;
        pushWarning(warnings, `Dropped unsupported at-rule "${block.selector}".`);
        return;
      }

      const selectors = block.selector.split(",");
      const scopedSelectors = selectors.flatMap((selector) => {
        const scoped = scopeSelector(selector, scopeMap, usedClassNames, usedIds);
        if (scoped.pseudo) {
          pseudoSelectorCount += 1;
          pushWarning(warnings, `Dropped pseudo selector "${selector.trim()}"; pseudo-elements/classes need manual Bricks CSS review.`);
        }
        if (scoped.missingNames.size > 0) {
          unusedSelectorCount += scoped.missingNames.size;
          pushWarning(
            warnings,
            `Dropped selector "${selector.trim()}" because it references classes or IDs not present in exported layers.`,
          );
        } else if (scoped.unsupported) {
          unmappedRuleCount += 1;
          pushWarning(warnings, `Dropped unsupported selector "${selector.trim()}"; it could not be scoped to generated BEM.`);
        }
        return scoped.selectors;
      });

      const uniqueSelectors = Array.from(new Set(scopedSelectors));
      if (uniqueSelectors.length === 0) {
        return;
      }

      scopedBlocks.push(formatRule(uniqueSelectors.join(",\n"), block.body));
      scopedRuleCount += 1;
    });

    if (!insideAtRule && blocks.length === 0 && inputCss.trim()) {
      pushWarning(warnings, "CSS could not be parsed into rules and was not exported.");
      unmappedRuleCount += 1;
    }

    return scopedBlocks.join("\n\n");
  };

  const cssOutput = processBlocks(css);
  if (cssOutput.trim()) {
    output.push(cssOutput.trim());
  }

  return {
    css: output.join("\n\n"),
    warnings,
    scopedRuleCount,
    unmappedRuleCount,
    unusedSelectorCount,
    pseudoSelectorCount,
  };
}
