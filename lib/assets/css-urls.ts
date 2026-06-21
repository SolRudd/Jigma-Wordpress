import type { AssetUsage } from "../../types/jigma.ts";

export interface CssUrlReference {
  url: string;
  property: string;
  selector: string;
  usage: AssetUsage;
}

function findMatchingBrace(css: string, openIndex: number) {
  let depth = 0;
  let quote = "";

  for (let index = openIndex; index < css.length; index += 1) {
    const char = css[index];
    const previous = css[index - 1];

    if (quote) {
      if (char === quote && previous !== "\\") {
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function parseBlocks(css: string): { selector: string; body: string }[] {
  const blocks: { selector: string; body: string }[] = [];
  let index = 0;

  while (index < css.length) {
    const openIndex = css.indexOf("{", index);
    if (openIndex === -1) {
      break;
    }

    const closeIndex = findMatchingBrace(css, openIndex);
    const selector = css.slice(index, openIndex).trim();
    const body = closeIndex === -1
      ? css.slice(openIndex + 1).trim()
      : css.slice(openIndex + 1, closeIndex).trim();

    if (selector && body && !selector.startsWith("@keyframes")) {
      if (selector.startsWith("@media") || selector.startsWith("@supports")) {
        blocks.push(...parseBlocks(body));
      } else if (!selector.startsWith("@")) {
        blocks.push({ selector, body });
      }
    }

    index = closeIndex === -1 ? css.length : closeIndex + 1;
  }

  return blocks;
}

function splitDeclarations(body: string) {
  const declarations: { property: string; value: string }[] = [];
  let current = "";
  let quote = "";
  let depth = 0;

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    const previous = body[index - 1];

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
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    }

    if (char === ";" && depth === 0) {
      const colonIndex = current.indexOf(":");
      if (colonIndex > 0) {
        declarations.push({
          property: current.slice(0, colonIndex).trim().toLowerCase(),
          value: current.slice(colonIndex + 1).trim(),
        });
      }
      current = "";
      continue;
    }

    current += char;
  }

  const colonIndex = current.indexOf(":");
  if (colonIndex > 0) {
    declarations.push({
      property: current.slice(0, colonIndex).trim().toLowerCase(),
      value: current.slice(colonIndex + 1).trim(),
    });
  }

  return declarations;
}

function getUsage(property: string, selector: string, value: string): AssetUsage {
  if (selector.includes("::before") || selector.includes("::after")) {
    return "pseudo-element";
  }

  if (property.includes("mask") || property.includes("clip-path") || property === "filter") {
    return "mask";
  }

  if (property === "content" || property === "cursor" || property === "src") {
    return "dependency";
  }

  if (/gradient\(/i.test(value) && /url\(/i.test(value)) {
    return "overlay";
  }

  return "background";
}

export function extractCssUrlReferences(css: string): CssUrlReference[] {
  const references: CssUrlReference[] = [];
  const urlPattern = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^"')\s]+))\s*\)/gi;

  parseBlocks(css).forEach((block) => {
    splitDeclarations(block.body).forEach((declaration) => {
      if (
        !/url\(/i.test(declaration.value) ||
        !/^(background|background-image|mask|mask-image|-webkit-mask-image|content|cursor|src|filter|clip-path)$/i
          .test(declaration.property)
      ) {
        return;
      }

      let match: RegExpExecArray | null;
      while ((match = urlPattern.exec(declaration.value)) !== null) {
        const url = (match[1] ?? match[2] ?? match[3] ?? "").trim();
        if (!url || url.startsWith("#")) {
          continue;
        }

        references.push({
          url,
          property: declaration.property,
          selector: block.selector,
          usage: getUsage(declaration.property, block.selector, declaration.value),
        });
      }
    });
  });

  return references;
}

export function getCssOwnerClass(selector: string) {
  return selector.match(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/)?.[1];
}
