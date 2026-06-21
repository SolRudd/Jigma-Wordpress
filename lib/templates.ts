import { jigmaHeaderTemplate } from "./template-library/jigma-header.ts";
import { jigmaHeroTemplate } from "./template-library/jigma-hero.ts";
import { jigmaProofTemplate } from "./template-library/jigma-proof.ts";
import { template, type JigmaTemplate } from "./template-library/types.ts";

export type { JigmaTemplate } from "./template-library/types.ts";

export const templates: JigmaTemplate[] = [
  template(jigmaHeaderTemplate),
  template(jigmaHeroTemplate),
  template(jigmaProofTemplate),
  template({
    id: "services",
    name: "Services",
    category: "Content",
    description: "Three service cards for productized conversion workflows.",
    version: 2,
    builderTarget: "bricks",
    prefix: "jg",
    blockName: "services",
    thumbnail: "services",
    expectedWarnings: ["clip-path"],
    testedBreakpoints: ["desktop", "tablet", "mobile"],
    html: `<section class="jg-services">
  <div class="jg-services__header">
    <p class="jg-services__eyebrow">Conversion coverage</p>
    <h2 class="jg-services__title">Keep every exported layer editable.</h2>
    <p class="jg-services__text">Source, preview, dependency checks, and export validation stay together in one focused workflow.</p>
  </div>
  <div class="jg-services__grid">
    <article class="jg-services__card">
      <span class="jg-services__number">01</span>
      <h3 class="jg-services__card-title">Code to Builder</h3>
      <p class="jg-services__card-text">Turn pasted HTML and CSS into a clean Bricks hierarchy without rebuilding from a blank canvas.</p>
    </article>
    <article class="jg-services__card">
      <span class="jg-services__number">02</span>
      <h3 class="jg-services__card-title">Clean BEM Classes</h3>
      <p class="jg-services__card-text">Generate predictable class names that stay readable in the Bricks class manager.</p>
    </article>
    <article class="jg-services__card">
      <span class="jg-services__number">03</span>
      <h3 class="jg-services__card-title">Native Styling</h3>
      <p class="jg-services__card-text">Map common CSS into Bricks controls and keep advanced fallback CSS on the owning class.</p>
    </article>
  </div>
</section>`,
    css: `.jg-services {
  padding: 78px 44px;
  color: #0f172a;
  background: #f8fafc;
}

.jg-services__header {
  max-width: 760px;
  margin: 0 auto 36px;
  text-align: center;
}

.jg-services__eyebrow {
  margin: 0 0 12px;
  color: #0f766e;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.jg-services__title {
  margin: 0;
  font-size: 48px;
  line-height: 1.05;
}

.jg-services__text {
  max-width: 680px;
  margin: 18px auto 0;
  color: #64748b;
  font-size: 18px;
  line-height: 1.6;
}

.jg-services__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  max-width: 1120px;
  margin: 0 auto;
}

.jg-services__card {
  display: grid;
  gap: 14px;
  min-height: 260px;
  padding: 28px;
  border: 1px solid #dbe4ef;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.06);
  clip-path: inset(0 round 16px);
}

.jg-services__card:hover {
  transform: translateY(-4px);
}

.jg-services__number {
  color: #0f766e;
  font-weight: 950;
}

.jg-services__card-title {
  margin: 0;
  font-size: 23px;
}

.jg-services__card-text {
  margin: 0;
  color: #5b6678;
  line-height: 1.6;
}

@media (max-width: 860px) {
  .jg-services__grid {
    grid-template-columns: 1fr;
  }

  .jg-services__title {
    font-size: 36px;
  }
}`,
    javascript: "",
  }),
  template({
    id: "product-showcase",
    name: "iPhone/Product Showcase",
    category: "Product",
    description: "Product feature section with a device-style visual.",
    version: 2,
    builderTarget: "bricks",
    prefix: "jg",
    blockName: "product",
    thumbnail: "product-showcase",
    expectedWarnings: ["container", "filter"],
    testedBreakpoints: ["desktop", "tablet", "mobile"],
    html: `<section class="jg-product">
  <div class="jg-product__media">
    <div class="jg-product__phone">
      <div class="jg-product__screen">
        <span class="jg-product__status">Live preview</span>
        <strong class="jg-product__score">99</strong>
        <span class="jg-product__caption">Editable layers</span>
      </div>
    </div>
  </div>
  <div class="jg-product__content">
    <p class="jg-product__eyebrow">Product showcase</p>
    <h2 class="jg-product__title">Preview the section before it becomes builder-native.</h2>
    <p class="jg-product__text">Use the canvas to inspect shape, spacing, and responsive behavior before copying the Bricks structure.</p>
    <ul class="jg-product__list">
      <li class="jg-product__item">Generated labels for the Structure panel</li>
      <li class="jg-product__item">Native class settings for common CSS</li>
      <li class="jg-product__item">Scoped fallback CSS for advanced effects</li>
    </ul>
    <a class="jg-product__button" href="#copy">Copy Bricks Structure</a>
  </div>
</section>`,
    css: `.jg-product {
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1fr);
  gap: 56px;
  align-items: center;
  padding: 82px 48px;
  color: #111827;
  background: #eef6ff;
}

.jg-product__media {
  display: flex;
  justify-content: center;
}

.jg-product__phone {
  width: min(320px, 76vw);
  min-height: 560px;
  padding: 16px;
  border: 10px solid #111827;
  border-radius: 42px;
  background: #020617;
  box-shadow: 0 34px 90px rgba(15, 23, 42, 0.28);
  filter: drop-shadow(0 24px 60px rgba(59, 130, 246, 0.28));
}

.jg-product__screen {
  display: grid;
  align-content: end;
  gap: 10px;
  min-height: 520px;
  padding: 24px;
  border-radius: 28px;
  color: #ffffff;
  background: linear-gradient(160deg, #1d4ed8, #7c3aed 58%, #020617);
}

.jg-product__status {
  width: max-content;
  padding: 7px 10px;
  border-radius: 999px;
  color: #cffafe;
  background: rgba(255, 255, 255, 0.14);
}

.jg-product__score {
  font-size: 82px;
  line-height: 0.9;
}

.jg-product__caption {
  color: rgba(255, 255, 255, 0.72);
}

.jg-product__content {
  max-width: 720px;
}

.jg-product__eyebrow {
  margin: 0 0 12px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.jg-product__title {
  margin: 0;
  font-size: clamp(40px, 5vw, 64px);
  line-height: 1.02;
}

.jg-product__text {
  margin: 22px 0 0;
  color: #475569;
  font-size: 18px;
  line-height: 1.65;
}

.jg-product__list {
  display: grid;
  gap: 10px;
  margin: 28px 0 0;
  padding: 0;
}

.jg-product__item {
  list-style: none;
  color: #334155;
}

.jg-product__button {
  display: inline-flex;
  width: max-content;
  margin-top: 28px;
  padding: 14px 20px;
  color: #ffffff;
  border-radius: 12px;
  background: #2563eb;
  font-weight: 850;
  text-decoration: none;
}

@container (max-width: 720px) {
  .jg-product__phone {
    min-height: 480px;
  }
}

@media (max-width: 900px) {
  .jg-product {
    grid-template-columns: 1fr;
    padding: 48px 24px;
  }
}`,
    javascript: "",
  }),
  template({
    id: "pricing",
    name: "Pricing",
    category: "Commerce",
    description: "Two-plan pricing section with a featured agency plan.",
    version: 2,
    builderTarget: "bricks",
    prefix: "jg",
    blockName: "pricing",
    thumbnail: "pricing",
    expectedWarnings: ["outline", "transform"],
    testedBreakpoints: ["desktop", "tablet", "mobile"],
    html: `<section class="jg-pricing">
  <div class="jg-pricing__header">
    <p class="jg-pricing__eyebrow">Beta access</p>
    <h2 class="jg-pricing__title">Choose a conversion workflow for your team.</h2>
    <p class="jg-pricing__text">Start with manual copy/paste, then move repeatable work into saved presets.</p>
  </div>
  <div class="jg-pricing__grid">
    <article class="jg-pricing__card">
      <h3 class="jg-pricing__card-title">Solo</h3>
      <p class="jg-pricing__price">$19</p>
      <p class="jg-pricing__card-text">For one-off landing page sections and quick rebuilds.</p>
      <a class="jg-pricing__button" href="#solo">Select Solo</a>
    </article>
    <article class="jg-pricing__card jg-pricing__card--featured">
      <h3 class="jg-pricing__card-title">Agency</h3>
      <p class="jg-pricing__price">$49</p>
      <p class="jg-pricing__card-text">For client builds, repeatable naming, and reusable presets.</p>
      <a class="jg-pricing__button jg-pricing__button--primary" href="#agency">Select Agency</a>
    </article>
  </div>
</section>`,
    css: `.jg-pricing {
  padding: 78px 44px;
  color: #f8fafc;
  background: #0b1020;
}

.jg-pricing__header {
  max-width: 780px;
  margin: 0 auto 34px;
  text-align: center;
}

.jg-pricing__eyebrow {
  margin: 0 0 12px;
  color: #2dd4bf;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.jg-pricing__title {
  margin: 0;
  font-size: 46px;
  line-height: 1.08;
}

.jg-pricing__text {
  margin: 16px 0 0;
  color: #a8b3c7;
  line-height: 1.65;
}

.jg-pricing__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  max-width: 900px;
  margin: 0 auto;
}

.jg-pricing__card {
  display: grid;
  gap: 16px;
  padding: 30px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
}

.jg-pricing__card--featured {
  border-color: rgba(45, 212, 191, 0.52);
  outline: 1px solid rgba(45, 212, 191, 0.18);
  transform: translateY(-8px);
}

.jg-pricing__card-title {
  margin: 0;
  font-size: 22px;
}

.jg-pricing__price {
  margin: 0;
  font-size: 52px;
  font-weight: 950;
  line-height: 1;
}

.jg-pricing__card-text {
  margin: 0;
  color: #a8b3c7;
  line-height: 1.6;
}

.jg-pricing__button {
  display: inline-flex;
  justify-content: center;
  padding: 13px 18px;
  color: #f8fafc;
  border: 1px solid rgba(248, 250, 252, 0.22);
  border-radius: 12px;
  font-weight: 850;
  text-decoration: none;
}

.jg-pricing__button--primary {
  color: #061312;
  background: #2dd4bf;
}

@media (max-width: 820px) {
  .jg-pricing__grid {
    grid-template-columns: 1fr;
  }

  .jg-pricing__card--featured {
    transform: translateY(0);
  }
}`,
    javascript: "",
  }),
  template({
    id: "testimonials",
    name: "Testimonials",
    category: "Trust",
    description: "Quote cards with attribution details and a soft editorial rhythm.",
    version: 2,
    builderTarget: "bricks",
    prefix: "jg",
    blockName: "testimonials",
    thumbnail: "testimonials",
    expectedWarnings: ["text-wrap"],
    testedBreakpoints: ["desktop", "tablet", "mobile"],
    html: `<section class="jg-testimonials">
  <div class="jg-testimonials__header">
    <p class="jg-testimonials__eyebrow">Beta feedback</p>
    <h2 class="jg-testimonials__title">Cleaner handoff for builder teams.</h2>
  </div>
  <div class="jg-testimonials__grid">
    <figure class="jg-testimonials__card">
      <blockquote class="jg-testimonials__quote">The pasted structure is finally readable enough to keep editing in Bricks.</blockquote>
      <figcaption class="jg-testimonials__author">Maya, studio owner</figcaption>
    </figure>
    <figure class="jg-testimonials__card">
      <blockquote class="jg-testimonials__quote">Layer labels and native class settings make the export feel like a proper build.</blockquote>
      <figcaption class="jg-testimonials__author">Jon, designer developer</figcaption>
    </figure>
  </div>
</section>`,
    css: `.jg-testimonials {
  padding: 74px 42px;
  color: #0f172a;
  background: #f1f5f9;
}

.jg-testimonials__header {
  max-width: 760px;
  margin: 0 auto 32px;
}

.jg-testimonials__eyebrow {
  margin: 0 0 10px;
  color: #7c3aed;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.jg-testimonials__title {
  margin: 0;
  font-size: 44px;
  line-height: 1.08;
  text-wrap: balance;
}

.jg-testimonials__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  max-width: 980px;
  margin: 0 auto;
}

.jg-testimonials__card {
  margin: 0;
  padding: 28px;
  border: 1px solid #dbe4ef;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.06);
}

.jg-testimonials__quote {
  margin: 0;
  font-size: 22px;
  line-height: 1.45;
}

.jg-testimonials__author {
  margin-top: 20px;
  color: #64748b;
  font-weight: 850;
}

@media (max-width: 820px) {
  .jg-testimonials__grid {
    grid-template-columns: 1fr;
  }
}`,
    javascript: "",
  }),
  template({
    id: "cta",
    name: "CTA",
    category: "Conversion",
    description: "Focused copy/paste call-to-action band.",
    version: 2,
    builderTarget: "bricks",
    prefix: "jg",
    blockName: "cta",
    thumbnail: "cta",
    expectedWarnings: ["animation", "keyframes"],
    testedBreakpoints: ["desktop", "tablet", "mobile"],
    html: `<section class="jg-cta">
  <div class="jg-cta__panel">
    <p class="jg-cta__eyebrow">Ready to paste</p>
    <h2 class="jg-cta__title">Copy a Bricks-ready structure in one step.</h2>
    <p class="jg-cta__text">Keep native Bricks classes as the default and use advanced modes only when the build needs them.</p>
    <a class="jg-cta__button" href="#copy">Copy Bricks Structure</a>
  </div>
</section>`,
    css: `.jg-cta {
  padding: 66px 32px;
  color: #f8fafc;
  background: #050714;
}

.jg-cta__panel {
  max-width: 980px;
  margin: 0 auto;
  padding: 48px;
  text-align: center;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.24), rgba(45, 212, 191, 0.12));
}

.jg-cta__eyebrow {
  margin: 0 0 12px;
  color: #2dd4bf;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.jg-cta__title {
  max-width: 720px;
  margin: 0 auto;
  font-size: 44px;
  line-height: 1.08;
}

.jg-cta__text {
  max-width: 620px;
  margin: 18px auto 0;
  color: #cbd5e1;
  line-height: 1.6;
}

.jg-cta__button {
  display: inline-flex;
  justify-content: center;
  margin-top: 28px;
  padding: 14px 22px;
  color: #111827;
  border-radius: 12px;
  background: #ffffff;
  font-weight: 900;
  text-decoration: none;
  animation: jgCtaPulse 6s ease-in-out infinite;
}

@keyframes jgCtaPulse {
  0%, 100% {
    box-shadow: 0 0 0 rgba(45, 212, 191, 0);
  }
  50% {
    box-shadow: 0 0 36px rgba(45, 212, 191, 0.22);
  }
}

@media (max-width: 820px) {
  .jg-cta__panel {
    padding: 34px 22px;
  }

  .jg-cta__title {
    font-size: 34px;
  }
}`,
    javascript: "",
  }),
];

export function getTemplateByKey(templateKey: string) {
  return templates.find((template) => template.key === templateKey || template.id === templateKey) ??
    null;
}
