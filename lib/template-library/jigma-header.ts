import type { JigmaTemplateSource } from "./types.ts";
import { jigmaLogoSvg } from "./jigma-logo.ts";

export const jigmaHeaderTemplate: JigmaTemplateSource = {
  id: "jigma-header",
  name: "Jigma Header",
  category: "Navigation",
  description: "Branded responsive Jigma navigation with optional mobile toggle.",
  version: 1,
  builderTarget: "bricks",
  prefix: "jigma",
  blockName: "header",
  thumbnail: "jigma-header",
  expectedWarnings: ["javascript", "backdrop-filter"],
  testedBreakpoints: ["1440", "1280", "1080", "940", "768", "560", "390"],
  html: `<header class="jigma-header">
  <div class="jigma-header__inner">
    <a class="jigma-header__brand" href="#top" aria-label="Jigma home">
      ${jigmaLogoSvg}
    </a>
    <nav class="jigma-header__nav" aria-label="Primary navigation">
      <a class="jigma-header__nav-link" href="#features">Features</a>
      <a class="jigma-header__nav-link" href="#templates">Templates</a>
      <a class="jigma-header__nav-link" href="#pricing">Pricing</a>
      <a class="jigma-header__nav-link" href="#docs">Docs</a>
    </nav>
    <a class="jigma-header__cta" href="#convert">
      <span class="jigma-header__cta-label">Start converting</span>
      <span class="jigma-header__cta-arrow" aria-hidden="true">→</span>
    </a>
    <button class="jigma-header__toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="jigma-header-menu">
      <span class="jigma-header__toggle-line"></span>
      <span class="jigma-header__toggle-line"></span>
      <span class="jigma-header__toggle-line"></span>
    </button>
  </div>
  <nav class="jigma-header__mobile-menu" id="jigma-header-menu" aria-label="Mobile navigation" hidden>
    <a class="jigma-header__nav-link" href="#features">Features</a>
    <a class="jigma-header__nav-link" href="#templates">Templates</a>
    <a class="jigma-header__nav-link" href="#pricing">Pricing</a>
    <a class="jigma-header__nav-link" href="#docs">Docs</a>
    <a class="jigma-header__cta" href="#convert">
      <span class="jigma-header__cta-label">Start converting</span>
      <span class="jigma-header__cta-arrow" aria-hidden="true">→</span>
    </a>
  </nav>
</header>`,
  css: `.jigma-header {
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
  z-index: 20;
  width: 100%;
  padding: 24px clamp(22px, 4vw, 54px);
  color: var(--jigma-text);
  background: rgba(6, 6, 13, 0.96);
  border-bottom: 1px solid rgba(170, 176, 212, 0.12);
}

.jigma-header__inner {
  max-width: 1500px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(22px, 4vw, 54px);
}

.jigma-header__brand {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  color: var(--jigma-text);
  font-weight: 900;
  text-decoration: none;
}

.jigma-header__logo-svg {
  width: min(210px, 38vw);
  height: auto;
  flex: 0 0 auto;
}

.jigma-header__nav {
  display: flex;
  align-items: center;
  gap: clamp(22px, 4vw, 62px);
}

.jigma-header__nav-link {
  padding: 10px 0;
  color: var(--jigma-text-soft);
  font-size: 17px;
  font-weight: 760;
  text-decoration: none;
}

.jigma-header__nav-link:hover,
.jigma-header__nav-link:focus-visible {
  color: var(--jigma-text);
  opacity: 0.92;
}

.jigma-header__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 54px;
  padding: 0 22px;
  color: #ffffff;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--jigma-violet-bright), var(--jigma-blue-bright));
  box-shadow: 0 18px 42px rgba(79, 140, 255, 0.26);
  font-weight: 850;
  text-decoration: none;
}

.jigma-header__cta-arrow {
  font-size: 22px;
  line-height: 1;
}

.jigma-header__toggle {
  display: none;
  width: 44px;
  height: 44px;
  place-items: center;
  padding: 0;
  border: 1px solid rgba(170, 176, 212, 0.2);
  border-radius: 14px;
  color: var(--jigma-text);
  background: rgba(255, 255, 255, 0.05);
}

.jigma-header__toggle-line {
  display: block;
  width: 18px;
  height: 2px;
  margin: 3px auto;
  border-radius: 999px;
  background: currentColor;
}

.jigma-header__mobile-menu {
  display: none;
  margin-top: 10px;
  padding: 12px;
  border: 1px solid rgba(170, 176, 212, 0.14);
  border-radius: 20px;
  background: rgba(14, 14, 31, 0.92);
  backdrop-filter: blur(18px);
}

.jigma-header__mobile-menu[hidden] {
  display: none;
}

@media (max-width: 820px) {
  .jigma-header {
    padding: 14px;
  }

  .jigma-header__nav,
  .jigma-header__inner > .jigma-header__cta {
    display: none;
  }

  .jigma-header__toggle {
    display: grid;
  }

  .jigma-header__mobile-menu {
    display: grid;
    gap: 4px;
  }
}`,
  javascript: `(() => {
  const header = document.querySelector(".jigma-header");
  if (!header) return;

  const toggle = header.querySelector(".jigma-header__toggle");
  const menu = header.querySelector(".jigma-header__mobile-menu");
  if (!toggle || !menu) return;

  const closeMenu = () => {
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const isOpen = menu.hidden;
    menu.hidden = !isOpen;
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
})();`,
};
