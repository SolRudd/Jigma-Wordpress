import type { JigmaTemplateSource } from "./types.ts";

export const jigmaProofTemplate: JigmaTemplateSource = {
  id: "jigma-proof",
  name: "Jigma Proof Bar",
  category: "Trust",
  description: "Compact Jigma proof metrics with inline SVG icons.",
  version: 1,
  builderTarget: "bricks",
  prefix: "jigma",
  blockName: "proof",
  thumbnail: "proof-bar",
  expectedWarnings: ["backdrop-filter"],
  testedBreakpoints: ["1440", "1280", "1080", "940", "768", "560", "390"],
  html: `<section class="jigma-proof" aria-labelledby="jigma-proof-title">
  <div class="jigma-proof__inner">
    <div class="jigma-proof__intro">
      <p class="jigma-proof__eyebrow">Conversion confidence</p>
      <h2 class="jigma-proof__title" id="jigma-proof-title">Builder-ready output without loose selectors.</h2>
    </div>
    <div class="jigma-proof__metrics">
      <article class="jigma-proof__metric">
        <svg class="jigma-proof__icon-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l2.4 5.4 5.8.5-4.4 3.8 1.3 5.7L12 15.4l-5.1 3 1.3-5.7-4.4-3.8 5.8-.5L12 3z" fill="currentColor"></path>
        </svg>
        <strong class="jigma-proof__value">98%</strong>
        <span class="jigma-proof__label">Layer match</span>
      </article>
      <article class="jigma-proof__metric">
        <svg class="jigma-proof__icon-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 2 4 14h7l-1 8 10-13h-7V2z" fill="currentColor"></path>
        </svg>
        <strong class="jigma-proof__value">2.4x</strong>
        <span class="jigma-proof__label">Faster setup</span>
      </article>
      <article class="jigma-proof__metric">
        <svg class="jigma-proof__icon-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 5h14v3H5V5zm0 5h14v3H5v-3zm0 5h14v4H5v-4z" fill="currentColor"></path>
        </svg>
        <strong class="jigma-proof__value">0</strong>
        <span class="jigma-proof__label">Loose selectors</span>
      </article>
      <article class="jigma-proof__metric">
        <svg class="jigma-proof__icon-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16v4H4V6zm2 6h12v6H6v-6z" fill="currentColor"></path>
        </svg>
        <strong class="jigma-proof__value">Native</strong>
        <span class="jigma-proof__label">Bricks classes</span>
      </article>
    </div>
    <p class="jigma-proof__note">Generated labels, class IDs, and fallback CSS stay attached to readable BEM classes.</p>
  </div>
</section>`,
  css: `.jigma-proof {
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
  padding: 34px 22px;
  color: var(--jigma-text);
  background: linear-gradient(180deg, var(--jigma-bg), var(--jigma-bg-2));
}

.jigma-proof__inner {
  display: grid;
  grid-template-columns: minmax(220px, 0.68fr) minmax(0, 1.32fr);
  gap: 22px;
  align-items: center;
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px;
  border: 1px solid rgba(170, 176, 212, 0.14);
  border-radius: 26px;
  background: rgba(14, 14, 31, 0.72);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(18px);
}

.jigma-proof__eyebrow {
  margin: 0 0 8px;
  color: var(--jigma-teal);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.jigma-proof__title {
  margin: 0;
  font-size: clamp(28px, 3vw, 42px);
  font-weight: 900;
  line-height: 1.05;
}

.jigma-proof__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.jigma-proof__metric {
  padding: 16px;
  border: 1px solid rgba(170, 176, 212, 0.14);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.045);
}

.jigma-proof__metric:hover {
  transform: translateY(-3px);
  border-color: rgba(52, 224, 208, 0.35);
}

.jigma-proof__icon-svg {
  width: 23px;
  height: 23px;
  color: var(--jigma-teal);
}

.jigma-proof__value {
  display: block;
  margin-top: 12px;
  font-size: 28px;
  line-height: 1;
}

.jigma-proof__label {
  display: block;
  margin-top: 6px;
  color: var(--jigma-text-dim);
  font-size: 13px;
}

.jigma-proof__note {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--jigma-text-soft);
  font-size: 14px;
}

@media (max-width: 940px) {
  .jigma-proof__inner {
    grid-template-columns: 1fr;
  }

  .jigma-proof__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .jigma-proof__metrics {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .jigma-proof__metric:hover {
    transform: none;
  }
}`,
  javascript: "",
};

