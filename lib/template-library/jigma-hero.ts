import type { JigmaTemplateSource } from "./types.ts";

export const jigmaHeroTemplate: JigmaTemplateSource = {
  id: "jigma-hero",
  name: "Jigma Hero",
  category: "Landing",
  description: "Clean native Jigma hero with a compact product mockup.",
  version: 4,
  builderTarget: "bricks",
  prefix: "jigma",
  blockName: "hero",
  thumbnail: "hero",
  expectedWarnings: ["svg-signature"],
  testedBreakpoints: ["1440", "1280", "1080", "940", "768", "560", "390"],
  html: `<section class="jigma-hero" aria-labelledby="jigma-hero-title">
  <div class="jigma-hero__overlay" aria-hidden="true"></div>
  <div class="jigma-hero__inner">
    <div class="jigma-hero__grid">
      <div class="jigma-hero__content">
        <p class="jigma-hero__eyebrow">Code to Bricks</p>
        <h1 class="jigma-hero__title" id="jigma-hero-title">Turn clean code into editable Bricks sections.</h1>
        <p class="jigma-hero__lead">Paste HTML and CSS. Jigma maps the structure, cleans the classes, and gives you a Bricks-ready section you can actually use.</p>
        <div class="jigma-hero__actions">
          <a class="jigma-hero__button jigma-hero__button--primary" href="#convert">Start converting</a>
          <a class="jigma-hero__button jigma-hero__button--secondary" href="#preview">View live preview</a>
        </div>
        <div class="jigma-hero__metrics" aria-label="Jigma conversion metrics">
          <article class="jigma-hero__metric">
            <strong class="jigma-hero__metric-value">98%</strong>
            <span class="jigma-hero__metric-label">Layer match</span>
          </article>
          <article class="jigma-hero__metric">
            <strong class="jigma-hero__metric-value">2.4x</strong>
            <span class="jigma-hero__metric-label">Faster setup</span>
          </article>
          <article class="jigma-hero__metric">
            <strong class="jigma-hero__metric-value">0</strong>
            <span class="jigma-hero__metric-label">Loose selectors</span>
          </article>
        </div>
      </div>
      <div class="jigma-hero__visual" aria-label="Jigma product preview">
        <svg class="jigma-hero__mockup-svg" viewBox="0 0 620 500" role="img" aria-label="Jigma conversion preview">
          <defs>
            <linearGradient id="jigma-hero-panel" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stop-color="#15152e"></stop>
              <stop offset="1" stop-color="#06060d"></stop>
            </linearGradient>
            <linearGradient id="jigma-hero-accent" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stop-color="#a96bff"></stop>
              <stop offset="1" stop-color="#4f8cff"></stop>
            </linearGradient>
          </defs>
          <rect x="26" y="42" width="240" height="330" rx="24" fill="url(#jigma-hero-panel)" stroke="#6e74a0" stroke-opacity=".38"></rect>
          <rect x="46" y="70" width="68" height="24" rx="8" fill="url(#jigma-hero-accent)"></rect>
          <rect x="46" y="122" width="180" height="10" rx="5" fill="#34e0d0" opacity=".88"></rect>
          <rect x="46" y="150" width="128" height="10" rx="5" fill="#aab0d4" opacity=".68"></rect>
          <rect x="46" y="178" width="164" height="10" rx="5" fill="#aab0d4" opacity=".48"></rect>
          <rect x="334" y="52" width="240" height="330" rx="24" fill="url(#jigma-hero-panel)" stroke="#6e74a0" stroke-opacity=".38"></rect>
          <rect x="360" y="84" width="38" height="38" rx="10" fill="#f7d348"></rect>
          <rect x="414" y="86" width="116" height="12" rx="6" fill="#eef0fb" opacity=".9"></rect>
          <rect x="414" y="112" width="78" height="10" rx="5" fill="#aab0d4" opacity=".58"></rect>
          <path d="M360 168h156M380 204h136M400 240h116M420 276h96" stroke="#aab0d4" stroke-opacity=".56" stroke-width="10" stroke-linecap="round"></path>
          <path d="M274 206 C304 206 306 206 326 206" stroke="#8b55d9" stroke-width="3" stroke-dasharray="8 10"></path>
          <circle cx="300" cy="206" r="46" fill="#12122a" stroke="#a96bff" stroke-opacity=".52"></circle>
          <path d="M300 172l12 26 28 3-21 18 6 28-25-14-25 14 6-28-21-18 28-3 12-26z" fill="url(#jigma-hero-accent)"></path>
          <rect x="188" y="404" width="244" height="54" rx="16" fill="#0e0e1f" stroke="#34e0d0" stroke-opacity=".35"></rect>
          <text x="310" y="438" text-anchor="middle" fill="#eef0fb" font-size="18" font-family="Arial, sans-serif" font-weight="700">Ready to copy</text>
        </svg>
      </div>
    </div>
  </div>
</section>`,
  css: `.jigma-hero {
  --jigma-bg: #06060d;
  --jigma-bg-2: #0a0a18;
  --jigma-panel: #0e0e1f;
  --jigma-text: #eef0fb;
  --jigma-text-soft: #aab0d4;
  --jigma-text-dim: #6e74a0;
  --jigma-violet: #8b55d9;
  --jigma-violet-bright: #a96bff;
  --jigma-blue-bright: #4f8cff;
  --jigma-teal: #34e0d0;
  position: relative;
  overflow: hidden;
  min-height: 760px;
  padding: clamp(70px, 8vw, 116px) clamp(22px, 4vw, 54px);
  color: var(--jigma-text);
  background: radial-gradient(circle at 78% 18%, rgba(139, 85, 217, 0.34), transparent 34%), linear-gradient(180deg, var(--jigma-bg-2), var(--jigma-bg));
}

.jigma-hero__overlay {
  position: absolute;
  inset: 0;
  opacity: 0.22;
  background-image: linear-gradient(rgba(238, 240, 251, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(238, 240, 251, 0.07) 1px, transparent 1px);
  background-size: 52px 52px;
  mask-image: radial-gradient(circle at 62% 32%, black, transparent 76%);
}

.jigma-hero__inner {
  position: relative;
  z-index: 1;
  max-width: 1500px;
  margin: 0 auto;
}

.jigma-hero__grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(380px, 0.86fr);
  gap: clamp(40px, 6vw, 82px);
  align-items: center;
}

.jigma-hero__content {
  max-width: 700px;
}

.jigma-hero__eyebrow {
  margin: 0 0 28px;
  color: var(--jigma-teal);
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.jigma-hero__title {
  max-width: 760px;
  margin: 0;
  color: #ffffff;
  font-size: clamp(58px, 6.8vw, 94px);
  font-weight: 950;
  line-height: 0.98;
  letter-spacing: -0.055em;
}

.jigma-hero__lead {
  max-width: 670px;
  margin: 28px 0 0;
  color: var(--jigma-text-soft);
  font-size: 21px;
  line-height: 1.56;
}

.jigma-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 36px;
}

.jigma-hero__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 58px;
  padding: 0 28px;
  border-radius: 14px;
  font-size: 17px;
  font-weight: 850;
  text-decoration: none;
}

.jigma-hero__button--primary {
  color: #ffffff;
  background: linear-gradient(135deg, var(--jigma-violet-bright), var(--jigma-blue-bright));
  box-shadow: 0 20px 48px rgba(79, 140, 255, 0.26);
}

.jigma-hero__button--secondary {
  color: var(--jigma-text);
  border: 1px solid rgba(170, 176, 212, 0.22);
  background: rgba(255, 255, 255, 0.035);
}

.jigma-hero__button:hover {
  transform: translateY(-2px);
}

.jigma-hero__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  max-width: 650px;
  margin-top: 64px;
}

.jigma-hero__metric {
  padding: 22px;
  border: 1px solid rgba(170, 176, 212, 0.16);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
}

.jigma-hero__metric-value {
  display: block;
  color: var(--jigma-violet-bright);
  font-size: clamp(34px, 4vw, 52px);
  font-weight: 950;
  line-height: 1;
}

.jigma-hero__metric-label {
  display: block;
  margin-top: 10px;
  color: var(--jigma-text-soft);
  font-size: 16px;
}

.jigma-hero__visual {
  position: relative;
}

.jigma-hero__mockup-svg {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 32px 70px rgba(79, 140, 255, 0.18));
}

@media (max-width: 940px) {
  .jigma-hero__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .jigma-hero__title {
    font-size: clamp(44px, 13vw, 64px);
  }

  .jigma-hero__actions,
  .jigma-hero__metrics {
    grid-template-columns: 1fr;
  }

  .jigma-hero__button {
    width: 100%;
  }
}`,
  javascript: "",
};
