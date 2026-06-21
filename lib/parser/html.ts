import type { LayerNode, ParsedElement } from "../../types/jigma.ts";
import { stripUnsafeEventAttributes } from "../assets/code.ts";
import { sanitizeSvgMarkup } from "../svg/sanitize.ts";

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

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

const SAFE_PHRASING_TAGS = new Set([
  "abbr",
  "b",
  "br",
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

const SAFE_INLINE_ATTRIBUTES = new Set([
  "class",
  "id",
  "role",
  "hidden",
  "title",
  "width",
  "height",
]);

function decodeBasicEntities(value: string) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseAttributes(raw: string) {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attributes[name] = decodeBasicEntities(value);
  }

  return attributes;
}

function createElement(tagName: string, rawAttributes: string, selfClosing: boolean): ParsedElement {
  return {
    tagName,
    attributes: parseAttributes(rawAttributes),
    children: [],
    textSegments: [],
    contentParts: [],
    selfClosing,
  };
}

function findSvgCloseIndex(html: string, fromIndex: number) {
  const pattern = /<\/?svg\b[^>]*>/gi;
  pattern.lastIndex = fromIndex;
  let depth = 1;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const token = match[0];
    if (/^<\s*svg\b/i.test(token) && !/\/\s*>$/.test(token)) {
      depth += 1;
    } else if (/^<\s*\/\s*svg\b/i.test(token)) {
      depth -= 1;
      if (depth === 0) {
        return pattern.lastIndex;
      }
    }
  }

  return -1;
}

export function parseHtmlFragment(html: string) {
  const root = createElement("root", "", false);
  const stack: ParsedElement[] = [root];
  let index = 0;
  const warnings: string[] = [];

  while (index < html.length) {
    const tagStart = html.indexOf("<", index);

    if (tagStart === -1) {
      const text = html.slice(index);
      if (text.trim()) {
        const decoded = decodeBasicEntities(text);
        stack.at(-1)?.textSegments.push(decoded);
        stack.at(-1)?.contentParts.push({ type: "text", value: decoded });
      }
      break;
    }

    if (tagStart > index) {
      const text = html.slice(index, tagStart);
      if (text.trim()) {
        const decoded = decodeBasicEntities(text);
        stack.at(-1)?.textSegments.push(decoded);
        stack.at(-1)?.contentParts.push({ type: "text", value: decoded });
      }
    }

    if (html.startsWith("<!--", tagStart)) {
      const commentEnd = html.indexOf("-->", tagStart + 4);
      index = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }

    const tagEnd = html.indexOf(">", tagStart + 1);
    if (tagEnd === -1) {
      warnings.push("HTML contains an unfinished tag.");
      break;
    }

    const rawTag = html.slice(tagStart + 1, tagEnd).trim();
    index = tagEnd + 1;

    if (!rawTag || rawTag.startsWith("!") || rawTag.startsWith("?")) {
      continue;
    }

    if (rawTag.startsWith("/")) {
      const closingTag = rawTag.slice(1).trim().split(/\s+/)[0]?.toLowerCase();
      if (!closingTag) {
        continue;
      }

      let matchingIndex = -1;
      for (let stackIndex = stack.length - 1; stackIndex >= 0; stackIndex -= 1) {
        if (stack[stackIndex].tagName === closingTag) {
          matchingIndex = stackIndex;
          break;
        }
      }
      if (matchingIndex > 0) {
        stack.length = matchingIndex;
      } else {
        warnings.push(`HTML contains an unmatched closing </${closingTag}> tag.`);
      }
      continue;
    }

    const tagMatch = rawTag.match(/^([a-zA-Z][a-zA-Z0-9:-]*)([\s\S]*)$/);
    if (!tagMatch) {
      warnings.push("HTML contains a malformed tag.");
      continue;
    }

    const tagName = tagMatch[1].toLowerCase();
    const rawAttributes = tagMatch[2].replace(/\/\s*$/, "");
    const selfClosing = /\/\s*$/.test(rawTag) || VOID_TAGS.has(tagName);
    const element = createElement(tagName, rawAttributes, selfClosing);
    const parent = stack.at(-1);
    parent?.children.push(element);
    parent?.contentParts.push({ type: "element", element });

    if (tagName === "svg") {
      if (selfClosing) {
        element.rawHtml = html.slice(tagStart, tagEnd + 1);
        continue;
      }

      const svgCloseIndex = findSvgCloseIndex(html, index);
      if (svgCloseIndex === -1) {
        element.rawHtml = html.slice(tagStart, tagEnd + 1);
        warnings.push("HTML contains an unfinished inline SVG.");
      } else {
        element.rawHtml = html.slice(tagStart, svgCloseIndex);
        index = svgCloseIndex;
      }
      continue;
    }

    if (tagName === "script" || tagName === "style") {
      const closePattern = new RegExp(`</${tagName}\\s*>`, "i");
      const closeMatch = closePattern.exec(html.slice(index));
      if (closeMatch) {
        const rawText = html.slice(index, index + closeMatch.index);
        if (rawText.trim()) {
          element.textSegments.push(rawText);
          element.contentParts.push({ type: "text", value: rawText });
        }
        index += closeMatch.index + closeMatch[0].length;
      }
      continue;
    }

    if (!selfClosing) {
      stack.push(element);
    }
  }

  if (stack.length > 1) {
    warnings.push("HTML had unclosed tags; Jigma closed them for parsing.");
  }

  return { root, warnings };
}

