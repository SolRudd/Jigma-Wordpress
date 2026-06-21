import { getAspectRatio, type ImageDescriptor } from "../../assets/images.ts";

export function createBricksImageSettings(image: ImageDescriptor | null) {
  const settings: Record<string, unknown> = {};

  if (!image) {
    return settings;
  }

  if (image.src) {
    settings.image = {
      url: image.src,
      ...(image.width ? { width: image.width } : {}),
      ...(image.height ? { height: image.height } : {}),
    };
  }
  if (image.alt !== undefined) settings.altText = image.alt;
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
