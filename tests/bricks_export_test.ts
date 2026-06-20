import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createBricksExport, TARGET_BRICKS_VERSION } from "../lib/bricks/export.ts";
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
import { getTemplateByKey, templates } from "../lib/templates.ts";
import JigmaBuilder, {
  AUTO_SCROLL_ENABLED,
  SOURCE_EDITOR_DEFINITIONS,
} from "../src/components/JigmaBuilder.tsx";
import type { OutputOptions } from "../types/jigma.ts";
import { sectionFixtures } from "./fixtures/sections.ts";

const defaultOptions: OutputOptions = {
  stylingMode: "bem-css",
  exportMode: "native-bem-classes",
  classMode: "strict-bem",
  projectPrefix: "acme",
  blockName: "section",
  createGlobalClasses: true,
  includeExternalCss: false,
  includeExternalScripts: false,
  minifyElementCss: false,
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

  it("fixture exports generate valid Bricks hierarchy", () => {
    sectionFixtures.forEach((fixture) => {
      const result = exportFor(fixture.html, fixture.css);

      expect(result.validation.hierarchyValid, fixture.name).toBe(true);
      expect(result.validation.totalElements, fixture.name).toBeGreaterThan(0);
      expect(result.validation.bemClassCount, fixture.name).toBeGreaterThan(0);
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
    expect(markup).toContain('id="source-panel-css"');
    expect(markup).toContain('id="source-panel-js"');
    expect(markup).toContain('class="code-highlight"');
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
      "Jigma Hero",
      "Proof Bar",
      "Services",
      "iPhone/Product Showcase",
      "Pricing",
      "Testimonials",
      "CTA",
    ]);

    const proofBar = getTemplateByKey("proof-bar");

    expect(proofBar?.html).toContain("jg-proof__number");
    expect(proofBar?.css).toContain(".jg-proof__shell");
    expect(proofBar?.javascript).toBe("");
    expect(proofBar?.prefix).toBe("jg");
    expect(proofBar?.builderTarget).toBe("bricks");
    expect(proofBar?.testedBreakpoints).toEqual(["desktop", "tablet", "mobile"]);
    expect(getTemplateByKey("missing-template")).toBeNull();
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

      expect(first.validation.hierarchyValid, template.name).toBe(true);
      expect(first.validation.classReferenceValid, template.name).toBe(true);
      expect(first.validation.globalClassCount, template.name).toBe(first.globalClasses?.length);
      expect(first.validation.nativeStyleMappedCount, template.name).toBeGreaterThan(0);
      expect(first.validation.customCssFallbackCount, template.name).toBeGreaterThan(0);
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
      expect(classCss).not.toContain(".card ");
      expect(classCss).not.toContain(".title");
      expect(classCss).not.toContain("div > span");
    });
  });

  it("keeps the beta workspace focused and generated JSON hidden by default", () => {
    const markup = renderToStaticMarkup(createElement(JigmaBuilder));

    expect(markup).toContain("Library");
    expect(markup).toContain("Code");
    expect(markup).toContain("Preview");
    expect(markup).toContain("Inspect");
    expect(markup).toContain("Template Library");
    expect(markup).toContain("Hero");
    expect(markup).toContain("Proof Bar");
    expect(markup).toContain("Save Preset locally");
    expect(markup).toContain("Load Preset locally");
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

    expect(sectionCss).toContain("%root% {");
    expect(sectionCss).toContain("background: radial-gradient(circle at 80% 10%, rgba(139, 92, 246, 0.45), transparent 36%), #080b16;");
    expect(sectionCss).not.toContain(".jg-hero");
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

    expect(titleCss).not.toContain(".jg-hero__title");
    expect(titleCss).not.toContain(".hero-title");
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

    expect(statsCss).not.toContain(".jg-hero__stats");
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
    const titleCss = getGlobalClassCss(result, "jg-hero__title");
    const titleSettings = getGlobalClassSettings(result, "jg-hero__title");

    expect(titleSettings._typography).toEqual({
      "font-size": "64px",
      "line-height": "1",
      color: { raw: "white" },
    });
    expect(titleSettings["_typography:tablet_portrait"]).toEqual({ "font-size": "42px" });
    expect(titleCss).toContain("%root%{filter:blur(0);}");
    expect(titleCss).toContain("@media (max-width: 768px){%root%{transform:translateY(0);}}");
    expect(titleCss).not.toContain(".jg-hero__title");
    expect(result.content.some((element) => element.label === "Generated BEM CSS")).toBe(false);
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
    <path onclick="evil()" d="M0 0h20v20H0z" fill="url(#grad)" />
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
    expect(warningDetails).toContain("Removed tags");
    expect(warningDetails).toContain("Removed attributes");
    expect(result.validation.unsignedSvgCodeCount).toBe(1);
    expect(result.validation.unsignedJavaScriptCodeCount).toBe(1);
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

  it("maps common CSS into native Bricks class settings and keeps unsupported CSS on %root%", () => {
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
    const titleCss = getGlobalClassCss(result, "jg-test__title");

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
    expect(titleCss).toContain("%root% {");
    expect(titleCss).toContain("transform: translateY(0);");
    expect(titleCss).toContain("@media (max-width: 820px) {");
    expect(titleCss).toContain("filter: blur(0);");
    expect(titleCss).not.toContain(".jg-test__title");
    expect(titleCss).not.toContain(".test-title");
    expect(result.validation.nativeStyleMappedCount).toBeGreaterThan(0);
    expect(result.validation.customCssFallbackCount).toBe(2);
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

    expect(cardCss).toContain("%root%:hover .jg-card__button-icon {");
    expect(cardCss).toContain("transform: rotate(8deg);");
    expect(cardCss).not.toContain(".jg-card:hover");
    expect(buttonSettings._display).toBe("inline-flex");
    expect(buttonSettings._gap).toBe("8px");
    expect(result.validation.blockScopedFallbackCount).toBe(1);
    expect(result.validation.customCssFallbackCount).toBe(1);
    expect(result.validation.pseudoRuleCount).toBe(0);
    expect(result.warnings.some((warning) =>
      warning.message.includes("was scoped to the") &&
      warning.message.includes("jg-card")
    )).toBe(true);
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
    expect(cardCss).toContain("%root% {");
    expect(cardCss).toContain("animation: cardPulse 6s ease-in-out infinite;");
    expect(titleCss).toContain("%root%::after {");
    expect(titleCss).toContain('content: "";');
    expect(titleCss).toContain("@container (max-width: 640px) {");
    expect(titleCss).toContain("text-wrap: balance;");
    expect(titleCss).not.toContain(".jg-card__title");
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

  it("wires the WordPress insertion adapter to merge Bricks global classes", () => {
    const readTextFileSync = (globalThis as unknown as {
      Deno: { readTextFileSync: (path: string) => string };
    }).Deno.readTextFileSync;
    const php = readTextFileSync("jigma-bricks/jigma-bricks.php");
    const panelJs = readTextFileSync("jigma-bricks/assets/jigma-bricks.js");

    expect(php).toContain("bricks_global_classes");
    expect(php).toContain("jigma_bricks_merge_global_classes");
    expect(php).toContain("update_option( jigma_bricks_get_global_classes_option_name()");
    expect(php).toContain("jigma_bricks_remap_global_class_ids");
    expect(php).toContain("jigma_bricks_validate_global_class_references");
    expect(php).toContain("jigma_bricks_request_css_regeneration");
    expect(php).toContain("bricks/generate_css_file");
    expect(php).toContain("Existing Bricks class");
    expect(php).toContain("bricks/security_check_before_save/new_elements");
    expect(php).not.toContain("|| '_cssGlobalClasses' === $key");
    expect(panelJs).toContain("globalClasses: globalClasses");
    expect(panelJs).toContain("settings._cssGlobalClasses");
    expect(panelJs).toContain("nativeStyleMappedCount");
    expect(panelJs).not.toContain("_exists");
    expect(panelJs).not.toContain("_jigmaPluginPoc");
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

  it("maps supported pseudo selectors to native class root CSS", () => {
    const result = exportFor(
      `<section class="hero"><a class="hero__button" href="#demo">Demo</a></section>`,
      `.hero__button:hover { opacity: 0.8; }
.hero__button::before { content: ""; }`,
    );
    const buttonCss = getGlobalClassCss(result, "acme-hero__button");
    const buttonSettings = getGlobalClassSettings(result, "acme-hero__button");

    expect(buttonSettings["_opacity:hover"]).toBe("0.8");
    expect(buttonCss).toContain("%root%::before {");
    expect(buttonCss).toContain('content: "";');
    expect(buttonCss).not.toContain(".hero__button");
    expect(result.warnings.some((warning) => warning.message.includes("pseudo selector"))).toBe(false);
  });

  it("does not crash on empty CSS and JS", () => {
    const result = exportFor(`<section class="empty"><p>Plain</p></section>`, "", "");

    expect(result.validation.hierarchyValid).toBe(true);
    expect(result.content.some((element) => element.name === "code")).toBe(false);
  });

  it("detects JavaScript but does not convert it", () => {
    const result = exportFor(
      `<section class="hero"><button class="hero__button">Click</button></section>`,
      `.hero__button { color: red; }`,
      `document.querySelector("button")?.click();`,
    );

    expect(result.validation.jsWarningCount).toBe(1);
    expect(
      result.warnings.some((warning) =>
        warning.message.includes("JavaScript was detected but not converted")
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
