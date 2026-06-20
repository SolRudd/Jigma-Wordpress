import type { ParsedElement } from "../../types/jigma.ts";

export interface BemNamingOptions {
  projectPrefix: string;
  blockName: string;
}

export interface BemClassAssignment {
  path: string;
  tagName: string;
  className: string;
  role: string;
}

const ROLE_BY_TAG: Record<string, string> = {
  section: "section",
  header: "header",
  main: "main",
  footer: "footer",
  article: "article",
  nav: "nav",
  aside: "aside",
  div: "block",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  p: "text",
  span: "text",
  strong: "text",
  em: "text",
  small: "text",
  a: "link",
  button: "button",
  img: "image",
  ul: "list",
  ol: "list",
  li: "item",
  svg: "svg",
};

const GENERIC_BLOCK_NAMES = new Set([
  "block",
  "component",
  "layout",
  "module",
  "section",
  "wrapper",
]);

const BLOCK_SUFFIX_WORDS = new Set([
  "area",
  "block",
  "component",
  "container",
  "layout",
  "module",
  "section",
  "wrapper",
  "wrap",
]);

const PROJECT_PREFIX_WORDS = new Set(["jig", "jigma", "ui", "c"]);

const UTILITY_CLASS_NAMES = new Set([
  "active",
  "align-center",
  "container",
  "flex",
  "hidden",
  "is-active",
  "is-hidden",
  "row",
  "show",
  "visible",
]);

const MODIFIER_WORDS = new Set([
  "active",
  "compact",
  "dark",
  "disabled",
  "featured",
  "ghost",
  "inverse",
  "large",
  "lg",
  "light",
  "muted",
  "outline",
  "primary",
  "secondary",
  "selected",
  "small",
  "sm",
  "solid",
  "tertiary",
  "wide",
]);

const SEMANTIC_CLASS_WORDS = new Set([
  "actions",
  "author",
  "badge",
  "body",
  "button",
  "buttons",
  "caption",
  "card",
  "content",
  "copy",
  "cta",
  "eyebrow",
  "field",
  "figure",
  "footer",
  "form",
  "gallery",
  "grid",
  "header",
  "headline",
  "icon",
  "image",
  "inner",
  "intro",
  "item",
  "kicker",
  "label",
  "lead",
  "link",
  "list",
  "media",
  "menu",
  "meta",
  "metric",
  "number",
  "overline",
  "panel",
  "quote",
  "stat",
  "stats",
  "subtitle",
  "text",
  "title",
  "value",
]);

export function sanitizeBemPart(value: string, fallback: string) {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!cleaned) {
    return fallback;
  }

  return /^[a-z]/.test(cleaned) ? cleaned : `${fallback}-${cleaned}`;
}

export function createBemBlockName(options: BemNamingOptions) {
  const prefix = sanitizeBemPart(options.projectPrefix, "jg");
  const block = sanitizeBemPart(options.blockName, "section");

  return `${prefix}-${block}`;
}

export function getElementRole(element: ParsedElement) {
  return ROLE_BY_TAG[element.tagName] ?? "element";
}

function getClassNames(element: ParsedElement) {
  return (element.attributes.class ?? "")
    .split(/\s+/)
    .map((className) => className.trim())
    .filter(Boolean);
}

