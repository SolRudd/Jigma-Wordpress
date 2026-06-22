(function() {
  "use strict";
  const EVENT_ATTRIBUTE_PATTERN = /^on[a-z]+$/i;
  function walk(element, path, callback) {
    callback(element, path);
    element.children.forEach((child, index) => walk(child, `${path}-${index}`, callback));
  }
  function getReadableOwner(element) {
    var _a;
    const className = (_a = element.attributes.class) == null ? void 0 : _a.split(/\s+/).find(Boolean);
    return className ? `${element.tagName}.${className}` : element.tagName;
  }
  function inspectInlineEventHandlers(roots) {
    const warnings = [];
    roots.forEach((root, index) => {
      walk(root, `${index}`, (element, path) => {
        const eventAttributes = Object.entries(element.attributes).filter(([name]) => EVENT_ATTRIBUTE_PATTERN.test(name));
        if (eventAttributes.length === 0) {
          return;
        }
        const owner = getReadableOwner(element);
        warnings.push({
          id: `inline-event:${path}`,
          code: "code.inline_event_handler",
          severity: "action-required",
          title: "Inline event handler removed",
          summary: `${owner} contains inline JavaScript that requires review.`,
          message: `${owner} contains inline JavaScript that requires review.`,
          ownerElementId: path,
          ownerLabel: owner,
          details: eventAttributes.map(([name, value]) => `${name}="${value}"`),
          suggestedAction: "Move reviewed behavior into the JavaScript editor or rebuild the interaction with Bricks-native controls."
        });
      });
    });
    return warnings;
  }
  function stripUnsafeEventAttributes(attributes) {
    return Object.fromEntries(
      Object.entries(attributes).filter(([name]) => !EVENT_ATTRIBUTE_PATTERN.test(name))
    );
  }
  const ALLOWED_TAGS = /* @__PURE__ */ new Set([
    "svg",
    "g",
    "path",
    "circle",
    "ellipse",
    "rect",
    "line",
    "polyline",
    "polygon",
    "defs",
    "lineargradient",
    "radialgradient",
    "stop",
    "clippath",
    "mask",
    "pattern",
    "symbol",
    "use",
    "title",
    "desc",
    "text",
    "tspan"
  ]);
  const ALLOWED_ATTRS = /* @__PURE__ */ new Set([
    "aria-hidden",
    "aria-label",
    "class",
    "clip-path",
    "clip-rule",
    "cx",
    "cy",
    "d",
    "dx",
    "dy",
    "fill",
    "fill-rule",
    "focusable",
    "gradienttransform",
    "gradientunits",
    "height",
    "href",
    "id",
    "mask",
    "offset",
    "opacity",
    "preserveaspectratio",
    "r",
    "role",
    "rx",
    "ry",
    "stroke",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-width",
    "stop-color",
    "stop-opacity",
    "style",
    "transform",
    "viewbox",
    "width",
    "x",
    "x1",
    "x2",
    "xlink:href",
    "xmlns",
    "xmlns:xlink",
    "y",
    "y1",
    "y2"
  ]);
  function unique$1(items) {
    return Array.from(new Set(items));
  }
  function blankReport() {
    return {
      removedTags: [],
      removedAttributes: [],
      externalReferences: [],
      changed: false,
      requiresSignature: true,
      requiresReview: true,
      malformed: false
    };
  }
  function finalizeReport(report) {
    const removedTags = unique$1(report.removedTags);
    const removedAttributes = unique$1(report.removedAttributes);
    const externalReferences = unique$1(report.externalReferences);
    return {
      ...report,
      removedTags,
      removedAttributes,
      externalReferences,
      changed: report.malformed || removedTags.length > 0 || removedAttributes.length > 0,
      requiresReview: true,
      requiresSignature: true
    };
  }
  function isUnsafeUrl(value) {
    const normalized = value.trim().replace(/[\u0000-\u001f\s]+/g, "").toLowerCase();
    return normalized.startsWith("javascript:") || normalized.startsWith("data:text/html") || normalized.startsWith("vbscript:");
  }
  function getExternalReference(value) {
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return "";
    }
    if (/^(https?:)?\/\//i.test(trimmed) || /\.svg(?:[?#]|$)/i.test(trimmed)) {
      return trimmed;
    }
    return "";
  }
  function isUnsafeRemoteReference(value) {
    return /^(https?:)?\/\//i.test(value.trim());
  }
  function isReferenceAttribute(name) {
    return ["href", "xlink:href", "src", "clip-path", "mask", "filter", "fill", "stroke"].includes(name);
  }
  function sanitizeAttributeValue(name, value, report) {
    if (isReferenceAttribute(name)) {
      if (isUnsafeUrl(value)) {
        report.removedAttributes.push(`${name}="${value}"`);
        return null;
      }
      const externalReference = getExternalReference(value.replace(/^url\(["']?|["']?\)$/g, ""));
      if (externalReference) {
        report.externalReferences.push(externalReference);
        if (isUnsafeRemoteReference(externalReference)) {
          report.removedAttributes.push(`${name}="${value}"`);
          return null;
        }
      }
    }
    if (name === "style" && /(?:javascript:|expression\s*\()/i.test(value)) {
      report.removedAttributes.push(`${name}="${value}"`);
      return null;
    }
    return value;
  }
  function serializeNode(node, report) {
    if (node.nodeType === node.TEXT_NODE) {
      return node.textContent ?? "";
    }
    if (node.nodeType !== node.ELEMENT_NODE) {
      return "";
    }
    const element = node;
    const tagName = element.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) {
      report.removedTags.push(tagName);
      return "";
    }
    const attributes = [];
    Array.from(element.attributes).forEach((attribute) => {
      const attrName = attribute.name.toLowerCase();
      if (attrName.startsWith("on") || !ALLOWED_ATTRS.has(attrName)) {
        report.removedAttributes.push(`${tagName}.${attribute.name}`);
        return;
      }
      const safeValue = sanitizeAttributeValue(attrName, attribute.value, report);
      if (safeValue === null) {
        return;
      }
      attributes.push(`${attribute.name}="${safeValue.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`);
    });
    const attributeText = attributes.length > 0 ? ` ${attributes.join(" ")}` : "";
    const children = Array.from(element.childNodes).map((child) => serializeNode(child, report)).join("");
    return `<${element.tagName}${attributeText}>${children}</${element.tagName}>`;
  }
  function sanitizeSvgMarkup(rawSvg) {
    const report = blankReport();
    const source = rawSvg.trim();
    if (!source || !/^<svg[\s>]/i.test(source)) {
      return {
        svg: "",
        report: {
          ...report,
          malformed: true,
          changed: true
        }
      };
    }
    if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
      const strippedUnsafe = source.replace(/<script\b[\s\S]*?<\/script>/gi, () => {
        report.removedTags.push("script");
        return "";
      }).replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, () => {
        report.removedTags.push("foreignObject");
        return "";
      }).replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (match) => {
        report.removedAttributes.push(match.trim());
        return "";
      }).replace(/\s+(href|xlink:href)\s*=\s*(["'])javascript:[\s\S]*?\2/gi, (match) => {
        report.removedAttributes.push(match.trim());
        return "";
      });
      const stripped = strippedUnsafe.replace(
        /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>/g,
        (match, closingSlash, tagName, rawAttributes) => {
          const normalizedTag = tagName.toLowerCase();
          if (!ALLOWED_TAGS.has(normalizedTag)) {
            report.removedTags.push(tagName);
            return "";
          }
          if (closingSlash) {
            return `</${tagName}>`;
          }
          const selfClosing = /\/\s*$/.test(rawAttributes);
          const attributeSource = rawAttributes.replace(/\/\s*$/, "");
          const attributes = [];
          const attributePattern = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
          let attributeMatch;
          while ((attributeMatch = attributePattern.exec(attributeSource)) !== null) {
            const originalName = attributeMatch[1];
            const attrName = originalName.toLowerCase();
            if (attrName.startsWith("on") || !ALLOWED_ATTRS.has(attrName)) {
              report.removedAttributes.push(`${tagName}.${originalName}`);
              continue;
            }
            const rawValue = attributeMatch[2] ?? attributeMatch[3] ?? attributeMatch[4] ?? "";
            const safeValue = sanitizeAttributeValue(attrName, rawValue, report);
            if (safeValue === null) {
              continue;
            }
            attributes.push(`${originalName}="${safeValue.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`);
          }
          return `<${tagName}${attributes.length ? ` ${attributes.join(" ")}` : ""}${selfClosing ? " /" : ""}>`;
        }
      );
      return {
        svg: stripped,
        report: {
          ...finalizeReport(report)
        }
      };
    }
    const parser = new DOMParser();
    const document = parser.parseFromString(source, "image/svg+xml");
    const parserError = document.querySelector("parsererror");
    const svg = document.documentElement;
    if (parserError || !svg || svg.tagName.toLowerCase() !== "svg") {
      return {
        svg: "",
        report: {
          ...report,
          malformed: true,
          changed: true
        }
      };
    }
    const safeSvg = serializeNode(svg, report);
    return {
      svg: safeSvg,
      report: finalizeReport(report)
    };
  }
  function countSvgInternalNodes(rawSvg) {
    const matches = rawSvg.match(/<\s*(path|circle|rect|defs|linearGradient|radialGradient|stop|clipPath|mask|g|use|line|polyline|polygon|ellipse)\b/gi);
    return (matches == null ? void 0 : matches.length) ?? 0;
  }
  const VOID_TAGS = /* @__PURE__ */ new Set([
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
    "wbr"
  ]);
  const HIDDEN_STRUCTURE_TAGS$1 = /* @__PURE__ */ new Set([
    "script",
    "style",
    "link",
    "meta",
    "title",
    "base",
    "template",
    "source"
  ]);
  const SAFE_PHRASING_TAGS = /* @__PURE__ */ new Set([
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
    "sup"
  ]);
  const SAFE_INLINE_ATTRIBUTES = /* @__PURE__ */ new Set([
    "class",
    "id",
    "role",
    "hidden",
    "title",
    "width",
    "height"
  ]);
  function decodeBasicEntities(value) {
    return value.replaceAll("&nbsp;", " ").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
  }
  function escapeHtml(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }
  function parseAttributes(raw) {
    const attributes = {};
    const pattern = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let match;
    while ((match = pattern.exec(raw)) !== null) {
      const name = match[1].toLowerCase();
      const value = match[2] ?? match[3] ?? match[4] ?? "";
      attributes[name] = decodeBasicEntities(value);
    }
    return attributes;
  }
  function createElement(tagName, rawAttributes, selfClosing) {
    return {
      tagName,
      attributes: parseAttributes(rawAttributes),
      children: [],
      textSegments: [],
      contentParts: [],
      selfClosing
    };
  }
  function findSvgCloseIndex(html, fromIndex) {
    const pattern = /<\/?svg\b[^>]*>/gi;
    pattern.lastIndex = fromIndex;
    let depth = 1;
    let match;
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
  function parseHtmlFragment(html) {
    var _a, _b, _c, _d, _e;
    const root = createElement("root", "", false);
    const stack = [root];
    let index = 0;
    const warnings = [];
    while (index < html.length) {
      const tagStart = html.indexOf("<", index);
      if (tagStart === -1) {
        const text = html.slice(index);
        if (text.trim()) {
          const decoded = decodeBasicEntities(text);
          (_a = stack.at(-1)) == null ? void 0 : _a.textSegments.push(decoded);
          (_b = stack.at(-1)) == null ? void 0 : _b.contentParts.push({ type: "text", value: decoded });
        }
        break;
      }
      if (tagStart > index) {
        const text = html.slice(index, tagStart);
        if (text.trim()) {
          const decoded = decodeBasicEntities(text);
          (_c = stack.at(-1)) == null ? void 0 : _c.textSegments.push(decoded);
          (_d = stack.at(-1)) == null ? void 0 : _d.contentParts.push({ type: "text", value: decoded });
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
        const closingTag = (_e = rawTag.slice(1).trim().split(/\s+/)[0]) == null ? void 0 : _e.toLowerCase();
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
      parent == null ? void 0 : parent.children.push(element);
      parent == null ? void 0 : parent.contentParts.push({ type: "element", element });
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
  function findFirstElement$1(node, tagName) {
    if (node.tagName === tagName) {
      return node;
    }
    for (const child of node.children) {
      const found = findFirstElement$1(child, tagName);
      if (found) {
        return found;
      }
    }
    return void 0;
  }
  function getRenderableRoots(html) {
    const parsed = parseHtmlFragment(html);
    const body = findFirstElement$1(parsed.root, "body");
    const htmlElement = findFirstElement$1(parsed.root, "html");
    const roots = (body == null ? void 0 : body.children) ?? (htmlElement == null ? void 0 : htmlElement.children) ?? parsed.root.children;
    return {
      roots: roots.filter((child) => !["head", "body"].includes(child.tagName)),
      warnings: parsed.warnings
    };
  }
  function getClassNames$1(element) {
    return (element.attributes.class ?? "").split(/\s+/).map((className) => className.trim()).filter(Boolean);
  }
  function isSafeInlineAttribute(name) {
    return SAFE_INLINE_ATTRIBUTES.has(name) || name.startsWith("aria-") || name.startsWith("data-");
  }
  function normalizeInlineText(value) {
    return value.replace(/\s+/g, " ").trim();
  }
  function serializeInlineAttributes(attributes) {
    return Object.entries(stripUnsafeEventAttributes(attributes)).filter(([name]) => isSafeInlineAttribute(name)).map(([name, value]) => value === "" ? name : `${name}="${escapeHtml(value)}"`).join(" ");
  }
  function serializeInlineElement(element) {
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
  function hasOnlyPhrasingContent(element) {
    return element.children.every(
      (child) => HIDDEN_STRUCTURE_TAGS$1.has(child.tagName) || SAFE_PHRASING_TAGS.has(child.tagName) && hasOnlyPhrasingContent(child)
    );
  }
  function serializeInlineContent(element) {
    const parts = element.contentParts.length > 0 ? element.contentParts : [
      ...element.textSegments.map((value) => ({ type: "text", value })),
      ...element.children.map((child) => ({ type: "element", element: child }))
    ];
    let output = "";
    let lastToken = "none";
    parts.forEach((part) => {
      if (part.type === "text") {
        const text = normalizeInlineText(part.value);
        if (!text) {
          return;
        }
        if (output && lastToken !== "br" && lastToken !== "empty-element" && !output.endsWith(" ")) {
          output += " ";
        }
        output += escapeHtml(text);
        lastToken = "text";
        return;
      }
      if (HIDDEN_STRUCTURE_TAGS$1.has(part.element.tagName)) {
        return;
      }
      const html = serializeInlineElement(part.element);
      if (!html) {
        return;
      }
      if (output && lastToken !== "br" && part.element.tagName !== "br" && !output.endsWith(" ")) {
        output += " ";
      }
      output += html;
      const hasVisibleInlineText = normalizeInlineText(getElementText(part.element)).length > 0;
      lastToken = part.element.tagName === "br" ? "br" : hasVisibleInlineText ? "element" : "empty-element";
    });
    return output.trim();
  }
  function getOwnText$1(element, maxLength = 80) {
    const ownText = element.textSegments.map((text2) => text2.replace(/\s+/g, " ").trim()).filter(Boolean).join(" ");
    const text = ownText || (element.children.length === 0 ? getElementText(element).replace(/\s+/g, " ").trim() : "");
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}...`;
  }
  function getElementText(element) {
    if (element.tagName === "br") {
      return "\n";
    }
    if (element.contentParts.length > 0) {
      return element.contentParts.map(
        (part) => part.type === "text" ? part.value : getElementText(part.element)
      ).join(" ");
    }
    return [
      ...element.textSegments,
      ...element.children.map((child) => getElementText(child))
    ].join(" ");
  }
  function serializeElement(element, options) {
    var _a, _b;
    if (((_a = options.excludeLayerIds) == null ? void 0 : _a.has(options.path)) || ((_b = options.deletedLayerIds) == null ? void 0 : _b.has(options.path)) || options.skipScripts && element.tagName === "script") {
      return "";
    }
    const attributes = stripUnsafeEventAttributes(element.attributes);
    if (options.addLayerAttributes) {
      attributes["data-jigma-layer"] = options.path;
      if (options.activeLayerId === options.path) {
        attributes["data-jigma-active"] = "true";
      }
    }
    const attributeText = Object.entries(attributes).filter(([name]) => name !== "").map(([name, value]) => value === "" ? name : `${name}="${escapeHtml(value)}"`).join(" ");
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
        `<svg data-jigma-layer="${escapeHtml(options.path)}"${options.activeLayerId === options.path ? ' data-jigma-active="true"' : ""}`
      );
    }
    if (VOID_TAGS.has(element.tagName) || element.selfClosing) {
      return attributeText ? `<${element.tagName} ${attributeText}>` : `<${element.tagName}>`;
    }
    const ownText = element.textSegments.map(escapeHtml).join("");
    let visibleChildIndex = 0;
    const childHtml = element.children.map((child) => {
      if (HIDDEN_STRUCTURE_TAGS$1.has(child.tagName)) {
        return options.skipScripts || child.tagName === "script" ? "" : serializeElement(child, {
          ...options,
          path: `${options.path}-meta`
        });
      }
      const childPath = `${options.path}-${visibleChildIndex}`;
      visibleChildIndex += 1;
      return serializeElement(child, {
        ...options,
        path: childPath
      });
    }).join("");
    return `${openTag}${ownText}${childHtml}</${element.tagName}>`;
  }
  function findMatchingBrace$2(css, openIndex) {
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
  function parseBlocks(css) {
    const blocks = [];
    let index = 0;
    while (index < css.length) {
      const openIndex = css.indexOf("{", index);
      if (openIndex === -1) {
        break;
      }
      const closeIndex = findMatchingBrace$2(css, openIndex);
      const selector = css.slice(index, openIndex).trim();
      const body = closeIndex === -1 ? css.slice(openIndex + 1).trim() : css.slice(openIndex + 1, closeIndex).trim();
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
  function splitDeclarations(body) {
    const declarations = [];
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
        const colonIndex2 = current.indexOf(":");
        if (colonIndex2 > 0) {
          declarations.push({
            property: current.slice(0, colonIndex2).trim().toLowerCase(),
            value: current.slice(colonIndex2 + 1).trim()
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
        value: current.slice(colonIndex + 1).trim()
      });
    }
    return declarations;
  }
  function getUsage(property, selector, value) {
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
  function extractCssUrlReferences(css) {
    const references = [];
    const urlPattern = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^"')\s]+))\s*\)/gi;
    parseBlocks(css).forEach((block) => {
      splitDeclarations(block.body).forEach((declaration) => {
        if (!/url\(/i.test(declaration.value) || !/^(background|background-image|mask|mask-image|-webkit-mask-image|content|cursor|src|filter|clip-path)$/i.test(declaration.property)) {
          return;
        }
        let match;
        while ((match = urlPattern.exec(declaration.value)) !== null) {
          const url = (match[1] ?? match[2] ?? match[3] ?? "").trim();
          if (!url || url.startsWith("#")) {
            continue;
          }
          references.push({
            url,
            property: declaration.property,
            selector: block.selector,
            usage: getUsage(declaration.property, block.selector, declaration.value)
          });
        }
      });
    });
    return references;
  }
  function getCssOwnerClass(selector) {
    var _a;
    return (_a = selector.match(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/)) == null ? void 0 : _a[1];
  }
  function numericAttribute(value) {
    if (!value) {
      return void 0;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : void 0;
  }
  function findFirstElement(element, tagName) {
    if (element.tagName === tagName) {
      return element;
    }
    for (const child of element.children) {
      const found = findFirstElement(child, tagName);
      if (found) {
        return found;
      }
    }
    return void 0;
  }
  function getImageDescriptor(element) {
    const image = element.tagName === "img" ? element : findFirstElement(element, "img");
    if (!image) {
      return null;
    }
    const responsiveSources = element.tagName === "picture" ? element.children.filter((child) => child.tagName === "source" && child.attributes.srcset).map((source) => ({
      srcset: source.attributes.srcset,
      media: source.attributes.media,
      sizes: source.attributes.sizes,
      type: source.attributes.type
    })) : [];
    return {
      src: image.attributes.src ?? "",
      alt: image.attributes.alt,
      width: numericAttribute(image.attributes.width),
      height: numericAttribute(image.attributes.height),
      loading: image.attributes.loading,
      decoding: image.attributes.decoding,
      srcset: image.attributes.srcset,
      sizes: image.attributes.sizes,
      responsiveSources
    };
  }
  function getAspectRatio(width, height) {
    if (!width || !height) {
      return void 0;
    }
    return `${width} / ${height}`;
  }
  function isSvgUrl$1(value) {
    return /\.svg(?:[?#]|$)/i.test(value);
  }
  function stableId(seed) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `asset_${(hash >>> 0).toString(36)}`;
  }
  function normalizeUrl(value) {
    return value.trim().replace(/^url\(["']?|["']?\)$/g, "");
  }
  function isExternalUrl$1(value) {
    return /^(https?:)?\/\//i.test(value);
  }
  function isDataUri(value) {
    return /^data:/i.test(value);
  }
  function mimeFromUrl(value) {
    const clean = value.split(/[?#]/)[0].toLowerCase();
    if (clean.endsWith(".svg")) return "image/svg+xml";
    if (clean.endsWith(".webp")) return "image/webp";
    if (clean.endsWith(".png")) return "image/png";
    if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
    if (clean.endsWith(".gif")) return "image/gif";
    if (clean.endsWith(".avif")) return "image/avif";
    if (clean.endsWith(".woff2")) return "font/woff2";
    if (clean.endsWith(".woff")) return "font/woff";
    if (clean.endsWith(".css")) return "text/css";
    if (clean.endsWith(".js")) return "text/javascript";
    return void 0;
  }
  function parseSrcset(value) {
    return value.split(",").map((part) => part.trim().split(/\s+/)[0]).filter(Boolean);
  }
  function getPrimaryClass(element) {
    return getClassNames$1(element)[0];
  }
  function walkElements$1(element, path, callback) {
    callback(element, path);
    element.children.forEach((child, index) => walkElements$1(child, `${path}-${index}`, callback));
  }
  function makeItem(input) {
    const normalizedUrl = normalizeUrl(input.originalUrl);
    const dataUri = isDataUri(normalizedUrl);
    const external = isExternalUrl$1(normalizedUrl);
    return {
      id: stableId(`${input.type}:${normalizedUrl}`),
      type: dataUri ? "data-uri" : input.type,
      source: input.source,
      originalUrl: input.originalUrl,
      normalizedUrl,
      ownerNodeId: input.ownerNodeId,
      ownerClass: input.ownerClass,
      usage: input.usage,
      mimeType: mimeFromUrl(normalizedUrl),
      alt: input.alt,
      width: input.width,
      height: input.height,
      external,
      importable: !dataUri && (external || normalizedUrl.startsWith("/")),
      status: input.status ?? (external ? "preserved" : "native"),
      warnings: input.warnings ?? []
    };
  }
  function addItem(items, item) {
    const key = item.normalizedUrl || `${item.type}:${item.ownerNodeId ?? item.id}`;
    const existing = items.get(key);
    if (!existing) {
      items.set(key, item);
      return;
    }
    existing.warnings = Array.from(/* @__PURE__ */ new Set([...existing.warnings, ...item.warnings]));
    existing.importable = existing.importable || item.importable;
    existing.external = existing.external || item.external;
    existing.status = existing.status === "native" && item.status !== "native" ? item.status : existing.status;
  }
  function warningForItem(item) {
    if (item.warnings.length === 0) {
      return null;
    }
    return {
      id: item.type === "svg-inline" ? "asset:inline-svg" : `asset:${item.id}`,
      code: `asset.${item.type}`,
      severity: item.status === "failed" || item.status === "unsupported" ? "action-required" : "notice",
      title: "Asset review",
      summary: item.warnings[0],
      message: item.warnings[0],
      ownerElementId: item.ownerNodeId,
      ownerLabel: item.ownerClass,
      details: [
        item.type === "svg-inline" && item.ownerClass ? `Owner: ${item.ownerClass}` : "",
        `Source: ${item.originalUrl || item.type}`,
        `Usage: ${item.usage}`,
        `Status: ${item.status}`,
        ...item.warnings.slice(1)
      ].filter(Boolean),
      suggestedAction: item.importable ? "Standalone exports preserve URLs. Import into WordPress Media Library only when explicitly enabled in the plugin." : "Review this asset in Bricks after paste."
    };
  }
  function createAssetManifest(input) {
    const items = /* @__PURE__ */ new Map();
    const parsed = getRenderableRoots(input.html);
    parsed.roots.forEach((root, index) => {
      walkElements$1(root, `${index}`, (element, path) => {
        if (element.tagName === "img" || element.tagName === "picture") {
          const image = getImageDescriptor(element);
          if (!image) {
            return;
          }
          const ownerClass = getPrimaryClass(element);
          if (image.src) {
            addItem(items, makeItem({
              type: isSvgUrl$1(image.src) ? "svg-file" : "image",
              source: "html",
              originalUrl: image.src,
              ownerNodeId: path,
              ownerClass,
              usage: "element",
              alt: image.alt,
              width: image.width,
              height: image.height,
              status: "native",
              warnings: image.alt === void 0 ? ["Image is missing alt text and needs accessibility review."] : []
            }));
          }
          [...image.srcset ? parseSrcset(image.srcset) : [], ...image.responsiveSources.flatMap(
            (source) => parseSrcset(source.srcset)
          )].forEach((url) => {
            addItem(items, makeItem({
              type: "responsive-image",
              source: "html",
              originalUrl: url,
              ownerNodeId: path,
              ownerClass,
              usage: "source-set",
              alt: image.alt,
              status: "preserved",
              warnings: ["Responsive source is preserved for Bricks review when no exact native mapping is available."]
            }));
          });
        }
        if (element.tagName === "svg") {
          addItem(items, makeItem({
            type: "svg-inline",
            source: "html",
            originalUrl: element.attributes.id ? `#${element.attributes.id}` : `inline-svg:${path}`,
            ownerNodeId: path,
            ownerClass: getPrimaryClass(element),
            usage: "element",
            status: "action-required",
            warnings: ["Inline SVG source is preserved as code and requires Bricks signature review after import."]
          }));
        }
        if (element.tagName === "video" && element.attributes.src) {
          addItem(items, makeItem({
            type: "video",
            source: "html",
            originalUrl: element.attributes.src,
            ownerNodeId: path,
            ownerClass: getPrimaryClass(element),
            usage: "element",
            status: "preserved",
            warnings: ["Video sources are preserved by URL and require manual Bricks review."]
          }));
        }
        if (element.tagName === "iframe" && element.attributes.src) {
          addItem(items, makeItem({
            type: "iframe",
            source: "html",
            originalUrl: element.attributes.src,
            ownerNodeId: path,
            ownerClass: getPrimaryClass(element),
            usage: "dependency",
            status: "action-required",
            warnings: ["Iframe embed is preserved as disabled code and requires review."]
          }));
        }
      });
    });
    extractCssUrlReferences(input.css).forEach((reference) => {
      const ownerClass = getCssOwnerClass(reference.selector);
      addItem(items, makeItem({
        type: isSvgUrl$1(reference.url) ? "svg-file" : reference.usage === "background" || reference.usage === "overlay" ? "background-image" : "css-url",
        source: "css",
        originalUrl: reference.url,
        ownerClass,
        usage: reference.usage,
        status: "preserved",
        warnings: reference.usage === "overlay" ? ["Background image and overlay layers are preserved in class-owned CSS when not safely mappable."] : ["CSS URL asset is preserved by URL and not fetched silently."]
      }));
    });
    const externalScriptPattern = /https?:\/\/[^\s"'<>),]+/gi;
    let jsMatch;
    while ((jsMatch = externalScriptPattern.exec(input.js)) !== null) {
      addItem(items, makeItem({
        type: "script",
        source: "js",
        originalUrl: jsMatch[0],
        usage: "script",
        status: "action-required",
        warnings: ["JavaScript dependency is review-required and not inserted by default."]
      }));
    }
    const manifestItems = [...items.values()];
    const inlineEventWarnings = inspectInlineEventHandlers(parsed.roots);
    const warnings = [
      ...manifestItems.map(warningForItem).filter((warning) => Boolean(warning)),
      ...inlineEventWarnings
    ];
    return {
      items: manifestItems,
      summary: {
        nativeImages: manifestItems.filter((item) => item.type === "image" && item.status === "native").length,
        responsiveImages: manifestItems.filter((item) => item.type === "responsive-image").length,
        backgroundImages: manifestItems.filter((item) => item.type === "background-image").length,
        overlaysMapped: manifestItems.filter((item) => item.usage === "overlay" || item.usage === "pseudo-element").length,
        inlineSvgs: manifestItems.filter((item) => item.type === "svg-inline").length,
        svgSignaturesRequired: manifestItems.filter(
          (item) => item.type === "svg-inline" && item.status === "action-required"
        ).length,
        codeElements: input.options.includeJavaScriptCode && input.js.trim() ? 1 : 0,
        externalAssets: manifestItems.filter((item) => item.external).length,
        failedAssets: manifestItems.filter((item) => item.status === "failed").length
      },
      warnings
    };
  }
  function createBricksImageSettings(image) {
    const settings = {};
    if (!image) {
      return settings;
    }
    if (image.src) {
      settings.image = {
        url: image.src,
        ...image.width ? { width: image.width } : {},
        ...image.height ? { height: image.height } : {}
      };
    }
    if (image.alt !== void 0) settings.altText = image.alt;
    if (image.width) settings.width = image.width;
    if (image.height) settings.height = image.height;
    if (image.loading) settings.loading = image.loading;
    if (image.decoding) settings.decoding = image.decoding;
    if (image.srcset) settings.srcset = image.srcset;
    if (image.sizes) settings.sizes = image.sizes;
    if (image.responsiveSources.length) settings.responsiveSources = image.responsiveSources;
    const aspectRatio = getAspectRatio(image.width, image.height);
    if (aspectRatio) settings.aspectRatio = aspectRatio;
    return settings;
  }
  const ROLE_BY_TAG = {
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
    svg: "svg"
  };
  const GENERIC_BLOCK_NAMES = /* @__PURE__ */ new Set([
    "block",
    "component",
    "layout",
    "module",
    "section",
    "wrapper"
  ]);
  const BLOCK_SUFFIX_WORDS = /* @__PURE__ */ new Set([
    "area",
    "block",
    "component",
    "container",
    "layout",
    "module",
    "section",
    "wrapper",
    "wrap"
  ]);
  const PROJECT_PREFIX_WORDS = /* @__PURE__ */ new Set(["jig", "jigma", "ui", "c"]);
  const UTILITY_CLASS_NAMES = /* @__PURE__ */ new Set([
    "active",
    "align-center",
    "container",
    "flex",
    "hidden",
    "is-active",
    "is-hidden",
    "row",
    "show",
    "visible"
  ]);
  const MODIFIER_WORDS = /* @__PURE__ */ new Set([
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
    "wide"
  ]);
  const SEMANTIC_CLASS_WORDS = /* @__PURE__ */ new Set([
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
    "value"
  ]);
  function sanitizeBemPart(value, fallback) {
    const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
    if (!cleaned) {
      return fallback;
    }
    return /^[a-z]/.test(cleaned) ? cleaned : `${fallback}-${cleaned}`;
  }
  function getElementRole(element) {
    return ROLE_BY_TAG[element.tagName] ?? "element";
  }
  function getClassNames(element) {
    return (element.attributes.class ?? "").split(/\s+/).map((className) => className.trim()).filter(Boolean);
  }
  function getOwnText(element) {
    return element.textSegments.map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean).join(" ");
  }
  function stripKnownPrefix(value, projectPrefix) {
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
  function stripBlockSuffix(value) {
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
  function normalizeClassBase(className, projectPrefix) {
    const withoutModifier = className.split("--")[0] ?? className;
    const withoutElement = withoutModifier.split("__")[0] ?? withoutModifier;
    const normalized = sanitizeBemPart(withoutElement, "");
    return stripKnownPrefix(normalized, projectPrefix);
  }
  function getRawClassBase(className) {
    const withoutModifier = className.split("--")[0] ?? className;
    const withoutElement = withoutModifier.split("__")[0] ?? withoutModifier;
    return sanitizeBemPart(withoutElement, "");
  }
  function normalizeElementCandidate(value, projectPrefix) {
    const normalized = sanitizeBemPart(value, "");
    const withoutPrefix = stripKnownPrefix(normalized, projectPrefix);
    return stripBlockSuffix(withoutPrefix);
  }
  function isUsefulClassName(value) {
    return Boolean(value) && !GENERIC_BLOCK_NAMES.has(value) && !UTILITY_CLASS_NAMES.has(value) && !MODIFIER_WORDS.has(value);
  }
  function getRootClassBases(element, projectPrefix, blockPart) {
    const bases = /* @__PURE__ */ new Set([blockPart]);
    getClassNames(element).forEach((className) => {
      const base = normalizeClassBase(className, projectPrefix);
      if (base) {
        bases.add(base);
        bases.add(stripBlockSuffix(base));
      }
    });
    return [...bases].filter(Boolean).sort((a, b) => b.length - a.length);
  }
  function inferRootBlockChoice(element, projectPrefix, fallbackBlock) {
    for (const className of getClassNames(element)) {
      const rawBase = getRawClassBase(className);
      const normalizedBase = stripKnownPrefix(rawBase, projectPrefix);
      const candidate = stripBlockSuffix(normalizedBase);
      if (isUsefulClassName(candidate)) {
        const removedBlockSuffix = normalizedBase !== candidate;
        const shouldPreserveRawBase = !removedBlockSuffix && rawBase.includes("-");
        return {
          blockPart: candidate,
          className: shouldPreserveRawBase ? rawBase : `${projectPrefix}-${candidate}`
        };
      }
    }
    if (!GENERIC_BLOCK_NAMES.has(fallbackBlock)) {
      return {
        blockPart: fallbackBlock,
        className: `${projectPrefix}-${fallbackBlock}`
      };
    }
    return {
      blockPart: fallbackBlock,
      className: `${projectPrefix}-${fallbackBlock}`
    };
  }
  function getBemElementHint(className, projectPrefix, rootClassBases) {
    const [rawBasePart = "", rawElementPart = ""] = className.trim().toLowerCase().split("__");
    const basePart = sanitizeBemPart(rawBasePart.split("--")[0] ?? rawBasePart, "");
    const elementPart = sanitizeBemPart(rawElementPart.split("--")[0] ?? rawElementPart, "");
    if (!elementPart) {
      return null;
    }
    const baseWithoutRoot = stripRootPrefix(
      stripKnownPrefix(basePart, projectPrefix),
      rootClassBases
    );
    const elementHint = normalizeElementCandidate(elementPart, projectPrefix);
    if (baseWithoutRoot && isUsefulClassName(baseWithoutRoot)) {
      return normalizeElementCandidate(`${baseWithoutRoot}-${elementHint}`, projectPrefix);
    }
    return elementHint;
  }
  function stripRootPrefix(value, rootClassBases) {
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
  function splitCandidateModifier(value) {
    const parts = value.split("-").filter(Boolean);
    if (parts.length <= 1) {
      return { role: value, modifier: "" };
    }
    const modifier = parts.at(-1) ?? "";
    if (MODIFIER_WORDS.has(modifier)) {
      return {
        role: parts.slice(0, -1).join("-"),
        modifier
      };
    }
    return { role: value, modifier: "" };
  }
  function improveTagRole(element, fallback) {
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
  function inferElementSemantics(element, projectPrefix, rootClassBases) {
    const classNames = getClassNames(element);
    for (const className of classNames) {
      const hint = getBemElementHint(className, projectPrefix, rootClassBases);
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
          modifier: split.modifier || getModifierHint(classNames, split.role, projectPrefix)
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
          modifier: getModifierHint(classNames, semanticPart, projectPrefix)
        };
      }
    }
    const fallbackRole = improveTagRole(element, getElementRole(element));
    return {
      role: fallbackRole,
      modifier: getModifierHint(classNames, fallbackRole, projectPrefix)
    };
  }
  function getModifierHint(classNames, role, projectPrefix) {
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
  function shouldCountDuplicates(role, modifier) {
    return !modifier && ["block", "element", "heading", "item", "section", "text"].includes(role);
  }
  function createBemClassFactory(options) {
    const projectPrefix = sanitizeBemPart(options.projectPrefix, "jg");
    const fallbackBlock = sanitizeBemPart(options.blockName, "section");
    let blockPart = fallbackBlock;
    let blockName = `${projectPrefix}-${blockPart}`;
    let rootClassBases = [blockPart];
    const roleCounts = /* @__PURE__ */ new Map();
    let rootCount = 0;
    const makeElementClass = (role, modifier) => {
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
      create(element, path, parent) {
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
            className: rootCount === 1 ? blockName : `${blockName}--root-${rootCount}`
          };
        }
        const semantics = inferElementSemantics(element, projectPrefix, rootClassBases);
        return {
          path,
          tagName: element.tagName,
          role: semantics.role,
          className: makeElementClass(semantics.role, semantics.modifier)
        };
      }
    };
  }
  const BRICKS_ELEMENT_LABEL_FIELD = "label";
  const LABEL_PREFIX_WORDS = /* @__PURE__ */ new Set([
    "acme",
    "c",
    "demo",
    "jg",
    "jig",
    "jigma",
    "lit",
    "prefix",
    "ui"
  ]);
  const ROOT_SUFFIX_BY_TAG = {
    article: "Card",
    aside: "Aside",
    footer: "Footer",
    header: "Header",
    main: "Main",
    nav: "Nav",
    section: "Section",
    svg: "SVG"
  };
  function titleCaseWord(word) {
    if (!word) {
      return "";
    }
    if (word.toLowerCase() === "cta") {
      return "CTA";
    }
    if (word.toLowerCase() === "svg") {
      return "SVG";
    }
    return `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`;
  }
  function wordsFromPart(part) {
    return part.split("-").map((word) => word.trim()).filter(Boolean);
  }
  function trimPrefixWords(words) {
    const next = [...words];
    while (next.length > 1 && LABEL_PREFIX_WORDS.has(next[0].toLowerCase())) {
      next.shift();
    }
    return next;
  }
  function formatWords(words) {
    return words.map(titleCaseWord).filter(Boolean).join(" ");
  }
  function parseBemClass(bemClass) {
    const [blockPart, rawElementPart = ""] = bemClass.split("__");
    const [elementPart = "", modifierPart = ""] = rawElementPart.split("--");
    return {
      blockWords: trimPrefixWords(wordsFromPart(blockPart)),
      elementWords: wordsFromPart(elementPart),
      modifierWords: wordsFromPart(modifierPart)
    };
  }
  function createBricksElementLabel(options) {
    const parsed = parseBemClass(options.bemClass);
    const blockLabel = formatWords(parsed.blockWords);
    if (parsed.elementWords.length === 0) {
      const suffix = ROOT_SUFFIX_BY_TAG[options.tagName] ?? "Element";
      if (blockLabel.toLowerCase() === suffix.toLowerCase()) {
        return blockLabel;
      }
      return `${blockLabel} ${suffix}`.trim();
    }
    const elementLabel = formatWords([
      ...parsed.blockWords,
      ...parsed.elementWords,
      ...parsed.modifierWords
    ]);
    if (options.tagName === "svg" && parsed.elementWords.length === 1 && parsed.elementWords[0].toLowerCase() === "svg" && options.parentLabel) {
      return `${options.parentLabel} SVG`;
    }
    return elementLabel || `${blockLabel} Element`.trim();
  }
  function applyBricksElementLabel(element, label) {
    element[BRICKS_ELEMENT_LABEL_FIELD] = label;
    return element;
  }
  function makeId(type, value) {
    let hash = 2166136261;
    const seed = `${type}:${value}`;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `dep_${(hash >>> 0).toString(36)}`;
  }
  function pushUnique(items, item) {
    const sameSourceValue = items.find(
      (existing) => existing.source === item.source && existing.value === item.value
    );
    if (sameSourceValue) {
      sameSourceValue.warning = sameSourceValue.warning ?? item.warning;
      sameSourceValue.required = sameSourceValue.required || item.required;
      sameSourceValue.includable = sameSourceValue.includable || item.includable;
      return;
    }
    const id = makeId(item.type, item.value);
    if (!items.some((existing) => existing.id === id)) {
      items.push({ ...item, id });
    }
  }
  function isExternalUrl(value) {
    return /^(https?:)?\/\//i.test(value);
  }
  function isSvgUrl(value) {
    return /\.svg(?:[?#]|$)/i.test(value);
  }
  function getHostLabel(value) {
    try {
      const url = value.startsWith("//") ? new URL(`https:${value}`) : new URL(value);
      return url.hostname.replace(/^www\./, "");
    } catch {
      return value;
    }
  }
  function cssUrlFamilyKey(value) {
    try {
      const url = value.startsWith("//") ? new URL(`https:${value}`) : new URL(value, "https://jigma.local");
      return `${url.origin}${url.pathname.replace(/[-_](?:desktop|tablet|mobile)(?=\.[a-z0-9]+$)/i, "").replace(/@\d+x(?=\.[a-z0-9]+$)/i, "")}`;
    } catch {
      return value.replace(/[-_](?:desktop|tablet|mobile)(?=\.[a-z0-9]+(?:[?#]|$))/i, "");
    }
  }
  function detectLibrary(value) {
    var _a;
    const normalized = value.toLowerCase();
    const libraries = [
      { pattern: /gsap|greensock/, label: "GSAP" },
      { pattern: /swiper/, label: "Swiper" },
      { pattern: /jquery/, label: "jQuery" },
      { pattern: /tailwind/, label: "Tailwind CDN" },
      { pattern: /font[-_]?awesome|fontawesome/, label: "Font Awesome" },
      { pattern: /splide/, label: "Splide" },
      { pattern: /alpinejs|alpine\.js/, label: "Alpine.js" },
      { pattern: /three(\.module)?\.js|threejs/, label: "Three.js" }
    ];
    return (_a = libraries.find((library) => library.pattern.test(normalized))) == null ? void 0 : _a.label;
  }
  function inspectSvgUseReferences(html, items) {
    const usePattern = /<use\b[^>]*\s(?:href|xlink:href)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;
    let match;
    while ((match = usePattern.exec(html)) !== null) {
      const value = match[1] ?? match[2] ?? match[3] ?? "";
      if (!value || value.startsWith("#")) {
        continue;
      }
      pushUnique(items, {
        type: "svg",
        label: isSvgUrl(value) ? `SVG sprite reference: ${getHostLabel(value)}` : "SVG external reference",
        value,
        source: "html",
        required: true,
        includable: false,
        warning: "SVG sprite references are preserved but must be available in the final Bricks site."
      });
    }
  }
  function walkElements(element, callback) {
    callback(element);
    element.children.forEach((child) => walkElements(child, callback));
  }
  function inspectDependencies(html, css, js) {
    var _a, _b;
    const items = [];
    const parsed = parseHtmlFragment(html);
    inspectSvgUseReferences(html, items);
    parsed.root.children.forEach((root) => {
      walkElements(root, (element) => {
        var _a2;
        if (element.tagName === "link") {
          const href = element.attributes.href;
          const rel = ((_a2 = element.attributes.rel) == null ? void 0 : _a2.toLowerCase()) ?? "";
          if (href && rel.includes("stylesheet")) {
            const isFont = /fonts\.(googleapis|gstatic)\.com/i.test(href);
            pushUnique(items, {
              type: isFont ? "font" : "stylesheet",
              label: isFont ? "Google Fonts stylesheet" : `External stylesheet: ${getHostLabel(href)}`,
              value: href,
              source: "html",
              required: true,
              includable: true,
              warning: "Bricks requires external stylesheets to be reviewed before execution."
            });
          }
        }
        if (element.tagName === "script") {
          const src = element.attributes.src;
          if (src) {
            pushUnique(items, {
              type: "script",
              label: `External script: ${getHostLabel(src)}`,
              value: src,
              source: "html",
              required: true,
              includable: true,
              warning: "External scripts are not run in preview and should be reviewed before adding to Bricks."
            });
          }
        }
        if (element.tagName === "img" && element.attributes.src) {
          const src = element.attributes.src;
          pushUnique(items, {
            type: isSvgUrl(src) ? "svg" : "image",
            label: isSvgUrl(src) ? `SVG image URL: ${getHostLabel(src)}` : `Image URL: ${getHostLabel(src)}`,
            value: src,
            source: "html",
            required: true,
            includable: false,
            warning: isSvgUrl(src) ? "SVG file URLs are listed as dependencies and are not fetched or inlined by Jigma." : void 0
          });
        }
        if (element.tagName === "svg") {
          pushUnique(items, {
            type: "svg",
            label: "Inline SVG asset",
            value: element.attributes.id ? `#${element.attributes.id}` : "inline-svg",
            source: "html",
            required: true,
            includable: false,
            warning: "SVG code may need manual signing or review in Bricks before rendering."
          });
        }
        const library = detectLibrary(JSON.stringify(element.attributes));
        if (library) {
          pushUnique(items, {
            type: "library",
            label: library,
            value: JSON.stringify(element.attributes),
            source: "html",
            required: true,
            includable: false,
            warning: `${library} was detected. Jigma does not bundle library runtime code automatically.`
          });
        }
      });
    });
    const importPattern = /@import\s+(?:url\()?["']?([^"')\s]+)["']?\)?/gi;
    let importMatch;
    while ((importMatch = importPattern.exec(css)) !== null) {
      const value = importMatch[1];
      pushUnique(items, {
        type: /fonts\.(googleapis|gstatic)\.com/i.test(value) ? "font" : "stylesheet",
        label: /fonts\.(googleapis|gstatic)\.com/i.test(value) ? "Google Fonts import" : `CSS import: ${getHostLabel(value)}`,
        value,
        source: "css",
        required: true,
        includable: true,
        warning: "CSS @import rules are preserved in raw CSS mode but may need review in Bricks."
      });
    }
    const cssUrlValues = /* @__PURE__ */ new Set();
    const cssImageUrlGroups = /* @__PURE__ */ new Map();
    const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
    let urlMatch;
    while ((urlMatch = urlPattern.exec(css)) !== null) {
      const value = urlMatch[1];
      if (value.startsWith("data:") || value.startsWith("#")) {
        continue;
      }
      cssUrlValues.add(value);
      if (isSvgUrl(value)) {
        pushUnique(items, {
          type: "svg",
          label: `SVG URL: ${getHostLabel(value)}`,
          value,
          source: "css",
          required: true,
          includable: false
        });
        continue;
      }
      const familyKey = cssUrlFamilyKey(value);
      cssImageUrlGroups.set(familyKey, [...cssImageUrlGroups.get(familyKey) ?? [], value]);
    }
    cssImageUrlGroups.forEach((values) => {
      const uniqueValues = Array.from(new Set(values));
      pushUnique(items, {
        type: "image",
        label: uniqueValues.length > 1 ? `External background image (${uniqueValues.length} responsive variants)` : `CSS asset: ${getHostLabel(uniqueValues[0])}`,
        value: uniqueValues.join("\n"),
        source: "css",
        required: true,
        includable: false
      });
    });
    const fontFacePattern = /@font-face\s*\{([\s\S]*?)\}/gi;
    let fontFaceMatch;
    while ((fontFaceMatch = fontFacePattern.exec(css)) !== null) {
      const body = fontFaceMatch[1];
      const family = ((_b = (_a = body.match(/font-family\s*:\s*["']?([^;"'}]+)["']?/i)) == null ? void 0 : _a[1]) == null ? void 0 : _b.trim()) ?? "custom font";
      pushUnique(items, {
        type: "font",
        label: `Font face: ${family}`,
        value: family,
        source: "css",
        required: true,
        includable: true,
        warning: "@font-face requires manual review before adding it to the final Bricks site."
      });
    }
    const externalPattern = /https?:\/\/[^\s"'<>),]+/gi;
    for (const source of [
      { text: html, source: "html" },
      { text: css, source: "css" },
      { text: js, source: "js" }
    ]) {
      let match;
      while ((match = externalPattern.exec(source.text)) !== null) {
        const value = match[0];
        if (source.source === "css" && cssUrlValues.has(value)) {
          continue;
        }
        const library = detectLibrary(value);
        const isCdn = /cdn|jsdelivr|unpkg|cdnjs|bootstrapcdn|googleapis|gstatic/i.test(value);
        if (library) {
          pushUnique(items, {
            type: "library",
            label: library,
            value,
            source: source.source,
            required: true,
            includable: false,
            warning: `${library} was detected. Confirm the dependency is loaded in the final Bricks site.`
          });
        } else if (isCdn || isExternalUrl(value)) {
          pushUnique(items, {
            type: isCdn ? "cdn" : "stylesheet",
            label: isCdn ? `CDN link: ${getHostLabel(value)}` : `External URL: ${getHostLabel(value)}`,
            value,
            source: source.source,
            required: true,
            includable: false,
            warning: "External URLs are listed for review and are not silently embedded."
          });
        }
      }
    }
    return items;
  }
  const BRICKS_ELEMENT_CUSTOM_CSS_FIELD = "_cssCustom";
  function pushWarning$2(warnings, message, severity = "warning") {
    if (!warnings.some((warning) => warning.message === message)) {
      warnings.push({ severity, message });
    }
  }
  function findMatchingBrace$1(css, openIndex) {
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
  function parseTopLevelBlocks$1(css) {
    const normalizedCss = stripCssComments(css);
    const blocks = [];
    let index = 0;
    while (index < normalizedCss.length) {
      const openIndex = normalizedCss.indexOf("{", index);
      if (openIndex === -1) {
        break;
      }
      const closeIndex = findMatchingBrace$1(normalizedCss, openIndex);
      if (closeIndex === -1) {
        blocks.push({
          selector: normalizedCss.slice(index, openIndex).trim(),
          body: normalizedCss.slice(openIndex + 1).trim()
        });
        break;
      }
      blocks.push({
        selector: normalizedCss.slice(index, openIndex).trim(),
        body: normalizedCss.slice(openIndex + 1, closeIndex).trim()
      });
      index = closeIndex + 1;
    }
    return blocks.filter((block) => block.selector && block.body);
  }
  function stripCssComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, "");
  }
  function formatDeclarations(body) {
    return parseDeclarations(body).map(formatDeclaration).join("\n");
  }
  function minifyDeclarations(declarations) {
    return declarations.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => line.replace(/\s*:\s*/, ":")).join("");
  }
  function indent(value, spaces) {
    const padding = " ".repeat(spaces);
    return value.split("\n").map((line) => `${padding}${line}`).join("\n");
  }
  function formatRootDeclarations(declarations, rootSuffix = "", minify = false) {
    if (minify) {
      return `%root%${rootSuffix}{${minifyDeclarations(declarations)}}`;
    }
    return `%root%${rootSuffix} {
${indent(declarations, 2)}
}`;
  }
  function formatMediaDeclarations(mediaSelector, declarations, rootSuffix = "", minify = false) {
    if (minify) {
      return `${mediaSelector}{${formatRootDeclarations(declarations, rootSuffix, true)}}`;
    }
    return `${mediaSelector} {
${indent(formatRootDeclarations(declarations, rootSuffix), 2)}
}`;
  }
  function formatLiteralDeclarations(selector, declarations, minify = false) {
    if (minify) {
      return `${selector}{${minifyDeclarations(declarations)}}`;
    }
    return `${selector} {
${indent(declarations, 2)}
}`;
  }
  function formatLiteralAtRule(atRuleSelector, selector, declarations, minify = false) {
    if (minify) {
      return `${atRuleSelector}{${formatLiteralDeclarations(selector, declarations, true)}}`;
    }
    return `${atRuleSelector} {
${indent(formatLiteralDeclarations(selector, declarations), 2)}
}`;
  }
  function getExistingElementCss(element) {
    const value = element.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD];
    return typeof value === "string" ? value.trim() : "";
  }
  function attachElementCss(element, css) {
    const existing = getExistingElementCss(element);
    const nextCss = existing ? `${existing}

${css}` : css;
    element.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] = nextCss;
  }
  function unique(items) {
    return Array.from(new Set(items));
  }
  function splitCssList(value, separator = /\s+/) {
    const parts = [];
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
  function parseDeclarations(body) {
    const rawDeclarations = [];
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
    }).filter((declaration) => Boolean(declaration));
  }
  function formatDeclaration(declaration) {
    return `${declaration.property}: ${declaration.value}${declaration.important ? " !important" : ""};`;
  }
  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
  function getSettingsObject(settings, key) {
    const existing = settings[key];
    if (isPlainObject(existing)) {
      return existing;
    }
    const next = {};
    settings[key] = next;
    return next;
  }
  function mergeObjectSetting(settings, key, value) {
    settings[key] = {
      ...getSettingsObject(settings, key),
      ...value
    };
  }
  function makeColorValue(value) {
    return { raw: value };
  }
  function isSimpleColorValue(value) {
    const lowerValue = value.trim().toLowerCase();
    return !/(gradient|url)\s*\(/i.test(lowerValue) && (/^#([0-9a-f]{3,8})$/i.test(lowerValue) || /^(rgb|rgba|hsl|hsla|color|color-mix|var)\(/i.test(lowerValue) || /^(currentcolor|transparent|inherit|initial|unset|[a-z]+)$/.test(lowerValue));
  }
  function extractSingleUrl(value) {
    const matches = [...value.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^"')\s]+))\s*\)/gi)];
    if (matches.length !== 1) {
      return "";
    }
    return (matches[0][1] ?? matches[0][2] ?? matches[0][3] ?? "").trim();
  }
  function isSimpleGradientValue(value) {
    return /^(linear-gradient|radial-gradient|conic-gradient)\(/i.test(value.trim()) && !/url\(/i.test(value);
  }
  function parseBackgroundMediaValue(value) {
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
  function spacingFromShorthand(value) {
    const parts = splitCssList(value);
    const [top, right = top, bottom = top, left = right] = parts;
    return {
      top,
      right,
      bottom,
      left
    };
  }
  function mergeSpacingSide(settings, key, side, value) {
    mergeObjectSetting(settings, key, { [side]: value });
  }
  function makeSettingKey(baseKey, breakpoint, state) {
    return [baseKey, breakpoint, state].filter(Boolean).join(":");
  }
  function getBreakpointFromMedia(mediaSelector) {
    if (!mediaSelector) {
      return void 0;
    }
    const maxWidth = mediaSelector.match(/max-width\s*:\s*(\d+(?:\.\d+)?)px/i);
    if (!maxWidth) {
      return void 0;
    }
    const value = Number(maxWidth[1]);
    if (Number.isNaN(value)) {
      return void 0;
    }
    if (value <= 478) {
      return "mobile_portrait";
    }
    if (value <= 767) {
      return "mobile_landscape";
    }
    return "tablet_portrait";
  }
  function getStateFromPseudo(rootSuffix) {
    const normalized = rootSuffix.replace(/^:/, "").trim();
    return ["hover", "focus", "focus-visible", "active"].includes(normalized) ? normalized : void 0;
  }
  function parseBorderValue(value) {
    const styleWords = /* @__PURE__ */ new Set([
      "none",
      "solid",
      "dashed",
      "dotted",
      "double",
      "groove",
      "ridge",
      "inset",
      "outset"
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
      ...width ? { width: spacingFromShorthand(width) } : {},
      style,
      ...color ? { color: makeColorValue(color) } : {}
    };
  }
  function mergeBorderSetting(settings, key, value) {
    mergeObjectSetting(settings, key, value);
  }
  function applyNativeSetting(settings, declaration, breakpoint, state) {
    if (declaration.important) {
      return false;
    }
    const key = (baseKey) => makeSettingKey(baseKey, breakpoint, state);
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
      mergeSpacingSide(settings, key("_inset"), insetSide[1], value);
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
      mergeSpacingSide(settings, key("_margin"), marginSide[1], value);
      return true;
    }
    const paddingSide = property.match(/^padding-(top|right|bottom|left)$/);
    if (paddingSide) {
      mergeSpacingSide(settings, key("_padding"), paddingSide[1], value);
      return true;
    }
    const typographyPropertyMap = /* @__PURE__ */ new Set([
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
      "word-break"
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
  function getBemAliases(bemClass) {
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
  function getClassAliases(target) {
    return unique([...target.sourceClasses, ...getBemAliases(target.bemClass)]);
  }
  function getLastCompoundSelector(selector) {
    return selector.trim().split(/\s+|>|\+|~/).map((part) => part.trim()).filter(Boolean).at(-1) ?? "";
  }
  function getPseudoSuffix(selector) {
    const compound = getLastCompoundSelector(selector);
    const pseudoPattern = /(:{1,2}[a-zA-Z-]+(?:\([^)]*\))?)+$/;
    const pseudoMatch = compound.match(pseudoPattern);
    if (!pseudoMatch) {
      return {
        suffix: "",
        unsupported: false
      };
    }
    const suffix = pseudoMatch[0];
    const unsupported = /:(?:not|has|is|where|nth-|root\b)/i.test(suffix);
    return {
      suffix,
      unsupported
    };
  }
  function getSelectorParts(selector) {
    const compound = getLastCompoundSelector(selector);
    const classes = [];
    const ids = [];
    let match;
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
      compound
    };
  }
  function intersectTargets(groups) {
    if (groups.length === 0) {
      return /* @__PURE__ */ new Set();
    }
    return groups.slice(1).reduce((current, group) => {
      return new Set([...current].filter((target) => group.has(target)));
    }, new Set(groups[0]));
  }
  function resolveSelectorTargets(selector, classMap, idMap) {
    const parts = getSelectorParts(selector);
    const groups = [];
    const missingNames = [];
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
      hasTargetableSelector: parts.classes.length > 0 || parts.ids.length > 0
    };
  }
  function addMapEntry(map, key, target) {
    if (!key) {
      return;
    }
    const existing = map.get(key) ?? /* @__PURE__ */ new Set();
    existing.add(target);
    map.set(key, existing);
  }
  function addClassMapEntry(map, key, target) {
    if (!key) {
      return;
    }
    const existing = map.get(key) ?? /* @__PURE__ */ new Set();
    existing.add(target);
    map.set(key, existing);
  }
  function resolveClassSelectorTargets(selector, classMap, idMap) {
    const parts = getSelectorParts(selector);
    const missingNames = [];
    const matchedByClass = parts.classes.map((className) => ({
      className,
      matches: classMap.get(className)
    }));
    const matchedById = parts.ids.map((id) => ({
      id,
      matches: idMap.get(id)
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
    if (classTarget == null ? void 0 : classTarget.matches) {
      return {
        targets: classTarget.matches,
        missingNames,
        hasTargetableSelector: true
      };
    }
    const idTarget = matchedById.find((entry) => entry.matches);
    if (idTarget == null ? void 0 : idTarget.matches) {
      return {
        targets: idTarget.matches,
        missingNames,
        hasTargetableSelector: true
      };
    }
    return {
      targets: /* @__PURE__ */ new Set(),
      missingNames,
      hasTargetableSelector: parts.classes.length > 0 || parts.ids.length > 0
    };
  }
  function getSelectorClassTokens(selector) {
    const tokens = [];
    const classPattern = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g;
    let match;
    while ((match = classPattern.exec(selector)) !== null) {
      tokens.push({
        className: match[1],
        index: match.index
      });
    }
    return tokens;
  }
  function getPreferredClassTarget(className, classMap) {
    const matches = classMap.get(className);
    if (!matches || matches.size === 0) {
      return null;
    }
    return [...matches].find((target) => target.className === className) ?? [...matches][0];
  }
  function selectorNeedsScopedFallback(selector) {
    const trimmed = selector.trim();
    return trimmed !== getLastCompoundSelector(trimmed) || /[\[\]>+~]|\s+|:(?:has|is|where|not|nth-)/i.test(trimmed);
  }
  function getOwningClassTarget(selector, classMap) {
    const tokens = getSelectorClassTokens(selector);
    const matchedTargets = tokens.map((token) => getPreferredClassTarget(token.className, classMap)).filter((target) => Boolean(target));
    const modifier = matchedTargets.find((target) => target.className.includes("--"));
    if (modifier) {
      return modifier;
    }
    return matchedTargets[0] ?? null;
  }
  function normalizeCssSearchText(value) {
    return stripCssComments(value).replace(/\s+/g, " ").replace(/\s*([{}:;,>+~])\s*/g, "$1").trim();
  }
  function collectConservationDeclarations(css, contexts = []) {
    const records = [];
    parseTopLevelBlocks$1(css).forEach((block) => {
      if (/^@(?:media|container|supports)\b/i.test(block.selector)) {
        records.push(...collectConservationDeclarations(block.body, [...contexts, block.selector]));
        return;
      }
      if (/^@(?:-\w+-)?keyframes\b/i.test(block.selector)) {
        records.push({
          selector: block.selector,
          declaration: block.body.trim(),
          contexts,
          classification: "page-level"
        });
        return;
      }
      const declarations = parseDeclarations(block.body).map(formatDeclaration);
      if (declarations.length === 0) {
        return;
      }
      if (block.selector === ":root" || /^@font-face\b/i.test(block.selector)) {
        declarations.forEach((declaration) => {
          records.push({
            selector: block.selector,
            declaration,
            contexts,
            classification: "page-level"
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
            classification: "unsupported"
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
            classification: "class-owned"
          });
        });
      });
    });
    return records;
  }
  function outputContainsDeclaration(outputCss, selector, declaration, contexts) {
    const normalizedOutput = normalizeCssSearchText(outputCss);
    const normalizedSelector = normalizeCssSearchText(selector);
    const normalizedDeclaration = normalizeCssSearchText(declaration);
    const selectorNeedle = `${normalizedSelector}{`;
    let selectorIndex = normalizedOutput.indexOf(selectorNeedle);
    while (selectorIndex !== -1) {
      const declarationIndex = normalizedOutput.indexOf(normalizedDeclaration, selectorIndex + selectorNeedle.length);
      const nextSelectorIndex = normalizedOutput.indexOf("{", selectorIndex + selectorNeedle.length);
      const declarationBelongsToSelector = declarationIndex !== -1 && (nextSelectorIndex === -1 || declarationIndex < nextSelectorIndex);
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
  function auditCssDeclarationConservation(sourceCss, outputCss) {
    const records = collectConservationDeclarations(sourceCss);
    let preservedDeclarationCount = 0;
    let pageLevelDeclarationCount = 0;
    let unsupportedDeclarationCount = 0;
    const missingDeclarations = [];
    records.forEach((record) => {
      if (record.classification === "page-level") {
        pageLevelDeclarationCount += 1;
        return;
      }
      if (record.classification === "class-owned" && outputContainsDeclaration(outputCss, record.selector, record.declaration, record.contexts)) {
        preservedDeclarationCount += 1;
        return;
      }
      unsupportedDeclarationCount += 1;
      missingDeclarations.push([
        ...record.contexts,
        record.selector,
        record.declaration
      ].join(" | "));
    });
    const accountedCount = preservedDeclarationCount + pageLevelDeclarationCount;
    const coveragePercentage = records.length > 0 ? Math.round(accountedCount / records.length * 100) : 100;
    return {
      sourceDeclarationCount: records.length,
      preservedDeclarationCount,
      pageLevelDeclarationCount,
      unsupportedDeclarationCount,
      missingDeclarations,
      coveragePercentage,
      valid: unsupportedDeclarationCount === 0
    };
  }
  function mapSelectorToGeneratedBem(selector, owner, classMap) {
    let ownerReplaced = false;
    const mappedSelector = selector.replace(
      /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g,
      (match, className) => {
        const target = getPreferredClassTarget(className, classMap);
        if (!target) {
          return match;
        }
        if (!ownerReplaced && target.className === owner.className) {
          ownerReplaced = true;
          return "%root%";
        }
        return `.${target.className}`;
      }
    );
    return ownerReplaced ? mappedSelector : `%root% ${mappedSelector}`;
  }
  function mapSelectorToLiteralBem(selector, classMap, idMap) {
    let unresolved = false;
    const mappedSelector = selector.replace(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g, (match, className) => {
      const target = getPreferredClassTarget(className, classMap);
      if (!target) {
        unresolved = true;
        return match;
      }
      return `.${target.className}`;
    }).replace(/#(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g, (match, id) => {
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
  function scopedSelectorSuffix(scopedSelector) {
    return scopedSelector.startsWith("%root%") ? scopedSelector.slice("%root%".length) : ` ${scopedSelector}`;
  }
  function formatRawAtRule(selector, body) {
    return `${selector} {
${indent(body.trim(), 2)}
}`;
  }
  function formatCssBucket(bucket, minify) {
    const snippets = [];
    bucket.root.forEach((declarationList, rootSuffix) => {
      snippets.push(formatRootDeclarations(
        declarationList.join("\n"),
        rootSuffix,
        minify
      ));
    });
    bucket.media.forEach((mediaBucket, mediaSelector) => {
      mediaBucket.forEach((declarationList, rootSuffix) => {
        snippets.push(formatMediaDeclarations(
          mediaSelector,
          declarationList.join("\n"),
          rootSuffix,
          minify
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
  function attachCssToElements(css, targets, options = {}) {
    const warnings = [];
    const classMap = /* @__PURE__ */ new Map();
    const idMap = /* @__PURE__ */ new Map();
    const attachmentBuckets = /* @__PURE__ */ new Map();
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
    const addDeclarations = (target, declarations, rootSuffix, mediaSelector) => {
      const bucket = attachmentBuckets.get(target) ?? {
        root: /* @__PURE__ */ new Map(),
        media: /* @__PURE__ */ new Map(),
        raw: []
      };
      if (mediaSelector) {
        const mediaBucket = bucket.media.get(mediaSelector) ?? /* @__PURE__ */ new Map();
        mediaBucket.set(rootSuffix, [...mediaBucket.get(rootSuffix) ?? [], declarations]);
        bucket.media.set(mediaSelector, mediaBucket);
      } else {
        bucket.root.set(rootSuffix, [...bucket.root.get(rootSuffix) ?? [], declarations]);
      }
      attachmentBuckets.set(target, bucket);
    };
    const processBlocks = (inputCss, mediaSelector) => {
      const blocks = parseTopLevelBlocks$1(inputCss);
      blocks.forEach((block) => {
        if (/^@media\b/i.test(block.selector)) {
          processBlocks(block.body, block.selector);
          responsiveRuleCount += 1;
          pushWarning$2(
            warnings,
            `CSS media query "${block.selector}" was attached to matching elements using element custom CSS.`,
            "info"
          );
          return;
        }
        if (/^@/.test(block.selector) || block.selector === ":root") {
          unmappedRuleCount += 1;
          pushWarning$2(warnings, `Dropped unsupported CSS block "${block.selector}" for element-level export.`);
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
            pushWarning$2(warnings, `Dropped unsupported selector "${selector}"; it could not be attached to a single exported element.`);
            return;
          }
          const pseudo = getPseudoSuffix(selector);
          if (pseudo.unsupported) {
            pseudoSelectorCount += 1;
            pushWarning$2(warnings, `Dropped pseudo selector "${selector}"; it could not be safely attached to a single Bricks element.`);
            return;
          }
          if (pseudo.suffix) {
            pseudoRuleCount += 1;
          }
          const resolved = resolveSelectorTargets(selector, classMap, idMap);
          if (!resolved.hasTargetableSelector) {
            unmappedRuleCount += 1;
            pushWarning$2(warnings, `Dropped unsupported selector "${selector}"; it could not be mapped to generated BEM element styles.`);
            return;
          }
          if (resolved.missingNames.length > 0 || resolved.targets.size === 0) {
            unmappedRuleCount += 1;
            pushWarning$2(
              warnings,
              `Dropped selector "${selector}" because it references classes or IDs not present in exported layers.`
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
        pushWarning$2(warnings, "CSS could not be parsed into rules and was not attached.");
      }
    };
    processBlocks(css);
    attachmentBuckets.forEach((bucket, target) => {
      const css2 = formatCssBucket(bucket, options.minify);
      if (css2) {
        attachElementCss(target.element, css2);
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
      styledClassIds: /* @__PURE__ */ new Set(),
      fallbackStrategy: "none"
    };
  }
  function attachCssToGlobalClasses(css, targets, options = {}) {
    const warnings = [];
    const classMap = /* @__PURE__ */ new Map();
    const idMap = /* @__PURE__ */ new Map();
    const attachmentBuckets = /* @__PURE__ */ new Map();
    const literalFallbackBuckets = /* @__PURE__ */ new Map();
    const literalFallbackKeys = /* @__PURE__ */ new Set();
    const fallbackRuleCountByClassName = /* @__PURE__ */ new Map();
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
    const keyframesByName = /* @__PURE__ */ new Map();
    const styledClassIds = /* @__PURE__ */ new Set();
    targets.forEach((target) => {
      unique([...target.sourceClasses, target.className]).forEach(
        (className) => addClassMapEntry(classMap, className, target)
      );
      addClassMapEntry(idMap, target.sourceId, target);
    });
    const rootTarget = targets.find((target) => !target.className.includes("__")) ?? targets[0];
    const addDeclarations = (target, declarations, rootSuffix, mediaSelector) => {
      const bucket = attachmentBuckets.get(target) ?? {
        root: /* @__PURE__ */ new Map(),
        media: /* @__PURE__ */ new Map(),
        raw: []
      };
      if (mediaSelector) {
        const mediaBucket = bucket.media.get(mediaSelector) ?? /* @__PURE__ */ new Map();
        mediaBucket.set(rootSuffix, [...mediaBucket.get(rootSuffix) ?? [], declarations]);
        bucket.media.set(mediaSelector, mediaBucket);
      } else {
        bucket.root.set(rootSuffix, [...bucket.root.get(rootSuffix) ?? [], declarations]);
      }
      attachmentBuckets.set(target, bucket);
    };
    const incrementFallbackRuleCount = (target) => {
      fallbackRuleCountByClassName.set(
        target.className,
        (fallbackRuleCountByClassName.get(target.className) ?? 0) + 1
      );
      literalFallbackRuleCount += 1;
    };
    const addLiteralFallback = (target, selector, declarations, mediaSelector) => {
      const cssBlock = mediaSelector ? formatLiteralAtRule(mediaSelector, selector, declarations, options.minify) : formatLiteralDeclarations(selector, declarations, options.minify);
      const key = `${mediaSelector ?? ""}
${selector}
${declarations}`;
      if (literalFallbackKeys.has(key)) {
        return;
      }
      literalFallbackKeys.add(key);
      literalFallbackBuckets.set(target, [...literalFallbackBuckets.get(target) ?? [], cssBlock]);
      incrementFallbackRuleCount(target);
    };
    const addLiteralRawFallback = (target, rawCss) => {
      const key = `raw
${rawCss.trim()}`;
      if (literalFallbackKeys.has(key)) {
        return;
      }
      literalFallbackKeys.add(key);
      literalFallbackBuckets.set(target, [...literalFallbackBuckets.get(target) ?? [], rawCss.trim()]);
      incrementFallbackRuleCount(target);
    };
    const addClassFallback = (target, declarations, rootSuffix, mediaSelector, literalSelector) => {
      if (classFallbackStrategy === "bricks-class-root") {
        addDeclarations(target, declarations, rootSuffix, mediaSelector);
        return;
      }
      addLiteralFallback(
        target,
        literalSelector ?? `.${target.className}${rootSuffix}`,
        declarations,
        mediaSelector
      );
    };
    const addRawCss = (target, rawCss) => {
      if (classFallbackStrategy === "literal-bem") {
        addLiteralRawFallback(target, rawCss);
        return;
      }
      const bucket = attachmentBuckets.get(target) ?? {
        root: /* @__PURE__ */ new Map(),
        media: /* @__PURE__ */ new Map(),
        raw: []
      };
      if (!bucket.raw.includes(rawCss)) {
        bucket.raw.push(rawCss);
      }
      attachmentBuckets.set(target, bucket);
    };
    const processBlocks = (inputCss, mediaSelector) => {
      const blocks = parseTopLevelBlocks$1(inputCss);
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
            pushWarning$2(
              warnings,
              `Keyframes "${name}" has conflicting definitions. The first definition was preserved on ${(rootTarget == null ? void 0 : rootTarget.className) ?? "the root class"}.`
            );
            return;
          }
          if (!keyframesByName.has(name) && rootTarget) {
            keyframesByName.set(name, rawCss);
            addRawCss(rootTarget, rawCss);
            styledClassIds.add(rootTarget.globalClass.id);
            customCssFallbackCount += 1;
            blockScopedFallbackCount += 1;
            pushWarning$2(
              warnings,
              `Keyframes "${name}" were preserved once in class-owned fallback CSS for ${rootTarget.className}.`,
              "info"
            );
          }
          return;
        }
        if (/^@font-face\b/i.test(block.selector)) {
          unmappedRuleCount += 1;
          pushWarning$2(
            warnings,
            "@font-face was detected and listed as a font dependency instead of being duplicated into Bricks class CSS.",
            "info"
          );
          return;
        }
        if (block.selector === ":root") {
          unmappedRuleCount += 1;
          pushWarning$2(warnings, "CSS :root variables were detected. Variable references are preserved, but variable import is not implemented yet.", "info");
          return;
        }
        if (/^@/.test(block.selector)) {
          if (rootTarget) {
            addRawCss(rootTarget, formatRawAtRule(block.selector, block.body));
            styledClassIds.add(rootTarget.globalClass.id);
            customCssFallbackCount += 1;
            blockScopedFallbackCount += 1;
            pushWarning$2(
              warnings,
              `Unsupported at-rule "${block.selector}" was preserved in class-owned fallback CSS for ${rootTarget.className}; fidelity may differ.`
            );
          } else {
            unmappedRuleCount += 1;
            pushWarning$2(warnings, `Unsupported at-rule "${block.selector}" could not be attached because no owning class exists.`);
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
              pushWarning$2(
                warnings,
                `Selector "${selector}" could not be assigned to a preserved Bricks class. Missing: ${missingTokens.map((token) => `.${token.className}`).join(", ") || "owning class"}.`
              );
              return;
            }
            addLiteralFallback(
              owner,
              selector,
              declarations.map(formatDeclaration).join("\n"),
              mediaSelector
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
              pushWarning$2(
                warnings,
                `Selector "${selector}" could not be safely mapped to generated classes. Missing: ${missingTokens.map((token) => `.${token.className}`).join(", ") || "owning class"}.`
              );
              return;
            }
            const scopedSelector = mapSelectorToGeneratedBem(selector, owner, classMap);
            const literalSelector = mapSelectorToLiteralBem(selector, classMap, idMap);
            if (!literalSelector) {
              unmappedRuleCount += 1;
              pushWarning$2(
                warnings,
                `Selector "${selector}" could not be rewritten to generated BEM fallback CSS.`
              );
              return;
            }
            addClassFallback(
              owner,
              declarations.map(formatDeclaration).join("\n"),
              scopedSelectorSuffix(scopedSelector),
              mediaSelector,
              literalSelector
            );
            customCssFallbackCount += declarations.length;
            blockScopedFallbackCount += 1;
            styledClassIds.add(owner.globalClass.id);
            attachedRuleCount += 1;
            pushWarning$2(
              warnings,
              `"${selector}" was scoped to the "${owner.className}" class using "${scopedSelector}".`,
              "info"
            );
            return;
          }
          const resolved = resolveClassSelectorTargets(selector, classMap, idMap);
          if (!resolved.hasTargetableSelector) {
            unmappedRuleCount += 1;
            pushWarning$2(warnings, `Selector "${selector}" could not be mapped to a generated Bricks class.`);
            return;
          }
          if (resolved.missingNames.length > 0 || resolved.targets.size === 0) {
            unmappedRuleCount += 1;
            pushWarning$2(
              warnings,
              `Selector "${selector}" references classes or IDs not present in exported layers: ${resolved.missingNames.join(", ")}.`
            );
            return;
          }
          resolved.targets.forEach((target) => {
            const breakpoint = getBreakpointFromMedia(mediaSelector);
            const state = getStateFromPseudo(pseudo.suffix);
            const canMapNatively = (!mediaSelector || Boolean(breakpoint)) && (!pseudo.suffix || Boolean(state));
            const fallbackDeclarations = [];
            declarations.forEach((declaration) => {
              const mapped = canMapNatively && applyNativeSetting(target.globalClass.settings, declaration, breakpoint, state);
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
                pushWarning$2(
                  warnings,
                  `Selector "${selector}" could not be rewritten to generated BEM fallback CSS.`
                );
                return;
              }
              addClassFallback(
                target,
                fallbackDeclarations.map(formatDeclaration).join("\n"),
                pseudo.suffix,
                mediaSelector,
                literalSelector
              );
              customCssFallbackCount += fallbackDeclarations.length;
              fallbackDeclarations.forEach((declaration) => {
                pushWarning$2(
                  warnings,
                  `"${declaration.property}" from "${selector}" was preserved in class-owned fallback CSS for "${target.className}".`,
                  "info"
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
        pushWarning$2(warnings, "CSS could not be parsed into rules and was not attached.");
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
      const existing = typeof target.globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] === "string" ? `${target.globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD]}`.trim() : "";
      const cssValue = blocks.join("\n\n");
      target.globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] = existing ? `${existing}

${cssValue}` : cssValue;
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
      fallbackStrategy: classFallbackStrategy === "literal-bem" && literalFallbackBuckets.size > 0 ? "literal-bem" : classFallbackStrategy === "bricks-class-root" && attachmentBuckets.size > 0 ? "bricks-class-root" : "none",
      fallbackRuleCountByClassName
    };
  }
  function pushWarning$1(warnings, message, severity = "warning") {
    if (!warnings.some((warning) => warning.message === message)) {
      warnings.push({ severity, message });
    }
  }
  function findMatchingBrace(css, openIndex) {
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
  function parseTopLevelBlocks(css) {
    const blocks = [];
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
          body: css.slice(openIndex + 1).trim()
        });
        break;
      }
      blocks.push({
        selector: css.slice(index, openIndex).trim(),
        body: css.slice(openIndex + 1, closeIndex).trim()
      });
      index = closeIndex + 1;
    }
    return blocks.filter((block) => block.selector && block.body);
  }
  function formatRule(selector, body) {
    const declarations = body.split(";").map((line) => line.trim()).filter(Boolean).map((line) => `  ${line.endsWith(";") ? line : `${line};`}`).join("\n");
    return `${selector} {
${declarations}
}`;
  }
  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function expandReplacement(selectors, pattern, sigil, lookup, usedNames, missingNames) {
    let expanded = selectors;
    const names = /* @__PURE__ */ new Set();
    let match;
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
        "g"
      );
      expanded = expanded.flatMap(
        (selector) => replacements.map(
          (replacement) => selector.replace(tokenPattern, `.${replacement}`)
        )
      );
    });
    return expanded;
  }
  function scopeSelector(selector, scopeMap, usedClassNames, usedIds) {
    const trimmed = selector.trim();
    const missingNames = /* @__PURE__ */ new Set();
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
      missingNames
    );
    selectors = expandReplacement(
      selectors,
      /#(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g,
      "#",
      (name) => {
        const mapped = scopeMap.ids.get(name);
        return mapped ? [mapped] : void 0;
      },
      usedIds,
      missingNames
    );
    if (missingNames.size > 0) {
      return { selectors: [], missingNames, unsupported: true, pseudo: false };
    }
    const scopedSelectors = selectors.map((item) => item.trim()).filter(Boolean);
    const stillUsesOriginalSelector = scopedSelectors.some(
      (item) => [...scopeMap.classes.keys()].some((className) => item.includes(`.${className}`)) || [...scopeMap.ids.keys()].some((id) => item.includes(`#${id}`))
    );
    return {
      selectors: stillUsesOriginalSelector ? [] : Array.from(new Set(scopedSelectors)),
      missingNames,
      unsupported: stillUsesOriginalSelector,
      pseudo: false
    };
  }
  function scopeCssToBem(css, scopeMap) {
    const warnings = [];
    const output = [];
    const usedClassNames = /* @__PURE__ */ new Set();
    const usedIds = /* @__PURE__ */ new Set();
    let scopedRuleCount = 0;
    let unmappedRuleCount = 0;
    let unusedSelectorCount = 0;
    let pseudoSelectorCount = 0;
    const processBlocks = (inputCss, insideAtRule = false) => {
      const blocks = parseTopLevelBlocks(inputCss);
      const scopedBlocks = [];
      blocks.forEach((block) => {
        if (block.selector === ":root") {
          scopedBlocks.push(formatRule(":root", block.body));
          scopedRuleCount += 1;
          return;
        }
        if (/^@media\b/i.test(block.selector)) {
          const inner = processBlocks(block.body, true);
          if (inner.trim()) {
            scopedBlocks.push(`${block.selector} {
${inner.split("\n").map((line) => `  ${line}`).join("\n")}
}`);
            pushWarning$1(warnings, "CSS media query was preserved only where inner selectors mapped to generated BEM classes.", "info");
          } else {
            pushWarning$1(warnings, `Dropped media query "${block.selector}" because none of its selectors mapped to exported BEM classes.`);
          }
          return;
        }
        if (/^@(font-face|keyframes|supports|layer)\b/i.test(block.selector)) {
          unmappedRuleCount += 1;
          pushWarning$1(warnings, `Dropped unsupported at-rule "${block.selector}".`);
          return;
        }
        const selectors = block.selector.split(",");
        const scopedSelectors = selectors.flatMap((selector) => {
          const scoped = scopeSelector(selector, scopeMap, usedClassNames, usedIds);
          if (scoped.pseudo) {
            pseudoSelectorCount += 1;
            pushWarning$1(warnings, `Dropped pseudo selector "${selector.trim()}"; pseudo-elements/classes need manual Bricks CSS review.`);
          }
          if (scoped.missingNames.size > 0) {
            unusedSelectorCount += scoped.missingNames.size;
            pushWarning$1(
              warnings,
              `Dropped selector "${selector.trim()}" because it references classes or IDs not present in exported layers.`
            );
          } else if (scoped.unsupported) {
            unmappedRuleCount += 1;
            pushWarning$1(warnings, `Dropped unsupported selector "${selector.trim()}"; it could not be scoped to generated BEM.`);
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
        pushWarning$1(warnings, "CSS could not be parsed into rules and was not exported.");
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
      pseudoSelectorCount
    };
  }
  const BRICKS_COMPATIBILITY_SCHEMA_VERSION = "bricks-compatibility.v1";
  const TARGET_BRICKS_VERSION = "2.3.7";
  const HIDDEN_STRUCTURE_TAGS = /* @__PURE__ */ new Set([
    "script",
    "style",
    "link",
    "meta",
    "title",
    "base",
    "template",
    "source"
  ]);
  const TEXT_TAGS = /* @__PURE__ */ new Set(["p", "span", "strong", "em", "small", "b", "i", "mark", "li", "blockquote"]);
  const CLASS_OWNED_PHRASING_TAGS = /* @__PURE__ */ new Set([
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
    "sup"
  ]);
  const WRAPPER_TAGS = /* @__PURE__ */ new Set(["div", "article", "header", "main", "footer", "nav", "aside", "ul", "ol"]);
  const SEMANTIC_WRAPPER_TAGS = /* @__PURE__ */ new Set(["header", "main", "footer", "nav", "article", "aside", "figure", "ul", "ol"]);
  const NON_NESTABLE_BRICKS_ELEMENTS = /* @__PURE__ */ new Set([
    "heading",
    "text-link",
    "button",
    "text-basic",
    "svg",
    "image",
    "rich-text"
  ]);
  const SUPPORTED_TAGS = /* @__PURE__ */ new Set([
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
    "blockquote"
  ]);
  const PRESERVED_ATTRIBUTE_NAMES = /* @__PURE__ */ new Set([
    "decoding",
    "hidden",
    "loading",
    "role",
    "title",
    "width",
    "height"
  ]);
  const CONSUMED_ATTRIBUTE_NAMES = /* @__PURE__ */ new Set(["class", "href", "id", "rel", "target"]);
  function makeStableId(seed) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    const id = (hash >>> 0).toString(36).padStart(6, "0").slice(0, 6);
    return /^[a-z]/.test(id) ? id : `j${id.slice(1)}`;
  }
  function makeGlobalClassId(className) {
    return makeStableId(`class:${className}`);
  }
  function makeUniqueGlobalClassId(className, usedIds) {
    let attempt = 0;
    let id = makeGlobalClassId(className);
    while (usedIds.has(id)) {
      attempt += 1;
      id = makeStableId(`class:${className}:${attempt}`);
    }
    usedIds.add(id);
    return id;
  }
  function isNativeBemClassMode(exportMode) {
    return exportMode === "native-bem-classes" || exportMode === "global-classes";
  }
  function pushWarning(warnings, message, severity = "warning") {
    if (!warnings.some((warning) => warning.message === message)) {
      warnings.push({ severity, message });
    }
  }
  function pushGroupedWarning(warnings, warning) {
    const id = warning.id ?? [warning.code, warning.ownerElementId, warning.ownerLabel, warning.message].filter(Boolean).join(":");
    const existing = warnings.find((item) => (item.id ?? item.message) === id);
    if (existing) {
      existing.count = (existing.count ?? 1) + (warning.count ?? 1);
      existing.details = Array.from(/* @__PURE__ */ new Set([...existing.details ?? [], ...warning.details ?? []]));
      return;
    }
    warnings.push({
      count: 1,
      ...warning,
      id
    });
  }
  function isActionableCssWarning(warning) {
    if (warning.severity !== "info" && warning.severity !== "notice") {
      return true;
    }
    return /@font-face|could not|dropped|missing|failed|unresolved|not present|requires manual review/i.test(warning.message);
  }
  function escapeAttribute(value) {
    return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  }
  function escapeHtmlText(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }
  function decodeComparableEntities(value) {
    return value.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16))).replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10))).replaceAll("&nbsp;", " ").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
  }
  function normalizeComparableText(value) {
    return decodeComparableEntities(value).replace(/\s+/g, " ").trim();
  }
  function stripInlineMarkup(value) {
    return value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ");
  }
  function isPreservedAttribute(name) {
    return PRESERVED_ATTRIBUTE_NAMES.has(name) || name.startsWith("aria-") || name.startsWith("data-");
  }
  function isValidClassName(className) {
    return /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(className);
  }
  function hasRenderableChildren(element) {
    return element.children.some((child) => !HIDDEN_STRUCTURE_TAGS.has(child.tagName));
  }
  function hasOnlyMediaChildren(element) {
    const children = element.children.filter((child) => !HIDDEN_STRUCTURE_TAGS.has(child.tagName));
    return children.length > 0 && children.every((child) => child.tagName === "img" || child.tagName === "picture");
  }
  function hasClassedPhrasingChild(element) {
    return element.children.some(
      (child) => !HIDDEN_STRUCTURE_TAGS.has(child.tagName) && CLASS_OWNED_PHRASING_TAGS.has(child.tagName) && (getClassNames$1(child).length > 0 || hasClassedPhrasingChild(child))
    );
  }
  function hasClassBearingPhrasingChild(element) {
    return element.children.some(
      (child) => !HIDDEN_STRUCTURE_TAGS.has(child.tagName) && CLASS_OWNED_PHRASING_TAGS.has(child.tagName) && (getClassNames$1(child).length > 0 || Boolean(child.attributes.id) || hasClassBearingPhrasingChild(child))
    );
  }
  function shouldPreserveEmptyPhrasingElement(element) {
    return CLASS_OWNED_PHRASING_TAGS.has(element.tagName) && hasOnlyPhrasingContent(element) && !serializeInlineContent(element).trim();
  }
  function shouldMapPhrasingContainerToText(element, compatibilityProfile) {
    if (!compatibilityProfile || !hasOnlyPhrasingContent(element) || hasClassBearingPhrasingChild(element)) {
      return false;
    }
    if (!getClassNames$1(element).length && !element.attributes.id && element.tagName !== "blockquote") {
      return false;
    }
    const inlineHtml = serializeInlineContent(element);
    return inlineHtml.trim().length > 0;
  }
  function getBricksMapping(element, compatibilityProfile = false) {
    const tag = element.tagName;
    const text = getOwnText$1(element, 500);
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
      if (hasChildren && (!hasOnlyPhrasingContent(element) && !hasOnlyMediaChildren(element) || hasClassedPhrasingChild(element))) {
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
        semanticTag: SEMANTIC_WRAPPER_TAGS.has(tag) ? tag : void 0
      };
    }
    return { name: "div", supported: false };
  }
  function getAttributeSettings(element) {
    const settings = {};
    if (element.attributes.id) {
      settings._cssId = element.attributes.id;
    }
    const attributes = Object.entries(element.attributes).filter(
      ([name, value]) => value !== void 0 && !CONSUMED_ATTRIBUTE_NAMES.has(name) && isPreservedAttribute(name)
    ).map(([name, value]) => ({ name, value }));
    if (attributes.length > 0) {
      settings._attributes = attributes;
    }
    return settings;
  }
  function getContentSettings(element, name, semanticTag) {
    const settings = {};
    const tag = element.tagName;
    const text = (name === "heading" || name === "text-link" || name === "button" || name === "text-basic") && hasOnlyPhrasingContent(element) ? serializeInlineContent(element) : name === "heading" || name === "text-link" || name === "button" ? getElementText(element).replace(/\s+/g, " ").trim() : getOwnText$1(element, 500);
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
          ...element.attributes.target ? { target: element.attributes.target } : {},
          ...element.attributes.rel ? { rel: element.attributes.rel } : {}
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
  function makeCodeElement(id, label, settings) {
    return {
      id,
      name: "code",
      parent: 0,
      children: [],
      label,
      settings
    };
  }
  function titleCaseWords(value) {
    return value.split(/[-_\s]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  function makeJavaScriptCodeLabel(blockName) {
    const labelBase = titleCaseWords(blockName);
    return `${/^jigma\b/i.test(labelBase) ? labelBase : `Jigma ${labelBase || "Section"}`} JavaScript`;
  }
  function validateHierarchy(content) {
    const ids = new Set(content.map((element) => element.id));
    return content.every(
      (element) => (element.parent === 0 || ids.has(element.parent)) && element.children.every((childId) => ids.has(childId))
    );
  }
  function collectSourceTextSegments(element, segments = []) {
    if (HIDDEN_STRUCTURE_TAGS.has(element.tagName) || element.tagName === "svg") {
      return segments;
    }
    const parts = element.contentParts.length > 0 ? element.contentParts : [
      ...element.textSegments.map((value) => ({ type: "text", value })),
      ...element.children.map((child) => ({ type: "element", element: child }))
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
  function extractVisibleTextFromSetting(value) {
    if (typeof value !== "string") {
      return "";
    }
    return normalizeComparableText(stripInlineMarkup(value));
  }
  function collectPayloadTextSegments(content) {
    const byId = new Map(content.map((element) => [element.id, element]));
    const segments = [];
    const visit = (element) => {
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
    content.filter((element) => element.parent === 0).forEach(visit);
    return segments;
  }
  function countOccurrences(haystack, needle) {
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
  function countValues(values) {
    const counts = /* @__PURE__ */ new Map();
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return counts;
  }
  function auditSourceTextCoverage(roots, content) {
    const sourceSegments = roots.flatMap((root) => collectSourceTextSegments(root));
    const payloadSegments = collectPayloadTextSegments(content);
    const payloadText = payloadSegments.join(" ");
    const expectedCounts = countValues(sourceSegments);
    const payloadExactCounts = countValues(payloadSegments);
    const missing = [];
    const duplicated = [];
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
    const reordered = [];
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
      valid: missing.length === 0 && duplicated.length === 0 && reordered.length === 0
    };
  }
  function collectSourceHrefs(element, hrefs = []) {
    if (HIDDEN_STRUCTURE_TAGS.has(element.tagName)) {
      return hrefs;
    }
    if (element.tagName === "a" && element.attributes.href) {
      hrefs.push(element.attributes.href);
    }
    element.children.forEach((child) => collectSourceHrefs(child, hrefs));
    return hrefs;
  }
  function collectPayloadHrefs(content) {
    return content.map((element) => element.settings.link).filter((link) => Boolean(link) && typeof link === "object").map((link) => typeof link.url === "string" ? link.url : "").filter(Boolean);
  }
  function auditHrefCoverage(roots, content) {
    const sourceHrefs = roots.flatMap((root) => collectSourceHrefs(root));
    const payloadHrefs = collectPayloadHrefs(content);
    const payloadCounts = countValues(payloadHrefs);
    const missing = [];
    countValues(sourceHrefs).forEach((expectedCount, href) => {
      const actualCount = payloadCounts.get(href) ?? 0;
      for (let index = actualCount; index < expectedCount; index += 1) {
        missing.push(href);
      }
    });
    return {
      sourceHrefs,
      missing,
      valid: missing.length === 0
    };
  }
  function collectSourceImages(element, images = []) {
    if (HIDDEN_STRUCTURE_TAGS.has(element.tagName)) {
      return images;
    }
    if (element.tagName === "img" && element.attributes.src) {
      images.push({ src: element.attributes.src, alt: element.attributes.alt });
    }
    element.children.forEach((child) => collectSourceImages(child, images));
    return images;
  }
  function collectPayloadImageUrls(content) {
    return content.map((element) => element.settings.image).filter((image) => Boolean(image) && typeof image === "object").map((image) => typeof image.url === "string" ? image.url : "").filter(Boolean);
  }
  function auditImageCoverage(roots, content) {
    const sourceImages = roots.flatMap((root) => collectSourceImages(root));
    const payloadUrls = collectPayloadImageUrls(content);
    const payloadCounts = countValues(payloadUrls);
    const missing = [];
    countValues(sourceImages.map((image) => image.src)).forEach((expectedCount, src) => {
      const actualCount = payloadCounts.get(src) ?? 0;
      for (let index = actualCount; index < expectedCount; index += 1) {
        missing.push(src);
      }
    });
    return {
      sourceImages,
      missing,
      valid: missing.length === 0
    };
  }
  const CLIPBOARD_PAYLOAD_KEYS = [
    "content",
    "globalClasses",
    "globalElements",
    "source",
    "sourceUrl",
    "version"
  ];
  function validateBricksClipboardPayloadSchema(payload) {
    const errors = [];
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { valid: false, errors: ["Clipboard payload is not an object."] };
    }
    const value = payload;
    const keys = Object.keys(value).sort();
    const expectedKeys = [...CLIPBOARD_PAYLOAD_KEYS].sort();
    if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
      errors.push(`Clipboard payload keys must be exactly ${expectedKeys.join(", ")}.`);
    }
    if (!Array.isArray(value.content)) errors.push("content must be an array.");
    if (!Array.isArray(value.globalClasses)) errors.push("globalClasses must be an array.");
    if (!Array.isArray(value.globalElements)) errors.push("globalElements must be an array.");
    if (Array.isArray(value.content) && Array.isArray(value.globalClasses)) {
      const classIds = new Set(value.globalClasses.filter((entry) => Boolean(entry) && typeof entry === "object").map((entry) => typeof entry.id === "string" ? entry.id : "").filter(Boolean));
      const referencesValid = value.content.filter((entry) => Boolean(entry) && typeof entry === "object").every((entry) => {
        var _a;
        const ids = Array.isArray((_a = entry.settings) == null ? void 0 : _a._cssGlobalClasses) ? entry.settings._cssGlobalClasses.map((id) => `${id}`) : [];
        return ids.every((id) => classIds.has(id));
      });
      if (!referencesValid) {
        errors.push("All _cssGlobalClasses references must resolve to globalClasses records.");
      }
    }
    return { valid: errors.length === 0, errors };
  }
  function makeClassList(mode, bemClass, originalClasses, warnings, blockName) {
    const validOriginalClasses = originalClasses.filter((className) => {
      const valid = isValidClassName(className);
      if (!valid && mode !== "strict-bem") {
        pushWarning(
          warnings,
          `Original class "${className}" is invalid and was not preserved.`
        );
      }
      return valid;
    });
    const strictBemClasses = bemClass.includes("__") && bemClass.includes("--") ? [bemClass.split("--")[0], bemClass] : [bemClass];
    if (mode === "strict-bem") {
      const sourceBemClasses = blockName ? validOriginalClasses.filter(
        (className) => className === blockName || className.startsWith(`${blockName}__`) || className.startsWith(`${blockName}--`)
      ) : [];
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
    return Array.from(/* @__PURE__ */ new Set([...strictBemClasses, ...validOriginalClasses]));
  }
  function makePreservedOriginalClassList(originalClasses, warnings) {
    return originalClasses.filter((className) => {
      const valid = isValidClassName(className);
      if (!valid) {
        pushWarning(
          warnings,
          `Original class "${className}" is invalid and was not preserved.`
        );
      }
      return valid;
    });
  }
  function makeCompatibilityClassList(originalClasses, warnings) {
    return Array.from(new Set(makePreservedOriginalClassList(originalClasses, warnings)));
  }
  function normalizeStepNumber(value) {
    var _a;
    const numeric = ((_a = value.match(/\d+/)) == null ? void 0 : _a[0]) ?? "";
    return numeric ? `${Number(numeric)}` : "";
  }
  function findFirstDescendant(element, predicate) {
    for (const child of element.children) {
      if (predicate(child)) {
        return child;
      }
      const nested = findFirstDescendant(child, predicate);
      if (nested) {
        return nested;
      }
    }
    return void 0;
  }
  function getOriginalClassesForExport(element) {
    const classes = getClassNames$1(element);
    if (element.tagName !== "picture") {
      return Array.from(new Set(classes));
    }
    const image = findFirstDescendant(element, (child) => child.tagName === "img");
    return Array.from(/* @__PURE__ */ new Set([
      ...classes,
      ...image ? getClassNames$1(image) : []
    ]));
  }
  function findProcessCardContext(element, ancestors) {
    const card = [element, ...[...ancestors].reverse()].find(
      (candidate) => getClassNames$1(candidate).some((className) => className === "lit-process-light__card")
    );
    if (!card) {
      return {};
    }
    const marker = findFirstDescendant(
      card,
      (child) => getClassNames$1(child).some((className) => className === "lit-process-light__marker")
    );
    const title = findFirstDescendant(
      card,
      (child) => getClassNames$1(child).some((className) => className === "lit-process-light__card-title")
    );
    const step = normalizeStepNumber(card.attributes["data-step"] ?? getElementText(marker ?? card));
    const titleText = getElementText(title ?? card).replace(/\s+/g, " ").trim();
    return {
      step,
      title: titleText
    };
  }
  function createProcessCompatibilityLabel(element, bricksName, ancestors, parentLabel) {
    var _a;
    const classes = getClassNames$1(element);
    const processClass = classes.find(
      (className) => className === "lit-process-light" || className.startsWith("lit-process-light__")
    );
    if (!processClass && element.tagName !== "svg") {
      return void 0;
    }
    const part = ((_a = processClass == null ? void 0 : processClass.split("__")[1]) == null ? void 0 : _a.split("--")[0]) ?? "";
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
    const labelsByPart = {
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
      "card-text": `${titleLabel} Card Text`
    };
    return labelsByPart[part];
  }
  function createCompatibilityElementLabel(element, bricksName, ancestors = [], parentLabel) {
    const processLabel = createProcessCompatibilityLabel(element, bricksName, ancestors, parentLabel);
    if (processLabel) {
      return processLabel;
    }
    if (element.attributes.id) {
      return `#${element.attributes.id}`;
    }
    const firstClass = getClassNames$1(element).find(isValidClassName);
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
  function buildExternalCode(options, html, css, js, warnings, suppressDependencyWarnings = false) {
    const dependencies = inspectDependencies(html, css, js);
    const lines = [];
    dependencies.forEach((dependency) => {
      if (dependency.warning && !suppressDependencyWarnings) {
        pushWarning(warnings, dependency.warning, "info");
      }
      if ((dependency.type === "stylesheet" || dependency.type === "font") && options.includeExternalCss) {
        lines.push(`<link rel="stylesheet" href="${escapeAttribute(dependency.value)}">`);
      }
      if (dependency.type === "script" && options.includeExternalScripts) {
        lines.push(`<script src="${escapeAttribute(dependency.value)}"><\/script>`);
      }
    });
    return {
      dependencies,
      element: lines.length > 0 ? makeCodeElement("jigma-external-dependencies", "External dependencies", {
        executeCode: false,
        html: lines.join("\n")
      }) : null
    };
  }
  function addSelectorMapping(scopeMap, sourceClassNames, sourceId, bemClass) {
    sourceClassNames.forEach((className) => {
      const existing = scopeMap.classes.get(className) ?? [];
      scopeMap.classes.set(className, Array.from(/* @__PURE__ */ new Set([...existing, bemClass])));
    });
    if (sourceId) {
      scopeMap.ids.set(sourceId, bemClass);
    }
  }
  function createGlobalClasses(classNames) {
    const seen = /* @__PURE__ */ new Set();
    const usedIds = /* @__PURE__ */ new Set();
    const globalClasses = [];
    classNames.forEach((className) => {
      if (seen.has(className)) {
        return;
      }
      seen.add(className);
      globalClasses.push({
        id: makeUniqueGlobalClassId(className, usedIds),
        name: className,
        settings: {}
      });
    });
    return globalClasses;
  }
  function getGlobalClassIdMap(globalClasses) {
    return new Map(globalClasses.map((entry) => [entry.name, entry.id]));
  }
  function getNativeSettingCount(settings) {
    return Object.keys(settings).filter((key) => key !== BRICKS_ELEMENT_CUSTOM_CSS_FIELD).length;
  }
  function getStringClasses(value) {
    return typeof value === "string" ? value.split(/\s+/).map((className) => className.trim()).filter(Boolean) : [];
  }
  function auditBricksClassReferences(content, globalClasses, styledClassIds, fallbackRuleCountByClassName = /* @__PURE__ */ new Map(), fallbackStrategy = "none") {
    const classById = /* @__PURE__ */ new Map();
    const entriesById = /* @__PURE__ */ new Map();
    const duplicateIds = /* @__PURE__ */ new Set();
    const seenIds = /* @__PURE__ */ new Set();
    const idsByName = /* @__PURE__ */ new Map();
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
        customCssPresent: typeof globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] === "string" && `${globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD]}`.trim().length > 0,
        missingReferences: [],
        conflicts: []
      });
      const ids = idsByName.get(globalClass.name) ?? /* @__PURE__ */ new Set();
      ids.add(globalClass.id);
      idsByName.set(globalClass.name, ids);
    });
    const entries = [...entriesById.values()];
    idsByName.forEach((ids, name) => {
      if (ids.size <= 1) {
        return;
      }
      ids.forEach((id) => {
        var _a;
        (_a = entriesById.get(id)) == null ? void 0 : _a.conflicts.push(
          `Duplicate class name "${name}" is associated with multiple class IDs.`
        );
      });
    });
    content.forEach((element) => {
      const classIds = Array.isArray(element.settings._cssGlobalClasses) ? element.settings._cssGlobalClasses.map((classId) => `${classId}`).filter(Boolean) : [];
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
            conflicts: [`Element "${element.id}" references a class ID that is missing from globalClasses.`]
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
        const entry = classRecord ? entriesById.get(classRecord.id) : void 0;
        entry == null ? void 0 : entry.conflicts.push(
          `Generated class "${className}" also appears in _cssClasses instead of only _cssGlobalClasses.`
        );
      });
    });
    styledClassIds.forEach((classId) => {
      const globalClass = classById.get(classId);
      const entry = entriesById.get(classId);
      if (!globalClass || !entry) {
        return;
      }
      if (getNativeSettingCount(globalClass.settings) === 0 && (fallbackRuleCountByClassName.get(globalClass.name) ?? 0) === 0 && !(typeof globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] === "string" && globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD].trim())) {
        emptyStyledClassCount += 1;
        entry.conflicts.push("CSS matched this generated class, but no native settings or custom CSS were saved.");
      }
    });
    const duplicateClassNameCount = [...idsByName.values()].filter((ids) => ids.size > 1).length;
    const valid = missingClassReferenceCount === 0 && duplicateIds.size === 0 && duplicateClassNameCount === 0 && emptyStyledClassCount === 0 && generatedClassOnlyInElementClassesCount === 0;
    return {
      entries,
      valid,
      missingClassReferenceCount,
      duplicateClassIdCount: duplicateIds.size,
      duplicateClassNameCount,
      emptyStyledClassCount,
      generatedClassOnlyInElementClassesCount
    };
  }
  function auditLiteralFallbackCss(fallbackCss, globalClasses) {
    const managedClassNames = new Set(globalClasses.map((entry) => entry.name));
    const missingClassNames = /* @__PURE__ */ new Set();
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
      elementIdSelectorCount
    };
  }
  function createGeneratedTextClass(blockName, assignment) {
    const parentRole = assignment.role;
    const suffix = parentRole && !["block", "element", "root", "section"].includes(parentRole) ? `${parentRole}-text` : "text";
    return `${blockName}__${suffix}`;
  }
  function shouldSkipGeneratedClass(element, mappingName, originalClasses) {
    if (originalClasses.length > 0) {
      return false;
    }
    return mappingName === "text-basic";
  }
  function getLabelClass(assignment, classList) {
    const modifierClass = [...classList].reverse().find((className) => className.includes("__") && className.includes("--"));
    if (modifierClass) {
      return modifierClass;
    }
    const sourceElementClass = [...classList].reverse().find((className) => className.includes("__"));
    return sourceElementClass ?? assignment.className;
  }
  function validateBricksStructure(content) {
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
      valid: invalidNestingCount === 0 && parentChildMismatchCount === 0
    };
  }
  function getModifier(className) {
    return className.includes("--") ? className.split("--").at(-1) ?? "" : "";
  }
  function getSourceClassesForGeneratedClass(originalClasses, generatedClass, classList) {
    if (originalClasses.includes(generatedClass)) {
      return [generatedClass];
    }
    const sourceClasses = /* @__PURE__ */ new Set([generatedClass]);
    const modifier = getModifier(generatedClass);
    const modifiers = classList.map(getModifier).filter(Boolean);
    const hasModifierClass = modifiers.length > 0;
    originalClasses.forEach((className) => {
      const lowerClassName = className.toLowerCase();
      if (modifier) {
        if (lowerClassName.includes(`--${modifier}`) || lowerClassName === modifier || lowerClassName.endsWith(`-${modifier}`)) {
          sourceClasses.add(className);
        }
        return;
      }
      if (!hasModifierClass || !lowerClassName.includes("--") && !modifiers.some(
        (item) => lowerClassName === item || lowerClassName.endsWith(`-${item}`)
      )) {
        sourceClasses.add(className);
      }
    });
    return [...sourceClasses];
  }
  function createClassCssTargets(pendingElements, globalClassIdMap, globalClassById) {
    const targets = [];
    pendingElements.forEach((pending) => {
      pending.classList.forEach((className) => {
        const globalClassId = globalClassIdMap.get(className);
        const globalClass = globalClassId ? globalClassById.get(globalClassId) : void 0;
        if (!globalClass) {
          return;
        }
        targets.push({
          globalClass,
          className,
          sourceClasses: getSourceClassesForGeneratedClass(
            pending.originalClasses,
            className,
            pending.classList
          ),
          sourceId: className === pending.assignment.className ? pending.parsedElement.attributes.id : void 0
        });
      });
    });
    return targets;
  }
  function createBricksExport(input) {
    const warnings = [];
    const conversionProfile = input.options.conversionProfile ?? "clean-native";
    const exportProfile = input.options.exportProfile ?? "native-controls-experimental";
    const compatibilityProfile = exportProfile === "bricks-compatibility";
    const exportMode = input.options.exportMode;
    const shouldCreateNativeBemClasses = compatibilityProfile || isNativeBemClassMode(exportMode);
    const shouldAttachElementCss = !compatibilityProfile && exportMode === "element-styles";
    const shouldCreateGlobalClasses = compatibilityProfile || shouldCreateNativeBemClasses;
    const shouldCreateScopedCssBlock = !compatibilityProfile && exportMode === "scoped-css-block";
    const assetManifest = createAssetManifest(input);
    const parsed = getRenderableRoots(input.html);
    const deletedLayerIds = input.deletedLayerIds ?? /* @__PURE__ */ new Set();
    const excludedLayerIds = input.excludedLayerIds ?? /* @__PURE__ */ new Set();
    const content = [];
    const contentById = /* @__PURE__ */ new Map();
    const pendingElements = [];
    const classListByElementId = /* @__PURE__ */ new Map();
    const generatedClassNames = [];
    const scopeMap = {
      classes: /* @__PURE__ */ new Map(),
      ids: /* @__PURE__ */ new Map()
    };
    const bemFactory = createBemClassFactory({
      projectPrefix: input.options.projectPrefix,
      blockName: input.options.blockName
    });
    let skippedLayerCount = 0;
    let unsupportedElementCount = 0;
    let generatedTextElementCount = 0;
    let classAttachmentCount = 0;
    let unsignedSvgCodeCount = 0;
    let unsignedJavaScriptCodeCount = 0;
    let generatedWrapperCount = 0;
    assetManifest.warnings.filter(
      (warning) => !compatibilityProfile || warning.severity === "error" || warning.severity === "action-required" || warning.code === "code.inline_event_handler"
    ).forEach((warning) => pushGroupedWarning(warnings, warning));
    parsed.warnings.forEach((warning) => pushWarning(warnings, warning));
    if (input.options.stylingMode === "native-experimental") {
      pushWarning(
        warnings,
        "Native/GUI style mapping is disabled for the MVP. Export uses generated BEM CSS instead.",
        "info"
      );
    }
    const walkElement = (element, parent, path, ancestors = []) => {
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
          `<${element.tagName}> was converted to a Bricks Div fallback.`
        );
      }
      const originalClasses = getOriginalClassesForExport(element);
      const assignment = bemFactory.create(element, path, parent);
      const id = makeStableId(`${path}:${element.tagName}:${assignment.className}:${getOwnText$1(element, 64)}`);
      const classList = compatibilityProfile ? makeCompatibilityClassList(originalClasses, warnings) : makeClassList(
        input.options.classMode,
        assignment.className,
        originalClasses,
        warnings,
        bemFactory.blockName
      ).filter(
        (className) => conversionProfile === "fidelity" || !shouldSkipGeneratedClass(element, mapping.name, originalClasses) || originalClasses.includes(className)
      );
      const svgSanitization = mapping.name === "svg" ? sanitizeSvgMarkup(element.rawHtml ?? serializeElement(element, { path: "svg", skipScripts: true })) : null;
      const settings = {
        ...getAttributeSettings(element),
        ...getContentSettings(element, mapping.name, mapping.semanticTag)
      };
      if (mapping.generatedWrapper) {
        generatedWrapperCount += 1;
      }
      if (shouldCreateNativeBemClasses) {
        const preservedClasses = input.options.classMode === "strict-bem" ? [] : makePreservedOriginalClassList(originalClasses, warnings);
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
      const parentElement = parent === 0 ? void 0 : contentById.get(parent);
      const elementLabel = compatibilityProfile ? createCompatibilityElementLabel(element, mapping.name, ancestors, parentElement == null ? void 0 : parentElement.label) : createBricksElementLabel({
        bemClass: getLabelClass(assignment, classList),
        tagName: element.tagName,
        parentLabel: parentElement == null ? void 0 : parentElement.label
      });
      const bricksElement = applyBricksElementLabel({
        id,
        name: mapping.name,
        parent,
        children: [],
        settings
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
        path
      });
      classList.forEach((className) => {
        addSelectorMapping(
          scopeMap,
          getSourceClassesForGeneratedClass(originalClasses, className, classList).filter((sourceClassName) => sourceClassName !== className),
          element.attributes.id,
          className
        );
      });
      if (mapping.name === "svg") {
        unsignedSvgCodeCount += 1;
        const internalNodeCount = countSvgInternalNodes(element.rawHtml ?? "");
        const report = svgSanitization == null ? void 0 : svgSanitization.report;
        const signatureDetails = [
          internalNodeCount > 0 ? `Inline SVG contains ${internalNodeCount} internal SVG node${internalNodeCount === 1 ? "" : "s"} and was exported as one Bricks SVG element.` : "Inline SVG was exported as one Bricks SVG element.",
          ...(report == null ? void 0 : report.malformed) ? ["SVG markup could not be parsed and requires manual review."] : []
        ];
        const sanitizationDetails = [
          ...(report == null ? void 0 : report.removedTags.length) ? [`Removed tags: ${report.removedTags.join(", ")}`] : [],
          ...(report == null ? void 0 : report.removedAttributes.length) ? [`Removed attributes: ${report.removedAttributes.join(", ")}`] : [],
          ...(report == null ? void 0 : report.externalReferences.length) ? [`External references: ${report.externalReferences.join(", ")}`] : [],
          ...(report == null ? void 0 : report.malformed) ? ["SVG markup could not be parsed and requires manual review."] : []
        ];
        pushGroupedWarning(warnings, {
          id: "svg-signature:inline-svg",
          code: "svg.signature_required",
          severity: (report == null ? void 0 : report.malformed) ? "error" : "action-required",
          title: "Inline SVG signatures required",
          summary: "Inline SVG elements were preserved as atomic SVG elements. Bricks signatures required.",
          message: "Inline SVG elements were preserved as atomic SVG elements. Bricks signatures required.",
          ownerElementId: id,
          ownerLabel: bricksElement.label,
          details: [`${bricksElement.label ?? "Inline SVG"}: ${signatureDetails.join(" ")}`],
          suggestedAction: "After pasting into Bricks, review and sign this SVG through Bricks' code signature workflow."
        });
        if (sanitizationDetails.length > 0) {
          pushGroupedWarning(warnings, {
            id: `svg-sanitized:${id}:html`,
            code: "svg.sanitized",
            severity: (report == null ? void 0 : report.malformed) ? "error" : "warning",
            title: "SVG markup sanitized",
            summary: `${bricksElement.label ?? "Inline SVG"} had unsafe or review-required SVG markup sanitized.`,
            message: `${bricksElement.label ?? "Inline SVG"} had unsafe or review-required SVG markup sanitized.`,
            ownerElementId: id,
            ownerLabel: bricksElement.label,
            details: sanitizationDetails,
            suggestedAction: "Review the sanitized SVG markup before signing the SVG in Bricks."
          });
        }
      }
      const directText = getOwnText$1(element, 500);
      const isTextElement = ["heading", "text-basic", "button", "text-link"].includes(mapping.name);
      const shouldCreateDirectTextElements = !isTextElement && directText && (conversionProfile === "fidelity" || compatibilityProfile);
      const addDirectTextElement = (text, sequence) => {
        const normalizedText = text.replace(/\s+/g, " ").trim();
        if (!normalizedText) {
          return;
        }
        const textId = makeStableId(`${path}:direct-text:${sequence}:${normalizedText}`);
        const textClass = conversionProfile === "fidelity" ? createGeneratedTextClass(bemFactory.blockName, assignment) : "";
        const textClassList = textClass ? [textClass] : [];
        const textElement = applyBricksElementLabel({
          id: textId,
          name: "text-basic",
          parent: id,
          children: [],
          settings: {
            text: normalizedText,
            tag: "span",
            ...!shouldCreateNativeBemClasses && textClass ? { _cssClasses: textClass } : {}
          }
        }, textClass ? createBricksElementLabel({
          bemClass: textClass,
          tagName: "span",
          parentLabel: bricksElement.label
        }) : `${bricksElement.label ?? "Element"} Text`);
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
        const walkChild = (child) => {
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
    const elementCssTargets = pendingElements.map((pending) => ({
      element: pending.element,
      bemClass: pending.assignment.className,
      sourceClasses: pending.originalClasses,
      sourceId: pending.parsedElement.attributes.id
    }));
    const elementCss = input.css.trim() && shouldAttachElementCss ? attachCssToElements(input.css, elementCssTargets, {
      minify: input.options.minifyElementCss
    }) : {
      warnings: [],
      attachedRuleCount: 0,
      unmappedRuleCount: 0,
      nativeStyleMappedCount: 0,
      customCssFallbackCount: 0,
      blockScopedFallbackCount: 0,
      literalFallbackRuleCount: 0,
      responsiveRuleCount: 0,
      pseudoRuleCount: 0,
      unresolvedSelectorCount: 0
    };
    elementCss.warnings.filter(isActionableCssWarning).forEach((warning) => pushWarning(warnings, warning.message, warning.severity));
    if (input.css.trim() && shouldAttachElementCss && elementCss.attachedRuleCount === 0) {
      pushWarning(
        warnings,
        "Input CSS did not contain selectors that could be safely attached to exported elements."
      );
    }
    const globalClasses = shouldCreateGlobalClasses ? createGlobalClasses(generatedClassNames) : [];
    const globalClassIdMap = getGlobalClassIdMap(globalClasses);
    const globalClassById = new Map(globalClasses.map((entry) => [entry.id, entry]));
    if (shouldCreateGlobalClasses) {
      content.forEach((element) => {
        const elementClassList = classListByElementId.get(element.id) ?? [];
        const classIds = elementClassList.map((className) => globalClassIdMap.get(className)).filter((classId) => typeof classId === "string");
        if (classIds.length > 0) {
          element.settings._cssGlobalClasses = classIds;
        }
      });
    }
    const classCss = input.css.trim() && shouldCreateNativeBemClasses ? attachCssToGlobalClasses(
      input.css,
      createClassCssTargets(pendingElements, globalClassIdMap, globalClassById),
      { minify: input.options.minifyElementCss, literalOnly: compatibilityProfile }
    ) : {
      warnings: [],
      attachedRuleCount: 0,
      unmappedRuleCount: 0,
      nativeStyleMappedCount: 0,
      customCssFallbackCount: 0,
      blockScopedFallbackCount: 0,
      literalFallbackRuleCount: 0,
      responsiveRuleCount: 0,
      pseudoRuleCount: 0,
      unresolvedSelectorCount: 0,
      styledClassIds: /* @__PURE__ */ new Set(),
      fallbackStrategy: "none",
      fallbackRuleCountByClassName: /* @__PURE__ */ new Map()
    };
    classCss.warnings.filter(isActionableCssWarning).forEach((warning) => pushWarning(warnings, warning.message, warning.severity));
    if (input.css.trim() && shouldCreateNativeBemClasses && classCss.attachedRuleCount === 0) {
      pushWarning(
        warnings,
        "Input CSS did not contain selectors that could be safely attached to generated Bricks classes."
      );
    }
    const classAudit = shouldCreateGlobalClasses ? auditBricksClassReferences(
      content,
      globalClasses,
      classCss.styledClassIds,
      classCss.fallbackRuleCountByClassName,
      classCss.fallbackStrategy
    ) : {
      entries: [],
      valid: true,
      missingClassReferenceCount: 0,
      duplicateClassIdCount: 0,
      duplicateClassNameCount: 0,
      emptyStyledClassCount: 0,
      generatedClassOnlyInElementClassesCount: 0
    };
    if (!classAudit.valid) {
      pushWarning(
        warnings,
        "Generated Bricks class references failed validation. Review the class audit before paste testing.",
        "error"
      );
    }
    if (classAudit.generatedClassOnlyInElementClassesCount > 0) {
      pushWarning(
        warnings,
        "One or more generated Bricks classes were found in _cssClasses instead of native _cssGlobalClasses.",
        "error"
      );
    }
    const classCustomCss = globalClasses.map((globalClass) => `${globalClass.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] ?? ""}`).filter((css) => css.trim().length > 0).join("\n\n");
    const fallbackCssAudit = auditLiteralFallbackCss(classCustomCss, globalClasses);
    if (fallbackCssAudit.missingClassSelectorCount > 0 || fallbackCssAudit.elementIdSelectorCount > 0) {
      pushWarning(
        warnings,
        "Literal BEM fallback CSS failed ownership validation. Review fallback selectors before paste testing.",
        "error"
      );
    }
    const cssConservationAudit = input.css.trim() && shouldCreateNativeBemClasses ? auditCssDeclarationConservation(input.css, classCustomCss) : {
      sourceDeclarationCount: 0,
      preservedDeclarationCount: 0,
      pageLevelDeclarationCount: 0,
      unsupportedDeclarationCount: 0,
      missingDeclarations: [],
      coveragePercentage: 100,
      valid: true
    };
    if (!cssConservationAudit.valid) {
      pushGroupedWarning(warnings, {
        id: "source-css-conservation",
        code: "source.css_loss",
        severity: "error",
        title: "Source CSS coverage failed",
        message: "Generated Bricks payload does not account for every source CSS declaration.",
        details: cssConservationAudit.missingDeclarations.slice(0, 12).map((entry) => `Missing CSS: ${entry}`),
        suggestedAction: "Review class-owned CSS before copying or inserting into Bricks."
      });
    }
    const scopedCss = input.css.trim() && shouldCreateScopedCssBlock ? scopeCssToBem(input.css, scopeMap) : {
      css: "",
      warnings: [],
      scopedRuleCount: 0,
      unmappedRuleCount: 0,
      unusedSelectorCount: 0
    };
    scopedCss.warnings.forEach((warning) => pushWarning(warnings, warning.message, warning.severity));
    if (input.css.trim() && shouldCreateScopedCssBlock && !scopedCss.css.trim()) {
      pushWarning(
        warnings,
        "Input CSS did not contain selectors that could be safely scoped to generated BEM classes."
      );
    }
    if (shouldCreateScopedCssBlock && scopedCss.css.trim()) {
      content.unshift(makeCodeElement("jigma-bem-css", "Generated BEM CSS", {
        executeCode: false,
        css: scopedCss.css,
        cssCode: scopedCss.css
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
          javascriptCode: input.js
        }));
      }
      pushGroupedWarning(warnings, {
        id: "javascript-review-required",
        code: "javascript.review_required",
        severity: "action-required",
        title: input.options.includeJavaScriptCode ? "JavaScript signature required" : "JavaScript detected",
        summary: input.options.includeJavaScriptCode ? "Included as one unsigned Bricks Code element. Review and sign after import." : "Excluded from Bricks export. The source remains saved in Jigma.",
        message: input.options.includeJavaScriptCode ? "Included as one unsigned Bricks Code element. Review and sign after import." : "Excluded from Bricks export. The source remains saved in Jigma.",
        details: [
          input.options.includeJavaScriptCode ? "This section contains one unsigned Bricks Code element. Review and sign it inside Bricks before enabling execution." : "Jigma kept the JavaScript in the editor and did not add a Bricks Code element.",
          "Execution is disabled by default."
        ],
        suggestedAction: input.options.includeJavaScriptCode ? "Review and sign the Code element inside Bricks before enabling execution." : "Turn on Include JavaScript in Bricks when you want one disabled Code element created."
      });
    }
    if (!compatibilityProfile && externalCode.dependencies.length > 0) {
      pushWarning(
        warnings,
        `${externalCode.dependencies.length} dependency item(s) were detected. Review before pasting into Bricks.`
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
          `${structureValidation.parentChildMismatchCount} parent/child mismatch(es) found.`
        ],
        suggestedAction: "Review the generated hierarchy before paste testing."
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
          ...sourceTextAudit.reordered.slice(0, 8).map((text) => `Reordered: ${text}`)
        ],
        suggestedAction: "Review the generated structure before copying or inserting into Bricks."
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
        suggestedAction: "Review link elements before copying or inserting into Bricks."
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
        suggestedAction: "Review image elements before copying or inserting into Bricks."
      });
    }
    const clipboardSchemaAudit = validateBricksClipboardPayloadSchema({
      content,
      source: "bricksCopiedElements",
      sourceUrl: "jigma.local",
      version: TARGET_BRICKS_VERSION,
      globalClasses: globalClasses ?? [],
      globalElements: []
    });
    if (!clipboardSchemaAudit.valid) {
      pushGroupedWarning(warnings, {
        id: "clipboard-schema",
        code: "clipboard.invalid_schema",
        severity: "error",
        title: "Clipboard payload schema failed",
        message: "Generated clipboard payload does not match the raw Bricks JSON schema.",
        details: clipboardSchemaAudit.errors,
        suggestedAction: "Do not paste this payload into Bricks until the schema is valid."
      });
    }
    const mappedRuleCount = elementCss.nativeStyleMappedCount + classCss.nativeStyleMappedCount;
    const fallbackCssCount = elementCss.customCssFallbackCount + classCss.customCssFallbackCount + (shouldCreateScopedCssBlock && scopedCss.css.trim() ? 1 : 0);
    const cssRuleWorkCount = mappedRuleCount + fallbackCssCount + elementCss.unmappedRuleCount + classCss.unmappedRuleCount;
    const nativeCssMappingPercentage = cssRuleWorkCount > 0 ? Math.round(mappedRuleCount / cssRuleWorkCount * 100) : 100;
    warnings.filter(
      (warning) => warning.severity === "action-required" || warning.severity === "error"
    ).length;
    const cleanNativeThresholdsExceeded = [
      content.length > 40 ? "element-count" : "",
      globalClasses.length > 25 ? "class-count" : "",
      unsignedSvgCodeCount > 4 ? "unsigned-svg-count" : "",
      classAudit.missingClassReferenceCount > 0 ? "missing-class-reference" : "",
      classAudit.duplicateClassIdCount > 0 ? "duplicate-class-id" : "",
      structureValidation.invalidNestingCount > 0 ? "invalid-nesting" : ""
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
        suggestedAction: "Review the hierarchy and switch to Fidelity mode only when visual detail matters more than editability."
      });
    }
    const finalActionRequiredWarningCount = warnings.filter(
      (warning) => warning.severity === "action-required" || warning.severity === "error"
    ).length;
    return {
      content,
      source: "bricksCopiedElements",
      sourceUrl: "jigma.local",
      version: TARGET_BRICKS_VERSION,
      ...shouldCreateGlobalClasses ? { globalClasses } : {},
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
          cleanNativeThresholdsExceeded
        },
        classAudit: classAudit.entries,
        assetManifest,
        notes: [
          `Generated BEM block: ${bemFactory.blockName}.`,
          shouldCreateNativeBemClasses ? compatibilityProfile ? "Source classes are preserved as Bricks classes assigned by ID." : "Generated BEM classes are native editable Bricks classes assigned by ID." : "Generated BEM classes are attached directly as element classes.",
          shouldCreateScopedCssBlock ? "CSS was exported as a scoped generated CSS block." : shouldCreateNativeBemClasses ? classCustomCss ? "Matching CSS declarations are owned by generated Bricks class records; unsupported declarations use literal BEM Custom CSS on the owning class." : "Matching CSS declarations are owned by generated Bricks class records." : shouldAttachElementCss ? "Matching CSS declarations were attached directly to exported elements." : "CSS output was disabled for structure-only export.",
          "JavaScript and external dependencies require manual Bricks review."
        ]
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
        cssUnmappedRuleCount: scopedCss.unmappedRuleCount + elementCss.unmappedRuleCount + classCss.unmappedRuleCount,
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
        preservedCssDeclarationCount: cssConservationAudit.preservedDeclarationCount + cssConservationAudit.pageLevelDeclarationCount,
        missingCssDeclarationCount: cssConservationAudit.unsupportedDeclarationCount,
        cssConservationPercentage: cssConservationAudit.coveragePercentage
      }
    };
  }
  function serializeBricksClipboardPayload(exportResult) {
    return {
      content: exportResult.content,
      source: exportResult.source,
      sourceUrl: exportResult.sourceUrl,
      version: exportResult.version,
      globalClasses: exportResult.globalClasses ?? [],
      globalElements: []
    };
  }
  function serializeBricksClipboardPayloadJson(exportResult) {
    return JSON.stringify(serializeBricksClipboardPayload(exportResult));
  }
  function getBricksExportBlockingMessages(exportResult) {
    const messages = [];
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
  const pluginCompatibilityOptions = (input) => ({
    stylingMode: "bem-css",
    exportMode: "native-bem-classes",
    exportProfile: "bricks-compatibility",
    classMode: "strict-bem",
    projectPrefix: input.projectPrefix || "jg",
    blockName: input.blockName || "section",
    createGlobalClasses: true,
    includeExternalCss: false,
    includeExternalScripts: false,
    minifyElementCss: false,
    includeJavaScriptCode: Boolean(input.includeJavaScriptCode)
  });
  function readTopLevelCssBlocks(css) {
    const blocks = [];
    let index = 0;
    while (index < css.length) {
      while (index < css.length && /\s/.test(css[index])) index += 1;
      if (index >= css.length) break;
      const start = index;
      let quote = "";
      let depth = 0;
      while (index < css.length) {
        const char = css[index];
        const previous = css[index - 1];
        if (quote) {
          if (char === quote && previous !== "\\") quote = "";
          index += 1;
          continue;
        }
        if (char === '"' || char === "'") {
          quote = char;
          index += 1;
          continue;
        }
        if (char === "{") {
          depth += 1;
        } else if (char === "}") {
          depth -= 1;
          if (depth === 0) {
            index += 1;
            blocks.push(css.slice(start, index).trim());
            break;
          }
        } else if (char === ";" && depth === 0) {
          index += 1;
          blocks.push(css.slice(start, index).trim());
          break;
        }
        index += 1;
      }
      if (index >= css.length && start < css.length) {
        const rest = css.slice(start).trim();
        if (rest) blocks.push(rest);
      }
    }
    return blocks.filter(Boolean);
  }
  function selectorList(header) {
    return header.split(",").map((selector) => selector.trim().toLowerCase()).filter(Boolean);
  }
  function classifyPageLevelCss(block) {
    const header = block.split("{")[0].trim();
    const lower = header.toLowerCase();
    if (lower.startsWith("@import")) return "import";
    if (lower.startsWith("@font-face")) return "font-face";
    if (lower.startsWith("@property")) return "property";
    if (lower.startsWith("@keyframes") || lower.startsWith("@-webkit-keyframes")) return "keyframes";
    if (lower.startsWith("@layer") && !lower.includes(".")) return "layer";
    const selectors = selectorList(header);
    if (selectors.length === 0) return null;
    if (selectors.every((selector) => selector === ":root")) return "root";
    if (selectors.every((selector) => selector === "html" || selector === "body" || selector === "html body")) {
      return "document";
    }
    if (selectors.some((selector) => selector === "*" || selector.startsWith("*::") || selector.includes("*, *"))) {
      return "reset";
    }
    if (selectors.some((selector) => selector.startsWith("html ") || selector.startsWith("body "))) {
      return "global";
    }
    return null;
  }
  const pageLevelLabels = {
    root: ":root variables",
    document: "document styles",
    "font-face": "@font-face",
    property: "@property",
    keyframes: "shared @keyframes",
    layer: "unscoped @layer",
    import: "@import",
    reset: "global reset",
    global: "global selector"
  };
  function detectPageLevelCss(css) {
    const seen = /* @__PURE__ */ new Set();
    const blocks = [];
    const groups = /* @__PURE__ */ new Map();
    readTopLevelCssBlocks(css).forEach((block) => {
      const type = classifyPageLevelCss(block);
      const normalized = block.replace(/\s+/g, " ").trim();
      if (!type || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      blocks.push(block);
      groups.set(type, (groups.get(type) || 0) + 1);
    });
    return {
      css: blocks.join("\n\n"),
      ruleCount: blocks.length,
      groups: Array.from(groups.entries()).map(([type, count]) => ({
        type,
        label: pageLevelLabels[type],
        count
      }))
    };
  }
  function convertToBricksCompatibility(input) {
    const exportResult = createBricksExport({
      html: input.html,
      css: input.css,
      js: input.js,
      options: pluginCompatibilityOptions(input)
    });
    const blockingErrors = getBricksExportBlockingMessages(exportResult);
    return {
      schemaVersion: BRICKS_COMPATIBILITY_SCHEMA_VERSION,
      targetBricksVersion: TARGET_BRICKS_VERSION,
      payload: serializeBricksClipboardPayload(exportResult),
      payloadJson: serializeBricksClipboardPayloadJson(exportResult),
      diagnostics: {
        warnings: exportResult.warnings,
        blocked: blockingErrors.length > 0,
        blockingErrors,
        elementCount: exportResult.validation.totalElements,
        classCount: exportResult.validation.globalClassCount,
        unsignedJavaScriptCount: exportResult.validation.unsignedJavaScriptCodeCount,
        unresolvedSelectorCount: exportResult.validation.unresolvedSelectorCount,
        missingSourceTextCount: exportResult.validation.missingSourceTextCount ?? 0,
        duplicatedSourceTextCount: exportResult.validation.duplicatedSourceTextCount ?? 0,
        missingHrefCount: exportResult.validation.missingHrefCount ?? 0,
        missingImageCount: exportResult.validation.missingImageCount ?? 0
      },
      pageLevelCss: detectPageLevelCss(input.css)
    };
  }
  window.JigmaCore = {
    schemaVersion: BRICKS_COMPATIBILITY_SCHEMA_VERSION,
    targetBricksVersion: TARGET_BRICKS_VERSION,
    convertToBricksCompatibility,
    detectPageLevelCss
  };
})();