function findFirstElement(node: ParsedElement, tagName: string): ParsedElement | undefined {
  if (node.tagName === tagName) {
    return node;
  }

  for (const child of node.children) {
    const found = findFirstElement(child, tagName);
    if (found) {
      return found;
    }
  }

  return undefined;
}

export function getRenderableRoots(html: string) {
  const parsed = parseHtmlFragment(html);
  const body = findFirstElement(parsed.root, "body");
  const htmlElement = findFirstElement(parsed.root, "html");
  const roots = body?.children ?? htmlElement?.children ?? parsed.root.children;

  return {
    roots: roots.filter((child) => !["head", "body"].includes(child.tagName)),
    warnings: parsed.warnings,
  };
}

export function getClassNames(element: ParsedElement) {
  return (element.attributes.class ?? "")
    .split(/\s+/)
    .map((className) => className.trim())
    .filter(Boolean);
}

function isSafeInlineAttribute(name: string) {
  return SAFE_INLINE_ATTRIBUTES.has(name) ||
    name.startsWith("aria-") ||
    name.startsWith("data-");
}

function normalizeInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function serializeInlineAttributes(attributes: Record<string, string>) {
  return Object.entries(stripUnsafeEventAttributes(attributes))
    .filter(([name]) => isSafeInlineAttribute(name))
    .map(([name, value]) => value === "" ? name : `${name}="${escapeHtml(value)}"`)
    .join(" ");
}

function serializeInlineElement(element: ParsedElement): string {
  if (element.tagName === "br") {
    return "<br>\n";
  }

  if (!SAFE_PHRASING_TAGS.has(element.tagName)) {
    return escapeHtml(getElementText(element));
  }

  const attributeText = serializeInlineAttributes(element.attributes);
  const openTag = attributeText ? `<${element.tagName} ${attributeText}>` : `<${element.tagName}>`;
  return `${openTag}${serializeInlineContent(element)}</${element.tagName}>`;
}

export function hasOnlyPhrasingContent(element: ParsedElement): boolean {
  return element.children.every((child) =>
    HIDDEN_STRUCTURE_TAGS.has(child.tagName) ||
    (SAFE_PHRASING_TAGS.has(child.tagName) && hasOnlyPhrasingContent(child))
  );
}

export function serializeInlineContent(element: ParsedElement): string {
  const parts = element.contentParts.length > 0
    ? element.contentParts
    : [
      ...element.textSegments.map((value) => ({ type: "text" as const, value })),
      ...element.children.map((child) => ({ type: "element" as const, element: child })),
    ];
  let output = "";
  let lastToken: "none" | "text" | "element" | "br" = "none";

  parts.forEach((part) => {
    if (part.type === "text") {
      const text = normalizeInlineText(part.value);
      if (!text) {
        return;
      }
      if (output && lastToken !== "br" && !output.endsWith(" ")) {
        output += " ";
      }
      output += escapeHtml(text);
      lastToken = "text";
      return;
    }

    if (HIDDEN_STRUCTURE_TAGS.has(part.element.tagName)) {
      return;
    }

    const html = serializeInlineElement(part.element);
    if (!html) {
      return;
    }

    if (
      output &&
      lastToken !== "br" &&
      part.element.tagName !== "br" &&
      !output.endsWith(" ")
    ) {
      output += " ";
    }

    output += html;
    lastToken = part.element.tagName === "br" ? "br" : "element";
  });

  return output.trim();
}

export function getOwnText(element: ParsedElement, maxLength = 80) {
  const ownText = element.textSegments
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");

  const text = ownText || (element.children.length === 0
    ? getElementText(element).replace(/\s+/g, " ").trim()
    : "");

  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}...`;
}

export function getElementText(element: ParsedElement): string {
  if (element.tagName === "br") {
    return "\n";
  }

  if (element.contentParts.length > 0) {
    return element.contentParts.map((part) =>
      part.type === "text" ? part.value : getElementText(part.element)
    ).join(" ");
  }

  return [
    ...element.textSegments,
    ...element.children.map((child) => getElementText(child)),
  ].join(" ");
}

function getElementLabel(element: ParsedElement) {
  const classes = getClassNames(element);
  const elementId = element.attributes.id;

  if (elementId) {
    return `${element.tagName}#${elementId}`;
  }

  if (classes.length > 0) {
    return `${element.tagName}.${classes.slice(0, 3).join(".")}`;
  }

  const text = getOwnText(element, 28);
  return text ? `${element.tagName} "${text}"` : element.tagName;
}

