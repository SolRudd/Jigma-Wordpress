import type { JigmaTemplateSource } from "../template-library/types.ts";

export const jigmaHeroTemplate: JigmaTemplateSource = {
  id: "jigma-hero",
  name: "Jigma Hero",
  category: "Landing",
  description: "Canonical Jigma Hero based on the supplied v2 visual source.",
  version: 6,
  builderTarget: "bricks",
  prefix: "jigma",
  blockName: "hero",
  thumbnail: "hero",
  expectedWarnings: ["svg-signature"],
  testedBreakpoints: ["1440", "1280", "1024", "768", "390"],
  html: `<section class="jigma-hero" aria-labelledby="jigma-hero-title">
  <div class="jigma-hero__inner">
    <div class="jigma-hero__grid">
      <div class="jigma-hero__content">
        <span class="jigma-hero__eyebrow">Code to Bricks</span>
        <h1 class="jigma-hero__title" id="jigma-hero-title">Turn clean code into <span class="jigma-hero__grad">editable Bricks</span> sections.</h1>
        <p class="jigma-hero__lead">Paste HTML and CSS. Jigma maps the structure, cleans the classes, and gives you a Bricks-ready section you can actually use.</p>
        <div class="jigma-hero__actions">
          <a class="jigma-hero__btn jigma-hero__btn--primary" href="#convert">Start converting</a>
          <a class="jigma-hero__btn jigma-hero__btn--ghost" href="#preview">View live preview</a>
        </div>
        <div class="jigma-hero__stats" aria-label="Jigma conversion metrics">
          <article class="jigma-hero__stat">
            <strong class="jigma-hero__stat-num">98%</strong>
            <span class="jigma-hero__stat-label">Layer match</span>
          </article>
          <article class="jigma-hero__stat">
            <strong class="jigma-hero__stat-num">2.4x</strong>
            <span class="jigma-hero__stat-label">Faster setup</span>
          </article>
          <article class="jigma-hero__stat">
            <strong class="jigma-hero__stat-num">0</strong>
            <span class="jigma-hero__stat-label">Loose selectors</span>
          </article>
        </div>
      </div>
      <div class="jigma-hero__visual" aria-label="Jigma product preview">
        <svg class="jigma-hero__visual-svg" viewBox="0 0 760 560" role="img" aria-label="HTML to Bricks conversion preview">
          <defs>
            <linearGradient id="jh-panel" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="#14142b"></stop>
              <stop offset="1" stop-color="#07070f"></stop>
            </linearGradient>
            <linearGradient id="jh-accent" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stop-color="#a96bff"></stop>
              <stop offset="1" stop-color="#5b7dff"></stop>
            </linearGradient>
            <radialGradient id="jh-core" cx=".5" cy=".48" r=".58">
              <stop offset="0" stop-color="#d65bff" stop-opacity=".88"></stop>
              <stop offset=".45" stop-color="#8b55d9" stop-opacity=".38"></stop>
              <stop offset="1" stop-color="#04040a" stop-opacity="0"></stop>
            </radialGradient>
          </defs>
          <path d="M84 270 C150 270 154 244 206 244M84 314 C150 314 160 356 206 390M554 244 C606 244 610 270 676 270M554 390 C606 390 610 314 676 314" fill="none" stroke="url(#jh-accent)" stroke-width="2" stroke-dasharray="7 9" opacity=".72"></path>
          <rect x="30" y="86" width="250" height="362" rx="22" fill="url(#jh-panel)" stroke="#ffffff" stroke-opacity=".16"></rect>
          <rect x="30" y="86" width="250" height="58" rx="22" fill="#111126" stroke="#ffffff" stroke-opacity=".08"></rect>
          <rect x="58" y="111" width="32" height="32" rx="8" fill="url(#jh-accent)"></rect>
          <text x="106" y="132" fill="#f0f1fb" font-size="15" font-weight="700">HTML + CSS</text>
          <text x="62" y="184" fill="#696f9c" font-size="13" font-family="monospace">1</text>
          <text x="86" y="184" fill="#5b7dff" font-size="13" font-family="monospace">&lt;section class="hero"&gt;</text>
          <text x="62" y="214" fill="#696f9c" font-size="13" font-family="monospace">2</text>
          <text x="86" y="214" fill="#34e0d0" font-size="13" font-family="monospace">  &lt;h1 class="title"&gt;</text>
          <text x="62" y="244" fill="#696f9c" font-size="13" font-family="monospace">3</text>
          <text x="86" y="244" fill="#aeb4d6" font-size="13" font-family="monospace">    Build clean code</text>
          <text x="62" y="274" fill="#696f9c" font-size="13" font-family="monospace">4</text>
          <text x="86" y="274" fill="#34e0d0" font-size="13" font-family="monospace">  &lt;/h1&gt;</text>
          <text x="62" y="324" fill="#696f9c" font-size="13" font-family="monospace">/* CSS */</text>
          <text x="86" y="356" fill="#a96bff" font-size="13" font-family="monospace">.hero { padding: 80px; }</text>
          <text x="86" y="386" fill="#a96bff" font-size="13" font-family="monospace">.title { font-size: 48px; }</text>
          <circle cx="380" cy="280" r="136" fill="url(#jh-core)"></circle>
          <rect x="292" y="190" width="176" height="176" rx="34" fill="#101022" stroke="#a96bff" stroke-opacity=".42"></rect>
          <path d="M380 232l20 42 46 7-33 32 8 45-41-22-41 22 8-45-33-32 46-7 20-42z" fill="url(#jh-accent)"></path>
          <text x="380" y="412" text-anchor="middle" fill="#f0f1fb" font-size="32" font-weight="800">Jigma</text>
          <text x="380" y="448" text-anchor="middle" fill="#34e0d0" font-size="14" font-weight="800" letter-spacing="8">CONVERT</text>
          <rect x="506" y="86" width="224" height="362" rx="22" fill="url(#jh-panel)" stroke="#ffffff" stroke-opacity=".16"></rect>
          <rect x="506" y="86" width="224" height="58" rx="22" fill="#111126" stroke="#ffffff" stroke-opacity=".08"></rect>
          <rect x="534" y="110" width="30" height="30" rx="7" fill="#f4d338"></rect>
          <text x="578" y="132" fill="#f0f1fb" font-size="15" font-weight="700">Bricks structure</text>
          <text x="536" y="184" fill="#f0f1fb" font-size="14">Section (hero)</text>
          <text x="556" y="218" fill="#aeb4d6" font-size="14">Container</text>
          <text x="576" y="252" fill="#aeb4d6" font-size="14">Heading (h1)</text>
          <text x="596" y="286" fill="#696f9c" font-size="14">Build faster</text>
          <text x="576" y="336" fill="#aeb4d6" font-size="14">Buttons</text>
          <text x="596" y="370" fill="#696f9c" font-size="14">Primary</text>
          <text x="596" y="404" fill="#696f9c" font-size="14">Secondary</text>
          <rect x="504" y="472" width="178" height="46" rx="16" fill="#101022" stroke="#34e0d0" stroke-opacity=".38"></rect>
          <text x="593" y="501" text-anchor="middle" fill="#f0f1fb" font-size="15" font-weight="700">Ready to copy</text>
        </svg>
      </div>
    </div>
  </div>
</section>`,
  css: `.jigma-hero {
  --jh-bg: #04040a;
  --jh-bg-2: #07070f;
  --jh-line: rgba(255,255,255,0.07);
  --jh-line-strong: rgba(255,255,255,0.13);
  --jh-text: #f0f1fb;
  --jh-text-soft: #aeb4d6;
  --jh-violet: #8b55d9;
  --jh-violet-bright: #a96bff;
  --jh-magenta: #d65bff;
  --jh-blue: #4368b7;
  --jh-blue-bright: #5b7dff;
  --jh-teal: #34e0d0;
  --jh-grad-cta: linear-gradient(135deg, #8b55d9 0%, #6b46e5 55%, #5b7dff 100%);
  --jh-grad-text: linear-gradient(100deg, #6b6bff 0%, #a96bff 45%, #d65bff 100%);
  --jh-r-md: 14px;
  --jh-ease: cubic-bezier(.22,.61,.36,1);
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: radial-gradient(1100px 600px at 70% 40%, rgba(107,70,229,0.16), transparent 60%), radial-gradient(800px 600px at 95% 80%, rgba(67,104,183,0.14), transparent 64%), radial-gradient(700px 500px at 50% 55%, rgba(168,107,255,0.10), transparent 62%), linear-gradient(180deg, var(--jh-bg-2) 0%, var(--jh-bg) 100%);
  color: var(--jh-text);
  font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.jigma-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: linear-gradient(to right, rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.022) 1px, transparent 1px);
  background-size: 58px 58px;
  mask-image: radial-gradient(circle at 62% 46%, #000 0%, transparent 80%);
  -webkit-mask-image: radial-gradient(circle at 62% 46%, #000 0%, transparent 80%);
}

.jigma-hero__inner {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 clamp(20px, 4vw, 48px);
}

.jigma-hero__grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.04fr) minmax(0, 0.96fr);
  align-items: center;
  gap: clamp(36px, 4vw, 72px);
  min-height: 710px;
  padding: clamp(56px, 7vw, 92px) 0 clamp(52px, 6vw, 82px);
}

.jigma-hero__content {
  max-width: 600px;
}

.jigma-hero__eyebrow {
  display: inline-block;
  margin-bottom: clamp(20px, 2.6vw, 28px);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--jh-teal);
}

.jigma-hero__title {
  font-size: clamp(2.15rem, 5.6vw, 4.5rem);
  line-height: 1.04;
  font-weight: 800;
  letter-spacing: -0.035em;
  margin: 0 0 clamp(22px, 2.8vw, 30px);
  color: #fff;
}

.jigma-hero__grad {
  background: var(--jh-grad-text);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.jigma-hero__lead {
  font-size: clamp(1.05rem, 1.25vw, 1.2rem);
  line-height: 1.6;
  color: var(--jh-text-soft);
  max-width: 34em;
  margin: 0 0 clamp(28px, 3.4vw, 40px);
}

.jigma-hero__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-bottom: clamp(38px, 4.6vw, 56px);
}

.jigma-hero__btn {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  padding: 16px 28px;
  border-radius: var(--jh-r-md);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-decoration: none;
  cursor: pointer;
  transition: transform .2s var(--jh-ease), box-shadow .2s var(--jh-ease), border-color .2s var(--jh-ease), background .2s var(--jh-ease);
}

.jigma-hero__btn--primary {
  color: #fff;
  background: var(--jh-grad-cta);
  box-shadow: 0 16px 38px -14px rgba(123,77,255,0.75), 0 0 0 1px rgba(255,255,255,0.08) inset;
}

.jigma-hero__btn--ghost {
  color: var(--jh-text);
  background: rgba(255,255,255,0.025);
  border: 1px solid var(--jh-line-strong);
}

.jigma-hero__btn:hover {
  transform: translateY(-2px);
}

.jigma-hero__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  max-width: 560px;
}

.jigma-hero__stat {
  padding: clamp(18px, 2vw, 24px) clamp(16px, 1.6vw, 20px);
  border: 1px solid var(--jh-line);
  border-radius: var(--jh-r-md);
  background: linear-gradient(180deg, rgba(18,18,38,0.6), rgba(8,8,20,0.35));
  text-align: center;
  transition: border-color .25s var(--jh-ease), transform .25s var(--jh-ease);
}

.jigma-hero__stat:hover {
  border-color: rgba(168,107,255,0.4);
  transform: translateY(-3px);
}

.jigma-hero__stat-num {
  display: block;
  font-size: clamp(1.8rem, 2.8vw, 2.3rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  background: var(--jh-grad-text);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.jigma-hero__stat-label {
  display: block;
  margin-top: 9px;
  font-size: 14px;
  font-weight: 500;
  color: var(--jh-text-soft);
}

.jigma-hero__visual {
  position: relative;
  min-width: 0;
}

.jigma-hero__visual-svg {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 32px 70px rgba(91,125,255,0.20));
}

@media (max-width: 1040px) {
  .jigma-hero__grid {
    grid-template-columns: 1fr;
    gap: clamp(44px, 8vw, 72px);
  }

  .jigma-hero__content {
    max-width: 660px;
  }
}

@media (max-width: 560px) {
  .jigma-hero__stats {
    grid-template-columns: 1fr;
    max-width: 380px;
  }

  .jigma-hero__btn {
    width: 100%;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .jigma-hero__btn,
  .jigma-hero__stat {
    transition: none;
  }
}`,
  javascript: "",
};
