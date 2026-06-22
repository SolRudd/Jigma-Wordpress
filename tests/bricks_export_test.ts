import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createBricksExport,
  BRICKS_COMPATIBILITY_SCHEMA_VERSION,
  serializeBricksClipboardPayload,
  serializeJigmaDebugReport,
  TARGET_BRICKS_VERSION,
} from "../lib/bricks/export.ts";
import {
  convertToBricksCompatibility,
  detectPageLevelCss,
} from "../lib/plugin/jigma-core.ts";
import { createAssetManifest } from "../lib/assets/manifest.ts";
import { BRICKS_ELEMENT_CUSTOM_CSS_FIELD } from "../lib/css/element.ts";
import { inspectDependencies } from "../lib/dependencies/inspect.ts";
import {
  DEFAULT_OUTPUT_ADAPTER,
  createOutputExport,
} from "../lib/output/adapters.ts";
import {
  createLocalPreset,
  deleteLocalPreset,
  duplicateLocalPreset,
  exportLocalPresetJson,
  importLocalPresetJson,
  parseLocalPresets,
  renameLocalPreset,
  serializeLocalPresets,
  upsertLocalPreset,
  validatePresetImport,
} from "../lib/presets.ts";
import {
  PREVIEW_HOVER_INSPECTOR_ENABLED,
  createPreviewDocument,
} from "../lib/preview/document.ts";
import {
  createLocalSavedSection,
  createSavedSectionSource,
  deleteSavedSection,
  duplicateSavedSection,
  exportSavedSectionJson,
  importSavedSectionJson,
  renameSavedSection,
  serializeSavedSections,
  parseSavedSections,
  upsertSavedSection,
} from "../lib/saved-sections.ts";
import {
  advancedTemplates,
  getAdvancedTemplateByKey,
  getTemplateByKey,
  getTemplateCompositionByKey,
  jigmaHeaderHeroComposition,
  templates,
} from "../lib/templates.ts";
import JigmaBuilder, {
  AUTO_SCROLL_ENABLED,
  SOURCE_EDITOR_DEFINITIONS,
} from "../src/components/JigmaBuilder.tsx";
import type { OutputOptions } from "../types/jigma.ts";
import { goldenExportFixtures } from "./fixtures/golden_exports.ts";
import { mediaFixtures } from "./fixtures/media.ts";
import { sectionFixtures } from "./fixtures/sections.ts";

const defaultOptions: OutputOptions = {
  stylingMode: "bem-css",
  exportMode: "native-bem-classes",
  exportProfile: "native-controls-experimental",
  classMode: "strict-bem",
  projectPrefix: "acme",
  blockName: "section",
  createGlobalClasses: true,
  includeExternalCss: false,
  includeExternalScripts: false,
  minifyElementCss: false,
};

const featureCtaHtml = readFileSync(
  new URL("./fixtures/compatibility/feature-cta.html", import.meta.url),
  "utf8",
);
const featureCtaCss = readFileSync(
  new URL("./fixtures/compatibility/feature-cta.css", import.meta.url),
  "utf8",
);
const featureCtaReference = JSON.parse(readFileSync(
  new URL("./fixtures/compatibility/feature-cta-reference.json", import.meta.url),
  "utf8",
)) as {
  content: Array<{ name: string; children: unknown[]; label?: string; settings?: Record<string, unknown> }>;
  globalClasses: string[];
  globalElements: unknown[];
};
const processLightHtml = readFileSync(
  new URL("./fixtures/compatibility/process-light.html", import.meta.url),
  "utf8",
);
const processLightCss = readFileSync(
  new URL("./fixtures/compatibility/process-light.css", import.meta.url),
  "utf8",
);
const processLightReference = JSON.parse(readFileSync(
  new URL("./fixtures/compatibility/process-light-reference.json", import.meta.url),
  "utf8",
)) as {
  content: Array<{ name: string; children: number[]; label: string; settings?: Record<string, unknown> }>;
  globalClasses: string[];
  globalElements: unknown[];
};

const compatibilityOptions: Partial<OutputOptions> = {
  exportProfile: "bricks-compatibility",
  exportMode: "native-bem-classes",
  classMode: "strict-bem",
  projectPrefix: "jg",
  blockName: "section",
};

const heroPasteHtml = `<section class="hero-section">
  <div class="hero-inner">
    <nav class="hero-nav">
      <span class="hero-logo">Jigma</span>
    </nav>

    <div class="hero-content">
      <span class="hero-eyebrow">Code to Bricks</span>
      <h1 class="hero-title">
        Convert frontend code into editable Bricks structure
      </h1>
      <p class="hero-text">
        Paste your HTML and CSS. Jigma converts it into a clean, structured, editable Bricks setup ready for production.
      </p>

      <div class="hero-actions">
        <a class="hero-button hero-button--primary" href="#start">Start Converting</a>
        <a class="hero-button hero-button--secondary" href="#preview">View Example</a>
      </div>

      <div class="hero-stats">
        <div class="hero-metric">
          <span class="hero-metric__number">98%</span>
          <span class="hero-metric__label">Accuracy</span>
        </div>
        <div class="hero-metric">
          <span class="hero-metric__number">2.4x</span>
          <span class="hero-metric__label">Faster Workflow</span>
        </div>
        <div class="hero-metric">
          <span class="hero-metric__number">100%</span>
          <span class="hero-metric__label">Bricks Compatible</span>
        </div>
      </div>
    </div>
  </div>
</section>`;

const heroPasteCss = `.hero-section {
  min-height: 720px;
  padding: 64px;
  background: radial-gradient(circle at 80% 10%, rgba(139, 92, 246, 0.45), transparent 36%), #080b16;
  color: #ffffff;
}

.hero-inner {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.hero-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 96px;
}

.hero-logo {
  font-size: 24px;
  font-weight: 900;
}

.hero-content {
  max-width: 760px;
}

.hero-eyebrow {
  display: inline-flex;
  margin-bottom: 18px;
  color: #2dd4bf;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero-title {
  margin: 0;
  font-size: clamp(48px, 7vw, 84px);
  line-height: 0.96;
  letter-spacing: -0.06em;
}

.hero-text {
  max-width: 680px;
  margin: 24px 0 0;
  color: rgba(255,255,255,0.72);
  font-size: 18px;
  line-height: 1.65;
}

.hero-actions {
  display: flex;
  gap: 14px;
  margin-top: 36px;
}

.hero-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 22px;
  border-radius: 12px;
  font-weight: 800;
  text-decoration: none;
}

.hero-button--primary {
  background: #2dd4bf;
  color: #061312;
}

.hero-button--secondary {
  border: 1px solid rgba(255,255,255,0.2);
  color: #ffffff;
}

.hero-stats {
  display: grid;
  gap: 22px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 72px;
  max-width: 760px;
}

.hero-metric {
  padding: 24px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 18px;
  background: rgba(255,255,255,0.05);
}

.hero-metric__number {
  display: block;
  font-size: 36px;
  font-weight: 900;
  color: #2dd4bf;
}

.hero-metric__label {
  display: block;
  margin-top: 4px;
  color: rgba(255,255,255,0.68);
}

@media (max-width: 820px) {
  .hero-section {
    padding: 36px 20px;
  }

  .hero-nav {
    margin-bottom: 56px;
  }

  .hero-stats {
    grid-template-columns: 1fr;
  }
}`;

function exportFor(
  html: string,
  css = "",
  js = "",
  overrides: Partial<OutputOptions> = {},
) {
  return createBricksExport({
    html,
    css,
    js,
    options: { ...defaultOptions, ...overrides },
  });
}

function getCssPayload(result: ReturnType<typeof createBricksExport>) {
  return result.content
    .filter((element) => element.name === "code")
    .map((element) => `${element.settings.css ?? ""}`)
    .join("\n");
}

function getAllClassCustomCss(result: ReturnType<typeof createBricksExport>) {
  return result.globalClasses
    ?.map((entry) => `${entry.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] ?? ""}`)
    .filter((css) => css.trim().length > 0)
    .join("\n\n") ?? "";
}

function getElementByBemClass(
  result: ReturnType<typeof createBricksExport>,
  className: string,
) {
  const classId = result.globalClasses?.find((entry) => entry.name === className)?.id;
  return result.content.find((element) =>
    Array.isArray(element.settings._cssGlobalClasses) &&
    element.settings._cssGlobalClasses.includes(classId)
  );
}

function getElementsByBemClass(
  result: ReturnType<typeof createBricksExport>,
  className: string,
) {
  const classId = result.globalClasses?.find((entry) => entry.name === className)?.id;
  return result.content.filter((element) =>
    Array.isArray(element.settings._cssGlobalClasses) &&
    element.settings._cssGlobalClasses.includes(classId)
  );
}

function getElementByLabel(
  result: ReturnType<typeof createBricksExport>,
  label: string,
) {
  return result.content.find((element) => element.label === label);
}

function getElementCss(element: NonNullable<ReturnType<typeof getElementByBemClass>>) {
  return `${element.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] ?? ""}`;
}

function getGlobalClass(result: ReturnType<typeof createBricksExport>, className: string) {
  return result.globalClasses?.find((entry) => entry.name === className);
}

function getGlobalClassCss(result: ReturnType<typeof createBricksExport>, className: string) {
  return `${getGlobalClass(result, className)?.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] ?? ""}`;
}

function getGlobalClassSettings(result: ReturnType<typeof createBricksExport>, className: string) {
  return getGlobalClass(result, className)?.settings ?? {};
}

function getElementGlobalClassNames(
  result: ReturnType<typeof createBricksExport>,
  element: NonNullable<ReturnType<typeof getElementByLabel>>,
) {
  const ids = Array.isArray(element.settings._cssGlobalClasses)
    ? element.settings._cssGlobalClasses
    : [];
  return ids.map((id) => result.globalClasses?.find((entry) => entry.id === id)?.name)
    .filter(Boolean);
}

