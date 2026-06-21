import type {
  AssetManifest,
  AssetManifestItem,
  AssetStatus,
  AssetType,
  AssetUsage,
  ConversionInput,
  ConversionWarning,
  ParsedElement,
} from "../../types/jigma.ts";
import { getClassNames, getRenderableRoots } from "../parser/html.ts";
import { extractCssUrlReferences, getCssOwnerClass } from "./css-urls.ts";
import { getImageDescriptor } from "./images.ts";
import { isSvgUrl } from "./svg.ts";
import { inspectInlineEventHandlers } from "./code.ts";

function stableId(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `asset_${(hash >>> 0).toString(36)}`;
}

function normalizeUrl(value: string) {
  return value.trim().replace(/^url\(["']?|["']?\)$/g, "");
}

function isExternalUrl(value: string) {
  return /^(https?:)?\/\//i.test(value);
}

function isDataUri(value: string) {
  return /^data:/i.test(value);
}

function mimeFromUrl(value: string) {
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
  return undefined;
}

function parseSrcset(value: string) {
  return value
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function getPrimaryClass(element: ParsedElement) {
  return getClassNames(element)[0];
}

function walkElements(
  element: ParsedElement,
  path: string,
  callback: (element: ParsedElement, path: string) => void,
) {
  callback(element, path);
  element.children.forEach((child, index) => walkElements(child, `${path}-${index}`, callback));
}

function makeItem(input: {
  type: AssetType;
  source: AssetManifestItem["source"];
  originalUrl: string;
  ownerNodeId?: string;
  ownerClass?: string;
  usage: AssetUsage;
  alt?: string;
  width?: number;
  height?: number;
  status?: AssetStatus;
  warnings?: string[];
}): AssetManifestItem {
  const normalizedUrl = normalizeUrl(input.originalUrl);
  const dataUri = isDataUri(normalizedUrl);
  const external = isExternalUrl(normalizedUrl);

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
    warnings: input.warnings ?? [],
  };
}

function addItem(items: Map<string, AssetManifestItem>, item: AssetManifestItem) {
  const key = item.normalizedUrl || `${item.type}:${item.ownerNodeId ?? item.id}`;
  const existing = items.get(key);

  if (!existing) {
    items.set(key, item);
    return;
  }

  existing.warnings = Array.from(new Set([...existing.warnings, ...item.warnings]));
  existing.importable = existing.importable || item.importable;
  existing.external = existing.external || item.external;
  existing.status = existing.status === "native" && item.status !== "native" ? item.status : existing.status;
}

function warningForItem(item: AssetManifestItem): ConversionWarning | null {
  if (item.warnings.length === 0) {
    return null;
  }

  return {
    id: `asset:${item.id}`,
    code: `asset.${item.type}`,
    severity: item.status === "failed" || item.status === "unsupported" ? "action-required" : "notice",
    title: "Asset review",
    summary: item.warnings[0],
    message: item.warnings[0],
    ownerElementId: item.ownerNodeId,
    ownerLabel: item.ownerClass,
    details: [
      `Source: ${item.originalUrl || item.type}`,
      `Usage: ${item.usage}`,
      `Status: ${item.status}`,
      ...item.warnings.slice(1),
    ],
    suggestedAction: item.importable
      ? "Standalone exports preserve URLs. Import into WordPress Media Library only when explicitly enabled in the plugin."
      : "Review this asset in Bricks after paste.",
  };
}

export function createAssetManifest(input: ConversionInput): AssetManifest {
  const items = new Map<string, AssetManifestItem>();
  const parsed = getRenderableRoots(input.html);

  parsed.roots.forEach((root, index) => {
    walkElements(root, `${index}`, (element, path) => {
      if (element.tagName === "img" || element.tagName === "picture") {
        const image = getImageDescriptor(element);
        if (!image) {
          return;
        }

        const ownerClass = getPrimaryClass(element);
        if (image.src) {
          addItem(items, makeItem({
            type: isSvgUrl(image.src) ? "svg-file" : "image",
            source: "html",
            originalUrl: image.src,
            ownerNodeId: path,
            ownerClass,
            usage: "element",
            alt: image.alt,
            width: image.width,
            height: image.height,
            status: "native",
            warnings: image.alt === undefined
              ? ["Image is missing alt text and needs accessibility review."]
              : [],
          }));
        }

        [...(image.srcset ? parseSrcset(image.srcset) : []), ...image.responsiveSources.flatMap((source) =>
          parseSrcset(source.srcset)
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
            warnings: ["Responsive source is preserved for Bricks review when no exact native mapping is available."],
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
          warnings: ["Inline SVG source is preserved as code and requires Bricks signature review after import."],
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
          warnings: ["Video sources are preserved by URL and require manual Bricks review."],
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
          warnings: ["Iframe embed is preserved as disabled code and requires review."],
        }));
      }
    });
  });

  extractCssUrlReferences(input.css).forEach((reference) => {
    const ownerClass = getCssOwnerClass(reference.selector);
    addItem(items, makeItem({
      type: isSvgUrl(reference.url)
        ? "svg-file"
        : reference.usage === "background" || reference.usage === "overlay"
        ? "background-image"
        : "css-url",
      source: "css",
      originalUrl: reference.url,
      ownerClass,
      usage: reference.usage,
      status: "preserved",
      warnings: reference.usage === "overlay"
        ? ["Background image and overlay layers are preserved in class-owned CSS when not safely mappable."]
        : ["CSS URL asset is preserved by URL and not fetched silently."],
    }));
  });

  const externalScriptPattern = /https?:\/\/[^\s"'<>),]+/gi;
  let jsMatch: RegExpExecArray | null;
  while ((jsMatch = externalScriptPattern.exec(input.js)) !== null) {
    addItem(items, makeItem({
      type: "script",
      source: "js",
      originalUrl: jsMatch[0],
      usage: "script",
      status: "action-required",
      warnings: ["JavaScript dependency is review-required and not inserted by default."],
    }));
  }

  const manifestItems = [...items.values()];
  const inlineEventWarnings = inspectInlineEventHandlers(parsed.roots);
  const warnings = [
    ...manifestItems.map(warningForItem).filter((warning): warning is ConversionWarning => Boolean(warning)),
    ...inlineEventWarnings,
  ];

  return {
    items: manifestItems,
    summary: {
      nativeImages: manifestItems.filter((item) => item.type === "image" && item.status === "native").length,
      responsiveImages: manifestItems.filter((item) => item.type === "responsive-image").length,
      backgroundImages: manifestItems.filter((item) => item.type === "background-image").length,
      overlaysMapped: manifestItems.filter((item) => item.usage === "overlay" || item.usage === "pseudo-element").length,
      inlineSvgs: manifestItems.filter((item) => item.type === "svg-inline").length,
      svgSignaturesRequired: manifestItems.filter((item) =>
        item.type === "svg-inline" && item.status === "action-required"
      ).length,
      codeElements: input.options.includeJavaScriptCode && input.js.trim() ? 1 : 0,
      externalAssets: manifestItems.filter((item) => item.external).length,
      failedAssets: manifestItems.filter((item) => item.status === "failed").length,
    },
    warnings,
  };
}
