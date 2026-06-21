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
        <svg class="jigma-hero__visual-svg" viewBox="0 0 860 620" role="img" aria-label="Jigma HTML to Bricks conversion preview">
          <defs>
            <linearGradient id="jh-panel" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="#15152f"></stop>
              <stop offset="1" stop-color="#070712"></stop>
            </linearGradient>
            <linearGradient id="jh-accent" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stop-color="#a96bff"></stop>
              <stop offset=".58" stop-color="#6b46e5"></stop>
              <stop offset="1" stop-color="#5b7dff"></stop>
            </linearGradient>
            <linearGradient id="jh-text-grad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stop-color="#6b6bff"></stop>
              <stop offset=".5" stop-color="#a96bff"></stop>
              <stop offset="1" stop-color="#d65bff"></stop>
            </linearGradient>
            <radialGradient id="jh-core" cx=".5" cy=".48" r=".58">
              <stop offset="0" stop-color="#d65bff" stop-opacity=".92"></stop>
              <stop offset=".46" stop-color="#8b55d9" stop-opacity=".38"></stop>
              <stop offset="1" stop-color="#04040a" stop-opacity="0"></stop>
            </radialGradient>
            <filter id="jh-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="18" result="blur"></feGaussianBlur>
              <feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>
            </filter>
          </defs>
          <rect x="0" y="0" width="860" height="620" fill="transparent"></rect>
          <path d="M62 356 C122 356 142 308 204 308M62 398 C136 398 152 468 238 468M622 308 C708 308 724 356 798 356M622 398 C696 398 720 468 802 468" fill="none" stroke="url(#jh-accent)" stroke-width="2" stroke-dasharray="8 10" opacity=".72"></path>
          <circle cx="430" cy="346" r="190" fill="url(#jh-core)" filter="url(#jh-glow)" opacity=".9"></circle>

          <g aria-label="HTML and CSS source card">
            <rect x="34" y="98" width="276" height="392" rx="24" fill="url(#jh-panel)" stroke="#ffffff" stroke-opacity=".18"></rect>
            <rect x="34" y="98" width="276" height="62" rx="24" fill="#111126" stroke="#ffffff" stroke-opacity=".08"></rect>
            <rect x="60" y="122" width="34" height="34" rx="8" fill="url(#jh-accent)"></rect>
            <text x="108" y="145" fill="#f0f1fb" font-size="16" font-weight="700">HTML + CSS</text>
            <text x="64" y="198" fill="#696f9c" font-size="13" font-family="monospace">1</text>
            <text x="88" y="198" fill="#5b7dff" font-size="13" font-family="monospace">&lt;section class=&quot;hero&quot;&gt;</text>
            <text x="64" y="226" fill="#696f9c" font-size="13" font-family="monospace">2</text>
            <text x="88" y="226" fill="#34e0d0" font-size="13" font-family="monospace">  &lt;div class=&quot;container&quot;&gt;</text>
            <text x="64" y="254" fill="#696f9c" font-size="13" font-family="monospace">3</text>
            <text x="88" y="254" fill="#a96bff" font-size="13" font-family="monospace">    &lt;h1 class=&quot;title&quot;&gt;</text>
            <text x="64" y="282" fill="#696f9c" font-size="13" font-family="monospace">4</text>
            <text x="88" y="282" fill="#aeb4d6" font-size="13" font-family="monospace">      Build faster with</text>
            <text x="64" y="310" fill="#696f9c" font-size="13" font-family="monospace">5</text>
            <text x="88" y="310" fill="#aeb4d6" font-size="13" font-family="monospace">      clean code</text>
            <text x="64" y="338" fill="#696f9c" font-size="13" font-family="monospace">6</text>
            <text x="88" y="338" fill="#34e0d0" font-size="13" font-family="monospace">    &lt;/h1&gt;</text>
            <path d="M58 366H286" stroke="#ffffff" stroke-opacity=".08"></path>
            <text x="64" y="398" fill="#696f9c" font-size="13" font-family="monospace">/* CSS */</text>
            <text x="88" y="428" fill="#a96bff" font-size="13" font-family="monospace">.hero { padding: 80px; }</text>
            <text x="88" y="456" fill="#d65bff" font-size="13" font-family="monospace">.title { font-size: 48px; }</text>
          </g>

          <g aria-label="Conversion status pipeline">
            <rect x="348" y="82" width="168" height="52" rx="18" fill="#101022" stroke="#a96bff" stroke-opacity=".38"></rect>
            <circle cx="374" cy="108" r="12" fill="#a96bff" fill-opacity=".18" stroke="#a96bff" stroke-opacity=".7"></circle>
            <text x="396" y="114" fill="#f0f1fb" font-size="15" font-weight="700">Strict BEM</text>
            <circle cx="496" cy="108" r="10" fill="none" stroke="#34e0d0" stroke-width="2"></circle>
            <path d="M491 108l4 4 7-8" fill="none" stroke="#34e0d0" stroke-width="2" stroke-linecap="round"></path>

            <rect x="348" y="190" width="168" height="52" rx="18" fill="#101022" stroke="#a96bff" stroke-opacity=".32"></rect>
            <circle cx="374" cy="216" r="12" fill="#a96bff" fill-opacity=".18" stroke="#a96bff" stroke-opacity=".7"></circle>
            <text x="396" y="222" fill="#f0f1fb" font-size="15" font-weight="700">Scoped CSS</text>
            <circle cx="496" cy="216" r="10" fill="none" stroke="#34e0d0" stroke-width="2"></circle>
            <path d="M491 216l4 4 7-8" fill="none" stroke="#34e0d0" stroke-width="2" stroke-linecap="round"></path>

            <path d="M432 135V188M432 244V278M432 430V492" stroke="url(#jh-accent)" stroke-width="2" stroke-dasharray="8 10" opacity=".75"></path>
            <rect x="328" y="278" width="208" height="152" rx="34" fill="#101022" stroke="#a96bff" stroke-opacity=".45"></rect>
            <circle cx="432" cy="354" r="112" fill="url(#jh-core)" opacity=".86"></circle>
            <path d="M390 346c0-24 18-44 42-44s42 20 42 44v42h-84z" fill="url(#jh-accent)"></path>
            <path d="M384 326h28c3-14 10-24 20-24s17 10 20 24h28" fill="none" stroke="#d9c8ff" stroke-width="8" stroke-linecap="round"></path>
            <path d="M400 350c13 16 51 16 64 0" fill="none" stroke="#07070f" stroke-width="8" stroke-linecap="round"></path>
            <circle cx="410" cy="338" r="7" fill="#05050b"></circle>
            <circle cx="454" cy="338" r="7" fill="#05050b"></circle>
            <text x="432" y="478" text-anchor="middle" fill="url(#jh-text-grad)" font-size="36" font-weight="850">Jigma</text>
            <text x="432" y="512" text-anchor="middle" fill="#34e0d0" font-size="14" font-weight="800" letter-spacing="8">CONVERT</text>

            <rect x="346" y="532" width="172" height="48" rx="16" fill="#101022" stroke="#34e0d0" stroke-opacity=".38"></rect>
            <text x="432" y="562" text-anchor="middle" fill="#f0f1fb" font-size="15" font-weight="700">Ready to copy</text>
          </g>

          <g aria-label="Bricks structure card">
            <rect x="552" y="98" width="274" height="392" rx="24" fill="url(#jh-panel)" stroke="#ffffff" stroke-opacity=".18"></rect>
            <rect x="552" y="98" width="274" height="62" rx="24" fill="#111126" stroke="#ffffff" stroke-opacity=".08"></rect>
            <rect x="578" y="122" width="34" height="34" rx="8" fill="#f4d338"></rect>
            <text x="624" y="145" fill="#f0f1fb" font-size="16" font-weight="700">Bricks structure</text>
            <text x="586" y="194" fill="#f0f1fb" font-size="14">Section (hero)</text>
            <path d="M600 206V438" stroke="#aeb4d6" stroke-opacity=".22"></path>
            <text x="616" y="228" fill="#aeb4d6" font-size="14">Container</text>
            <path d="M630 240V300" stroke="#aeb4d6" stroke-opacity=".22"></path>
            <text x="646" y="262" fill="#aeb4d6" font-size="14">Heading (h1)</text>
            <text x="666" y="292" fill="#696f9c" font-size="14">Build faster with clean code</text>
            <text x="646" y="338" fill="#aeb4d6" font-size="14">Text (p)</text>
            <text x="666" y="368" fill="#696f9c" font-size="14">Publish better websites</text>
            <text x="616" y="414" fill="#aeb4d6" font-size="14">Div (btns)</text>
            <text x="646" y="444" fill="#696f9c" font-size="14">Button (primary)</text>
          </g>

          <g aria-label="Layer inspector card">
            <rect x="585" y="466" width="226" height="118" rx="18" fill="#101022" stroke="#ffffff" stroke-opacity=".18"></rect>
            <text x="610" y="498" fill="#f0f1fb" font-size="15" font-weight="700">Layer inspector</text>
            <text x="610" y="528" fill="#696f9c" font-size="13">Class</text>
            <rect x="692" y="512" width="88" height="24" rx="9" fill="#15152b"></rect>
            <text x="706" y="529" fill="#aeb4d6" font-size="12" font-family="monospace">hero__title</text>
            <text x="610" y="558" fill="#696f9c" font-size="13">Status</text>
            <text x="692" y="558" fill="#4ade80" font-size="13">Clean</text>
          </g>
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
