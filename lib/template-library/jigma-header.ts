import type { JigmaTemplateSource } from "./types.ts";

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
      <svg class="jigma-header__logo-svg" viewBox="0 0 48 48" role="img" aria-label="Jigma Logo">
        <rect x="6" y="14" width="36" height="26" rx="10" fill="#8b55d9"></rect>
        <path d="M13 24h22v8H13z" fill="#06060d"></path>
        <circle cx="17" cy="28" r="2.5" fill="#34e0d0"></circle>
        <circle cx="31" cy="28" r="2.5" fill="#34e0d0"></circle>
        <path d="M15 14 10 7m23 7 5-7" stroke="#a96bff" stroke-width="4" stroke-linecap="round"></path>
        <path d="M18 35c3 2 9 2 12 0" stroke="#eef0fb" stroke-width="2.5" stroke-linecap="round"></path>
      </svg>
      <span class="jigma-header__wordmark">Jigma</span>
    </a>
    <nav class="jigma-header__nav" aria-label="Primary navigation">
      <a class="jigma-header__nav-link" href="#features">Features</a>
      <a class="jigma-header__nav-link" href="#templates">Templates</a>
      <a class="jigma-header__nav-link" href="#pricing">Pricing</a>
      <a class="jigma-header__nav-link" href="#docs">Docs</a>
    </nav>
    <a class="jigma-header__cta" href="#convert">Start converting</a>
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
    <a class="jigma-header__cta" href="#convert">Start converting</a>
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
  max-width: 1180px;
  margin: 0 auto;
  padding: 18px 22px;
  color: var(--jigma-text);
}

.jigma-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  padding: 12px 14px;
  border: 1px solid rgba(170, 176, 212, 0.16);
  border-radius: 24px;
  background: rgba(14, 14, 31, 0.78);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.26);
  backdrop-filter: blur(18px);
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
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
}

.jigma-header__wordmark {
  font-size: 24px;
  letter-spacing: -0.02em;
}

.jigma-header__nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.jigma-header__nav-link {
  padding: 10px 12px;
  color: var(--jigma-text-soft);
  border-radius: 999px;
  font-size: 14px;
  font-weight: 760;
  text-decoration: none;
}

.jigma-header__nav-link:hover,
.jigma-header__nav-link:focus-visible {
  color: var(--jigma-text);
  background: rgba(255, 255, 255, 0.07);
}

.jigma-header__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 16px;
  color: #ffffff;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--jigma-violet-bright), var(--jigma-blue-bright));
  box-shadow: 0 14px 34px rgba(79, 140, 255, 0.24);
  font-weight: 850;
  text-decoration: none;
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
