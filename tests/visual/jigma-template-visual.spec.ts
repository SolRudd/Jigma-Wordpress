import { expect, test } from "@playwright/test";
import {
  getTemplateByKey,
  jigmaHeaderHeroComposition,
} from "../../lib/templates.ts";

const viewports = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
];

const header = getTemplateByKey("jigma-header");
const hero = getTemplateByKey("jigma-hero");

if (!header || !hero) {
  throw new Error("Required Jigma templates are not registered.");
}

const cases = [
  {
    id: "jigma-header",
    html: header.html,
    css: header.css,
    javascript: header.javascript,
  },
  {
    id: "jigma-hero",
    html: hero.html,
    css: hero.css,
    javascript: hero.javascript,
  },
  {
    id: "jigma-header-hero",
    html: jigmaHeaderHeroComposition.html,
    css: jigmaHeaderHeroComposition.css,
    javascript: jigmaHeaderHeroComposition.javascript,
  },
];

function renderDocument(input: { html: string; css: string; javascript: string }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: #04040a; }
      body { overflow-x: hidden; }
      ${input.css}
    </style>
  </head>
  <body>
    ${input.html}
    <script>${input.javascript}</script>
  </body>
</html>`;
}

for (const viewport of viewports) {
  for (const visualCase of cases) {
    test(`${visualCase.id} ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setContent(renderDocument(visualCase), { waitUntil: "networkidle" });

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${visualCase.id} should not overflow at ${viewport.name}`).toBeLessThanOrEqual(1);

      const screenshot = await page.screenshot({
        animations: "disabled",
        fullPage: true,
        path: `tests/visual-regression/${visualCase.id}-${viewport.name}.png`,
      });
      expect(
        screenshot.byteLength,
        `${visualCase.id} screenshot should not be blank at ${viewport.name}`,
      ).toBeGreaterThan(10_000);
    });
  }
}
