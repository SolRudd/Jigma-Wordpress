import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createBricksExport } from "../../lib/bricks/export.ts";
import { BRICKS_ELEMENT_CUSTOM_CSS_FIELD } from "../../lib/css/element.ts";
import type { BricksElement, BricksExport, OutputOptions } from "../../types/jigma.ts";

const viewports = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1100x900", width: 1100, height: 900 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
];

const html = readFileSync(new URL("../fixtures/bb-system-shell/source.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../fixtures/bb-system-shell/source.css", import.meta.url), "utf8");

const options: OutputOptions = {
  stylingMode: "bem-css",
  exportMode: "native-bem-classes",
  exportProfile: "bricks-compatibility",
  classMode: "strict-bem",
  projectPrefix: "jg",
  blockName: "section",
  createGlobalClasses: true,
  includeExternalCss: false,
  includeExternalScripts: false,
  minifyElementCss: false,
};

function escapeAttribute(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function classNamesFor(element: BricksElement, result: BricksExport) {
  const ids = Array.isArray(element.settings._cssGlobalClasses)
    ? element.settings._cssGlobalClasses.map((id) => `${id}`)
    : [];
  return ids
    .map((id) => result.globalClasses?.find((entry) => entry.id === id)?.name)
    .filter(Boolean)
    .join(" ");
}

function renderAttributes(element: BricksElement, result: BricksExport) {
  const attributes = Array.isArray(element.settings._attributes)
    ? element.settings._attributes as Array<{ name?: unknown; value?: unknown }>
    : [];
  const className = classNamesFor(element, result);
  const parts = className ? [`class="${escapeAttribute(className)}"`] : [];

  attributes.forEach((attribute) => {
    if (typeof attribute.name !== "string" || !attribute.name) {
      return;
    }
    parts.push(`${attribute.name}="${escapeAttribute(attribute.value ?? "")}"`);
  });

  return parts.length ? ` ${parts.join(" ")}` : "";
}

function tagFor(element: BricksElement) {
  if (element.name === "section") return "section";
  if (element.name === "heading") return String(element.settings.tag || "h2");
  if (element.name === "text-basic") return String(element.settings.customTag || element.settings.tag || "p");
  if (element.name === "text-link") return "a";
  return String(element.settings.customTag || element.settings.tag || "div");
}

function renderElement(element: BricksElement, result: BricksExport, byId: Map<string, BricksElement>): string {
  if (element.name === "code") return "";
  if (element.name === "svg") return String(element.settings.code || "");

  if (element.name === "image") {
    const image = element.settings.image as { url?: string } | undefined;
    return `<img${renderAttributes(element, result)} src="${escapeAttribute(image?.url || "")}" alt="${escapeAttribute(element.settings.altText || "")}">`;
  }

  const tag = tagFor(element);
  const href = element.name === "text-link" && element.settings.link &&
    typeof element.settings.link === "object" &&
    "url" in element.settings.link
    ? ` href="${escapeAttribute((element.settings.link as { url?: string }).url || "")}"`
    : "";
  const childHtml = element.children
    .map((childId) => byId.get(childId))
    .filter((child): child is BricksElement => Boolean(child))
    .map((child) => renderElement(child, result, byId))
    .join("");
  const text = typeof element.settings.text === "string" ? element.settings.text : "";

  return `<${tag}${renderAttributes(element, result)}${href}>${text}${childHtml}</${tag}>`;
}

function reconstructFromPayload(result: BricksExport) {
  const byId = new Map(result.content.map((element) => [element.id, element]));
  return result.content
    .filter((element) => element.parent === 0)
    .map((element) => renderElement(element, result, byId))
    .join("\n");
}

function classCssFromPayload(result: BricksExport) {
  return result.globalClasses
    ?.map((entry) => `${entry.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] ?? ""}`)
    .filter((value) => value.trim().length > 0)
    .join("\n\n") ?? "";
}

function renderDocument(input: { html: string; css: string }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: #070a16; }
      body { overflow-x: hidden; }
      ${input.css}
    </style>
  </head>
  <body>${input.html}</body>
</html>`;
}

const result = createBricksExport({ html, css, js: "", options });
const reconstructed = reconstructFromPayload(result);
const reconstructedCss = classCssFromPayload(result);

for (const viewport of viewports) {
  for (const visualCase of [
    { id: "source", html, css },
    { id: "reconstructed", html: reconstructed, css: reconstructedCss },
  ]) {
    test(`bb-system-shell ${visualCase.id} ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setContent(renderDocument(visualCase), { waitUntil: "networkidle" });

      const root = page.locator(".bb-system-shell");
      await expect(root).toBeVisible();
      await expect(page.locator(".bb-system-shell__heading")).toContainText("Built like a website.");
      await expect(page.locator(".bb-system-card")).toHaveCount(3);
      await expect(page.locator(".bb-system-stat")).toHaveCount(4);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${visualCase.id} should not overflow at ${viewport.name}`).toBeLessThanOrEqual(1);

      const fidelity = await page.evaluate(() => {
        const shell = document.querySelector(".bb-system-shell")!;
        const card = document.querySelector(".bb-system-card")!;
        const text = document.body.innerText;
        return {
          eyebrowCount: (text.match(/02 · SYSTEMS BUILT TO SCALE/g) || []).length,
          beforeContent: getComputedStyle(shell, "::before").content,
          afterContent: getComputedStyle(card, "::after").content,
          activeTransform: getComputedStyle(document.querySelector(".bb-system-card--active")!).transform,
          cardDisplay: getComputedStyle(document.querySelector(".bb-system-shell__cards")!).display,
        };
      });
      expect(fidelity.eyebrowCount).toBe(1);
      expect(fidelity.beforeContent).toBe("\"\"");
      expect(fidelity.afterContent).toBe("\"\"");
      expect(fidelity.cardDisplay).toBe("grid");
      if (viewport.width <= 900) {
        expect(fidelity.activeTransform).toBe("none");
      }

      const screenshot = await page.screenshot({
        animations: "disabled",
        fullPage: true,
        path: `tests/visual-regression/bb-system-shell-${visualCase.id}-${viewport.name}.png`,
      });
      expect(screenshot.byteLength).toBeGreaterThan(10_000);
    });
  }
}
