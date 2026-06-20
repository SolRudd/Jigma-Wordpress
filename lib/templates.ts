export interface JigmaTemplate {
  key: string;
  name: string;
  html: string;
  css: string;
  js: string;
}

export const templates: JigmaTemplate[] = [
  {
    key: "hero",
    name: "Conversion Hero",
    html: `<section class="jg-hero">
  <div class="jg-hero__inner">
    <header class="jg-hero__nav">
      <img class="jg-hero__logo" src="/jigma-logo.svg" alt="Jigma">
      <button class="jg-hero__menu" type="button" aria-label="Open menu"></button>
    </header>
    <div class="jg-hero__content">
      <p class="jg-hero__eyebrow">Code to Bricks</p>
      <h1 class="jg-hero__title">Convert frontend code into <span>editable Bricks</span> structure</h1>
      <p class="jg-hero__text">Paste your HTML and CSS. Jigma converts it into a clean, structured, editable Bricks setup ready for production.</p>
      <div class="jg-hero__actions">
        <a class="jg-hero__button jg-hero__button--primary" href="#start">Start Converting</a>
        <a class="jg-hero__button jg-hero__button--secondary" href="#preview">View Example</a>
      </div>
    </div>
    <div class="jg-hero__stats" aria-label="Conversion stats">
      <div class="jg-hero__metric">
        <strong>98%</strong>
        <span>Accuracy</span>
      </div>
      <div class="jg-hero__metric">
        <strong>2.4x</strong>
        <span>Faster Workflow</span>
      </div>
      <div class="jg-hero__metric">
        <strong>100%</strong>
        <span>Bricks Compatible</span>
      </div>
    </div>
  </div>
</section>`,
    css: `.jg-hero {
  background:
    radial-gradient(circle at 78% 12%, rgba(139, 92, 246, 0.42), transparent 34%),
    linear-gradient(135deg, #070a17 0%, #0d1022 45%, #210b4f 100%);
  color: #f8fafc;
  min-height: 680px;
  overflow: hidden;
  padding: 42px;
  position: relative;
}

.jg-hero::after {
  background:
    linear-gradient(90deg, rgba(99, 102, 241, 0.15) 1px, transparent 1px),
    linear-gradient(0deg, rgba(99, 102, 241, 0.14) 1px, transparent 1px);
  background-size: 48px 48px;
  bottom: -140px;
  content: "";
  height: 300px;
  left: 0;
  opacity: 0.42;
  position: absolute;
  right: 0;
  transform: perspective(420px) rotateX(62deg);
  transform-origin: bottom center;
}

.jg-hero__inner {
  display: grid;
  gap: 54px;
  margin: 0 auto;
  max-width: 1120px;
  min-height: 596px;
  position: relative;
  z-index: 1;
}

.jg-hero__nav {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.jg-hero__logo {
  height: 58px;
  object-fit: cover;
  object-position: center;
  width: 168px;
}

.jg-hero__menu {
  background: transparent;
  border: 0;
  border-bottom: 2px solid #c4b5fd;
  border-top: 2px solid #c4b5fd;
  height: 18px;
  position: relative;
  width: 26px;
}

.jg-hero__menu::before {
  background: #c4b5fd;
  content: "";
  height: 2px;
  left: 0;
  position: absolute;
  top: 6px;
  width: 26px;
}

.jg-hero__content {
  max-width: 760px;
}

.jg-hero__eyebrow {
  border: 1px solid rgba(139, 92, 246, 0.62);
  border-radius: 999px;
  color: #c084fc;
  display: inline-flex;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  margin: 0 0 24px;
  padding: 8px 16px;
  text-transform: uppercase;
}

.jg-hero__title {
  font-size: clamp(3rem, 7vw, 5.4rem);
  line-height: 1.02;
  margin: 0;
  max-width: 820px;
}

.jg-hero__title span {
  background: linear-gradient(135deg, #a855f7, #6366f1);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.jg-hero__text {
  color: #cbd5e1;
  font-size: 1.2rem;
  line-height: 1.6;
  margin: 26px 0 0;
  max-width: 620px;
}

.jg-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 34px;
}

.jg-hero__button {
  border-radius: 10px;
  display: inline-flex;
  font-size: 1rem;
  font-weight: 800;
  justify-content: center;
  min-width: 154px;
  padding: 17px 24px;
  text-decoration: none;
}

.jg-hero__button--primary {
  background: linear-gradient(135deg, #a855f7, #3b82f6);
  box-shadow: 0 18px 40px rgba(59, 130, 246, 0.24);
  color: #ffffff;
}

.jg-hero__button--secondary {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(248, 250, 252, 0.22);
  color: #f8fafc;
}

.jg-hero__stats {
  align-items: end;
  display: grid;
  gap: 22px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: auto;
  max-width: 760px;
}

.jg-hero__metric {
  display: grid;
  gap: 4px;
}

.jg-hero__metric strong {
  color: #ffffff;
  font-size: 2rem;
  line-height: 1;
}

.jg-hero__metric span {
  color: #a8b3c7;
  font-size: 0.95rem;
}

@media (max-width: 820px) {
  .jg-hero {
    padding: 28px 20px;
  }

  .jg-hero__inner {
    gap: 36px;
    min-height: auto;
  }

  .jg-hero__stats {
    grid-template-columns: 1fr;
  }
}`,
    js: "",
  },
  {
    key: "cards",
    name: "Service Cards",
    html: `<section class="service-strip">
  <div class="service-strip__header">
    <h2 class="service-strip__title">Conversion checks that matter.</h2>
    <p class="service-strip__intro">Jigma keeps structure, styling mode, and dependencies visible before export.</p>
  </div>
  <div class="service-strip__grid">
    <article class="service-card">
      <span class="service-card__number">01</span>
      <h3>Layer control</h3>
      <p>Select, remove, and undo layers before creating Bricks output.</p>
    </article>
    <article class="service-card">
      <span class="service-card__number">02</span>
      <h3>Style fallback</h3>
      <p>Map simple CSS where possible and preserve complex CSS safely.</p>
    </article>
    <article class="service-card">
      <span class="service-card__number">03</span>
      <h3>Dependency audit</h3>
      <p>Catch external scripts, fonts, images, CDN URLs, and CSS variables.</p>
    </article>
  </div>
</section>`,
    css: `.service-strip {
  background: #f7f9fc;
  color: #111827;
  padding: 70px 42px;
}

.service-strip__header {
  margin: 0 auto 34px;
  max-width: 760px;
  text-align: center;
}

.service-strip__title {
  font-size: 3.4rem;
  line-height: 1;
  margin: 0;
}

.service-strip__intro {
  color: #64748b;
  font-size: 1.05rem;
  line-height: 1.65;
  margin: 18px auto 0;
}

.service-strip__grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0 auto;
  max-width: 1120px;
}

.service-card {
  background: #ffffff;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  display: grid;
  gap: 14px;
  padding: 26px;
}

.service-card__number {
  color: #0f766e;
  font-weight: 900;
}

.service-card h3 {
  font-size: 1.25rem;
  margin: 0;
}

.service-card p {
  color: #5b6678;
  line-height: 1.6;
  margin: 0;
}

@media (max-width: 820px) {
  .service-strip__grid {
    grid-template-columns: 1fr;
  }

  .service-strip__title {
    font-size: 2.4rem;
  }
}`,
    js: "",
  },
];
