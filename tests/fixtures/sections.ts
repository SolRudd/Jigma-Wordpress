export interface SectionFixture {
  name: string;
  html: string;
  css: string;
}

export const sectionFixtures: SectionFixture[] = [
  {
    name: "basic hero",
    html: `<section class="hero">
  <div class="hero__content">
    <p class="hero__eyebrow">Local studio</p>
    <h1 class="hero__title">Build sharper Bricks sections.</h1>
    <p class="hero__text">Convert approved frontend code into a cleaner builder handoff.</p>
    <a class="hero__button" href="#start">Start project</a>
  </div>
</section>`,
    css: `.hero {
  background: #101820;
  color: #ffffff;
  padding: 72px;
}

.hero__content {
  max-width: 720px;
}

.hero__title {
  font-size: 4rem;
  line-height: 1;
}

.hero__button {
  background: #2dd4bf;
  color: #061312;
  padding: 14px 18px;
}`,
  },
  {
    name: "card grid",
    html: `<section class="cards">
  <div class="cards__grid">
    <article class="card">
      <h3 class="card__title">Strategy</h3>
      <p class="card__text">Plan the section structure.</p>
    </article>
    <article class="card">
      <h3 class="card__title">Build</h3>
      <p class="card__text">Convert and inspect.</p>
    </article>
  </div>
</section>`,
    css: `.cards {
  padding: 64px;
}

.cards__grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, 1fr);
}

.card {
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  padding: 24px;
}

.card__title {
  margin: 0 0 10px;
}`,
  },
  {
    name: "text image section",
    html: `<section class="split">
  <div class="split__copy">
    <h2 class="split__title">A clearer content split.</h2>
    <p class="split__text">Text and image sections should remain editable after paste.</p>
  </div>
  <img class="split__image" src="https://example.com/image.jpg" alt="Workspace">
</section>`,
    css: `.split {
  align-items: center;
  display: grid;
  gap: 32px;
  grid-template-columns: 1fr 1fr;
}

.split__image {
  border-radius: 8px;
  width: 100%;
}`,
  },
  {
    name: "button group",
    html: `<section class="cta">
  <h2 class="cta__title">Ready to launch?</h2>
  <div class="cta__actions">
    <a class="button button--primary" href="#buy">Buy now</a>
    <a class="button button--secondary" href="#learn">Learn more</a>
  </div>
</section>`,
    css: `.cta {
  padding: 56px;
  text-align: center;
}

.cta__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.button {
  border-radius: 8px;
  padding: 13px 18px;
}

.button--primary:hover {
  opacity: 0.85;
}`,
  },
  {
    name: "image section",
    html: `<section class="gallery">
  <img class="gallery__image" src="https://example.com/a.jpg" alt="A">
  <img class="gallery__image" src="https://example.com/b.jpg" alt="B">
</section>`,
    css: `.gallery {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, 1fr);
}

.gallery__image {
  display: block;
  width: 100%;
}`,
  },
  {
    name: "nested layout",
    html: `<section class="shell">
  <div class="shell__outer">
    <div class="shell__inner">
      <div class="shell__content">
        <h2 class="shell__title">Nested but controlled.</h2>
        <p class="shell__text">Deep layers should preserve parent/child references.</p>
      </div>
    </div>
  </div>
</section>`,
    css: `.shell {
  padding: 40px;
}

.shell__outer {
  border: 1px solid #dbe4ef;
}

.shell__inner {
  padding: 24px;
}

.shell__content {
  max-width: 640px;
}`,
  },
];
