export function isSvgUrl(value: string) {
  return /\.svg(?:[?#]|$)/i.test(value);
}

export function isSvgSpriteReference(value: string) {
  return isSvgUrl(value) && value.includes("#");
}

export function getSvgMimeType(value: string) {
  return isSvgUrl(value) ? "image/svg+xml" : undefined;
}
