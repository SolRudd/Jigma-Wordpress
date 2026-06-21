import type { ConversionWarning, ParsedElement } from "../../types/jigma.ts";

const EVENT_ATTRIBUTE_PATTERN = /^on[a-z]+$/i;

function walk(
  element: ParsedElement,
  path: string,
  callback: (element: ParsedElement, path: string) => void,
) {
  callback(element, path);
  element.children.forEach((child, index) => walk(child, `${path}-${index}`, callback));
}

function getReadableOwner(element: ParsedElement) {
  const className = element.attributes.class?.split(/\s+/).find(Boolean);
  return className ? `${element.tagName}.${className}` : element.tagName;
}

export function inspectInlineEventHandlers(roots: ParsedElement[]): ConversionWarning[] {
  const warnings: ConversionWarning[] = [];

  roots.forEach((root, index) => {
    walk(root, `${index}`, (element, path) => {
      const eventAttributes = Object.entries(element.attributes)
        .filter(([name]) => EVENT_ATTRIBUTE_PATTERN.test(name));
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
        suggestedAction: "Move reviewed behavior into the JavaScript editor or rebuild the interaction with Bricks-native controls.",
      });
    });
  });

  return warnings;
}

export function stripUnsafeEventAttributes(attributes: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(attributes).filter(([name]) => !EVENT_ATTRIBUTE_PATTERN.test(name)),
  );
}
