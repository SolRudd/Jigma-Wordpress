import type { JigmaTemplateSource } from "./types.ts";

export const jigmaHeroTemplate: JigmaTemplateSource = {
  id: "jigma-hero",
  name: "Jigma Hero",
  category: "Landing",
  description: "Polished Jigma conversion hero with rotating headline and product visual.",
  version: 3,
  builderTarget: "bricks",
  prefix: "jigma",
  blockName: "hero",
  thumbnail: "hero",
  expectedWarnings: ["keyframes", "mask", "backdrop-filter"],
  testedBreakpoints: ["1440", "1280", "1080", "940", "768", "560", "390"],
  html: `<section class="jigma-hero" aria-labelledby="jigma-hero-title">
  <div class="jigma-hero__overlay" aria-hidden="true"></div>
  <div class="jigma-hero__inner">
    <div class="jigma-hero__grid">
      <div class="jigma-hero__content">
        <p class="jigma-hero__eyebrow">
          <span class="jigma-hero__eyebrow-dot"></span>
          Code to Bricks
        </p>
        <h1 class="jigma-hero__title" id="jigma-hero-title">
          <span class="jigma-hero__title-line">Turn clean code</span>
          <span class="jigma-hero__title-line">into <span class="jigma-hero__grad">editable Bricks</span></span>
          <span class="jigma-hero__title-line">
            <span class="jigma-hero__rotator" aria-label="sections layouts templates">
              <span class="jigma-hero__rotator-list">
                <span class="jigma-hero__rotator-item">sections.</span>
                <span class="jigma-hero__rotator-item">layouts.</span>
                <span class="jigma-hero__rotator-item">templates.</span>
              </span>
            </span>
          </span>
        </h1>
        <p class="jigma-hero__lead">Paste HTML and CSS. Jigma maps the structure, cleans the classes, and gives you a Bricks-ready section you can actually use.</p>
        <div class="jigma-hero__actions">
          <a class="jigma-hero__btn jigma-hero__btn--primary" href="#convert">Start converting</a>
          <a class="jigma-hero__btn jigma-hero__btn--ghost" href="#example">View live preview</a>
        </div>
        <div class="jigma-hero__stats" aria-label="Jigma conversion metrics">
          <div class="jigma-hero__stat">
            <svg class="jigma-hero__stat-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3l2.4 5.6 6.1.5-4.6 4 1.4 5.9L12 15.8 6.7 19l1.4-5.9-4.6-4 6.1-.5L12 3z" fill="currentColor"></path>
            </svg>
            <strong class="jigma-hero__stat-num">98%</strong>
            <span class="jigma-hero__stat-label">Layer match</span>
          </div>
          <div class="jigma-hero__stat">
            <svg class="jigma-hero__stat-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13 2 4 14h7l-1 8 10-13h-7l0-7z" fill="currentColor"></path>
            </svg>
            <strong class="jigma-hero__stat-num">2.4x</strong>
            <span class="jigma-hero__stat-label">Faster setup</span>
          </div>
          <div class="jigma-hero__stat">
            <svg class="jigma-hero__stat-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 4h14v4H5V4zm0 6h14v4H5v-4zm0 6h14v4H5v-4z" fill="currentColor"></path>
            </svg>
            <strong class="jigma-hero__stat-num">0</strong>
            <span class="jigma-hero__stat-label">Loose selectors</span>
          </div>
        </div>
      </div>
      <div class="jigma-hero__visual" aria-label="Jigma product preview">
        <div class="jigma-hero__visual-glow"></div>
        <article class="jigma-hero__card jigma-hero__input-card">
          <span class="jigma-hero__card-kicker">Input</span>
          <code class="jigma-hero__code">&lt;section class="hero"&gt;</code>
          <code class="jigma-hero__code">.hero__title { clamp(...) }</code>
          <code class="jigma-hero__code">button--primary</code>
        </article>
        <article class="jigma-hero__card jigma-hero__output-card">
          <span class="jigma-hero__card-kicker">Bricks structure</span>
          <div class="jigma-hero__tree-row">Hero Section</div>
          <div class="jigma-hero__tree-row">Hero Content</div>
          <div class="jigma-hero__tree-row">Hero Button Primary</div>
        </article>
        <article class="jigma-hero__card jigma-hero__inspector-card">
          <span class="jigma-hero__card-kicker">Native class</span>
          <strong class="jigma-hero__class-name">jigma-hero__title</strong>
          <span class="jigma-hero__class-chip">Typography</span>
          <span class="jigma-hero__class-chip">Spacing</span>
          <span class="jigma-hero__class-chip">Fallback CSS</span>
        </article>
        <span class="jigma-hero__spark jigma-hero__spark--one"></span>
        <span class="jigma-hero__spark jigma-hero__spark--two"></span>
      </div>
    </div>
  </div>
</section>`,
  css: `.jigma-hero {
  --jigma-bg: #06060d;
  --jigma-bg-2: #0a0a18;
  --jigma-panel: #0e0e1f;
  --jigma-panel-2: #12122a;
  --jigma-surface: #15152e;
  --jigma-text: #eef0fb;
  --jigma-text-soft: #aab0d4;
  --jigma-text-dim: #6e74a0;
  --jigma-violet: #8b55d9;
  --jigma-violet-bright: #a96bff;
  --jigma-purple: #6b46e5;
  --jigma-blue: #4368b7;
  --jigma-blue-bright: #4f8cff;
  --jigma-teal: #34e0d0;
  position: relative;
  overflow: hidden;
  min-height: 760px;
  padding: 96px 28px;
  color: var(--jigma-text);
  background: radial-gradient(circle at 78% 20%, rgba(139, 85, 217, 0.42), transparent 32%), radial-gradient(circle at 18% 86%, rgba(52, 224, 208, 0.16), transparent 28%), linear-gradient(180deg, var(--jigma-bg), var(--jigma-bg-2));
}

.jigma-hero__overlay {
  position: absolute;
  inset: 0;
  opacity: 0.2;
  background-image: linear-gradient(rgba(238, 240, 251, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(238, 240, 251, 0.07) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: linear-gradient(to bottom, black, transparent 86%);
}

.jigma-hero__inner {
  position: relative;
  z-index: 1;
  max-width: 1180px;
  margin: 0 auto;
}

.jigma-hero__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.82fr);
  gap: 54px;
  align-items: center;
}

.jigma-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 18px;
  color: var(--jigma-teal);
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.jigma-hero__eyebrow-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 28px currentColor;
}

.jigma-hero__title {
  max-width: 880px;
  margin: 0;
  font-size: clamp(52px, 7vw, 92px);
  font-weight: 950;
  line-height: 0.95;
  letter-spacing: -0.055em;
}

.jigma-hero__title-line {
  display: block;
}

.jigma-hero__rotator {
  display: inline-grid;
  height: 0.95em;
  overflow: hidden;
  vertical-align: -0.08em;
}

.jigma-hero__rotator-list {
  display: grid;
  animation: jh-rotate 7.5s infinite;
}

.jigma-hero__rotator-item {
  display: block;
  color: var(--jigma-teal);
}

.jigma-hero__grad {
  background: linear-gradient(135deg, var(--jigma-violet-bright), var(--jigma-blue-bright), var(--jigma-teal));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.jigma-hero__lead {
  max-width: 680px;
  margin: 26px 0 0;
  color: var(--jigma-text-soft);
  font-size: 19px;
  line-height: 1.7;
}

.jigma-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 34px;
}

.jigma-hero__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 22px;
  border-radius: 14px;
  font-weight: 860;
  text-decoration: none;
}

.jigma-hero__btn--primary {
  color: #ffffff;
  background: linear-gradient(135deg, var(--jigma-violet-bright), var(--jigma-blue-bright));
  box-shadow: 0 20px 48px rgba(79, 140, 255, 0.24);
}

.jigma-hero__btn--ghost {
  color: var(--jigma-text);
  border: 1px solid rgba(170, 176, 212, 0.2);
  background: rgba(255, 255, 255, 0.04);
}

.jigma-hero__btn:hover {
  transform: translateY(-2px);
}

.jigma-hero__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  max-width: 760px;
  margin-top: 58px;
}

.jigma-hero__stat {
  padding: 18px;
  border: 1px solid rgba(170, 176, 212, 0.14);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.045);
  backdrop-filter: blur(18px);
}

.jigma-hero__stat-icon-svg {
  width: 22px;
  height: 22px;
  color: var(--jigma-teal);
}

.jigma-hero__stat-num {
  display: block;
  margin-top: 10px;
  font-size: 32px;
  line-height: 1;
}

.jigma-hero__stat-label {
  display: block;
  margin-top: 6px;
  color: var(--jigma-text-dim);
  font-size: 14px;
}

.jigma-hero__visual {
  position: relative;
  min-height: 560px;
}

.jigma-hero__visual-glow {
  position: absolute;
  inset: 8% 0 0 4%;
  border-radius: 38px;
  background: radial-gradient(circle at 50% 20%, rgba(169, 107, 255, 0.28), transparent 40%), rgba(18, 18, 42, 0.74);
  filter: blur(4px);
}

.jigma-hero__card {
  position: absolute;
  width: min(340px, 86vw);
  padding: 18px;
  border: 1px solid rgba(170, 176, 212, 0.16);
  border-radius: 22px;
  background: rgba(14, 14, 31, 0.82);
  box-shadow: 0 26px 80px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(20px);
}

.jigma-hero__input-card {
  top: 24px;
  left: 0;
  animation: jh-float 8s ease-in-out infinite;
}

.jigma-hero__output-card {
  top: 190px;
  right: 0;
  animation: jh-float2 9s ease-in-out infinite;
}

.jigma-hero__inspector-card {
  bottom: 18px;
  left: 38px;
  animation: jh-float 10s ease-in-out infinite;
}

.jigma-hero__card-kicker {
  display: block;
  margin-bottom: 12px;
  color: var(--jigma-teal);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.jigma-hero__code,
.jigma-hero__tree-row,
.jigma-hero__class-chip {
  display: block;
  margin-top: 8px;
  padding: 9px 10px;
  border-radius: 10px;
  color: var(--jigma-text-soft);
  background: rgba(255, 255, 255, 0.055);
}

.jigma-hero__class-name {
  display: block;
  color: var(--jigma-text);
  font-size: 18px;
}

.jigma-hero__spark {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--jigma-teal);
  box-shadow: 0 0 34px var(--jigma-teal);
  animation: jh-pulse 2.8s ease-in-out infinite;
}

.jigma-hero__spark--one {
  top: 110px;
  right: 42px;
}

.jigma-hero__spark--two {
  bottom: 124px;
  left: 12px;
}

@keyframes jh-rotate {
  0%, 28% { transform: translateY(0); }
  34%, 62% { transform: translateY(-33.333%); }
  68%, 94% { transform: translateY(-66.666%); }
  100% { transform: translateY(0); }
}

@keyframes jh-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}

@keyframes jh-float2 {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(12px); }
}

@keyframes jh-pulse {
  0%, 100% { opacity: 0.45; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.35); }
}

@media (max-width: 940px) {
  .jigma-hero {
    padding: 70px 20px;
  }

  .jigma-hero__grid {
    grid-template-columns: 1fr;
  }

  .jigma-hero__visual {
    min-height: 500px;
  }
}

@media (max-width: 560px) {
  .jigma-hero__title {
    font-size: clamp(42px, 13vw, 62px);
  }

  .jigma-hero__actions,
  .jigma-hero__stats {
    grid-template-columns: 1fr;
  }

  .jigma-hero__btn {
    width: 100%;
  }

  .jigma-hero__card {
    position: relative;
    inset: auto;
    width: 100%;
    margin-top: 14px;
  }

  .jigma-hero__visual {
    min-height: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .jigma-hero__rotator {
    height: auto;
  }

  .jigma-hero__rotator-list {
    animation: none;
  }

  .jigma-hero__rotator-item:not(:first-child) {
    display: none;
  }

  .jigma-hero__input-card,
  .jigma-hero__output-card,
  .jigma-hero__inspector-card,
  .jigma-hero__spark {
    animation: none;
  }
}`,
  javascript: "",
};
