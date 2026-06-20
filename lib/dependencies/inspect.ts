import type { DependencyItem } from "../../types/jigma.ts";
import { getRenderableRoots, parseHtmlFragment } from "../parser/html.ts";

function makeId(type: string, value: string) {
  let hash = 2166136261;
  const seed = `${type}:${value}`;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `dep_${(hash >>> 0).toString(36)}`;
}

function pushUnique(items: DependencyItem[], item: Omit<DependencyItem, "id">) {
  const id = makeId(item.type, item.value);
  if (!items.some((existing) => existing.id === id)) {
    items.push({ ...item, id });
  }
}

function isExternalUrl(value: string) {
  return /^(https?:)?\/\//i.test(value);
}

function getHostLabel(value: string) {
  try {
    const url = value.startsWith("//") ? new URL(`https:${value}`) : new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function detectLibrary(value: string) {
  const normalized = value.toLowerCase();
  const libraries = [
    { pattern: /gsap|greensock/, label: "GSAP" },
    { pattern: /swiper/, label: "Swiper" },
    { pattern: /jquery/, label: "jQuery" },
    { pattern: /tailwind/, label: "Tailwind CDN" },
    { pattern: /font[-_]?awesome|fontawesome/, label: "Font Awesome" },
    { pattern: /splide/, label: "Splide" },
    { pattern: /alpinejs|alpine\.js/, label: "Alpine.js" },
    { pattern: /three(\.module)?\.js|threejs/, label: "Three.js" },
  ];

  return libraries.find((library) => library.pattern.test(normalized))?.label;
}

function walkElements(
  element: ReturnType<typeof getRenderableRoots>["roots"][number],
  callback: (element: ReturnType<typeof getRenderableRoots>["roots"][number]) => void,
) {
  callback(element);
  element.children.forEach((child) => walkElements(child, callback));
}

export function inspectDependencies(html: string, css: string, js: string) {
  const items: DependencyItem[] = [];
  const parsed = parseHtmlFragment(html);

  parsed.root.children.forEach((root) => {
    walkElements(root, (element) => {
      if (element.tagName === "link") {
        const href = element.attributes.href;
        const rel = element.attributes.rel?.toLowerCase() ?? "";
        if (href && rel.includes("stylesheet")) {
          const isFont = /fonts\.(googleapis|gstatic)\.com/i.test(href);
          pushUnique(items, {
            type: isFont ? "font" : "stylesheet",
            label: isFont ? "Google Fonts stylesheet" : `External stylesheet: ${getHostLabel(href)}`,
            value: href,
            source: "html",
            required: true,
            includable: true,
            warning: "Bricks requires external stylesheets to be reviewed before execution.",
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
            warning: "External scripts are not run in preview and should be reviewed before adding to Bricks.",
          });
        }
      }

      if (element.tagName === "img" && element.attributes.src) {
        pushUnique(items, {
          type: "image",
          label: `Image URL: ${getHostLabel(element.attributes.src)}`,
          value: element.attributes.src,
          source: "html",
          required: true,
          includable: false,
        });
      }

      if (element.tagName === "svg") {
        pushUnique(items, {
          type: "svg",
          label: "Inline SVG asset",
          value: element.attributes.id ? `#${element.attributes.id}` : "inline-svg",
          source: "html",
          required: true,
          includable: true,
          warning: "SVG code may need manual signing or review in Bricks before rendering.",
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
          warning: `${library} was detected. Jigma does not bundle library runtime code automatically.`,
        });
      }
    });
  });

  const importPattern = /@import\s+(?:url\()?["']?([^"')\s]+)["']?\)?/gi;
  let importMatch: RegExpExecArray | null;
  while ((importMatch = importPattern.exec(css)) !== null) {
    const value = importMatch[1];
    pushUnique(items, {
      type: /fonts\.(googleapis|gstatic)\.com/i.test(value) ? "font" : "stylesheet",
      label: /fonts\.(googleapis|gstatic)\.com/i.test(value) ? "Google Fonts import" : `CSS import: ${getHostLabel(value)}`,
      value,
      source: "css",
      required: true,
      includable: true,
      warning: "CSS @import rules are preserved in raw CSS mode but may need review in Bricks.",
    });
  }

  const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlPattern.exec(css)) !== null) {
    const value = urlMatch[1];
    if (value.startsWith("data:")) {
      continue;
    }

    pushUnique(items, {
      type: /\.svg(?:[?#]|$)/i.test(value) ? "svg" : "image",
      label: /\.svg(?:[?#]|$)/i.test(value) ? `SVG URL: ${getHostLabel(value)}` : `CSS asset: ${getHostLabel(value)}`,
      value,
      source: "css",
      required: true,
      includable: false,
    });
  }

  const variablePattern = /(--[a-zA-Z0-9_-]+)\s*:/g;
  let variableMatch: RegExpExecArray | null;
  while ((variableMatch = variablePattern.exec(css)) !== null) {
    pushUnique(items, {
      type: "css-variable",
      label: `CSS variable: ${variableMatch[1]}`,
      value: variableMatch[1],
      source: "css",
      required: false,
      includable: true,
    });
  }

  const externalPattern = /https?:\/\/[^\s"'<>),]+/gi;
  for (const source of [
    { text: html, source: "html" as const },
    { text: css, source: "css" as const },
    { text: js, source: "js" as const },
  ]) {
    let match: RegExpExecArray | null;
    while ((match = externalPattern.exec(source.text)) !== null) {
      const value = match[0];
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
          warning: `${library} was detected. Confirm the dependency is loaded in the final Bricks site.`,
        });
      } else if (isCdn || isExternalUrl(value)) {
        pushUnique(items, {
          type: isCdn ? "cdn" : "stylesheet",
          label: isCdn ? `CDN link: ${getHostLabel(value)}` : `External URL: ${getHostLabel(value)}`,
          value,
          source: source.source,
          required: true,
          includable: false,
          warning: "External URLs are listed for review and are not silently embedded.",
        });
      }
    }
  }

  return items;
}
