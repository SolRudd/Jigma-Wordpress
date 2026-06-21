export interface SvgSanitizationReport {
  removedTags: string[];
  removedAttributes: string[];
  externalReferences: string[];
  requiresReview: boolean;
  malformed: boolean;
}

export interface SvgSanitizationResult {
  svg: string;
  report: SvgSanitizationReport;
}

const ALLOWED_TAGS = new Set([
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
  "tspan",
]);

const ALLOWED_ATTRS = new Set([
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
  "y2",
]);

function unique(items: string[]) {
  return Array.from(new Set(items));
}

function blankReport(): SvgSanitizationReport {
  return {
    removedTags: [],
    removedAttributes: [],
    externalReferences: [],
    requiresReview: true,
    malformed: false,
  };
}

function isUnsafeUrl(value: string) {
  const normalized = value.trim().replace(/[\u0000-\u001f\s]+/g, "").toLowerCase();
  return normalized.startsWith("javascript:") ||
    normalized.startsWith("data:text/html") ||
    normalized.startsWith("vbscript:");
}

function getExternalReference(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return "";
  }

  if (/^(https?:)?\/\//i.test(trimmed) || /\.svg(?:[?#]|$)/i.test(trimmed)) {
    return trimmed;
  }

  return "";
}

function isUnsafeRemoteReference(value: string) {
  return /^(https?:)?\/\//i.test(value.trim());
}

function isReferenceAttribute(name: string) {
  return ["href", "xlink:href", "src", "clip-path", "mask", "filter", "fill", "stroke"].includes(name);
}

function sanitizeAttributeValue(name: string, value: string, report: SvgSanitizationReport) {
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

function serializeNode(node: Element | ChildNode, report: SvgSanitizationReport): string {
  if (node.nodeType === node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (node.nodeType !== node.ELEMENT_NODE) {
    return "";
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  if (!ALLOWED_TAGS.has(tagName)) {
    report.removedTags.push(tagName);
    return "";
  }

  const attributes: string[] = [];
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

export function sanitizeSvgMarkup(rawSvg: string): SvgSanitizationResult {
  const report = blankReport();
  const source = rawSvg.trim();

  if (!source || !/^<svg[\s>]/i.test(source)) {
    return {
      svg: "",
      report: {
        ...report,
        malformed: true,
      },
    };
  }

  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    const strippedUnsafe = source
      .replace(/<script\b[\s\S]*?<\/script>/gi, () => {
        report.removedTags.push("script");
        return "";
      })
      .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, () => {
        report.removedTags.push("foreignObject");
        return "";
      })
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (match) => {
        report.removedAttributes.push(match.trim());
        return "";
      })
      .replace(/\s+(href|xlink:href)\s*=\s*(["'])javascript:[\s\S]*?\2/gi, (match) => {
        report.removedAttributes.push(match.trim());
        return "";
      });

    const stripped = strippedUnsafe.replace(
      /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>/g,
      (match, closingSlash: string | undefined, tagName: string, rawAttributes: string) => {
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
        const attributes: string[] = [];
        const attributePattern = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
        let attributeMatch: RegExpExecArray | null;

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
      },
    );

    return {
      svg: stripped,
      report: {
        ...report,
        removedTags: unique(report.removedTags),
        removedAttributes: unique(report.removedAttributes),
        externalReferences: unique(report.externalReferences),
        requiresReview: true,
      },
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
      },
    };
  }

  const safeSvg = serializeNode(svg, report);

  return {
    svg: safeSvg,
    report: {
      ...report,
      removedTags: unique(report.removedTags),
      removedAttributes: unique(report.removedAttributes),
      externalReferences: unique(report.externalReferences),
      requiresReview: true,
    },
  };
}

export function countSvgInternalNodes(rawSvg: string) {
  const matches = rawSvg.match(/<\s*(path|circle|rect|defs|linearGradient|radialGradient|stop|clipPath|mask|g|use|line|polyline|polygon|ellipse)\b/gi);
  return matches?.length ?? 0;
}