function getOwnText(element: ParsedElement) {
  return element.textSegments
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

function stripKnownPrefix(value: string, projectPrefix: string) {
  const parts = value.split("-").filter(Boolean);
  if (parts.length <= 1) {
    return value;
  }

  const first = parts[0];
  if (first === projectPrefix || PROJECT_PREFIX_WORDS.has(first)) {
    return parts.slice(1).join("-");
  }

  return value;
}

function stripBlockSuffix(value: string) {
  const parts = value.split("-").filter(Boolean);
  if (parts.length <= 1) {
    return value;
  }

  const last = parts.at(-1);
  if (last && BLOCK_SUFFIX_WORDS.has(last)) {
    return parts.slice(0, -1).join("-");
  }

  return value;
}

function normalizeClassBase(className: string, projectPrefix: string) {
  const withoutModifier = className.split("--")[0] ?? className;
  const withoutElement = withoutModifier.split("__")[0] ?? withoutModifier;
  const normalized = sanitizeBemPart(withoutElement, "");

  return stripKnownPrefix(normalized, projectPrefix);
}

function getRawClassBase(className: string) {
  const withoutModifier = className.split("--")[0] ?? className;
  const withoutElement = withoutModifier.split("__")[0] ?? withoutModifier;
  return sanitizeBemPart(withoutElement, "");
}

function normalizeElementCandidate(value: string, projectPrefix: string) {
  const normalized = sanitizeBemPart(value, "");
  const withoutPrefix = stripKnownPrefix(normalized, projectPrefix);
  return stripBlockSuffix(withoutPrefix);
}

function isUsefulClassName(value: string) {
  return Boolean(value) &&
    !GENERIC_BLOCK_NAMES.has(value) &&
    !UTILITY_CLASS_NAMES.has(value) &&
    !MODIFIER_WORDS.has(value);
}

function getRootClassBases(element: ParsedElement, projectPrefix: string, blockPart: string) {
  const bases = new Set([blockPart]);

  getClassNames(element).forEach((className) => {
    const base = normalizeClassBase(className, projectPrefix);
    if (base) {
      bases.add(base);
      bases.add(stripBlockSuffix(base));
    }
  });

  return [...bases].filter(Boolean).sort((a, b) => b.length - a.length);
}

function inferRootBlockChoice(
  element: ParsedElement,
  projectPrefix: string,
  fallbackBlock: string,
) {
  if (!GENERIC_BLOCK_NAMES.has(fallbackBlock)) {
    return {
      blockPart: fallbackBlock,
      className: `${projectPrefix}-${fallbackBlock}`,
    };
  }

  for (const className of getClassNames(element)) {
    const rawBase = getRawClassBase(className);
    const normalizedBase = stripKnownPrefix(rawBase, projectPrefix);
    const candidate = stripBlockSuffix(normalizedBase);

    if (isUsefulClassName(candidate)) {
      const removedBlockSuffix = normalizedBase !== candidate;

      return {
        blockPart: candidate,
        className: removedBlockSuffix ? `${projectPrefix}-${candidate}` : rawBase,
      };
    }
  }

  return {
    blockPart: fallbackBlock,
    className: `${projectPrefix}-${fallbackBlock}`,
  };
}

function getBemElementHint(className: string, projectPrefix: string) {
  const elementPart = className.trim().toLowerCase().split("__")[1]?.split("--")[0];
  if (!elementPart) {
    return null;
  }

  return normalizeElementCandidate(elementPart, projectPrefix);
}

function stripRootPrefix(value: string, rootClassBases: string[]) {
  for (const rootBase of rootClassBases) {
    if (value === rootBase) {
      return "";
    }

    if (value.startsWith(`${rootBase}-`)) {
      return value.slice(rootBase.length + 1);
    }
  }

  return value;
}

function splitCandidateModifier(value: string) {
  const parts = value.split("-").filter(Boolean);
  if (parts.length <= 1) {
    return { role: value, modifier: "" };
  }

  const modifier = parts.at(-1) ?? "";
  if (MODIFIER_WORDS.has(modifier)) {
    return {
      role: parts.slice(0, -1).join("-"),
      modifier,
    };
  }

  return { role: value, modifier: "" };
}

function improveTagRole(element: ParsedElement, fallback: string) {
  if (element.tagName === "h1") {
    return "title";
  }

  if (/^h[2-6]$/.test(element.tagName)) {
    return "heading";
  }

  if (element.tagName === "a") {
    return "link";
  }

  const text = getOwnText(element);
  if ((element.tagName === "p" || element.tagName === "span") && text) {
    const compactText = text.replace(/[^a-zA-Z0-9]/g, "");
    if (/^[A-Z0-9]+$/.test(compactText) && compactText.length <= 24) {
      return "eyebrow";
    }

    if (/^\d+([.,:]\d+)?[%+]?$/i.test(text.trim())) {
      return "metric";
    }
  }

  return fallback;
}

function inferElementSemantics(
  element: ParsedElement,
  projectPrefix: string,
  rootClassBases: string[],
) {
  const classNames = getClassNames(element);

  for (const className of classNames) {
    const hint = getBemElementHint(className, projectPrefix);
    if (hint && isUsefulClassName(hint)) {
      return { role: hint, modifier: getModifierHint(classNames, hint, projectPrefix) };
    }
  }

  for (const className of classNames) {
    const base = normalizeClassBase(className, projectPrefix);
    const withoutRoot = stripRootPrefix(base, rootClassBases);
    const candidate = normalizeElementCandidate(withoutRoot || base, projectPrefix);
    const split = splitCandidateModifier(candidate);

    if (isUsefulClassName(split.role)) {
      return {
        role: split.role,
        modifier: split.modifier || getModifierHint(classNames, split.role, projectPrefix),
      };
    }
  }

  for (const className of classNames) {
    const candidate = normalizeElementCandidate(className, projectPrefix);
    const parts = candidate.split("-").filter(Boolean);
    const semanticPart = parts.find((part) => SEMANTIC_CLASS_WORDS.has(part));

    if (semanticPart && isUsefulClassName(semanticPart)) {
      return {
        role: semanticPart,
        modifier: getModifierHint(classNames, semanticPart, projectPrefix),
      };
    }
  }

  const fallbackRole = improveTagRole(element, getElementRole(element));
  return {
    role: fallbackRole,
    modifier: getModifierHint(classNames, fallbackRole, projectPrefix),
  };
}

function getModifierHint(classNames: string[], role: string, projectPrefix: string) {
  for (const className of classNames) {
    const explicitModifier = className.trim().toLowerCase().split("--")[1];
    if (explicitModifier) {
      const modifier = normalizeElementCandidate(explicitModifier, projectPrefix);
      if (modifier) {
        return modifier;
      }
    }
  }

  for (const className of classNames) {
    const candidate = normalizeElementCandidate(className, projectPrefix);
    if (MODIFIER_WORDS.has(candidate)) {
      return candidate;
    }

    const withoutRoot = splitCandidateModifier(candidate);
    if (withoutRoot.role === role && withoutRoot.modifier) {
      return withoutRoot.modifier;
    }
  }

  return "";
}

function shouldCountDuplicates(role: string, modifier: string) {
  return !modifier && ["block", "element", "heading", "item", "section", "text"].includes(role);
}

export function createBemClassFactory(options: BemNamingOptions) {
  const projectPrefix = sanitizeBemPart(options.projectPrefix, "jg");
  const fallbackBlock = sanitizeBemPart(options.blockName, "section");
  let blockPart = fallbackBlock;
  let blockName = `${projectPrefix}-${blockPart}`;
  let rootClassBases = [blockPart];
  const roleCounts = new Map<string, number>();
  let rootCount = 0;

  const makeElementClass = (role: string, modifier: string) => {
    const baseClass = `${blockName}__${role}${modifier ? `--${modifier}` : ""}`;

    if (!shouldCountDuplicates(role, modifier)) {
      return baseClass;
    }

    const key = `${role}:${modifier}`;
    const count = (roleCounts.get(key) ?? 0) + 1;
    roleCounts.set(key, count);

    return count === 1 ? baseClass : `${baseClass}-${count}`;
  };

  return {
    get blockName() {
      return blockName;
    },
    create(element: ParsedElement, path: string, parent: string | 0): BemClassAssignment {
      if (parent === 0) {
        rootCount += 1;

        if (rootCount === 1) {
          const rootChoice = inferRootBlockChoice(element, projectPrefix, fallbackBlock);
          blockPart = rootChoice.blockPart;
          blockName = rootChoice.className;
          rootClassBases = getRootClassBases(element, projectPrefix, blockPart);
        }

        return {
          path,
          tagName: element.tagName,
          role: "root",
          className: rootCount === 1 ? blockName : `${blockName}--root-${rootCount}`,
        };
      }

      const semantics = inferElementSemantics(element, projectPrefix, rootClassBases);

      return {
        path,
        tagName: element.tagName,
        role: semantics.role,
        className: makeElementClass(semantics.role, semantics.modifier),
      };
    },
  };
}
