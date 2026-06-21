export interface MediaFixture {
  name: string;
  html: string;
  css: string;
  js?: string;
}

export const mediaFixtures: MediaFixture[] = [
  {
    name: "standard jpg image with alt",
    html: `<section class="media-card"><img class="media-card__image" src="/images/team.jpg" alt="Our team" width="1200" height="800"></section>`,
    css: `.media-card__image { width: 100%; object-fit: cover; object-position: center; }`,
  },
  {
    name: "webp image with lazy loading",
    html: `<section class="media-card"><img class="media-card__image" src="/images/team.webp" alt="Our team" width="1200" height="800" loading="lazy" decoding="async"></section>`,
    css: `.media-card__image { aspect-ratio: 3 / 2; object-fit: cover; }`,
  },
  {
    name: "picture srcset responsive image",
    html: `<section class="media-card"><picture class="media-card__picture"><source media="(max-width: 720px)" srcset="/images/team-mobile.webp 720w" type="image/webp"><source media="(min-width: 721px)" srcset="/images/team.webp 1200w" type="image/webp"><img class="media-card__image" src="/images/team.jpg" srcset="/images/team.jpg 1200w, /images/team@2x.jpg 2400w" sizes="100vw" alt="Our team"></picture></section>`,
    css: `.media-card__picture { display: block; } .media-card__image { width: 100%; object-fit: cover; }`,
  },
  {
    name: "linked image",
    html: `<section class="media-card"><a class="media-card__link" href="/gallery" target="_blank" rel="noopener" aria-label="Open gallery"><img class="media-card__image" src="/images/gallery.jpg" alt="Gallery"></a></section>`,
    css: `.media-card__image { display: block; width: 100%; }`,
  },
  {
    name: "background image cover center",
    html: `<section class="media-hero"><div class="media-hero__content"><h2>Background</h2></div></section>`,
    css: `.media-hero { background-image: url("/images/hero.jpg"); background-size: cover; background-position: center; background-repeat: no-repeat; }`,
  },
  {
    name: "background image plus gradient overlay",
    html: `<section class="media-hero"><h2 class="media-hero__title">Overlay</h2></section>`,
    css: `.media-hero { background: linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("/images/hero.jpg"); background-size: cover; }`,
  },
  {
    name: "before color overlay",
    html: `<section class="media-hero"><h2 class="media-hero__title">Before</h2></section>`,
    css: `.media-hero { position: relative; isolation: isolate; } .media-hero::before { content: ""; position: absolute; inset: 0; background: rgba(0,0,0,.45); }`,
  },
  {
    name: "multiple background layers",
    html: `<section class="media-hero"><h2>Layers</h2></section>`,
    css: `.media-hero { background-image: url("/images/noise.png"), linear-gradient(#111, #333), url("/images/hero.jpg"); background-blend-mode: overlay, normal, normal; }`,
  },
  {
    name: "inline svg one path",
    html: `<section class="media-icon"><svg class="media-icon__svg" viewBox="0 0 16 16" role="img" aria-label="Check"><path d="M1 8l4 4L15 2" fill="none" stroke="currentColor"/></svg></section>`,
    css: `.media-icon__svg { width: 32px; height: 32px; color: #2dd4bf; }`,
  },
  {
    name: "complex svg gradients and paths",
    html: `<section class="media-icon"><svg class="media-icon__svg" viewBox="0 0 80 80"><defs><linearGradient id="g"><stop offset="0%" stop-color="#fff"/><stop offset="100%" stop-color="#000"/></linearGradient></defs>${Array.from({ length: 55 }, (_, index) => `<path d="M${index} ${index}h1v1h-1z" fill="url(#g)"/>`).join("")}</svg></section>`,
    css: `.media-icon__svg { width: 80px; height: 80px; }`,
  },
  {
    name: "svg mask clipPath",
    html: `<section class="media-icon"><svg class="media-icon__svg" viewBox="0 0 20 20"><defs><clipPath id="clip"><circle cx="10" cy="10" r="8"/></clipPath><mask id="mask"><rect width="20" height="20" fill="white"/></mask></defs><rect clip-path="url(#clip)" mask="url(#mask)" width="20" height="20"/></svg></section>`,
    css: `.media-icon__svg { display: block; }`,
  },
  {
    name: "external svg file",
    html: `<section class="media-icon"><img class="media-icon__image" src="/icons/check.svg" alt="Check"></section>`,
    css: `.media-icon__image { width: 32px; height: 32px; }`,
  },
  {
    name: "svg sprite use",
    html: `<section class="media-icon"><svg class="media-icon__svg"><use href="/icons/sprite.svg#check"></use></svg></section>`,
    css: `.media-icon__svg { width: 24px; height: 24px; }`,
  },
  {
    name: "unsafe svg script onload",
    html: `<section class="media-icon"><svg class="media-icon__svg" viewBox="0 0 16 16" onload="evil()"><script>alert(1)</script><path onclick="evil()" d="M0 0h16v16H0z"/></svg></section>`,
    css: `.media-icon__svg { width: 16px; }`,
  },
  {
    name: "css mask image url",
    html: `<section class="media-mask"><span class="media-mask__icon"></span></section>`,
    css: `.media-mask__icon { mask-image: url("/masks/blob.svg"); background: #111; }`,
  },
  {
    name: "javascript interaction",
    html: `<section class="media-tabs"><button class="media-tabs__button">Open</button></section>`,
    css: `.media-tabs__button { cursor: pointer; }`,
    js: `document.querySelector(".media-tabs__button")?.addEventListener("click", () => console.log("open"));`,
  },
  {
    name: "inline onclick handler",
    html: `<section class="media-modal"><button class="media-modal__button" onclick="openModal()">Open</button></section>`,
    css: `.media-modal__button { padding: 12px 16px; }`,
  },
  {
    name: "third party iframe embed",
    html: `<section class="media-embed"><iframe class="media-embed__frame" src="https://player.example.com/embed/123" title="Video"></iframe></section>`,
    css: `.media-embed__frame { width: 100%; aspect-ratio: 16 / 9; }`,
  },
  {
    name: "missing asset",
    html: `<section class="media-card"><img class="media-card__image" src="/missing/team.jpg" alt=""></section>`,
    css: `.media-card { background-image: url("/missing/bg.jpg"); }`,
  },
  {
    name: "duplicate image url",
    html: `<section class="media-grid"><img class="media-grid__image" src="/images/reused.jpg" alt="One"><img class="media-grid__image" src="/images/reused.jpg" alt="Two"><img class="media-grid__image" src="/images/reused.jpg" alt="Three"></section>`,
    css: `.media-grid { background-image: url("/images/reused.jpg"); } .media-grid__image { width: 100%; }`,
  },
];
