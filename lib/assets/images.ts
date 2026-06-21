import type { ParsedElement } from "../../types/jigma.ts";

export interface ResponsiveImageSource {
  srcset: string;
  media?: string;
  sizes?: string;
  type?: string;
}

export interface ImageDescriptor {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  loading?: string;
  decoding?: string;
  srcset?: string;
  sizes?: string;
  responsiveSources: ResponsiveImageSource[];
}

function numericAttribute(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function findFirstElement(element: ParsedElement, tagName: string): ParsedElement | undefined {
  if (element.tagName === tagName) {
    return element;
  }

  for (const child of element.children) {
    const found = findFirstElement(child, tagName);
    if (found) {
      return found;
    }
  }

  return undefined;
}

export function getImageDescriptor(element: ParsedElement): ImageDescriptor | null {
  const image = element.tagName === "img" ? element : findFirstElement(element, "img");
  if (!image) {
    return null;
  }

  const responsiveSources = element.tagName === "picture"
    ? element.children
      .filter((child) => child.tagName === "source" && child.attributes.srcset)
      .map((source) => ({
        srcset: source.attributes.srcset,
        media: source.attributes.media,
        sizes: source.attributes.sizes,
        type: source.attributes.type,
      }))
    : [];

  return {
    src: image.attributes.src ?? "",
    alt: image.attributes.alt,
    width: numericAttribute(image.attributes.width),
    height: numericAttribute(image.attributes.height),
    loading: image.attributes.loading,
    decoding: image.attributes.decoding,
    srcset: image.attributes.srcset,
    sizes: image.attributes.sizes,
    responsiveSources,
  };
}

export function getAspectRatio(width?: number, height?: number) {
  if (!width || !height) {
    return undefined;
  }

  return `${width} / ${height}`;
}