describe("Bricks export", () => {
  it("matches the Feature CTA Bricks Compatibility reference structure", () => {
    const result = exportFor(featureCtaHtml, featureCtaCss, "", compatibilityOptions);
    const clipboard = serializeBricksClipboardPayload(result);
    const heading = result.content.find((element) => element.name === "heading");
    const paragraph = result.content.find((element) => element.name === "text-basic");
    const link = result.content.find((element) => element.name === "text-link");
    const section = result.content.find((element) => element.name === "section");
    const classNames = result.globalClasses?.map((entry) => entry.name) ?? [];

    expect(result.content.map((element) => element.name)).toEqual(
      featureCtaReference.content.map((element) => element.name),
    );
    expect(result.content).toHaveLength(6);
    expect(result.globalClasses).toHaveLength(6);
    expect(classNames).toEqual([
      "lit-feature-cta",
      "lit-feature-cta__inner",
      "lit-feature-cta__content",
      "lit-feature-cta__title",
      "lit-feature-cta__text",
      "lit-feature-cta__link",
    ]);
    expect(classNames).not.toContain("lit-feature-cta__element");

    expect(section?.children).toHaveLength(1);
    expect(result.content[1].children).toEqual([result.content[2].id]);
    expect(result.content[2].children).toEqual([
      heading?.id,
      paragraph?.id,
      link?.id,
    ]);

    expect(heading?.children).toEqual([]);
    expect(heading?.settings.tag).toBe("h2");
    expect(heading?.settings._cssId).toBe("lit-feature-cta-title");
    expect(heading?.settings.text).toBe("A Sustainable Future:<br>\nSmall Steps, Big Impact");
    expect(JSON.stringify(result.content)).not.toContain("lit-feature-cta__element");
    expect(result.warnings.some((warning) => /br/i.test(warning.message))).toBe(false);

    expect(paragraph?.children).toEqual([]);
    expect(paragraph?.settings.tag).toBe("p");
    expect(`${paragraph?.settings.text ?? ""}`).toContain("Better choices compound over time.");

    expect(link?.children).toEqual([]);
    expect(link?.settings.text).toBe('Find out more <span aria-hidden="true">→</span>');
    expect(link?.settings.link).toEqual({ type: "internal", url: "#" });

    expect(section?.settings._attributes).toEqual([
      { name: "aria-labelledby", value: "lit-feature-cta-title" },
    ]);
    expect(result.content.some((element) => element.settings._cssId === "lit-feature-cta-title"))
      .toBe(true);

    expect(clipboard.globalElements).toEqual(featureCtaReference.globalElements);
    expect(Object.keys(clipboard).sort()).toEqual([
      "content",
      "globalClasses",
      "globalElements",
      "source",
      "sourceUrl",
      "version",
    ]);
    expect(JSON.stringify(clipboard)).not.toContain("jigmaMeta");
    expect(JSON.stringify(clipboard)).not.toContain("validation");
    expect(JSON.stringify(clipboard)).not.toContain("warnings");
    expect(clipboard.sourceUrl).toBe("jigma.local");
    expect(clipboard.version).toBe(TARGET_BRICKS_VERSION);
  });

  it("preserves Feature CTA literal class CSS without native-control leakage", () => {
    const result = exportFor(featureCtaHtml, featureCtaCss, "", compatibilityOptions);
    const allCss = getAllClassCustomCss(result);
    const innerCss = getGlobalClassCss(result, "lit-feature-cta__inner");
    const titleCss = getGlobalClassCss(result, "lit-feature-cta__title");
    const linkCss = getGlobalClassCss(result, "lit-feature-cta__link");

    expect(allCss).toContain(".lit-feature-cta__inner::before {");
    expect(allCss).toContain(".lit-feature-cta__inner::after {");
    expect(allCss).toContain("@media (max-width: 820px)");
    expect(allCss).toContain("forest-desktop.webp");
    expect(allCss).toContain("forest-tablet.webp");
    expect(allCss).toContain("forest-mobile.webp");
    expect(allCss).not.toContain("%root%");
    expect(allCss).not.toContain("#brxe-");
    expect(result.content.some((element) => element.name === "image")).toBe(false);

    expect(innerCss).toContain(".lit-feature-cta__inner {");
    expect(innerCss).toContain(".lit-feature-cta__inner::before {");
    expect(titleCss).toContain(".lit-feature-cta__title {");
    expect(linkCss).toContain(".lit-feature-cta__link:hover {");
    expect(linkCss).toContain(".lit-feature-cta__link span {");

    expect(getGlobalClassSettings(result, "lit-feature-cta__title")._typography).toBeUndefined();
    expect(result.validation.nativeStyleMappedCount).toBe(0);
    expect(result.validation.customCssFallbackCount).toBeGreaterThan(0);
    expect(result.warnings.filter((warning) => warning.severity !== "info")).toEqual([]);
  });

  it("keeps Compatibility and Native Controls Experimental profiles isolated", () => {
    const compatibility = exportFor(featureCtaHtml, featureCtaCss, "", compatibilityOptions);
    const nativeControls = exportFor(featureCtaHtml, featureCtaCss, "", {
      exportProfile: "native-controls-experimental",
      exportMode: "native-bem-classes",
      classMode: "strict-bem",
      projectPrefix: "jg",
      blockName: "feature-cta",
    });

    expect(getGlobalClassSettings(compatibility, "lit-feature-cta__title")._typography).toBeUndefined();
    expect(getGlobalClassSettings(nativeControls, "lit-feature-cta__title")._typography).toBeDefined();
    expect(getGlobalClassCss(compatibility, "lit-feature-cta__inner")).toContain(".lit-feature-cta__inner::before");
    expect(nativeControls.validation.nativeStyleMappedCount).toBeGreaterThan(compatibility.validation.nativeStyleMappedCount);
    expect(nativeControls.validation.customCssFallbackCount).toBeLessThan(compatibility.validation.customCssFallbackCount);
  });

  it("keeps Jigma diagnostics out of the clipboard and available in the debug report", () => {
    const result = exportFor(featureCtaHtml, featureCtaCss, "", compatibilityOptions);
    const clipboard = serializeBricksClipboardPayload(result);
    const debug = serializeJigmaDebugReport(result);

    expect("jigmaMeta" in clipboard).toBe(false);
    expect("validation" in clipboard).toBe(false);
    expect("warnings" in clipboard).toBe(false);
    expect(clipboard.globalElements).toEqual([]);
    expect(debug.validation.totalElements).toBe(6);
    expect(debug.assetManifest?.summary.overlaysMapped).toBeGreaterThan(0);
    expect(debug.classAudit).toHaveLength(6);
  });

  it("groups valid Feature CTA responsive background URLs as one dependency family", () => {
    const dependencies = inspectDependencies(featureCtaHtml, featureCtaCss, "");
    const backgroundFamily = dependencies.find((dependency) =>
      dependency.label === "External background image (3 responsive variants)"
    );

    expect(backgroundFamily).toBeDefined();
    expect(backgroundFamily?.value).toContain("forest-desktop.webp");
    expect(backgroundFamily?.value).toContain("forest-tablet.webp");
    expect(backgroundFamily?.value).toContain("forest-mobile.webp");
    expect(dependencies.filter((dependency) => dependency.value.includes("forest-"))).toHaveLength(1);
  });

  it("locks Process Light Bricks Compatibility structure and contextual labels", () => {
    const result = exportFor(processLightHtml, processLightCss, "", compatibilityOptions);
    const clipboard = serializeBricksClipboardPayload(result);
    const labels = result.content.map((element) => element.label);
    const names = result.content.map((element) => element.name);
    const classNames = result.globalClasses?.map((entry) => entry.name) ?? [];

    expect(result.validation.totalElements).toBe(31);
    expect(result.validation.globalClassCount).toBe(17);
    expect(names).toEqual(processLightReference.content.map((element) => element.name));
    expect(labels).toEqual(processLightReference.content.map((element) => element.label));
    expect(classNames).toEqual(processLightReference.globalClasses);
    expect(clipboard.globalElements).toEqual(processLightReference.globalElements);

    const shell = result.content.find((element) => element.label === "Process Shell")!;
    const header = result.content.find((element) => element.label === "Process Header")!;
    const track = result.content.find((element) => element.label === "Process Track")!;
    const grid = result.content.find((element) => element.label === "Process Grid")!;
    const step1 = result.content.find((element) => element.label === "Process Step 1")!;
    const step4 = result.content.find((element) => element.label === "Process Step 4")!;
    const discoverTitle = result.content.find((element) => element.label === "Discover Card Title")!;
    const discoverText = result.content.find((element) => element.label === "Discover Card Text")!;
    const monitorSvg = result.content.find((element) => element.label === "Monitor & Improve Icon SVG")!;

    expect(shell.children).toEqual([header.id, track.id, grid.id]);
    expect(header.settings.tag).toBe("header");
    expect(step1.settings.tag).toBe("article");
    expect(step4.settings.tag).toBe("article");
    expect(discoverTitle.name).toBe("heading");
    expect(discoverTitle.children).toEqual([]);
    expect(discoverTitle.settings.tag).toBe("h3");
    expect(discoverText.name).toBe("text-basic");
    expect(discoverText.settings.tag).toBe("p");
    expect(result.content.find((element) => element.label === "Step 1 Marker")?.settings.text).toBe("01");
    expect(result.content.find((element) => element.label === "Step 4 Marker")?.settings.text).toBe("04");
    expect(monitorSvg.name).toBe("svg");
    expect(monitorSvg.children).toEqual([]);
    expect(`${monitorSvg.settings.code ?? ""}`).toContain("<path");
    expect(JSON.stringify(result.content)).not.toContain("Paragraph");
    expect(JSON.stringify(result.content)).not.toContain("\"Svg\"");
    expect(result.content.some((element) => element.name === "path")).toBe(false);
  });

  it("preserves Process Light class CSS, repeated class IDs, SVG groups, and minimal clipboard JSON", () => {
    const result = exportFor(processLightHtml, processLightCss, "", compatibilityOptions);
    const clipboard = serializeBricksClipboardPayload(result);
    const cardClass = getGlobalClass(result, "lit-process-light__card")!;
    const markerClass = getGlobalClass(result, "lit-process-light__marker")!;
    const iconSvgClass = getGlobalClass(result, "lit-process-light__icon-svg")!;
    const cardCss = getGlobalClassCss(result, "lit-process-light__card");
    const trackCss = getGlobalClassCss(result, "lit-process-light__track");
    const gridCss = getGlobalClassCss(result, "lit-process-light__grid");
    const cardElements = result.content.filter((element) =>
      Array.isArray(element.settings._cssGlobalClasses) &&
      element.settings._cssGlobalClasses.includes(cardClass.id)
    );
    const markerElements = result.content.filter((element) =>
      Array.isArray(element.settings._cssGlobalClasses) &&
      element.settings._cssGlobalClasses.includes(markerClass.id)
    );
    const svgElements = result.content.filter((element) => element.name === "svg");
    const svgWithClass = svgElements.filter((element) =>
      Array.isArray(element.settings._cssGlobalClasses) &&
      element.settings._cssGlobalClasses.includes(iconSvgClass.id)
    );

    expect(cardElements).toHaveLength(4);
    expect(markerElements).toHaveLength(4);
    expect(svgElements).toHaveLength(4);
    expect(svgWithClass).toHaveLength(4);
    expect(cardCss).toContain(".lit-process-light__card::before {");
    expect(cardCss).toContain(".lit-process-light__card:hover::before {");
    expect(trackCss).toContain(".lit-process-light__track::before {");
    expect(gridCss).toContain("@media (max-width: 900px)");
    expect(gridCss).toContain("@media (max-width: 560px)");
    expect(getAllClassCustomCss(result)).not.toContain("%root%");
    expect(result.validation.unresolvedSelectorCount).toBe(0);
    expect(result.validation.missingClassReferenceCount).toBe(0);
    expect(result.validation.invalidNestingCount).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe("svg.signature_required");
    expect(result.warnings[0].count).toBe(4);
    expect(Object.keys(clipboard).sort()).toEqual([
      "content",
      "globalClasses",
      "globalElements",
      "source",
      "sourceUrl",
      "version",
    ]);
    expect(JSON.stringify(clipboard)).not.toContain("jigmaMeta");
    expect(JSON.stringify(clipboard)).not.toContain("validation");
    expect(JSON.stringify(clipboard)).not.toContain("warnings");
  });

  it("defines the standalone HTML, CSS, and review-required JavaScript editors", () => {
    expect(SOURCE_EDITOR_DEFINITIONS).toHaveLength(3);
    expect(SOURCE_EDITOR_DEFINITIONS.map((editor) => editor.kind)).toEqual([
      "html",
      "css",
      "js",
    ]);
    expect(SOURCE_EDITOR_DEFINITIONS.map((editor) => editor.label)).toEqual([
      "HTML",
      "CSS",
      "JavaScript",
    ]);
    expect(SOURCE_EDITOR_DEFINITIONS.find((editor) => editor.kind === "js")?.badge)
      .toBe("Review required");
  });

  it("starts new users with a blank workspace and no auto-loaded template", () => {
    const markup = renderToStaticMarkup(createElement(JigmaBuilder));

    expect(markup).toContain('value="jg"');
    expect(markup).toContain('value="section"');
    expect(markup).toContain("Start with HTML, CSS or JavaScript");
    expect(markup).toContain("Paste your code and run the preview.");
    expect(markup).toContain("No layers yet");
    expect(markup).toContain("Load Header Example");
    expect(markup).not.toContain("Reset Header Example");
    expect(markup).not.toContain("jigma-header__inner");
    expect(markup).not.toContain("jigma-hero__visual");
    expect(markup).toContain("Copy Bricks Structure");
    expect(markup).toContain("disabled=\"\"");
  });

  it("keeps Header HTML, CSS and JavaScript separate and preview-runnable", () => {
    const header = getTemplateByKey("jigma-header")!;
    const previewDocument = createPreviewDocument({
      html: header.html,
      css: header.css,
      js: header.javascript,
      activeLayerId: null,
      deletedLayerIds: new Set(),
      highlightsEnabled: false,
    });

    expect(header.html).toContain("jigma-header__mobile-menu");
    expect(header.html).not.toMatch(/<style|<script/i);
    expect(header.css).toContain(".jigma-header");
    expect(header.css).not.toMatch(/<script|<\/script/i);
    expect(header.javascript).toContain("aria-expanded");
    expect(header.javascript).not.toContain(".jigma-header {");
    expect(previewDocument).toContain("document.createElement(\"script\")");
    expect(previewDocument).toContain("jigma-header__toggle");
    expect(previewDocument).toContain("aria-expanded");
  });

  it("fixture exports generate valid Bricks hierarchy", () => {
    sectionFixtures.forEach((fixture) => {
      const result = exportFor(fixture.html, fixture.css);

      expect(result.validation.hierarchyValid, fixture.name).toBe(true);
      expect(result.validation.totalElements, fixture.name).toBeGreaterThan(0);
      expect(result.validation.bemClassCount, fixture.name).toBeGreaterThan(0);
    });
  });

  it("uses valid native structure mappings for headings, text, spans, links, and semantic wrappers", () => {
    const result = exportFor(
      `<section class="hero">
  <header class="hero__header"><nav class="hero__nav"><a class="hero__link" href="#plain">Plain link</a></nav></header>
  <h1 class="hero__title"><span class="hero__title-line">Convert frontend</span><span class="hero__rotator">sections</span></h1>
  <p class="hero__text">Simple paragraph</p>
  <span class="hero__eyebrow">Code to Bricks</span>
  <a class="hero__icon-link" href="#icon"><span class="hero__icon"></span><span class="hero__icon-label">Icon link</span></a>
  <button class="hero__button"><span class="hero__button-label">Button label</span></button>
</section>`,
      `.hero__title { font-size: 64px; }
.hero__text { line-height: 1.6; }
.hero__eyebrow { color: teal; }
.hero__button { display: inline-flex; }`,
      "",
      { projectPrefix: "jg", blockName: "hero" },
    );
    const title = getElementByLabel(result, "Hero Title")!;
    const text = getElementByLabel(result, "Hero Text")!;
    const eyebrow = getElementByLabel(result, "Hero Eyebrow")!;
    const nav = getElementByLabel(result, "Hero Nav")!;
    const iconLink = getElementByLabel(result, "Hero Icon Link")!;
    const button = getElementByLabel(result, "Hero Button")!;

    expect(title.name).toBe("div");
    expect(title.settings.tag).toBe("h1");
    expect(title.settings.text).toBeUndefined();
    expect(title.children.length).toBeGreaterThan(0);
    expect(text.name).toBe("text-basic");
    expect(text.settings.tag).toBe("p");
    expect(eyebrow.name).toBe("text-basic");
    expect(eyebrow.settings.tag).toBe("span");
    expect(nav.name).toBe("div");
    expect(nav.settings.tag).toBe("nav");
    expect(iconLink.name).toBe("div");
    expect(iconLink.settings.tag).toBe("a");
    expect(button.name).toBe("div");
    expect(button.settings.tag).toBe("button");
    expect(result.validation.invalidNestingCount).toBe(0);
    expect(result.content.filter((element) =>
      ["heading", "text-link", "button", "text-basic", "svg", "image"].includes(element.name) &&
      element.children.length > 0
    )).toHaveLength(0);
  });

  it("preserves distinct source BEM base and variant classes without selector collapse", () => {
    const result = exportFor(
      `<section class="jigma-hero">
  <article class="jigma-hero__card jigma-hero__input-card">Input</article>
  <article class="jigma-hero__card jigma-hero__output-card">Output</article>
  <article class="jigma-hero__card jigma-hero__inspector-card">Inspector</article>
</section>`,
      `.jigma-hero__card { border-radius: 20px; }
.jigma-hero__input-card { top: 4px; left: 0; }
.jigma-hero__output-card { top: 92px; right: -8px; }
.jigma-hero__inspector-card { bottom: 0; left: 4px; }`,
      "",
      { projectPrefix: "jigma", blockName: "hero" },
    );
    const inputCard = getElementByLabel(result, "Hero Input Card")!;
    const outputCard = getElementByLabel(result, "Hero Output Card")!;
    const inspectorCard = getElementByLabel(result, "Hero Inspector Card")!;

    expect(getElementGlobalClassNames(result, inputCard)).toEqual([
      "jigma-hero__card",
      "jigma-hero__input-card",
    ]);
    expect(getElementGlobalClassNames(result, outputCard)).toEqual([
      "jigma-hero__card",
      "jigma-hero__output-card",
    ]);
    expect(getElementGlobalClassNames(result, inspectorCard)).toEqual([
      "jigma-hero__card",
      "jigma-hero__inspector-card",
    ]);
    expect(getGlobalClassSettings(result, "jigma-hero__card")._border).toEqual({
      radius: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
    });
    expect(getGlobalClassSettings(result, "jigma-hero__input-card")._inset).toEqual({
      top: "4px",
      left: "0",
    });
    expect(getGlobalClassSettings(result, "jigma-hero__output-card")._inset).toEqual({
      top: "92px",
      right: "-8px",
    });
    expect(getGlobalClassSettings(result, "jigma-hero__inspector-card")._inset).toEqual({
      bottom: "0",
      left: "4px",
    });
  });

  it("uses Bricks JSON as the default output adapter", () => {
    const result = createOutputExport({
      html: `<section class="hero-section"><h1 class="hero-title">Adapter output</h1></section>`,
      css: `.hero-title { color: white; }`,
      js: "",
      options: defaultOptions,
    });

    expect(DEFAULT_OUTPUT_ADAPTER.target).toBe("bricks");
    expect(DEFAULT_OUTPUT_ADAPTER.format).toBe("bricks-json");
    expect(DEFAULT_OUTPUT_ADAPTER.formatLabel).toBe("Bricks JSON");
    expect(DEFAULT_OUTPUT_ADAPTER.copyLabel).toBe("Copy Bricks Structure");
    expect(DEFAULT_OUTPUT_ADAPTER.targetVersion).toBe(TARGET_BRICKS_VERSION);
    expect(result.source).toBe("bricksCopiedElements");
    expect(result.version).toBe(TARGET_BRICKS_VERSION);
    expect(result.content.some((element) => element.label === "Generated BEM CSS")).toBe(false);
    expect(result.globalClasses?.length).toBeGreaterThan(0);
  });

  it("keeps the preview hover inspector hard disabled", () => {
    const documentHtml = createPreviewDocument({
      html: `<section class="hero-section"><h1 class="hero-title">Preview</h1></section>`,
      css: `.hero-title { color: white; }`,
      js: "",
      activeLayerId: "0",
      deletedLayerIds: new Set(),
      highlightsEnabled: true,
    });

    expect(PREVIEW_HOVER_INSPECTOR_ENABLED).toBe(false);
    expect(documentHtml).not.toContain("hover-layer");
    expect(documentHtml).not.toContain("mouseover");
    expect(documentHtml).not.toContain("mousemove");
    expect(documentHtml).not.toContain("mouseenter");
    expect(documentHtml).not.toContain("mouseleave");
    expect(documentHtml).not.toContain("[data-jigma-layer]:hover");
    expect(documentHtml).not.toContain("scrollIntoView");
    expect(documentHtml).not.toContain('data-jigma-active="true"');
  });

  it("keeps Auto Scroll disabled and hidden from the MVP workspace", () => {
    const markup = renderToStaticMarkup(createElement(JigmaBuilder));

    expect(AUTO_SCROLL_ENABLED).toBe(false);
    expect(markup).not.toContain("Auto Scroll");
    expect(markup).not.toContain("Disable Highlights");
    expect(markup).not.toContain("data-line-number-mode");
    expect(markup).not.toContain("onScroll");
  });

  it("renders source editor tabs and keeps only one source editor visible", () => {
    const markup = renderToStaticMarkup(createElement(JigmaBuilder));

    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('id="source-tab-html"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('id="source-panel-html"');
    expect(markup).not.toContain('id="source-panel-css"');
    expect(markup).not.toContain('id="source-panel-js"');
    expect(markup).toContain("code-editor-host");
    expect(markup).toContain('data-editor-library="codemirror-6"');
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("code-lines");
    expect(markup).toContain('aria-controls="source-panel-css"');
    expect(markup).toContain('aria-controls="source-panel-js"');
    expect(markup).toContain("Review required");
  });

  it("renders responsive workspace controls and collapsed conversion check", () => {
    const markup = renderToStaticMarkup(createElement(JigmaBuilder));

    expect(markup).toContain("workspace-mode-tabs");
    expect(markup).toContain("mobile-action-bar");
    expect(markup).toContain("Run Preview");
    expect(markup).toContain("Copy Structure");
    expect(markup).toContain("conversion-check__summary");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("conversion-drawer");
  });

  it("ships a focused template library for the beta workspace", () => {
    expect(templates.map((template) => template.name)).toEqual([
      "Jigma Header",
    ]);

    const header = getTemplateByKey("jigma-header");

    expect(header?.html).toContain("jigma-header__toggle");
    expect(header?.html).toContain("jigma-header__logo-svg");
    expect(header?.html).not.toContain("jigma-header__wordmark");
    expect(header?.javascript).toContain("aria-expanded");
    expect(header?.javascript).not.toContain("onclick");
    expect(header?.prefix).toBe("jigma");
    expect(header?.blockName).toBe("header");
    expect(templates).toHaveLength(1);
    expect(getTemplateByKey("jigma-hero")).toBeNull();
    expect(getTemplateByKey("missing-template")).toBeNull();
  });

  it("keeps Header, Hero, fidelity, and composition sources separated", () => {
    const header = getTemplateByKey("jigma-header")!;
    const fidelityHero = getAdvancedTemplateByKey("jigma-hero-fidelity")!;
    const composition = getTemplateCompositionByKey("jigma-header-hero")!;
    const hero = composition.sources.find((source) => source.id === "jigma-hero")!;

    expect(advancedTemplates.map((template) => template.name)).toEqual([
      "Jigma Hero Fidelity Stress Test",
    ]);
    expect(templates.some((template) => template.id === fidelityHero.id)).toBe(false);
    expect(fidelityHero.category).toBe("Advanced");

    [header, hero, fidelityHero].forEach((template) => {
      expect(template.html).not.toMatch(/<!DOCTYPE|<html\b|<head\b|<body\b|<style\b|<script\b/i);
      expect(template.css).not.toMatch(/<style|<\/style|<script|<\/script/i);
      expect(template.javascript).not.toContain(".jigma-header {");
      expect(template.javascript).not.toContain(".jigma-hero {");
    });

    expect(header.html).toContain("jigma-header__mobile-menu");
    expect(header.javascript).toContain("aria-expanded");
    expect(hero.html).not.toContain("jigma-header");
    expect(hero.css).not.toContain("jigma-header");
    expect(fidelityHero.html).not.toContain("jigma-hero__header");
    expect(fidelityHero.css).not.toContain(".jigma-hero__header");

    expect(composition).toBe(jigmaHeaderHeroComposition);
    expect(composition.sources.map((source) => source.id)).toEqual([header.id, hero.id]);
    expect(composition.html).toContain(header.html);
    expect(composition.html).toContain(hero.html);
    expect(composition.css.split(header.css).length - 1).toBe(1);
    expect(composition.css.split(hero.css).length - 1).toBe(1);
    expect(composition.javascript).toBe(header.javascript);
    expect(composition.javascript).not.toContain("})();.jigma-header");
  });

  it("exports every production template as a valid native Bricks fixture", () => {
    templates.forEach((template) => {
      const first = exportFor(template.html, template.css, template.javascript, {
        projectPrefix: template.prefix,
        blockName: template.blockName,
      });
      const second = exportFor(template.html, template.css, template.javascript, {
        projectPrefix: template.prefix,
        blockName: template.blockName,
      });
      const classIds = first.globalClasses?.map((entry) => entry.id) ?? [];
      const classNames = first.globalClasses?.map((entry) => entry.name) ?? [];
      const classCss = first.globalClasses?.map((entry) =>
        `${entry.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] ?? ""}`
      ).join("\n") ?? "";
      const fallbackCss = getAllClassCustomCss(first);

      expect(first.validation.hierarchyValid, template.name).toBe(true);
      expect(first.validation.classReferenceValid, template.name).toBe(true);
      expect(first.validation.globalClassCount, template.name).toBe(first.globalClasses?.length);
      expect(first.validation.nativeStyleMappedCount, template.name).toBeGreaterThan(0);
      expect(first.validation.customCssFallbackCount, template.name).toBeGreaterThan(0);
      expect(first.validation.classFallbackStrategy, template.name).toBe("literal-bem");
      expect(first.validation.literalFallbackRuleCount, template.name).toBeGreaterThan(0);
      expect(first.validation.responsiveRuleCount, template.name).toBeGreaterThan(0);
      expect(first.content.every((element) => typeof element.label === "string" && element.label.length > 0))
        .toBe(true);
      expect(classIds.every((id) => /^[a-z0-9]{6}$/.test(id)), template.name).toBe(true);
      expect(new Set(classIds).size, template.name).toBe(classIds.length);
      expect(new Set(classNames).size, template.name).toBe(classNames.length);
      expect(first.globalClasses?.map((entry) => entry.id)).toEqual(
        second.globalClasses?.map((entry) => entry.id),
      );
      expect(first.content.some((element) => element.label === "Generated BEM CSS")).toBe(false);
      expect(first.content.filter((element) => element.label === "Jigma Component Styles")).toHaveLength(0);
      expect(classCss).not.toContain(".card ");
      expect(classCss).not.toContain(".title");
      expect(classCss).not.toContain("div > span");
      expect(classCss).not.toContain("%root%");
      expect(fallbackCss).toContain(`.${classNames[0]}`);
      expect(fallbackCss).not.toContain("#brxe-");
    });
  });

  it("matches golden Bricks export fixtures for every beta template", () => {
    expect(goldenExportFixtures.map((fixture) => fixture.templateId)).toEqual(
      templates.map((template) => template.id),
    );

    goldenExportFixtures.forEach((fixture) => {
      const template = templates.find((item) => item.id === fixture.templateId);
      expect(template, fixture.templateId).toBeDefined();

      const result = exportFor(template!.html, template!.css, template!.javascript, {
        projectPrefix: template!.prefix,
        blockName: template!.blockName,
      });
      const copyPayload = JSON.stringify(result);
      const parsedPayload = JSON.parse(copyPayload) as typeof result;
      const classRecords = result.globalClasses ?? [];
      const classIds = classRecords.map((entry) => entry.id);
      const classNames = classRecords.map((entry) => entry.name);
      const classById = new Map(classRecords.map((entry) => [entry.id, entry]));
      const classIdByName = new Map(classRecords.map((entry) => [entry.name, entry.id]));
      const referencedClassIds = result.content.flatMap((element) =>
        Array.isArray(element.settings._cssGlobalClasses)
          ? element.settings._cssGlobalClasses.map((id) => `${id}`)
          : []
      );
      const modifierClasses = classRecords.filter((entry) => entry.name.includes("--"));
      const classCustomCss = classRecords
        .map((entry) => `${entry.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] ?? ""}`)
        .filter((css) => css.trim().length > 0);
      const fallbackCss = getAllClassCustomCss(result);

      expect(result.validation.hierarchyValid, fixture.templateName).toBe(true);
      expect(result.validation.classReferenceValid, fixture.templateName).toBe(true);
      expect(result.validation.fallbackCssMissingClassSelectorCount, fixture.templateName).toBe(0);
      expect(result.validation.fallbackCssElementIdSelectorCount, fixture.templateName).toBe(0);
      expect(result.validation.totalElements, fixture.templateName).toBe(fixture.expected.elementCount);
      expect(result.validation.globalClassCount, fixture.templateName).toBe(fixture.expected.classCount);
      expect(result.content, fixture.templateName).toHaveLength(fixture.expected.elementCount);
      expect(classRecords, fixture.templateName).toHaveLength(fixture.expected.classCount);
      expect(classNames[0], fixture.templateName).toBe(fixture.expected.rootClass);
      expect(classIds[0], fixture.templateName).toBe(fixture.expected.rootClassId);
      expect(result.content.slice(0, fixture.expected.firstLabels.length).map((element) => element.label))
        .toEqual(fixture.expected.firstLabels);
      expect(result.content.every((element) => typeof element.label === "string" && element.label.length > 0))
        .toBe(true);
      expect(classIds.every((id) => /^[a-z0-9]{6}$/.test(id)), fixture.templateName).toBe(true);
      expect(new Set(classIds).size, fixture.templateName).toBe(classIds.length);
      expect(new Set(classNames).size, fixture.templateName).toBe(classNames.length);

      Object.entries(fixture.expected.firstClassIds).forEach(([className, id]) => {
        expect(classIdByName.get(className), `${fixture.templateName}: ${className}`).toBe(id);
      });

      expect(referencedClassIds.length, fixture.templateName).toBeGreaterThan(0);
      expect(referencedClassIds.every((id) => classById.has(id)), fixture.templateName).toBe(true);

      classRecords.forEach((classRecord) => {
        const assignedElements = result.content.filter((element) =>
          Array.isArray(element.settings._cssGlobalClasses) &&
          element.settings._cssGlobalClasses.includes(classRecord.id)
        );
        if (assignedElements.length > 1) {
          assignedElements.forEach((element) => {
            expect((element.settings._cssGlobalClasses as string[]).includes(classRecord.id)).toBe(true);
          });
        }
      });

      modifierClasses.forEach((modifierClass) => {
        const baseName = modifierClass.name.split("--")[0];
        const baseId = classIdByName.get(baseName);
        expect(baseId, `${fixture.templateName}: ${modifierClass.name} base class`).toBeDefined();
        expect(baseId).not.toBe(modifierClass.id);
        const modifierElements = result.content.filter((element) =>
          Array.isArray(element.settings._cssGlobalClasses) &&
          element.settings._cssGlobalClasses.includes(modifierClass.id)
        );
        expect(modifierElements.length, `${fixture.templateName}: ${modifierClass.name}`).toBeGreaterThan(0);
        modifierElements.forEach((element) => {
          expect((element.settings._cssGlobalClasses as string[]).includes(baseId!)).toBe(true);
        });
      });

      expect(result.validation.nativeStyleMappedCount, fixture.templateName)
        .toBe(fixture.expected.nativeStyleMappedCount);
      expect(result.validation.customCssFallbackCount, fixture.templateName)
        .toBe(fixture.expected.customCssFallbackCount);
      expect(result.validation.literalFallbackRuleCount, fixture.templateName)
        .toBe(fixture.expected.literalFallbackRuleCount);
      expect(result.validation.classFallbackStrategy, fixture.templateName).toBe("literal-bem");
      expect(result.validation.responsiveRuleCount, fixture.templateName).toBe(fixture.expected.responsiveRuleCount);
      expect(result.validation.pseudoRuleCount, fixture.templateName).toBe(fixture.expected.pseudoRuleCount);
      expect(result.validation.cssAttachedRuleCount, fixture.templateName).toBe(fixture.expected.cssAttachedRuleCount);
      expect(result.validation.cssUnmappedRuleCount, fixture.templateName).toBe(fixture.expected.cssUnmappedRuleCount);
      expect(result.validation.unresolvedSelectorCount, fixture.templateName)
        .toBe(fixture.expected.unresolvedSelectorCount);
      expect(result.validation.unsignedSvgCodeCount, fixture.templateName).toBe(fixture.expected.unsignedSvgCodeCount);
      expect(result.content.filter((element) => element.name === "svg").map((element) => element.label ?? ""))
        .toEqual(fixture.expected.svgLabels);

      expect(result.validation.cssUnmappedRuleCount === 0 || result.warnings.length > 0, fixture.templateName)
        .toBe(true);
      expect(result.content.some((element) => element.label === "Generated BEM CSS"), fixture.templateName)
        .toBe(false);
      expect(result.content.filter((element) => element.label === "Jigma Component Styles"), fixture.templateName)
        .toHaveLength(0);
      expect(result.content.some((element) =>
        Object.keys(element.settings).some((key) => key !== "_cssGlobalClasses")
      ), fixture.templateName).toBe(true);
      expect(classCustomCss.length, fixture.templateName).toBeGreaterThan(0);
      expect(fallbackCss.length, fixture.templateName).toBeGreaterThan(0);
      expect(fallbackCss, fixture.templateName).toContain(fixture.expected.rootClass);
      expect(fallbackCss, fixture.templateName).not.toContain("%root%");
      expect(fallbackCss, fixture.templateName).not.toMatch(/#brxe-[a-z0-9]+/);
      const selectorLines = fallbackCss.split("\n").filter((line) => line.trim().endsWith("{"));
      expect(selectorLines.every((line) => {
        const trimmed = line.trim();
        return trimmed.startsWith(".jg-") || trimmed.startsWith(".jigma-") ||
          trimmed.startsWith("@") || /^\d/.test(trimmed);
      }), fixture.templateName)
        .toBe(true);

      expect(parsedPayload.source, fixture.templateName).toBe("bricksCopiedElements");
      expect(parsedPayload.version, fixture.templateName).toBe(TARGET_BRICKS_VERSION);
      expect(parsedPayload.content.length, fixture.templateName).toBe(result.content.length);
      expect(parsedPayload.globalClasses?.length, fixture.templateName).toBe(classRecords.length);
    });
  });

  it("preserves media SVG overlay and code fidelity fixtures", () => {
    expect(mediaFixtures.map((fixture) => fixture.name)).toEqual([
      "standard jpg image with alt",
      "webp image with lazy loading",
      "picture srcset responsive image",
      "linked image",
      "background image cover center",
      "background image plus gradient overlay",
      "before color overlay",
      "multiple background layers",
      "inline svg one path",
      "complex svg gradients and paths",
      "svg mask clipPath",
      "external svg file",
      "svg sprite use",
      "unsafe svg script onload",
      "css mask image url",
      "javascript interaction",
      "inline onclick handler",
      "third party iframe embed",
      "missing asset",
      "duplicate image url",
    ]);

    mediaFixtures.forEach((fixture) => {
      const result = exportFor(fixture.html, fixture.css, fixture.js ?? "", {
        projectPrefix: "jg",
        blockName: "media",
      });
      const classIds = result.globalClasses?.map((entry) => entry.id) ?? [];

      expect(result.validation.hierarchyValid, fixture.name).toBe(true);
      expect(result.validation.classReferenceValid, fixture.name).toBe(true);
      expect(classIds.every((id) => /^[a-z0-9]{6}$/.test(id)), fixture.name).toBe(true);
      expect(result.content.some((element) => element.label === "Generated BEM CSS"), fixture.name).toBe(false);
      result.content.forEach((element) => {
        const ids = Array.isArray(element.settings._cssGlobalClasses)
          ? element.settings._cssGlobalClasses
          : [];
        expect(ids.every((id) => classIds.includes(`${id}`)), fixture.name).toBe(true);
      });
    });

    const standardImage = exportFor(mediaFixtures[0].html, mediaFixtures[0].css, "", {
      projectPrefix: "jg",
      blockName: "media-card",
    });
    const standardImageElement = standardImage.content.find((element) => element.name === "image")!;
    expect(standardImageElement.settings.image).toEqual({
      url: "/images/team.jpg",
      width: 1200,
      height: 800,
    });
    expect(standardImageElement.settings.altText).toBe("Our team");
    expect(standardImageElement.settings.aspectRatio).toBe("1200 / 800");
    expect(getGlobalClassSettings(standardImage, "media-card__image")._objectFit).toBe("cover");
    expect(getGlobalClassSettings(standardImage, "media-card__image")._objectPosition).toBe("center");

    const lazyImage = exportFor(mediaFixtures[1].html, mediaFixtures[1].css, "", {
      projectPrefix: "jg",
      blockName: "media-card",
    }).content.find((element) => element.name === "image")!;
    expect(lazyImage.settings.loading).toBe("lazy");
    expect(lazyImage.settings.decoding).toBe("async");

    const picture = exportFor(mediaFixtures[2].html, mediaFixtures[2].css, "", {
      projectPrefix: "jg",
      blockName: "media-card",
    });
    const pictureImage = picture.content.find((element) => element.name === "image")!;
    expect(picture.content.filter((element) => element.name === "image")).toHaveLength(1);
    expect(pictureImage.settings.image).toEqual({ url: "/images/team.jpg" });
    expect(pictureImage.settings.srcset).toBe("/images/team.jpg 1200w, /images/team@2x.jpg 2400w");
    expect(pictureImage.settings.sizes).toBe("100vw");
    expect(pictureImage.settings.responsiveSources).toEqual([
      {
        media: "(max-width: 720px)",
        srcset: "/images/team-mobile.webp 720w",
        type: "image/webp",
      },
      {
        media: "(min-width: 721px)",
        srcset: "/images/team.webp 1200w",
        type: "image/webp",
      },
    ]);

    const linked = exportFor(mediaFixtures[3].html, mediaFixtures[3].css, "", {
      projectPrefix: "jg",
      blockName: "media-card",
    });
    const linkedElement = linked.content.find((element) => element.name === "text-link")!;
    expect(linkedElement.settings.link).toEqual({
      type: "external",
      url: "/gallery",
      target: "_blank",
      rel: "noopener",
    });

    const background = exportFor(mediaFixtures[4].html, mediaFixtures[4].css, "", {
      projectPrefix: "jg",
      blockName: "media-hero",
    });
    expect(getGlobalClassSettings(background, "media-hero")._background).toEqual({
      image: { url: "/images/hero.jpg" },
      size: "cover",
      position: "center",
      repeat: "no-repeat",
    });
    expect(background.jigmaMeta.assetManifest?.summary.backgroundImages).toBe(1);

    const gradientOverlay = exportFor(mediaFixtures[5].html, mediaFixtures[5].css, "", {
      projectPrefix: "jg",
      blockName: "media-hero",
    });
    expect(getGlobalClassCss(gradientOverlay, "media-hero")).toContain(
      'background: linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("/images/hero.jpg");',
    );
    expect(getGlobalClassCss(gradientOverlay, "media-hero")).toContain(".media-hero {");
    expect(gradientOverlay.jigmaMeta.assetManifest?.summary.overlaysMapped).toBe(1);

    const beforeOverlay = exportFor(mediaFixtures[6].html, mediaFixtures[6].css, "", {
      projectPrefix: "jg",
      blockName: "media-hero",
    });
    expect(getGlobalClassCss(beforeOverlay, "media-hero")).toContain(".media-hero::before");
    expect(getGlobalClassSettings(beforeOverlay, "media-hero")._position).toBe("relative");

    const multiBackground = exportFor(mediaFixtures[7].html, mediaFixtures[7].css, "", {
      projectPrefix: "jg",
      blockName: "media-hero",
    });
    expect(getGlobalClassCss(multiBackground, "media-hero")).toContain(
      'background-image: url("/images/noise.png"), linear-gradient(#111, #333), url("/images/hero.jpg");',
    );

    const complexSvg = exportFor(mediaFixtures[9].html, mediaFixtures[9].css, "", {
      projectPrefix: "jg",
      blockName: "media-icon",
    });
    const svgElement = complexSvg.content.find((element) => element.name === "svg")!;
    expect(complexSvg.content.filter((element) => element.name === "svg")).toHaveLength(1);
    expect(complexSvg.content.some((element) => element.name === "path")).toBe(false);
    expect(`${svgElement.settings.code ?? ""}`).toContain("<path");
    expect(complexSvg.warnings.filter((warning) => warning.code === "svg.signature_required")).toHaveLength(1);
    expect(complexSvg.warnings.some((warning) => warning.message.includes("<path>"))).toBe(false);

    const unsafeSvg = exportFor(mediaFixtures[13].html, mediaFixtures[13].css, "", {
      projectPrefix: "jg",
      blockName: "media-icon",
    });
    const unsafeSvgCode = `${unsafeSvg.content.find((element) => element.name === "svg")?.settings.code ?? ""}`;
    expect(unsafeSvgCode).not.toContain("<script");
    expect(unsafeSvgCode).not.toContain("onload");
    expect(unsafeSvgCode).not.toContain("onclick");
    expect(unsafeSvg.warnings.filter((warning) => warning.code === "svg.sanitized")).toHaveLength(1);

    const jsDefault = exportFor(mediaFixtures[15].html, mediaFixtures[15].css, mediaFixtures[15].js, {
      projectPrefix: "jg",
      blockName: "media-tabs",
    });
    expect(jsDefault.content.filter((element) => element.label === "Jigma Media Tabs JavaScript")).toHaveLength(0);
    expect(jsDefault.content.filter((element) => element.label === "Jigma Component Styles")).toHaveLength(0);
    expect(jsDefault.validation.unsignedJavaScriptCodeCount).toBe(0);
    expect(jsDefault.warnings.some((warning) => warning.code === "javascript.review_required")).toBe(true);

    const jsOptional = exportFor(mediaFixtures[15].html, mediaFixtures[15].css, mediaFixtures[15].js, {
      projectPrefix: "jg",
      blockName: "media-tabs",
      includeJavaScriptCode: true,
    });
    const jsCodeElements = jsOptional.content.filter((element) => element.label === "Jigma Media Tabs JavaScript");
    expect(jsCodeElements).toHaveLength(1);
    expect(jsCodeElements[0].label).toBe("Jigma Media Tabs JavaScript");
    expect(jsCodeElements[0].settings.executeCode).toBe(false);
    expect(`${jsCodeElements[0].settings.javascriptCode ?? ""}`).toContain("addEventListener");
    expect(jsCodeElements[0].settings.javascript).toBeUndefined();
    expect(jsCodeElements[0].settings.js).toBeUndefined();

    const inlineEvent = exportFor(mediaFixtures[16].html, mediaFixtures[16].css, "", {
      projectPrefix: "jg",
      blockName: "media-modal",
    });
    expect(JSON.stringify(inlineEvent.content)).not.toContain("onclick");
    expect(inlineEvent.warnings.some((warning) => warning.code === "code.inline_event_handler")).toBe(true);

    const iframe = exportFor(mediaFixtures[17].html, mediaFixtures[17].css, "", {
      projectPrefix: "jg",
      blockName: "media-embed",
    });
    const iframeCode = iframe.content.find((element) => element.name === "code")!;
    expect(iframeCode.settings.executeCode).toBe(false);
    expect(`${iframeCode.settings.html ?? ""}`).toContain("<iframe");

    const duplicateManifest = createAssetManifest({
      html: mediaFixtures[19].html,
      css: mediaFixtures[19].css,
      js: "",
      options: { ...defaultOptions, projectPrefix: "jg", blockName: "media-grid" },
    });
    expect(duplicateManifest.items.filter((item) => item.normalizedUrl === "/images/reused.jpg")).toHaveLength(1);
  });

  it("keeps the beta workspace focused and generated JSON hidden by default", () => {
    const markup = renderToStaticMarkup(createElement(JigmaBuilder));

    expect(markup).toContain("Library");
    expect(markup).toContain("Code");
    expect(markup).toContain("Preview");
    expect(markup).toContain("Inspect");
    expect(markup).toContain("Template Library");
    expect(markup).toContain("Load Header Example");
    expect(markup).not.toContain("Jigma Hero");
    expect(markup).not.toContain("Reset Template");
    expect(markup).toContain("Save Section locally");
    expect(markup).toContain("Load Saved Section");
    expect(markup).toContain("Export JSON");
    expect(markup).toContain("Import JSON");
    expect(markup).toContain("Layers");
    expect(markup).toContain("Dependencies");
    expect(markup).toContain("Warnings");
    expect(markup).toContain("Export");
    expect(markup).not.toContain("Download JSON");
    expect(markup).not.toContain("View generated JSON");
    expect(markup).not.toContain("Advanced output");
    expect(markup).not.toContain("bricksCopiedElements");
    expect(markup).not.toContain("_cssCustom");
    expect(markup).not.toContain("globalClasses");
    expect(markup).not.toContain("Element ID Styles");
    expect(markup).not.toContain("npm");
    expect(markup).not.toContain("Vite");
    expect(markup).not.toContain("Deno");
    expect(markup).not.toContain("dev server");
    expect(markup).not.toContain("local setup");
    expect(markup).not.toContain("debug payload");
  });

  it("renders release smoke surfaces for template, preview, inspector, export, presets, and mobile navigation", () => {
    const markup = renderToStaticMarkup(createElement(JigmaBuilder));
    const builderSource = readFileSync(
      new URL("../src/components/JigmaBuilder.tsx", import.meta.url),
      "utf8",
    );

    expect(markup).toContain("Template Library");
    expect(markup).toContain("Load Header Example");
    expect(markup).not.toContain("Jigma Hero");
    expect(markup).not.toContain("Reset Header Example");
    expect(markup).toContain("Start with HTML, CSS or JavaScript");
    expect(markup).toContain("No layers yet");
    expect(markup).toContain('role="tablist" aria-label="Source editors"');
    expect(markup).toContain('id="source-tab-html"');
    expect(markup).toContain('id="source-tab-css"');
    expect(markup).toContain('id="source-tab-js"');
    expect(markup).toContain('class="preview-frame"');
    expect(markup).toContain("desktop preview");
    expect(markup).toContain("tablet preview");
    expect(markup).toContain("mobile preview");
    expect(markup).toContain('role="tablist" aria-label="Conversion workflow"');
    expect(markup).toContain("Layers");
    expect(markup).toContain("Dependencies");
    expect(markup).toContain("Warnings");
    expect(markup).toContain("Export");
    expect(markup).toContain("Select");
    expect(markup).toContain("Deselect");
    expect(markup).toContain("Undo");
    expect(markup).toContain('class="conversion-check__summary"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("Copy Bricks Structure");
    expect(markup).toContain("Copy Structure");
    expect(markup).toContain("Save Section locally");
    expect(markup).toContain("Load Saved Section");
    expect(markup).toContain("Export JSON");
    expect(markup).toContain("Import JSON");
    expect(markup).toContain('class="workspace-mode-tabs"');
    expect(markup).toContain("Code");
    expect(markup).toContain("Preview");
    expect(markup).toContain("Inspect");
    expect(builderSource).toContain("Download JSON");
    expect(builderSource).toContain("Output format");
    expect(builderSource).toContain("Native Bricks Classes");
    expect(builderSource).toContain("showAllWarnings");
    expect(builderSource).toContain("No dependencies detected");
    expect(builderSource).toContain("No issues to review");
    expect(builderSource).toContain("Add some HTML before exporting.");
    expect(builderSource).toContain("Include JavaScript in Bricks");
  });

  it("saves local preset values and applies them to fallback BEM output", () => {
    const preset = createLocalPreset(
      { projectPrefix: "beta", blockName: "landing-panel" },
      new Date("2026-01-01T00:00:00.000Z"),
    );
    const savedPresets = upsertLocalPreset([], preset);
    const restoredPresets = parseLocalPresets(serializeLocalPresets(savedPresets));
    const result = exportFor(
      `<section><h1>Preset driven BEM</h1></section>`,
      "",
      "",
      {
        projectPrefix: restoredPresets[0].projectPrefix,
        blockName: restoredPresets[0].blockName,
      },
    );
    const classValues = result.globalClasses?.map((entry) => entry.name) ?? [];

    expect(restoredPresets).toEqual(savedPresets);
    expect(restoredPresets[0].version).toBe(2);
    expect(restoredPresets[0].prefix).toBe("beta");
    expect(restoredPresets[0].outputAdapter).toBe("bricks");
    expect(classValues).toContain("beta-landing-panel");
    expect(classValues).toContain("beta-landing-panel__title");
  });

  it("renames, duplicates, deletes, exports, and imports local presets", () => {
    const preset = createLocalPreset(
      { projectPrefix: "team", blockName: "hero", exportMode: "native-bem-classes" },
      new Date("2026-01-01T00:00:00.000Z"),
      "Team Hero",
    );
    const renamed = renameLocalPreset([preset], preset.id, "Client Hero", new Date("2026-01-02T00:00:00.000Z"));
    const duplicated = duplicateLocalPreset(renamed, preset.id, new Date("2026-01-03T00:00:00.000Z"));
    const exported = exportLocalPresetJson(duplicated[0]);
    const imported = importLocalPresetJson(exported, new Date("2026-01-04T00:00:00.000Z"));
    const deleted = deleteLocalPreset(duplicated, preset.id);

    expect(renamed[0].name).toBe("Client Hero");
    expect(duplicated).toHaveLength(2);
    expect(duplicated[0].name).toBe("Client Hero Copy");
    expect(imported.valid).toBe(true);
    expect(imported.preset?.prefix).toBe("team");
    expect(validatePresetImport({ name: "Broken" }).valid).toBe(false);
    expect(deleteLocalPreset(deleted, duplicated[0].id)).toHaveLength(0);
  });

  it("saves, exports, imports, and deletes local sections with JavaScript intact", () => {
    const source = createSavedSectionSource(
      `<header class="jigma-header"></header>`,
      `.jigma-header { color: white; }`,
      `document.querySelector(".jigma-header")?.setAttribute("data-ready", "true");`,
      { projectPrefix: "jigma", blockName: "header" },
    );
    const section = createLocalSavedSection(source, new Date("2026-01-01T00:00:00.000Z"), "Header Example");
    const renamed = renameSavedSection([section], section.id, "Signed Header", new Date("2026-01-02T00:00:00.000Z"));
    const duplicated = duplicateSavedSection(renamed, section.id, new Date("2026-01-03T00:00:00.000Z"));
    const exported = exportSavedSectionJson(duplicated[0]);
    const imported = importSavedSectionJson(exported, new Date("2026-01-04T00:00:00.000Z"));
    const serialized = serializeSavedSections(duplicated);
    const parsed = parseSavedSections(serialized);
    const upserted = upsertSavedSection(parsed, imported.section!);
    const deleted = deleteSavedSection(upserted, section.id);

    expect(section.html).toBe(source.html);
    expect(section.css).toBe(source.css);
    expect(section.javascript).toBe(source.javascript);
    expect(renamed[0].name).toBe("Signed Header");
    expect(duplicated[0].name).toBe("Signed Header Copy");
    expect(imported.valid).toBe(true);
    expect(imported.section?.javascript).toBe(source.javascript);
    expect(parsed).toHaveLength(2);
    expect(deleted.some((item) => item.id === section.id)).toBe(false);
  });

  it("generates BEM classes for exported elements", () => {
    const result = exportFor(sectionFixtures[0].html, sectionFixtures[0].css, "", {
      projectPrefix: "demo",
      blockName: "hero",
    });
    const classValues = result.globalClasses?.map((entry) => entry.name) ?? [];

    expect(classValues.length).toBeGreaterThan(0);
    expect(classValues.every((value) => value.includes("demo-hero"))).toBe(true);
  });

  it("defaults to Native BEM Classes with Bricks class records owning CSS", () => {
    const result = exportFor(
      `<section class="hero-section">
  <div class="hero-content">
    <h1 class="hero-title">Element classes</h1>
    <p class="hero-text">Mapped text.</p>
    <a class="hero-button hero-button--secondary" href="#start">Start</a>
  </div>
</section>`,
      `.hero-section {
  padding: 80px;
  background: #101820;
}
.hero-content {
  max-width: 920px;
}
.hero-title {
  font-size: 64px;
  line-height: 1;
  color: white;
}
.hero-text {
  color: #d7dee8;
}
.hero-button {
  padding: 14px 18px;
}
.hero-button--secondary {
  border: 1px solid currentColor;
}
.hero-title:hover {
  opacity: 0.8;
}
@media (max-width: 768px) {
  .hero-title {
    font-size: 42px;
  }
}`,
      "",
      { projectPrefix: "jg" },
    );
    const exportedElements = result.content.filter((element) =>
      Array.isArray(element.settings._cssGlobalClasses)
    );
    const section = getElementByBemClass(result, "jg-hero");
    const content = getElementByBemClass(result, "jg-hero__content");
    const title = getElementByBemClass(result, "jg-hero__title");
    const text = getElementByBemClass(result, "jg-hero__text");
    const button = getElementByBemClass(result, "jg-hero__button--secondary");

    expect(exportedElements.length).toBeGreaterThan(0);
    expect(exportedElements.every((element) => !("_cssClasses" in element.settings))).toBe(true);
    expect(result.content.some((element) => element.label === "Generated BEM CSS")).toBe(false);
    expect(result.globalClasses?.length).toBeGreaterThan(0);
    expect(result.validation.globalClassCount).toBe(result.globalClasses?.length);
    expect(result.validation.cssAttachedRuleCount).toBeGreaterThan(0);
    expect(section).toBeDefined();
    expect(content).toBeDefined();
    expect(title).toBeDefined();
    expect(text).toBeDefined();
    expect(button).toBeDefined();
    expect(section?.label).toBe("Hero Section");
    expect(content?.label).toBe("Hero Content");
    expect(title?.label).toBe("Hero Title");
    expect(text?.label).toBe("Hero Text");
    expect(button?.label).toBe("Hero Button Secondary");
    expect(getElementGlobalClassNames(result, button!)).toEqual([
      "jg-hero__button",
      "jg-hero__button--secondary",
    ]);
    expect(getElementCss(section!)).toBe("");
    expect(getGlobalClassSettings(result, "jg-hero")._padding).toEqual({
      top: "80px",
      right: "80px",
      bottom: "80px",
      left: "80px",
    });
    expect(getGlobalClassSettings(result, "jg-hero")._background).toEqual({
      color: { raw: "#101820" },
    });
    expect(getGlobalClassSettings(result, "jg-hero__content")._widthMax).toBe("920px");
    expect(getGlobalClassSettings(result, "jg-hero__title")._typography).toEqual({
      "font-size": "64px",
      "line-height": "1",
      color: { raw: "white" },
    });
    expect(getGlobalClassSettings(result, "jg-hero__title")["_opacity:hover"]).toBe("0.8");
    expect(getGlobalClassSettings(result, "jg-hero__title")["_typography:tablet_portrait"])
      .toEqual({ "font-size": "42px" });
    expect(getGlobalClassCss(result, "jg-hero__title")).not.toContain(".jg-hero__title");
    expect(getGlobalClassCss(result, "jg-hero__title")).not.toContain(".hero-title");
    expect(getGlobalClassSettings(result, "jg-hero__text")._typography)
      .toEqual({ color: { raw: "#d7dee8" } });
    expect(getGlobalClassSettings(result, "jg-hero__button")._padding).toEqual({
      top: "14px",
      right: "18px",
      bottom: "14px",
      left: "18px",
    });
    expect(getGlobalClassSettings(result, "jg-hero__button--secondary")._border).toEqual({
      width: { top: "1px", right: "1px", bottom: "1px", left: "1px" },
      style: "solid",
      color: { raw: "currentColor" },
    });
    expect(getGlobalClassSettings(result, "jg-hero__button--secondary")._padding).toBeUndefined();
    expect(result.validation.nativeStyleMappedCount).toBeGreaterThan(0);
    expect(result.validation.classReferenceValid).toBe(true);
  });

  it("maps the manual hero paste case to native Bricks class CSS", () => {
    const result = exportFor(heroPasteHtml, heroPasteCss, "", {
      projectPrefix: "jg",
      blockName: "hero-jigma",
    });
    const exportedElements = result.content.filter((element) =>
      Array.isArray(element.settings._cssGlobalClasses)
    );
    const section = getElementByBemClass(result, "jg-hero");
    const inner = getElementByBemClass(result, "jg-hero__inner");
    const nav = getElementByBemClass(result, "jg-hero__nav");
    const logo = getElementByBemClass(result, "jg-hero__logo");
    const content = getElementByBemClass(result, "jg-hero__content");
    const title = getElementByBemClass(result, "jg-hero__title");
    const actions = getElementByBemClass(result, "jg-hero__actions");
    const primaryButton = getElementByBemClass(result, "jg-hero__button--primary");
    const secondaryButton = getElementByBemClass(result, "jg-hero__button--secondary");
    const stats = getElementByBemClass(result, "jg-hero__stats");
    const metrics = getElementsByBemClass(result, "jg-hero__metric");
    const metricNumbers = getElementsByBemClass(result, "jg-hero__metric-number");
    const metricLabels = getElementsByBemClass(result, "jg-hero__metric-label");

    expect(result.validation.hierarchyValid).toBe(true);
    expect(result.content.some((element) => element.label === "Generated BEM CSS")).toBe(false);
    expect(exportedElements.every((element) => Array.isArray(element.settings._cssGlobalClasses)))
      .toBe(true);
    expect(result.globalClasses?.length).toBeGreaterThan(0);
    expect(result.validation.globalClassCount).toBe(result.globalClasses?.length);
    expect(result.validation.cssAttachedRuleCount).toBeGreaterThanOrEqual(18);
    expect(result.validation.cssUnmappedRuleCount).toBe(0);
    expect(section?.label).toBe("Hero Section");
    expect(inner?.label).toBe("Hero Inner");
    expect(nav?.label).toBe("Hero Nav");
    expect(logo?.label).toBe("Hero Logo");
    expect(content?.label).toBe("Hero Content");
    expect(title?.label).toBe("Hero Title");
    expect(actions?.label).toBe("Hero Actions");
    expect(primaryButton?.label).toBe("Hero Button Primary");
    expect(secondaryButton?.label).toBe("Hero Button Secondary");
    expect(stats?.label).toBe("Hero Stats");
    expect(metrics).toHaveLength(3);
    expect(metricNumbers).toHaveLength(3);
    expect(metricLabels).toHaveLength(3);
    expect(getElementGlobalClassNames(result, section!)).toEqual(["jg-hero"]);
    expect(getElementGlobalClassNames(result, inner!)).toEqual(["jg-hero__inner"]);
    expect(getElementGlobalClassNames(result, primaryButton!)).toEqual([
      "jg-hero__button",
      "jg-hero__button--primary",
    ]);
    expect(getElementGlobalClassNames(result, secondaryButton!)).toEqual([
      "jg-hero__button",
      "jg-hero__button--secondary",
    ]);
    expect(metricNumbers.every((element) => element.label === "Hero Metric Number")).toBe(true);
    expect(metricLabels.every((element) => element.label === "Hero Metric Label")).toBe(true);

    const sectionCss = getGlobalClassCss(result, "jg-hero");
    const titleCss = getGlobalClassCss(result, "jg-hero__title");
    const statsCss = getGlobalClassCss(result, "jg-hero__stats");
    const baseButtonCss = getGlobalClassCss(result, "jg-hero__button");
    const primaryButtonCss = getGlobalClassCss(result, "jg-hero__button--primary");
    const secondaryButtonCss = getGlobalClassCss(result, "jg-hero__button--secondary");
    const metricCss = getGlobalClassCss(result, "jg-hero__metric");
    const metricNumberCss = getGlobalClassCss(result, "jg-hero__metric-number");
    const metricLabelCss = getGlobalClassCss(result, "jg-hero__metric-label");
    const sectionSettings = getGlobalClassSettings(result, "jg-hero");
    const titleSettings = getGlobalClassSettings(result, "jg-hero__title");
    const statsSettings = getGlobalClassSettings(result, "jg-hero__stats");
    const baseButtonSettings = getGlobalClassSettings(result, "jg-hero__button");
    const primaryButtonSettings = getGlobalClassSettings(result, "jg-hero__button--primary");
    const secondaryButtonSettings = getGlobalClassSettings(result, "jg-hero__button--secondary");
    const metricSettings = getGlobalClassSettings(result, "jg-hero__metric");
    const metricNumberSettings = getGlobalClassSettings(result, "jg-hero__metric-number");
    const metricLabelSettings = getGlobalClassSettings(result, "jg-hero__metric-label");

    expect(sectionCss).toContain(".jg-hero {");
    expect(sectionCss).toContain("background: radial-gradient(circle at 80% 10%, rgba(139, 92, 246, 0.45), transparent 36%), #080b16;");
    expect(sectionCss).not.toContain(".hero-section");
    expect(sectionSettings._heightMin).toBe("720px");
    expect(sectionSettings._padding).toEqual({
      top: "64px",
      right: "64px",
      bottom: "64px",
      left: "64px",
    });
    expect(sectionSettings._typography).toEqual({ color: { raw: "#ffffff" } });
    expect(sectionSettings["_padding:tablet_portrait"]).toEqual({
      top: "36px",
      right: "20px",
      bottom: "36px",
      left: "20px",
    });

    expect(titleCss).toBe("");
    expect(getAllClassCustomCss(result)).not.toContain(".hero-title");
    expect(titleSettings._typography).toEqual({
      "font-size": "clamp(48px, 7vw, 84px)",
      "line-height": "0.96",
      "letter-spacing": "-0.06em",
    });
    expect(titleSettings._margin).toEqual({
      top: "0",
      right: "0",
      bottom: "0",
      left: "0",
    });

    expect(statsCss).toBe("");
    expect(statsSettings._display).toBe("grid");
    expect(statsSettings._gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
    expect(statsSettings["_gridTemplateColumns:tablet_portrait"]).toBe("1fr");

    expect(baseButtonCss).toBe("");
    expect(baseButtonSettings._display).toBe("inline-flex");
    expect(baseButtonSettings._heightMin).toBe("52px");
    expect(baseButtonSettings._padding).toEqual({
      top: "0",
      right: "22px",
      bottom: "0",
      left: "22px",
    });
    expect(primaryButtonCss).toBe("");
    expect(primaryButtonSettings._background).toEqual({ color: { raw: "#2dd4bf" } });
    expect(primaryButtonSettings._typography).toEqual({ color: { raw: "#061312" } });
    expect(secondaryButtonCss).toBe("");
    expect(secondaryButtonSettings._display).toBeUndefined();
    expect(secondaryButtonSettings._border).toEqual({
      width: { top: "1px", right: "1px", bottom: "1px", left: "1px" },
      style: "solid",
      color: { raw: "rgba(255,255,255,0.2)" },
    });
    expect(secondaryButtonSettings._typography).toEqual({ color: { raw: "#ffffff" } });

    expect(metricCss).toBe("");
    expect(metricSettings._padding).toEqual({
      top: "24px",
      right: "24px",
      bottom: "24px",
      left: "24px",
    });
    expect(metricNumberCss).toBe("");
    expect(metricNumberSettings._typography).toEqual({
      "font-size": "36px",
      "font-weight": "900",
      color: { raw: "#2dd4bf" },
    });
    expect(metricLabelCss).toBe("");
    expect(metricLabelSettings._margin).toEqual({ top: "4px" });
    expect(metricLabelSettings._typography).toEqual({
      color: { raw: "rgba(255,255,255,0.68)" },
    });
    expect(result.validation.classReferenceValid).toBe(true);
    expect(result.validation.nativeStyleMappedCount).toBeGreaterThan(20);
  });

  it("keeps legacy Element ID Styles available as an optional mode", () => {
    const result = exportFor(
      `<section class="hero-section"><h1 class="hero-title">Element styles</h1></section>`,
      `.hero-section { padding: 3rem; } .hero-title { color: white; }`,
      "",
      { projectPrefix: "jg", exportMode: "element-styles", createGlobalClasses: false },
    );
    const exportedElements = result.content.filter((element) =>
      typeof element.settings._cssClasses === "string"
    );

    expect(exportedElements.length).toBeGreaterThan(0);
    expect(exportedElements.every((element) => typeof element.settings._cssClasses === "string"))
      .toBe(true);
    expect(exportedElements.some((element) => Array.isArray(element.settings._cssGlobalClasses)))
      .toBe(false);
    expect("globalClasses" in result).toBe(false);
    expect(result.validation.globalClassCount).toBe(0);
    expect(getElementCss(getElementByLabel(result, "Hero Title")!)).toContain("color: white;");
  });

  it("optionally minifies native class root CSS without changing export mode", () => {
    const result = exportFor(
      `<section class="hero-section">
  <h1 class="hero-title">Minified CSS</h1>
</section>`,
      `.hero-title {
  font-size: 64px;
  line-height: 1;
  color: white;
  filter: blur(0);
}
@media (max-width: 768px) {
  .hero-title {
    font-size: 42px;
    transform: translateY(0);
  }
}`,
      "",
      { projectPrefix: "jg", minifyElementCss: true },
    );
    const fallbackCss = getGlobalClassCss(result, "jg-hero__title");
    const titleSettings = getGlobalClassSettings(result, "jg-hero__title");

    expect(titleSettings._typography).toEqual({
      "font-size": "64px",
      "line-height": "1",
      color: { raw: "white" },
    });
    expect(titleSettings["_typography:tablet_portrait"]).toEqual({ "font-size": "42px" });
    expect(fallbackCss).toContain(".jg-hero__title{filter:blur(0);}");
    expect(titleSettings["_transform:tablet_portrait"]).toBe("translateY(0)");
    expect(fallbackCss).not.toContain("%root%");
    expect(result.content.some((element) => element.label === "Generated BEM CSS")).toBe(false);
    expect(result.content.some((element) => element.label === "Jigma Component Styles")).toBe(false);
    expect(result.globalClasses?.length).toBeGreaterThan(0);
  });

  it("exports structure only without CSS attachments or generated CSS block", () => {
    const result = exportFor(
      `<section class="hero-section"><h1 class="hero-title">Structure only</h1></section>`,
      `.hero-section { padding: 3rem; } .hero-title { color: white; }`,
      "",
      { projectPrefix: "jg", exportMode: "structure-only" },
    );
    const exportedElements = result.content.filter((element) =>
      typeof element.settings._cssClasses === "string"
    );

    expect(exportedElements.length).toBeGreaterThan(0);
    expect(exportedElements.every((element) => typeof element.settings._cssClasses === "string"))
      .toBe(true);
    expect(exportedElements.some((element) => BRICKS_ELEMENT_CUSTOM_CSS_FIELD in element.settings))
      .toBe(false);
    expect(result.content.some((element) => element.label === "Generated BEM CSS")).toBe(false);
    expect("globalClasses" in result).toBe(false);
    expect(result.validation.cssAttachedRuleCount).toBe(0);
    expect(result.validation.globalClassCount).toBe(0);
  });

  it("exports a scoped CSS block only when scoped CSS block mode is selected", () => {
    const result = exportFor(
      `<section class="hero-section"><h1 class="hero-title">Scoped CSS</h1></section>`,
      `.hero-section { padding: 3rem; } .hero-title { color: white; }`,
      "",
      { projectPrefix: "jg", exportMode: "scoped-css-block" },
    );
    const css = getCssPayload(result);
    const exportedElements = result.content.filter((element) =>
      typeof element.settings._cssClasses === "string"
    );

    expect(exportedElements.every((element) => typeof element.settings._cssClasses === "string"))
      .toBe(true);
    expect(exportedElements.some((element) => BRICKS_ELEMENT_CUSTOM_CSS_FIELD in element.settings))
      .toBe(false);
    expect(result.content.some((element) => element.label === "Generated BEM CSS")).toBe(true);
    expect(css).toContain(".jg-hero");
    expect(css).toContain(".jg-hero__title");
    expect(result.validation.cssAttachedRuleCount).toBe(0);
    expect(result.validation.cssScopedRuleCount).toBeGreaterThan(0);
  });

  it("warns when element style CSS selectors cannot be mapped", () => {
    const result = exportFor(
      `<section class="hero-section"><h1 class="hero-title">Mapped</h1></section>`,
      `.hero-title { color: white; } .missing-card { opacity: 0; }`,
      "",
      { projectPrefix: "jg" },
    );

    expect(result.validation.cssAttachedRuleCount).toBeGreaterThan(0);
    expect(result.validation.cssUnmappedRuleCount).toBeGreaterThan(0);
    expect(result.validation.unresolvedSelectorCount).toBeGreaterThan(0);
    expect(result.warnings.some((warning) =>
      warning.message.includes("not present in exported layers") &&
      warning.message.includes(".missing-card")
    )).toBe(true);
  });

  it("does not persist Jigma-only settings and preserves originals only in hybrid _cssClasses", () => {
    const strict = exportFor(`<section class="hero"><h2 class="hero__title">Title</h2></section>`);
    const hybrid = exportFor(
      `<section class="hero"><h2 class="hero__title">Title</h2></section>`,
      "",
      "",
      { classMode: "hybrid" },
    );
    const hybridPayload = JSON.stringify(hybrid.content);

    expect(JSON.stringify(strict.content)).not.toContain("_jigma");
    expect(JSON.stringify(strict.globalClasses)).not.toContain("_jigma");
    expect(hybridPayload).not.toContain("_jigma");
    expect(hybrid.content.some((element) => `${element.settings._cssClasses ?? ""}`.includes("hero__title")))
      .toBe(true);
  });

  it("generates semantic BEM names from hero source classes", () => {
    const result = exportFor(
      `<section class="hero-section">
  <div class="hero-content">
    <p class="hero-eyebrow">Launching soon</p>
    <h1 class="hero-title">Sharper landing pages.</h1>
    <div class="hero-actions">
      <button class="button secondary">Book a demo</button>
    </div>
  </div>
</section>`,
      `.hero-section { padding: 4rem; }
.hero-content { max-width: 720px; }
.hero-eyebrow { color: teal; }
.hero-title { font-size: 4rem; }
.button { border-radius: 8px; }
.secondary { background: transparent; }`,
      "",
      { projectPrefix: "prefix" },
    );
    const classValues = result.globalClasses?.map((entry) => entry.name) ?? [];

    expect(classValues).toContain("prefix-hero");
    expect(classValues).toContain("prefix-hero__content");
    expect(classValues).toContain("prefix-hero__eyebrow");
    expect(classValues).toContain("prefix-hero__title");
    expect(classValues).toContain("prefix-hero__actions");
    expect(classValues).toContain("prefix-hero__button--secondary");
  });

  it("adds human-readable Bricks labels without replacing BEM classes", () => {
    const result = exportFor(
      `<section class="lit-proof">
  <div class="lit-proof__shell">
    <div class="lit-proof__item">
      <div class="lit-proof__icon"><svg></svg></div>
      <div class="lit-proof__content">
        <strong class="lit-proof__number">14 mins</strong>
        <span class="lit-proof__label">Average response time</span>
      </div>
    </div>
  </div>
</section>`,
      `.lit-proof__content { display: grid; }`,
      "",
      { projectPrefix: "jg" },
    );
    const content = getElementByLabel(result, "Proof Content");
    const number = getElementByLabel(result, "Proof Number");
    const iconSvg = getElementByLabel(result, "Proof Icon SVG");

    expect(getElementGlobalClassNames(result, getElementByLabel(result, "Proof Section")!))
      .toEqual(["lit-proof"]);
    expect(getElementGlobalClassNames(result, getElementByLabel(result, "Proof Shell")!))
      .toEqual(["lit-proof__shell"]);
    expect(getElementGlobalClassNames(result, getElementByLabel(result, "Proof Item")!))
      .toEqual(["lit-proof__item"]);
    expect(getElementGlobalClassNames(result, getElementByLabel(result, "Proof Icon")!))
      .toEqual(["lit-proof__icon"]);
    expect(getElementGlobalClassNames(result, content!)).toEqual(["lit-proof__content"]);
    expect(getElementGlobalClassNames(result, number!)).toEqual(["lit-proof__number"]);
    expect(getElementGlobalClassNames(result, getElementByLabel(result, "Proof Label")!))
      .toEqual(["lit-proof__label"]);
    expect(getElementGlobalClassNames(result, iconSvg!)).toEqual(["lit-proof__svg"]);
    expect(getGlobalClassSettings(result, "lit-proof__content")._display).toBe("grid");
  });

  it("exports inline SVG as one atomic Bricks SVG code element", () => {
    const paths = Array.from({ length: 56 }, (_, index) =>
      `<path d="M${index} ${index}h1v1h-1z" fill="currentColor" />`
    ).join("");
    const result = exportFor(
      `<section class="lit-proof">
  <div class="lit-proof__icon">
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">${paths}</svg>
  </div>
</section>`,
      `.lit-proof__svg { color: #8b5cf6; }`,
      "",
      { projectPrefix: "jg" },
    );
    const svgElements = result.content.filter((element) => element.name === "svg");
    const svgElement = svgElements[0];
    const svgCode = `${svgElement.settings.code ?? ""}`;
    const svgSettingKeys = Object.keys(svgElement.settings).map((key) => key.toLowerCase());

    expect(svgElements).toHaveLength(1);
    expect(result.content.some((element) => element.name === "path")).toBe(false);
    expect(svgElement.children).toEqual([]);
    expect(svgElement.label).toBe("Proof Icon SVG");
    expect(svgElement.settings.source).toBe("code");
    expect(svgElement.settings.svg).toBeUndefined();
    expect(svgSettingKeys.some((key) => key.includes("signature"))).toBe(false);
    expect(svgCode).toContain("<svg");
    expect(svgCode).toContain("viewBox");
    expect(svgCode).toContain("<path");
    expect(getElementGlobalClassNames(result, svgElement)).toEqual(["lit-proof__svg"]);
    expect(result.validation.unsignedSvgCodeCount).toBe(1);
    expect(result.validation.groupedWarningCount).toBe(result.warnings.length);
    expect(result.warnings.some((warning) => warning.code === "svg.signature_required")).toBe(true);
    expect(result.warnings.filter((warning) => warning.code === "svg.signature_required")).toHaveLength(1);
    expect(result.warnings.filter((warning) => warning.code === "svg.sanitized")).toHaveLength(0);
    expect(result.warnings.some((warning) => warning.message.includes("<path>"))).toBe(false);
  });

  it("sanitizes SVG code while preserving safe SVG structure", () => {
    const result = exportFor(
      `<section class="lit-proof">
  <svg viewBox="0 0 20 20" onload="alert(1)">
    <defs><linearGradient id="grad"><stop offset="0%" stop-color="#fff" /></linearGradient></defs>
    <script>alert(1)</script>
    <foreignObject><div>Unsafe</div></foreignObject>
    <use href="javascript:alert(1)"></use>
    <use href="https://cdn.example.com/icons.svg#bad"></use>
    <path onclick="evil()" d="M0 0h20v20H0z" fill="url(https://cdn.example.com/paint.svg#bad)" />
    <path d="M1 1h18v18H1z" fill="url(#grad)" />
  </svg>
</section>`,
      "",
      "console.log('review');",
      { projectPrefix: "jg" },
    );
    const svgElement = result.content.find((element) => element.name === "svg")!;
    const svgCode = `${svgElement.settings.code ?? ""}`;
    const warningDetails = result.warnings.flatMap((warning) => warning.details ?? []).join("\n");

    expect(svgCode).toContain("<svg");
    expect(svgCode).toContain("viewBox");
    expect(svgCode).toContain("linearGradient");
    expect(svgCode).toContain("<path");
    expect(svgCode).not.toContain("<script");
    expect(svgCode).not.toContain("foreignObject");
    expect(svgCode).not.toContain("onload");
    expect(svgCode).not.toContain("onclick");
    expect(svgCode).not.toContain("javascript:");
    expect(svgCode).not.toContain("https://cdn.example.com");
    expect(warningDetails).toContain("Removed tags");
    expect(warningDetails).toContain("Removed attributes");
    expect(warningDetails).toContain("External references");
    expect(result.warnings.filter((warning) => warning.code === "svg.sanitized")).toHaveLength(1);
    expect(result.warnings.filter((warning) => warning.code === "svg.signature_required")).toHaveLength(1);
    expect(result.validation.unsignedSvgCodeCount).toBe(1);
    expect(result.validation.unsignedJavaScriptCodeCount).toBe(0);
    expect(result.warnings.some((warning) => warning.code === "javascript.review_required")).toBe(true);
  });

  it("renders sanitized inline SVG in preview without running unsafe SVG markup", () => {
    const documentHtml = createPreviewDocument({
      html: `<section class="lit-proof">
  <svg viewBox="0 0 16 16" onmouseover="alert(1)">
    <defs><linearGradient id="g"><stop offset="0%" stop-color="#fff" /></linearGradient></defs>
    <script>alert(1)</script>
    <circle cx="8" cy="8" r="6" fill="url(#g)" />
  </svg>
</section>`,
      css: "",
      js: "",
      activeLayerId: null,
      deletedLayerIds: new Set(),
      highlightsEnabled: false,
    });

    expect(documentHtml).toContain("<svg");
    expect(documentHtml).toContain("linearGradient");
    expect(documentHtml).toContain("<circle");
    expect(documentHtml).not.toContain("<script>alert(1)</script>");
    expect(documentHtml).not.toContain("onmouseover");
  });

  it("lists SVG files and sprite references as dependencies without fetching them", () => {
    const dependencies = inspectDependencies(
      `<section>
  <img src="/assets/proof.svg" alt="Proof">
  <svg><use href="/assets/sprite.svg#check"></use></svg>
</section>`,
      `.proof { background-image: url("/assets/bg.svg"); }`,
      "",
    );
    const svgDependencies = dependencies.filter((dependency) => dependency.type === "svg");

    expect(svgDependencies.map((dependency) => dependency.value)).toEqual(
      expect.arrayContaining([
        "/assets/proof.svg",
        "/assets/sprite.svg#check",
        "/assets/bg.svg",
      ]),
    );
    expect(svgDependencies.every((dependency) => dependency.includable === false)).toBe(true);
    expect(svgDependencies.some((dependency) => dependency.label.includes("sprite"))).toBe(true);
  });

  it("keeps useful multi-word top-level classes as BEM blocks", () => {
    const result = exportFor(
      `<article class="service-card">
  <img class="service-card__image" src="https://example.com/service.jpg" alt="Service">
  <div class="service-card__content">
    <h3 class="service-card__title">Migration support</h3>
    <a class="service-card__button service-card__button--secondary" href="#service">Details</a>
  </div>
</article>`,
      `.service-card { padding: 2rem; }
.service-card__image { width: 100%; }
.service-card__content { display: grid; }
.service-card__button--secondary { border: 1px solid currentColor; }`,
      "",
      { projectPrefix: "prefix" },
    );
    const classValues = result.globalClasses?.map((entry) => entry.name) ?? [];

    expect(classValues).toContain("service-card");
    expect(classValues).toContain("service-card__image");
    expect(classValues).toContain("service-card__content");
    expect(classValues).toContain("service-card__title");
    expect(classValues).toContain("service-card__button--secondary");
  });

  it("exports selected layers", () => {
    const result = createBricksExport({
      html: `<section class="hero"><h2 class="hero__title">Keep</h2><p class="hero__text">Also keep</p></section>`,
      css: `.hero__title { color: red; }`,
      js: "",
      options: defaultOptions,
    });

    expect(JSON.stringify(result.content)).toContain("Keep");
    expect(JSON.stringify(result.content)).toContain("Also keep");
  });

  it("excludes deselected layers", () => {
    const result = createBricksExport({
      html: `<section class="hero"><h2 class="hero__title">Keep</h2><p class="hero__text">Drop</p></section>`,
      css: `.hero__title { color: red; } .hero__text { color: blue; }`,
      js: "",
      options: defaultOptions,
      excludedLayerIds: new Set(["0-1"]),
    });

    const payload = JSON.stringify(result.content);
    expect(payload).toContain("Keep");
    expect(payload).not.toContain("Drop");
    expect(result.validation.skippedLayerCount).toBe(1);
  });

  it("excludes deleted layers", () => {
    const result = createBricksExport({
      html: `<section class="hero"><h2 class="hero__title">Keep</h2><p class="hero__text">Delete</p></section>`,
      css: `.hero__title { color: red; } .hero__text { color: blue; }`,
      js: "",
      options: defaultOptions,
      deletedLayerIds: new Set(["0-1"]),
    });

    const payload = JSON.stringify(result.content);
    expect(payload).not.toContain("Delete");
    expect(result.validation.deletedLayerCount).toBe(1);
  });

  it("creates a copyable Bricks clipboard payload structure", () => {
    const result = exportFor(
      `<section class="hero-section"><h1 class="hero-title">Copy ready</h1></section>`,
      `.hero-section { padding: 3rem; } .hero-title { color: white; }`,
    );
    const payload = JSON.parse(JSON.stringify(result)) as typeof result;

    expect(payload.source).toBe("bricksCopiedElements");
    expect(payload.sourceUrl).toBe("jigma.local");
    expect(payload.version).toBe(TARGET_BRICKS_VERSION);
    expect(payload.jigmaMeta.targetBricksVersion).toBe(TARGET_BRICKS_VERSION);
    expect(payload.content.length).toBeGreaterThan(0);
    expect(payload.globalClasses?.length).toBeGreaterThan(0);
    expect(payload.validation.globalClassCount).toBe(payload.globalClasses?.length);
    expect(
      payload.content.every((element) =>
        typeof element.id === "string" &&
        typeof element.name === "string" &&
        Array.isArray(element.children)
      ),
    ).toBe(true);
    expect(payload.content.some((element) => element.label === "Generated BEM CSS")).toBe(false);
    expect(payload.content.some((element) => `${element.settings._cssClasses ?? ""}`.includes("jg-hero")))
      .toBe(false);
  });

  it("emits Bricks-valid native class records and matching element references", () => {
    const result = exportFor(
      `<section class="hero-section">
  <div class="hero-content">
    <h1 class="hero-title">Native classes</h1>
    <a class="hero-button hero-button--secondary" href="#demo">Demo</a>
  </div>
</section>`,
      `.hero-section { padding: 40px; }
.hero-content { display: flex; }
.hero-title { color: white; }
.hero-button { padding: 12px 18px; }
.hero-button--secondary { border: 1px solid currentColor; }`,
      "",
      { projectPrefix: "jg" },
    );
    const classIds = new Set(result.globalClasses?.map((entry) => entry.id) ?? []);
    const refs = result.content.flatMap((element) =>
      Array.isArray(element.settings._cssGlobalClasses)
        ? element.settings._cssGlobalClasses.map((classId) => `${classId}`)
        : []
    );

    expect(result.globalClasses?.every((entry) => /^[a-z0-9]{6}$/.test(entry.id))).toBe(true);
    expect(JSON.stringify(result.globalClasses)).not.toContain("_exists");
    expect(result.validation.classReferenceValid).toBe(true);
    expect(result.validation.missingClassReferenceCount).toBe(0);
    expect(result.validation.duplicateClassIdCount).toBe(0);
    expect(result.validation.duplicateClassNameCount).toBe(0);
    expect(result.validation.emptyStyledClassCount).toBe(0);
    expect(refs.length).toBeGreaterThan(0);
    refs.forEach((classId) => expect(classIds.has(classId)).toBe(true));
    expect(result.content.some((element) =>
      `${element.settings._cssClasses ?? ""}`.split(/\s+/).some((className) =>
        result.globalClasses?.some((entry) => entry.name === className)
      )
    )).toBe(false);
    expect(result.jigmaMeta.classAudit?.every((entry) =>
      entry.missingReferences.length === 0 && entry.conflicts.length === 0
    )).toBe(true);
  });

  it("exports the requested native Bricks class ownership fixture with literal BEM fallback", () => {
    const html = `<section class="test-section">
  <div class="test-content">
    <h1 class="test-title">Native class test</h1>
    <p class="test-text">
      This should use editable Bricks classes.
    </p>
    <a class="test-button test-button--secondary" href="#">
      Test button
    </a>
  </div>
</section>`;
    const css = `.test-section {
  padding: 80px 24px;
  background: #080b16;
  color: white;
}

.test-content {
  max-width: 900px;
  margin: 0 auto;
}

.test-title {
  margin: 0;
  font-size: 72px;
  line-height: 0.95;
  text-wrap: balance;
}

.test-text {
  margin-top: 24px;
  opacity: 0.7;
}

.test-button {
  display: inline-flex;
  padding: 14px 20px;
  border-radius: 10px;
  text-decoration: none;
}

.test-button--secondary {
  border: 1px solid white;
  color: white;
}

.test-button:hover {
  transform: translateY(-2px);
}`;
    const first = exportFor(html, css, "", { projectPrefix: "jg", blockName: "test" });
    const second = exportFor(html, css, "", { projectPrefix: "jg", blockName: "test" });
    const expectedClasses = [
      "jg-test",
      "jg-test__content",
      "jg-test__title",
      "jg-test__text",
      "jg-test__button",
      "jg-test__button--secondary",
    ];
    const classRecords = first.globalClasses ?? [];
    const classIdByName = new Map(classRecords.map((entry) => [entry.name, entry.id]));
    const referencedClassIds = first.content.flatMap((element) =>
      Array.isArray(element.settings._cssGlobalClasses)
        ? element.settings._cssGlobalClasses.map((classId) => `${classId}`)
        : []
    );
    const secondaryButton = getElementByLabel(first, "Test Button Secondary");
    const fallbackCss = getGlobalClassCss(first, "jg-test__title");
    const buttonSettings = getGlobalClassSettings(first, "jg-test__button");

    expect(first.validation.classFallbackStrategy).toBe("literal-bem");
    expect(first.validation.classReferenceValid).toBe(true);
    expect(first.validation.missingClassReferenceCount).toBe(0);
    expect(first.validation.duplicateClassIdCount).toBe(0);
    expect(first.validation.duplicateClassNameCount).toBe(0);
    expect(first.validation.fallbackCssMissingClassSelectorCount).toBe(0);
    expect(first.validation.fallbackCssElementIdSelectorCount).toBe(0);
    expect(classRecords.map((entry) => entry.name)).toEqual(expectedClasses);
    expect(classRecords.every((entry) => /^[a-z0-9]{6}$/.test(entry.id))).toBe(true);
    expect(first.globalClasses?.map((entry) => entry.id)).toEqual(second.globalClasses?.map((entry) => entry.id));
    expect(referencedClassIds.every((id) => classRecords.some((entry) => entry.id === id))).toBe(true);
    expect(getElementGlobalClassNames(first, secondaryButton!)).toEqual([
      "jg-test__button",
      "jg-test__button--secondary",
    ]);
    expect(classIdByName.get("jg-test__button")).not.toBe(classIdByName.get("jg-test__button--secondary"));
    expect(first.content.some((element) => `${element.settings._cssClasses ?? ""}`.includes("jg-test"))).toBe(false);
    expect(first.content.some((element) => BRICKS_ELEMENT_CUSTOM_CSS_FIELD in element.settings)).toBe(false);
    expect(first.content.some((element) => element.label === "Generated BEM CSS")).toBe(false);
    expect(first.content.filter((element) => element.label === "Jigma Component Styles")).toHaveLength(0);

    expect(getGlobalClassSettings(first, "jg-test")._padding).toEqual({
      top: "80px",
      right: "24px",
      bottom: "80px",
      left: "24px",
    });
    expect(getGlobalClassSettings(first, "jg-test")._background).toEqual({ color: { raw: "#080b16" } });
    expect(getGlobalClassSettings(first, "jg-test__title")._typography).toEqual({
      "font-size": "72px",
      "line-height": "0.95",
    });
    expect(getGlobalClassSettings(first, "jg-test__text")._opacity).toBe("0.7");
    expect(getGlobalClassSettings(first, "jg-test__button")._display).toBe("inline-flex");
    expect(buttonSettings["_transform:hover"]).toBe("translateY(-2px)");
    expect(getGlobalClassSettings(first, "jg-test__button--secondary")._border).toEqual({
      width: { top: "1px", right: "1px", bottom: "1px", left: "1px" },
      style: "solid",
      color: { raw: "white" },
    });
    expect(fallbackCss).toContain(".jg-test__title {");
    expect(fallbackCss).toContain("text-wrap: balance;");
    expect(fallbackCss).not.toContain("%root%");
    expect(fallbackCss).not.toContain(".test-title");
    expect(fallbackCss).not.toMatch(/#brxe-[a-z0-9]+/);
    expect(first.jigmaMeta.classAudit?.find((entry) => entry.className === "jg-test__title")?.fallbackCssRuleCount)
      .toBe(1);
    expect(first.jigmaMeta.classAudit?.find((entry) => entry.className === "jg-test__title")?.fallbackStrategy)
      .toBe("literal-bem");
  });

  it("maps common CSS into native Bricks class settings and keeps unsupported CSS in literal BEM fallback", () => {
    const result = exportFor(
      `<section class="test-section">
  <div class="test-content">
    <h2 class="test-title">Native settings</h2>
  </div>
</section>`,
      `.test-section {
  padding: 48px 24px;
  min-height: 420px;
}
.test-content {
  display: grid;
  gap: 24px;
  max-width: 960px;
  margin: 0 auto;
}
.test-title {
  font-size: 48px;
  line-height: 1.05;
  color: #ffffff;
  transform: translateY(0);
}
@media (max-width: 820px) {
  .test-title {
    font-size: 36px;
    filter: blur(0);
  }
}`,
      "",
      { projectPrefix: "jg", blockName: "test" },
    );
    const sectionSettings = getGlobalClassSettings(result, "jg-test");
    const contentSettings = getGlobalClassSettings(result, "jg-test__content");
    const titleSettings = getGlobalClassSettings(result, "jg-test__title");
    const fallbackCss = getGlobalClassCss(result, "jg-test__title");

    expect(sectionSettings._padding).toEqual({
      top: "48px",
      right: "24px",
      bottom: "48px",
      left: "24px",
    });
    expect(sectionSettings._heightMin).toBe("420px");
    expect(contentSettings._display).toBe("grid");
    expect(contentSettings._gap).toBe("24px");
    expect(contentSettings._widthMax).toBe("960px");
    expect(contentSettings._margin).toEqual({
      top: "0",
      right: "auto",
      bottom: "0",
      left: "auto",
    });
    expect(titleSettings._typography).toEqual({
      "font-size": "48px",
      "line-height": "1.05",
      color: { raw: "#ffffff" },
    });
    expect(titleSettings["_typography:tablet_portrait"]).toEqual({ "font-size": "36px" });
    expect(titleSettings._transform).toBe("translateY(0)");
    expect(fallbackCss).not.toContain("transform: translateY(0);");
    expect(fallbackCss).toContain("@media (max-width: 820px) {");
    expect(fallbackCss).toContain("filter: blur(0);");
    expect(fallbackCss).not.toContain("%root%");
    expect(fallbackCss).not.toContain(".test-title");
    expect(result.validation.nativeStyleMappedCount).toBeGreaterThan(0);
    expect(result.validation.customCssFallbackCount).toBe(1);
    expect(result.validation.literalFallbackRuleCount).toBe(1);
    expect(result.validation.classFallbackStrategy).toBe("literal-bem");
  });

  it("scopes relationship selectors to the owning BEM block class", () => {
    const result = exportFor(
      `<section class="jg-card">
  <a class="jg-card__button" href="#card">
    <span class="jg-card__button-icon"></span>
  </a>
</section>`,
      `.jg-card:hover .jg-card__button-icon {
  transform: rotate(8deg);
}
.jg-card__button {
  display: inline-flex;
  gap: 8px;
}`,
      "",
      { projectPrefix: "jg", blockName: "card" },
    );
    const cardCss = getGlobalClassCss(result, "jg-card");
    const buttonSettings = getGlobalClassSettings(result, "jg-card__button");

    expect(cardCss).toContain(".jg-card:hover .jg-card__button-icon {");
    expect(cardCss).toContain("transform: rotate(8deg);");
    expect(cardCss).not.toContain("%root%");
    expect(buttonSettings._display).toBe("inline-flex");
    expect(buttonSettings._gap).toBe("8px");
    expect(result.validation.blockScopedFallbackCount).toBe(1);
    expect(result.validation.customCssFallbackCount).toBe(1);
    expect(result.validation.pseudoRuleCount).toBe(0);
    expect(result.warnings.some((warning) => warning.message.includes("was scoped to the")))
      .toBe(false);
  });

  it("preserves pseudo fallbacks, container queries, keyframes, and font-face dependencies", () => {
    const result = exportFor(
      `<section class="jg-card">
  <h2 class="jg-card__title">At-rules</h2>
</section>`,
      `@font-face {
  font-family: "Fixture Sans";
  src: url("https://example.com/fixture.woff2") format("woff2");
}
@keyframes cardPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.72; }
}
.jg-card {
  animation: cardPulse 6s ease-in-out infinite;
}
.jg-card__title::after {
  content: "";
  display: block;
}
@container (max-width: 640px) {
  .jg-card__title {
    text-wrap: balance;
  }
}`,
      "",
      { projectPrefix: "jg", blockName: "card" },
    );
    const cardCss = getGlobalClassCss(result, "jg-card");
    const titleCss = getGlobalClassCss(result, "jg-card__title");

    expect(cardCss).toContain("@keyframes cardPulse");
    expect(cardCss).toContain(".jg-card {");
    expect(cardCss).toContain("animation: cardPulse 6s ease-in-out infinite;");
    expect(titleCss).toContain(".jg-card__title::after {");
    expect(titleCss).toContain('content: "";');
    expect(titleCss).toContain("@container (max-width: 640px) {");
    expect(titleCss).toContain("text-wrap: balance;");
    expect(`${cardCss}\n${titleCss}`).not.toContain("%root%");
    expect(result.validation.pseudoRuleCount).toBeGreaterThan(0);
    expect(result.validation.customCssFallbackCount).toBeGreaterThanOrEqual(4);
    expect(result.validation.externalDependencyCount).toBeGreaterThan(0);
    expect(result.warnings.some((warning) => warning.message.includes("@font-face"))).toBe(true);
  });

  it("exports the golden Bricks class fixture with readable labels and native CSS", () => {
    const result = exportFor(
      `<section class="test-section">
  <div class="test-content">
    <h2 class="test-title">Live fixture title</h2>
    <p class="test-text">Live fixture body.</p>
    <a class="test-button" href="#fixture">Action</a>
  </div>
</section>`,
      `.test-section { padding: 56px; }
.test-content { display: grid; gap: 16px; max-width: 760px; }
.test-title { font-size: 52px; color: #ffffff; }
.test-text { color: rgba(255,255,255,0.72); }
.test-button { display: inline-flex; padding: 14px 20px; border-radius: 12px; }`,
      "",
      { projectPrefix: "jg", blockName: "test" },
    );

    expect(getElementByBemClass(result, "jg-test")?.label).toBe("Test Section");
    expect(getElementByBemClass(result, "jg-test__content")?.label).toBe("Test Content");
    expect(getElementByBemClass(result, "jg-test__title")?.label).toBe("Test Title");
    expect(getElementByBemClass(result, "jg-test__text")?.label).toBe("Test Text");
    expect(getElementByBemClass(result, "jg-test__button")?.label).toBe("Test Button");
    expect(getGlobalClassSettings(result, "jg-test")._padding).toEqual({
      top: "56px",
      right: "56px",
      bottom: "56px",
      left: "56px",
    });
    expect(getGlobalClassSettings(result, "jg-test__content")._display).toBe("grid");
    expect(getGlobalClassSettings(result, "jg-test__title")._typography).toEqual({
      "font-size": "52px",
      color: { raw: "#ffffff" },
    });
    expect(getGlobalClassSettings(result, "jg-test__button")._border).toEqual({
      radius: { top: "12px", right: "12px", bottom: "12px", left: "12px" },
    });
    expect(result.validation.classReferenceValid).toBe(true);
    expect(result.content.some((element) => element.label === "Generated BEM CSS")).toBe(false);
  });

  it("reuses the same native Bricks class ID for repeated BEM classes", () => {
    const result = exportFor(
      `<section class="hero-section">
  <a class="hero-button" href="#one">One</a>
  <a class="hero-button" href="#two">Two</a>
</section>`,
      `.hero-button { color: white; }`,
      "",
      { projectPrefix: "jg" },
    );
    const classRecord = getGlobalClass(result, "jg-hero__button");
    const buttons = result.content.filter((element) => element.label === "Hero Button");

    expect(classRecord).toBeDefined();
    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) =>
      Array.isArray(button.settings._cssGlobalClasses) &&
      button.settings._cssGlobalClasses.includes(classRecord?.id)
    )).toBe(true);
    expect(result.globalClasses?.filter((entry) => entry.name === "jg-hero__button"))
      .toHaveLength(1);
  });

  it("keeps base and modifier native classes separate on secondary buttons", () => {
    const result = exportFor(
      `<section class="hero-section">
  <a class="hero-button hero-button--secondary" href="#two">Two</a>
</section>`,
      `.hero-button { padding: 14px 20px; }
.hero-button--secondary { border: 1px solid white; color: white; }`,
      "",
      { projectPrefix: "jg" },
    );
    const button = getElementByLabel(result, "Hero Button Secondary");

    expect(getElementGlobalClassNames(result, button!)).toEqual([
      "jg-hero__button",
      "jg-hero__button--secondary",
    ]);
    expect(getGlobalClassSettings(result, "jg-hero__button")._padding).toEqual({
      top: "14px",
      right: "20px",
      bottom: "14px",
      left: "20px",
    });
    expect(getGlobalClassSettings(result, "jg-hero__button--secondary")._border).toEqual({
      width: { top: "1px", right: "1px", bottom: "1px", left: "1px" },
      style: "solid",
      color: { raw: "white" },
    });
    expect(getGlobalClassSettings(result, "jg-hero__button--secondary")._typography)
      .toEqual({ color: { raw: "white" } });
    expect(getGlobalClassCss(result, "jg-hero__button--secondary")).not.toContain("padding: 14px 20px;");
  });

  it("wires the WordPress insertion adapter to the Bricks Compatibility payload schema", () => {
    const php = readFileSync("jigma-bricks/jigma-bricks.php", "utf8");
    const panelJs = readFileSync("jigma-bricks/assets/jigma-bricks.js", "utf8");
    const panelCss = readFileSync("jigma-bricks/assets/jigma-bricks.css", "utf8");
    const coreEntry = readFileSync("lib/plugin/jigma-core-entry.ts", "utf8");
    const coreWrapper = readFileSync("lib/plugin/jigma-core.ts", "utf8");
    const coreBundle = readFileSync("jigma-bricks/assets/jigma-core.js", "utf8");

    expect(php).toContain("JIGMA_BRICKS_COMPATIBILITY_SCHEMA_VERSION");
    expect(php).toContain("Plugin URI: https://jigma.co.uk/");
    expect(php).toContain("0.2.2-beta");
    expect(php).toContain("assets/jigma-core.js");
    expect(php).toContain("'jigma-core'");
    expect(php).toContain("array( 'jigma-core' )");
    expect(php.indexOf("jigma_bricks_asset_url( $assets['css'] )"))
      .toBeLessThan(php.indexOf("jigma_bricks_asset_url( $assets['core'] )"));
    expect(php.indexOf("jigma_bricks_asset_url( $assets['core'] )"))
      .toBeLessThan(php.indexOf("jigma_bricks_asset_url( $assets['panel'] )"));
    expect(php).toContain("jigma_bricks_detect_builder_context");
    expect(php).toContain("jigma_bricks_request_has_builder_signal");
    expect(php).toContain("jigma_bricks_core_reports_builder_context");
    expect(php).toContain("bricks_is_builder");
    expect(php).toContain("bricks_is_builder_main");
    expect(php).toContain("jigma_debug");
    expect(php).toContain("jigma_bricks_is_debug_override");
    expect(php).toContain("current_user_can( 'edit_post', $post_id )");
    expect(php).toContain("'bricks'");
    expect(php).toContain("'run', 'builder', 'preview'");
    expect(php).toContain("0 === stripos( $key, 'bricks' )");
    expect(php).toContain("jigma_bricks_required_asset_files");
    expect(php).toContain("'assets/jigma-core.js'");
    expect(php).toContain("'assets/jigma-bricks.js'");
    expect(php).toContain("'assets/jigma-bricks.css'");
    expect(php).toContain("is_readable");
    expect(php).toContain("filemtime");
    expect(php).toContain("Missing required Jigma asset file(s)");
    expect(php).toContain("Jigma development error");
    expect(php).toContain("window.JigmaBricksDiagnostics");
    expect(php).toContain("'phpEnqueued'       => true");
    expect(php).toContain("'builderDetected'   => (bool) $context['builderSignal']");
    expect(php).toContain("'contentHash'");
    expect(php).toContain("'contentSummary'");
    expect(php).toContain("jigma_bricks_validate_compatibility_payload");
    expect(php).toContain("'bricksCopiedElements' !== (string) $payload['source']");
    expect(php).toContain("'globalClasses'");
    expect(php).toContain("'globalElements'");
    expect(php).toContain("jigma_bricks_element_accepts_children");
    expect(php).toContain("jigma_bricks_element_is_locked");
    expect(php).toContain("jigma_bricks_find_element_index");
    expect(php).toContain("'targetId'");
    expect(php).toContain("jigma_missing_selected_target");
    expect(php).toContain("jigma_selected_target_not_nestable");
    expect(php).toContain("jigma_selected_target_locked");
    expect(php).toContain("jigma_no_selected_target_roots");
    expect(php).toContain("jigma_content_version_changed");
    expect(php).toContain("$target_id");
    expect(php).toContain("? $target_id");
    expect(php).toContain("'insertedRootIds'");
    expect(php).toContain("Jigma Page Styles");
    expect(php).toContain("jigma_bricks_apply_page_styles");
    expect(php).toContain("bricks_global_classes");
    expect(php).toContain("jigma_bricks_merge_global_classes");
    expect(php).toContain("update_option( jigma_bricks_get_global_classes_option_name()");
    expect(php).toContain("jigma_bricks_remap_global_class_ids");
    expect(php).toContain("jigma_bricks_validate_global_class_references");
    expect(php).toContain("jigma_bricks_request_css_regeneration");
    expect(php).toContain("bricks/generate_css_file");
    expect(php).toContain("jigma_global_class_conflict");
    expect(php).toContain("No content was inserted");
    expect(php).toContain("A Bricks global class named");
    expect(php).toContain("409");
    expect(php).toContain("$settings['css']     = $css_code;");
    expect(php).toContain("$settings['cssCode'] = $css_code;");
    expect(php).toContain("$settings['javascriptCode'] = $js_code;");
    expect(php).toContain("'codeWarnings'  => $code_warnings");
    expect(php).toContain("JavaScript signature required");
    expect(php).toContain("bricks/security_check_before_save/new_elements");
    expect(php).not.toContain("|| '_cssGlobalClasses' === $key");
    expect(panelJs).toContain("window.JigmaCore.convertToBricksCompatibility");
    expect(panelJs).toContain("JigmaBricksDiagnostics");
    expect(panelJs).toContain("phpEnqueued");
    expect(panelJs).toContain("coreLoaded");
    expect(panelJs).toContain("configLoaded");
    expect(panelJs).toContain("workspaceDetected");
    expect(panelJs).toContain("waitForBody");
    expect(panelJs).toContain("reportInitializationError");
    expect(panelJs).toContain("console.error(\"[Jigma] initialization failed at \" + stage, error)");
    expect(panelJs).toContain("Jigma initialization failed");
    expect(panelJs).toContain("jigma-bricks-root");
    expect(panelJs).toContain("jigma_bricks_ui_v1");
    expect(panelJs).toContain("jigma_bricks_workspace_v1");
    expect(panelJs).toContain("jigma_bricks_saved_sections_v1");
    expect(panelJs).toContain("document.getElementById(ROOT_ID) || window.JigmaBricksPanelLoaded");
    expect(panelJs).toContain("findWorkspaceNode");
    expect(panelJs).toContain("ResizeObserver");
    expect(panelJs).toContain("MutationObserver");
    expect(panelJs).toContain("updateDockBounds");
    expect(panelJs).toContain('nodes.root.dataset.workspace = "detected"');
    expect(panelJs).toContain('nodes.root.dataset.workspace = "fallback"');
    expect(panelJs).toContain("Insert into Selected");
    expect(panelJs).toContain("Select a container in Bricks before inserting.");
    expect(panelJs).toContain("The selected element cannot contain children.");
    expect(panelJs).toContain("targetId");
    expect(panelJs).toContain("pageStylesCss");
    expect(panelJs).toContain("contentHash");
    expect(panelJs).toContain("contentHash: config.contentHash");
    expect(panelJs).toContain("state.target.exists");
    expect(panelJs).toContain("state.target.acceptsChildren");
    expect(panelJs).toContain("state.pageStylesDecision");
    expect(panelJs).toContain("Save Section");
    expect(panelJs).toContain("Duplicate Section");
    expect(panelJs).toContain("Import JSON");
    expect(panelJs).toContain("Quick Import");
    expect(panelJs).toContain("role\", \"dialog");
    expect(panelJs).toContain("aria-modal");
    expect(panelJs).toContain("modalFocusables");
    expect(panelJs).toContain('event.key === "Tab"');
    expect(panelJs).toContain('event.key === "Escape"');
    expect(panelJs).toContain("liveAnalysis: false");
    expect(panelJs).toContain("isValidStoredUi");
    expect(panelJs).toContain("storageGet(UI_KEY)");
    expect(panelJs).toContain("storageRemove(UI_KEY)");
    expect(panelJs).toContain("storageRemove(WORKSPACE_KEY)");
    expect(panelJs).toContain("Reset Jigma UI");
    expect(panelJs).toContain("confirmBeforeInsert: true");
    expect(panelJs).toContain("clearAfterInsert: false");
    expect(panelJs).toContain('dockState: "expanded"');
    expect(panelJs).toContain("dockHeight: 320");
    expect(panelJs).toContain("Math.max(180, Math.min(ui.dockHeight, Math.round(window.innerHeight * 0.65)))");
    expect(panelJs).toContain("function readStoredWorkspace()");
    expect(panelJs).toContain("if (!isPlainObject(parsed))");
    expect(panelJs).toContain("(parsed.html !== undefined && typeof parsed.html !== \"string\")");
    expect(panelJs).toContain("html: typeof parsed.html === \"string\" ? parsed.html : \"\"");
    expect(panelJs).toContain("setInitStage(\"bootstrap-state\")");
    expect(panelJs).toContain("initializeBootstrapState()");
    expect(panelJs).toContain("reportInitializationError(initStage, error)");
    expect(panelJs).toContain("function readSavedSections()");
    expect(panelJs).toContain("if (!Array.isArray(parsed))");
    expect(panelJs).toContain("if (!parsed.every(isPlainObject))");
    expect(panelJs).toContain("storageRemove(SAVED_SECTIONS_KEY)");
    expect(panelJs).not.toContain("safeJsonParse(storageGet(WORKSPACE_KEY), {})");
    expect(panelJs).toContain("includeJsCode");
    expect(panelJs).toContain("Review required");
    expect(panelJs).toContain("Unsigned JavaScript: Signature required after import.");
    expect(panelJs).toContain("Jigma Page Styles");
    expect(panelJs).toContain("Include as Jigma Page Styles");
    expect(panelJs).toContain("keydown");
    expect(panelJs).not.toContain("Ctrl + Shift + R");
    expect(panelJs).not.toContain("Meta + Shift + R");
    expect(panelJs).not.toContain("function createTargets");
    expect(panelJs).not.toContain("function attachCss");
    expect(panelJs).not.toContain("function parseHtml");
    expect(panelJs).not.toContain("new DOMParser");
    expect(panelJs).not.toContain("Jigma Component Styles");
    expect(panelJs).not.toContain("jigmaMeta:");
    expect(panelJs).not.toContain("_exists");
    expect(panelJs).not.toContain("_jigmaPluginPoc");
    expect(panelCss).toContain("#jigma-bricks-root");
    expect(panelCss).toContain(".jigma-dock");
    expect(panelCss).toContain(".jigma-launcher");
    expect(panelCss).toContain(".jigma-launcher--error");
    expect(panelCss).toContain(".jigma-init-error");
    expect(panelCss).toContain(".jigma-modal");
    expect(panelCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(panelCss).not.toContain(".jigma-bricks-dock");
    expect(coreEntry).toContain("window.JigmaCore");
    expect(coreWrapper).toContain("createBricksExport");
    expect(coreWrapper).toContain("serializeBricksClipboardPayload");
    expect(coreWrapper).toContain("BRICKS_COMPATIBILITY_SCHEMA_VERSION");
    expect(coreBundle).toContain("window.JigmaCore");
    expect(coreBundle).toContain("bricks-compatibility.v1");
  });

  it("keeps the Bricks plugin dock isolated and explicit-action only", () => {
    const panelJs = readFileSync("jigma-bricks/assets/jigma-bricks.js", "utf8");
    const panelCss = readFileSync("jigma-bricks/assets/jigma-bricks.css", "utf8");
    const unsafeGlobalSelector = /(^|\n)\s*(html|body|button|input|textarea|svg|\*)\b/;
    const bareJigmaSelector = /(^|\n)\s*\.jigma-/;
    const scheduleLiveAnalysis = panelJs.slice(
      panelJs.indexOf("function scheduleLiveAnalysis"),
      panelJs.indexOf("function minimalPayload"),
    );
    const doRun = panelJs.slice(
      panelJs.indexOf("function doRun"),
      panelJs.indexOf("function doCopy"),
    );

    expect(panelJs).toContain('var ROOT_ID = "jigma-bricks-root"');
    expect(panelJs).toContain("document.body.appendChild(root)");
    expect(panelJs).toContain("root.dataset.workspace = \"fallback\"");
    expect(panelJs).toContain("window.requestAnimationFrame(function ()");
    expect(panelJs).toContain("nodes.workspaceNotice.hidden = !bounds.fallback");
    expect(panelJs).toContain("setDockState(\"expanded\")");
    expect(panelJs).toContain('ui.dockState === "hidden"');
    expect(panelJs).toContain("nodes.launcher.hidden = ui.dockState !== \"hidden\"");
    expect(panelJs).toContain("[\"expanded\", \"collapsed\", \"hidden\"].indexOf(ui.dockState) === -1");
    expect(panelJs).toContain("startDockResize");
    expect(panelJs).toContain("startEditorResize");
    expect(panelJs).toContain("Hide dock");
    expect(panelJs).toContain("normalizeVisibility");
    expect(panelJs).toContain("splitCombinedSource");
    expect(panelJs).toContain("openSettingsModal");
    expect(panelJs).toContain("openQuickImportModal");
    expect(panelJs).toContain("restoreLastWorkspace");
    expect(panelJs).toContain("storageRemove(UI_KEY)");
    expect(panelJs).toContain("Clear after successful insertion");
    expect(panelJs).toContain("Include page-level CSS");
    expect(panelJs).toContain("Class conflict behaviour");
    expect(panelJs).toContain("Saved Sections");
    expect(panelJs).toContain("pageStylesReady");
    expect(panelJs).toContain("Run Jigma to generate a Bricks Compatibility payload.");
    expect(panelJs).toContain("Select a container in Bricks before inserting.");
    expect(scheduleLiveAnalysis).not.toContain("insert(");
    expect(doRun).not.toContain("insert(");
    expect(panelCss).not.toMatch(unsafeGlobalSelector);
    expect(panelCss).not.toMatch(bareJigmaSelector);
    expect(panelCss).not.toContain("backdrop-filter");
    expect(panelCss).not.toContain("scale(");
    expect(panelCss).not.toContain(":hover {\n  transform");
    expect(panelCss).toContain("#jigma-bricks-root .jigma-dock.is-collapsed");
    expect(panelCss).toContain("#jigma-bricks-root .jigma-dock.is-hidden");
    expect(panelCss).toContain("#jigma-bricks-root .jigma-launcher--error");
    expect(panelCss).toContain("#jigma-bricks-root .jigma-button:hover");
    expect(panelCss).toContain("transition-duration: 0.01ms !important");
  });

  it("uses the shared Jigma Core wrapper for plugin payloads", () => {
    const standalone = serializeBricksClipboardPayload(exportFor(featureCtaHtml, featureCtaCss, "", compatibilityOptions));
    const plugin = convertToBricksCompatibility({
      html: featureCtaHtml,
      css: featureCtaCss,
      js: "",
      projectPrefix: "jg",
      blockName: "section",
    });

    expect(plugin.schemaVersion).toBe(BRICKS_COMPATIBILITY_SCHEMA_VERSION);
    expect(plugin.targetBricksVersion).toBe(TARGET_BRICKS_VERSION);
    expect(plugin.payload).toEqual(standalone);
    expect(Object.keys(plugin.payload).sort()).toEqual([
      "content",
      "globalClasses",
      "globalElements",
      "source",
      "sourceUrl",
      "version",
    ]);
    expect(JSON.stringify(plugin.payload)).not.toContain("diagnostics");
    expect(JSON.stringify(plugin.payload)).not.toContain("assetManifest");
    expect(JSON.stringify(plugin.payload)).not.toContain("classAudit");
  });

  it("routes page-level CSS separately without moving class CSS into page styles", () => {
    const review = detectPageLevelCss(`:root { --brand: #7957ff; }
body { margin: 0; }
@font-face { font-family: Test; src: url("/test.woff2"); }
@keyframes pulse { to { opacity: 1; } }
@keyframes pulse { to { opacity: 1; } }
.component { color: white; }
.component:hover .component__icon { opacity: 1; }`);

    expect(review.ruleCount).toBe(4);
    expect(review.css).toContain(":root");
    expect(review.css).toContain("body");
    expect(review.css).toContain("@font-face");
    expect(review.css).toContain("@keyframes pulse");
    expect(review.css.match(/@keyframes pulse/g)).toHaveLength(1);
    expect(review.css).not.toContain(".component {");
    expect(review.css).not.toContain(".component:hover .component__icon");
    expect(review.groups.map((group) => group.type)).toEqual([
      "root",
      "document",
      "font-face",
      "keyframes",
    ]);
  });

  it("produces the Feature CTA payload the plugin adapter must insert without class loss", () => {
    const result = exportFor(featureCtaHtml, featureCtaCss, "", compatibilityOptions);
    const payload = serializeBricksClipboardPayload(result);
    const knownClassIds = new Set(payload.globalClasses.map((entry) => entry.id));
    const heading = payload.content.find((element) => element.name === "heading");
    const textLink = payload.content.find((element) => element.name === "text-link");
    const innerCss = `${payload.globalClasses.find((entry) =>
      entry.name === "lit-feature-cta__inner"
    )?.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] ?? ""}`;

    expect(payload.content).toHaveLength(6);
    expect(payload.globalClasses).toHaveLength(6);
    expect(payload.globalElements).toEqual([]);
    expect(payload.source).toBe("bricksCopiedElements");
    expect(payload.version).toBe(TARGET_BRICKS_VERSION);
    expect(JSON.stringify(payload.content)).not.toContain("_cssClasses");
    expect(payload.content.every((element) => Array.isArray(element.settings._cssGlobalClasses)))
      .toBe(true);
    expect(payload.content.flatMap((element) =>
      Array.isArray(element.settings._cssGlobalClasses)
        ? element.settings._cssGlobalClasses.map((id) => `${id}`)
        : []
    ).every((id) => knownClassIds.has(id))).toBe(true);
    expect(heading?.settings._cssId).toBe("lit-feature-cta-title");
    expect(payload.content[0].settings._attributes).toEqual([
      { name: "aria-labelledby", value: "lit-feature-cta-title" },
    ]);
    expect(textLink?.settings.link).toEqual({ type: "internal", url: "#" });
    expect(textLink?.settings.text).toContain("<span");
    expect(textLink?.settings.text).toContain("→");
    expect(innerCss).toContain(".lit-feature-cta__inner::before");
    expect(innerCss).toContain(".lit-feature-cta__inner::after");
    expect(innerCss).toContain("forest-desktop.webp");
    expect(innerCss).toContain("@media (max-width: 820px)");
  });

  it("produces the Process Light payload the plugin adapter must preserve after save and reload", () => {
    const result = exportFor(processLightHtml, processLightCss, "", compatibilityOptions);
    const payload = serializeBricksClipboardPayload(result);
    const knownClassIds = new Set(payload.globalClasses.map((entry) => entry.id));
    const header = payload.content.find((element) => element.label === "Process Header");
    const articles = payload.content.filter((element) => element.settings.tag === "article");
    const svgElements = payload.content.filter((element) => element.name === "svg");
    const grid = payload.content.find((element) => element.label === "Process Grid");
    const cardClass = payload.globalClasses.find((entry) => entry.name === "lit-process-light__card");
    const iconSvgClass = payload.globalClasses.find((entry) => entry.name === "lit-process-light__icon-svg");

    expect(payload.content).toHaveLength(31);
    expect(payload.globalClasses).toHaveLength(17);
    expect(header?.settings.tag).toBe("header");
    expect(articles).toHaveLength(4);
    expect(grid?.children).toHaveLength(4);
    expect(svgElements).toHaveLength(4);
    expect(svgElements.every((element) => `${element.settings.code ?? ""}`.includes("<svg")))
      .toBe(true);
    expect(payload.content.flatMap((element) =>
      Array.isArray(element.settings._cssGlobalClasses)
        ? element.settings._cssGlobalClasses.map((id) => `${id}`)
        : []
    ).every((id) => knownClassIds.has(id))).toBe(true);
    expect(payload.content.filter((element) =>
      Array.isArray(element.settings._cssGlobalClasses) &&
      element.settings._cssGlobalClasses.includes(cardClass?.id)
    )).toHaveLength(4);
    expect(svgElements.filter((element) =>
      Array.isArray(element.settings._cssGlobalClasses) &&
      element.settings._cssGlobalClasses.includes(iconSvgClass?.id)
    )).toHaveLength(4);
    expect(`${cardClass?.settings[BRICKS_ELEMENT_CUSTOM_CSS_FIELD] ?? ""}`)
      .toContain(".lit-process-light__card::before");
  });

  it("keeps plugin-compatible JavaScript optional as one disabled unsigned Code element", () => {
    const html = `<section class="plugin-js"><h2 class="plugin-js__title">Plugin JS</h2></section>`;
    const js = `document.querySelector('.plugin-js')?.classList.add('is-ready');`;
    const disabled = serializeBricksClipboardPayload(exportFor(html, "", js, {
      ...compatibilityOptions,
      includeJavaScriptCode: false,
    }));
    const enabled = serializeBricksClipboardPayload(exportFor(html, "", js, {
      ...compatibilityOptions,
      includeJavaScriptCode: true,
    }));

    expect(disabled.content.filter((element) => element.name === "code")).toHaveLength(0);
    const codeElements = enabled.content.filter((element) => element.name === "code");
    expect(codeElements).toHaveLength(1);
    expect(codeElements[0].settings.executeCode).toBe(false);
    expect(codeElements[0].settings.javascriptCode).toBe(js);
    expect(codeElements[0].settings.javascript).toBeUndefined();
    expect(codeElements[0].settings._cssGlobalClasses).toBeUndefined();
    expect(enabled.content[enabled.content.length - 1].id).toBe(codeElements[0].id);
  });

  it("scopes CSS to generated BEM classes", () => {
    const result = exportFor(sectionFixtures[0].html, sectionFixtures[0].css, "", {
      projectPrefix: "demo",
      blockName: "hero",
      exportMode: "scoped-css-block",
    });
    const css = getCssPayload(result);

    expect(css).toContain(".demo-hero");
    expect(css).toContain(".demo-hero__title");
    expect(css).not.toContain(".hero__title");
  });

  it("maps supported pseudo selectors to native class settings and literal fallback CSS", () => {
    const result = exportFor(
      `<section class="hero"><a class="hero__button" href="#demo">Demo</a></section>`,
      `.hero__button:hover { opacity: 0.8; }
.hero__button::before { content: ""; }`,
    );
    const buttonCss = getGlobalClassCss(result, "acme-hero__button");
    const buttonSettings = getGlobalClassSettings(result, "acme-hero__button");

    expect(buttonSettings["_opacity:hover"]).toBe("0.8");
    expect(buttonCss).toContain(".acme-hero__button::before {");
    expect(buttonCss).toContain('content: "";');
    expect(buttonCss).not.toContain(".hero__button");
    expect(buttonCss).not.toContain("%root%");
    expect(result.warnings.some((warning) => warning.message.includes("pseudo selector"))).toBe(false);
  });

  it("does not crash on empty CSS and JS", () => {
    const result = exportFor(`<section class="empty"><p>Plain</p></section>`, "", "");

    expect(result.validation.hierarchyValid).toBe(true);
    expect(result.content.some((element) => element.name === "code")).toBe(false);
  });

  it("creates exactly one unsigned Bricks Code element when JavaScript inclusion is enabled", () => {
    const js = `(() => {
  document.querySelector(".jigma-header__toggle")?.addEventListener("click", () => {
    document.body.dataset.menu = "open";
  });
})();`;
    const result = exportFor(
      `<header class="jigma-header"><button class="jigma-header__toggle">Menu</button></header>`,
      `.jigma-header { display: flex; }`,
      js,
      { projectPrefix: "jigma", blockName: "header", includeJavaScriptCode: true },
    );
    const codeElements = result.content.filter((element) => element.name === "code" && element.label === "Jigma Header JavaScript");
    const headerRootIndex = result.content.findIndex((element) => element.label === "Header");
    const codeIndex = result.content.findIndex((element) => element.label === "Jigma Header JavaScript");

    expect(codeElements).toHaveLength(1);
    expect(codeElements[0].parent).toBe(0);
    expect(codeElements[0].children).toEqual([]);
    expect(codeElements[0].settings.javascriptCode).toBe(js);
    expect(codeElements[0].settings.executeCode).toBe(false);
    expect(codeElements[0].settings.javascript).toBeUndefined();
    expect(codeElements[0].settings.js).toBeUndefined();
    expect(codeElements[0].settings.css).toBeUndefined();
    expect(codeElements[0].settings.html).toBeUndefined();
    expect(JSON.stringify(codeElements[0].settings).toLowerCase()).not.toContain("signature");
    expect(codeIndex).toBeGreaterThan(headerRootIndex);
    expect(result.validation.unsignedJavaScriptCodeCount).toBe(1);
    expect(result.warnings.filter((warning) => warning.code === "javascript.review_required")).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.title === "JavaScript signature required")).toBe(true);
  });

  it("detects JavaScript and excludes it when Code export is off", () => {
    const result = exportFor(
      `<section class="hero"><button class="hero__button">Click</button></section>`,
      `.hero__button { color: red; }`,
      `document.querySelector("button")?.click();`,
      { includeJavaScriptCode: false },
    );

    expect(result.validation.jsWarningCount).toBe(1);
    expect(result.validation.unsignedJavaScriptCodeCount).toBe(0);
    expect(
      result.warnings.some((warning) =>
        warning.message.includes("Excluded from Bricks export")
      ),
    ).toBe(true);
    expect(JSON.stringify(result.content)).not.toContain("querySelector");
  });

  it("fails gracefully on invalid HTML", () => {
    const result = exportFor(
      `<section class="broken"><div><p>Missing closing tags`,
      `.broken { color: red; }`,
    );

    expect(result.validation.hierarchyValid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