function layerFromElement(element: ParsedElement, path: string): LayerNode {
  const visibleChildren = element.children.filter((child) =>
    !HIDDEN_STRUCTURE_TAGS.has(child.tagName)
  );

  return {
    id: path,
    tagName: element.tagName,
    label: getElementLabel(element),
    text: getOwnText(element, 46),
    classes: getClassNames(element),
    elementId: element.attributes.id,
    children: visibleChildren.map((child, index) => layerFromElement(child, `${path}-${index}`)),
  };
}

export function getLayers(html: string) {
  return getRenderableRoots(html).roots
    .filter((element) => !HIDDEN_STRUCTURE_TAGS.has(element.tagName))
    .map((element, index) => layerFromElement(element, `${index}`));
}

export function collectLayerIds(nodes: LayerNode[]) {
  const ids: string[] = [];

  const walk = (node: LayerNode) => {
    ids.push(node.id);
    node.children.forEach(walk);
  };

  nodes.forEach(walk);
  return ids;
}

export function findLayer(nodes: LayerNode[], id: string): LayerNode | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    const found = findLayer(node.children, id);
    if (found) {
      return found;
    }
  }

  return undefined;
}

export function serializeElement(
  element: ParsedElement,
  options: {
    path: string;
    excludeLayerIds?: Set<string>;
    deletedLayerIds?: Set<string>;
    addLayerAttributes?: boolean;
    activeLayerId?: string | null;
    skipScripts?: boolean;
  },
): string {
  if (
    options.excludeLayerIds?.has(options.path) ||
    options.deletedLayerIds?.has(options.path) ||
    (options.skipScripts && element.tagName === "script")
  ) {
    return "";
  }

  const attributes = stripUnsafeEventAttributes(element.attributes);
  if (options.addLayerAttributes) {
    attributes["data-jigma-layer"] = options.path;
    if (options.activeLayerId === options.path) {
      attributes["data-jigma-active"] = "true";
    }
  }

  const attributeText = Object.entries(attributes)
    .filter(([name]) => name !== "")
    .map(([name, value]) => value === "" ? name : `${name}="${escapeHtml(value)}"`)
    .join(" ");
  const openTag = attributeText ? `<${element.tagName} ${attributeText}>` : `<${element.tagName}>`;

  if (element.tagName === "svg" && element.rawHtml) {
    const sanitized = sanitizeSvgMarkup(element.rawHtml);
    if (!sanitized.svg) {
      return `<span data-jigma-svg-error="true" style="display:inline-flex;align-items:center;justify-content:center;min-width:40px;min-height:40px;border:1px solid currentColor;border-radius:8px;color:#ef4444;font:12px/1.3 system-ui;">SVG review required</span>`;
    }

    if (!options.addLayerAttributes) {
      return sanitized.svg;
    }

    return sanitized.svg.replace(
      /^<svg\b/i,
      `<svg data-jigma-layer="${escapeHtml(options.path)}"${options.activeLayerId === options.path ? ' data-jigma-active="true"' : ""}`,
    );
  }

  if (VOID_TAGS.has(element.tagName) || element.selfClosing) {
    return attributeText ? `<${element.tagName} ${attributeText}>` : `<${element.tagName}>`;
  }

  const ownText = element.textSegments.map(escapeHtml).join("");
  let visibleChildIndex = 0;
  const childHtml = element.children
    .map((child) => {
      if (HIDDEN_STRUCTURE_TAGS.has(child.tagName)) {
        return options.skipScripts || child.tagName === "script" ? "" : serializeElement(child, {
          ...options,
          path: `${options.path}-meta`,
        });
      }

      const childPath = `${options.path}-${visibleChildIndex}`;
      visibleChildIndex += 1;
      return serializeElement(child, {
        ...options,
        path: childPath,
      });
    })
    .join("");

  return `${openTag}${ownText}${childHtml}</${element.tagName}>`;
}

export function serializeHtml(
  html: string,
  options: {
    excludeLayerIds?: Set<string>;
    deletedLayerIds?: Set<string>;
    addLayerAttributes?: boolean;
    activeLayerId?: string | null;
    skipScripts?: boolean;
  } = {},
) {
  return getRenderableRoots(html).roots
    .map((element, index) =>
      serializeElement(element, {
        ...options,
        path: `${index}`,
      })
    )
    .join("\n");
}

export function sanitizeHtmlInput(raw: string): string {
  const stripped = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim().replace(/\*\*/g, "").replace(/:$/, "").trim().toLowerCase();
      return !/^```[a-z0-9_-]*\s*$/i.test(line.trim()) &&
        trimmed !== ":::" &&
        !/^:::writing\b/i.test(trimmed) &&
        trimmed !== "html" &&
        !/^\d+\.\s*html$/.test(trimmed);
    })
    .join("\n")
    .trim();

  const firstTag = stripped.match(/<(section|div|article|header|main|footer|html|body)\b[^>]*>/i) ??
    stripped.match(/<[a-z][a-z0-9:-]*\b[^>]*>/i);

  if (!firstTag || typeof firstTag.index !== "number") {
    return stripped;
  }

  return stripped.slice(firstTag.index).trim();
}
