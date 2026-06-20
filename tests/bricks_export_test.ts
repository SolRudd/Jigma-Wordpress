import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createBricksExport, TARGET_BRICKS_VERSION } from "../lib/bricks/export.ts";
import { BRICKS_ELEMENT_CUSTOM_CSS_FIELD } from "../lib/css/element.ts";
import {
  DEFAULT_OUTPUT_ADAPTER,
  createOutputExport,
} from "../lib/output/adapters.ts";
import {
  PREVIEW_HOVER_INSPECTOR_ENABLED,
  createPreviewDocument,
} from "../lib/preview/document.ts";
import JigmaBuilder, {
  AUTO_SCROLL_ENABLED,
  SOURCE_EDITOR_DEFINITIONS,
} from "../src/components/JigmaBuilder.tsx";
import type { OutputOptions } from "../types/jigma.ts";
import { sectionFixtures } from "./fixtures/sections.ts";

const defaultOptions: OutputOptions = {
  stylingMode: "bem-css",
  exportMode: "element-styles",
  classMode: "strict-bem",
  projectPrefix: "acme",
  blockName: "section",
  createGlobalClasses: false,
  includeExternalCss: false,
  includeExternalScripts: false,
  minifyElementCss: false,
};

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
  return result.content.find((element) => element.settings._jigmaBemClass === className);
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
    expect("globalClasses" in result).toBe(false);
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
    expect(markup).toContain("Disable Highlights");
  });

  it("generates BEM classes for exported elements", () => {
    const result = exportFor(sectionFixtures[0].html, sectionFixtures[0].css, "", {
      projectPrefix: "demo",
      blockName: "hero",
    });
    const classValues = result.content
      .filter((element) => element.name !== "code")
      .map((element) => `${element.settings._cssClasses ?? ""}`);

    expect(classValues.length).toBeGreaterThan(0);
    expect(classValues.every((value) => value.includes("demo-hero"))).toBe(true);
  });

  it("defaults to element styles without generated CSS block or Bricks global classes", () => {
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
      typeof element.settings._jigmaBemClass === "string"
    );
    const section = getElementByBemClass(result, "jg-hero");
    const content = getElementByBemClass(result, "jg-hero__content");
    const title = getElementByBemClass(result, "jg-hero__title");
    const text = getElementByBemClass(result, "jg-hero__text");
    const button = getElementByBemClass(result, "jg-hero__button--secondary");

    expect(exportedElements.length).toBeGreaterThan(0);
    expect(exportedElements.every((element) =>
      typeof element.settings._cssClasses === "string" &&
      `${element.settings._cssClasses}`.startsWith("jg-hero")
    )).toBe(true);
    expect(result.content.some((element) => element.label === "Generated BEM CSS")).toBe(false);
    expect(exportedElements.some((element) => "_cssGlobalClasses" in element.settings)).toBe(false);
    expect("globalClasses" in result).toBe(false);
    expect(result.validation.globalClassCount).toBe(0);
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
    expect(button?.settings._cssClasses).toBe("jg-hero__button jg-hero__button--secondary");
    expect(getElementCss(section!)).toContain("%root% {");
    expect(getElementCss(section!)).toContain("padding: 80px;");
    expect(getElementCss(section!)).toContain("background: #101820;");
    expect(getElementCss(content!)).toContain("%root% {");
    expect(getElementCss(content!)).toContain("max-width: 920px;");
    expect(getElementCss(title!)).toContain("%root% {");
    expect(getElementCss(title!)).toContain("font-size: 64px;");
    expect(getElementCss(title!)).toContain("line-height: 1;");
    expect(getElementCss(title!)).toContain("color: white;");
    expect(getElementCss(title!)).toContain("%root%:hover {");
    expect(getElementCss(title!)).toContain("opacity: 0.8;");
    expect(getElementCss(title!)).toContain("@media (max-width: 768px) {");
    expect(getElementCss(title!)).toContain("  %root% {");
    expect(getElementCss(title!)).toContain("font-size: 42px;");
    expect(getElementCss(title!)).not.toContain(".jg-hero__title");
    expect(getElementCss(title!)).not.toContain(".hero-title");
    expect(getElementCss(text!)).toContain("color: #d7dee8;");
    expect(getElementCss(button!)).toContain("padding: 14px 18px;");
    expect(getElementCss(button!)).toContain("border: 1px solid currentColor;");
    expect(getElementCss(button!)).not.toContain(".jg-hero__button");
    expect(getElementCss(button!).match(/%root% \{/g)?.length).toBe(1);
  });

  it("creates Bricks global classes only when opted in", () => {
    const result = exportFor(
      `<section class="hero-section"><h1 class="hero-title">Global classes</h1></section>`,
      `.hero-section { padding: 3rem; } .hero-title { color: white; }`,
      "",
      { projectPrefix: "jg", exportMode: "global-classes", createGlobalClasses: true },
    );
    const exportedElements = result.content.filter((element) =>
      typeof element.settings._jigmaBemClass === "string"
    );

    expect(exportedElements.length).toBeGreaterThan(0);
    expect(exportedElements.every((element) => typeof element.settings._cssClasses === "string"))
      .toBe(true);
    expect(exportedElements.every((element) => Array.isArray(element.settings._cssGlobalClasses)))
      .toBe(true);
    expect(result.globalClasses).toBeDefined();
    expect(result.globalClasses?.length).toBeGreaterThan(0);
    expect(result.validation.globalClassCount).toBe(result.globalClasses?.length);
  });

  it("optionally minifies element-level root CSS without changing export mode", () => {
    const result = exportFor(
      `<section class="hero-section">
  <h1 class="hero-title">Minified CSS</h1>
</section>`,
      `.hero-title {
  font-size: 64px;
  line-height: 1;
  color: white;
}
@media (max-width: 768px) {
  .hero-title {
    font-size: 42px;
  }
}`,
      "",
      { projectPrefix: "jg", minifyElementCss: true },
    );
    const title = getElementByBemClass(result, "jg-hero__title");
    const titleCss = getElementCss(title!);

    expect(titleCss).toContain("%root%{font-size:64px;line-height:1;color:white;}");
    expect(titleCss).toContain("@media (max-width: 768px){%root%{font-size:42px;}}");
    expect(titleCss).not.toContain(".jg-hero__title");
    expect(result.content.some((element) => element.label === "Generated BEM CSS")).toBe(false);
    expect("globalClasses" in result).toBe(false);
  });

  it("exports structure only without CSS attachments or generated CSS block", () => {
    const result = exportFor(
      `<section class="hero-section"><h1 class="hero-title">Structure only</h1></section>`,
      `.hero-section { padding: 3rem; } .hero-title { color: white; }`,
      "",
      { projectPrefix: "jg", exportMode: "structure-only" },
    );
    const exportedElements = result.content.filter((element) =>
      typeof element.settings._jigmaBemClass === "string"
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
      typeof element.settings._jigmaBemClass === "string"
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
    expect(result.warnings.some((warning) =>
      warning.message.includes("Dropped selector") &&
      warning.message.includes(".missing-card")
    )).toBe(true);
  });

  it("does not preserve originals in strict BEM but does in hybrid", () => {
    const strict = exportFor(`<section class="hero"><h2 class="hero__title">Title</h2></section>`);
    const hybrid = exportFor(
      `<section class="hero"><h2 class="hero__title">Title</h2></section>`,
      "",
      "",
      { classMode: "hybrid" },
    );
    const hybridPayload = JSON.stringify(hybrid.content);

    expect(
      strict.content.some((element) => element.settings._jigmaOriginalClasses),
    ).toBe(false);
    expect(hybridPayload).toContain("hero__title");
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
    const classValues = result.content
      .filter((element) => element.name !== "code")
      .map((element) => `${element.settings._jigmaBemClass ?? ""}`);

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

    expect(getElementByLabel(result, "Proof Section")?.settings._cssClasses).toBe("lit-proof");
    expect(getElementByLabel(result, "Proof Shell")?.settings._cssClasses)
      .toBe("lit-proof__shell");
    expect(getElementByLabel(result, "Proof Item")?.settings._cssClasses)
      .toBe("lit-proof__item");
    expect(getElementByLabel(result, "Proof Icon")?.settings._cssClasses)
      .toBe("lit-proof__icon");
    expect(content?.settings._cssClasses).toBe("lit-proof__content");
    expect(number?.settings._cssClasses).toBe("lit-proof__number");
    expect(getElementByLabel(result, "Proof Label")?.settings._cssClasses)
      .toBe("lit-proof__label");
    expect(iconSvg?.settings._cssClasses).toBe("lit-proof__svg");
    expect(getElementCss(content!)).toContain("display: grid;");
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
    const classValues = result.content
      .filter((element) => element.name !== "code")
      .map((element) => `${element.settings._jigmaBemClass ?? ""}`);

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
    expect("globalClasses" in payload).toBe(false);
    expect(payload.validation.globalClassCount).toBe(0);
    expect(
      payload.content.every((element) =>
        typeof element.id === "string" &&
        typeof element.name === "string" &&
        Array.isArray(element.children)
      ),
    ).toBe(true);
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

  it("maps supported pseudo selectors to element-level root CSS", () => {
    const result = exportFor(
      `<section class="hero"><a class="hero__button" href="#demo">Demo</a></section>`,
      `.hero__button:hover { opacity: 0.8; }
.hero__button::before { content: ""; }`,
    );
    const button = getElementByBemClass(result, "hero__button");
    const buttonCss = getElementCss(button!);

    expect(buttonCss).toContain("%root%:hover {");
    expect(buttonCss).toContain("opacity: 0.8;");
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
