# Changelog

## CSS placement modes - 2026-06-23

- Added four CSS placement modes to the shared converter (`lib/css/placement.ts`):
  Auto — class-first (default), Attach to classes, Scope to section, and Page stylesheet.
- Default is **Auto — class-first**: clear single-class rules attach to Bricks global
  class CSS; descendant/pseudo/media rules that cannot split safely stay on the
  root/component class; only true globals go to Jigma Page Styles. This preserves Jigma's
  core class-owned CSS advantage rather than scoping everything to the root.
- Page/global CSS (`:root`, `html`, `body`, `@font-face`, `@keyframes`, `@property`,
  resets, and global utility selectors) is routed automatically to one reusable Jigma
  Page Styles element instead of being dropped or re-pasted by hand.
- Exposed a "CSS placement" setting in the Bricks plugin dock and the standalone web app;
  both front-ends use the same shared routing and default to Auto — class-first.
- Plugin Insert and web Copy Bricks Structure both apply the routed page styles
  automatically, so users no longer need to paste page-level CSS manually.
- Added acceptance tests for class-first routing, descendant/pseudo/media → root,
  true-globals-only → Page Styles, Attach to classes / Scope to section / Page stylesheet
  behaviour, and CSS declaration conservation across all modes.

## Jigma hosted plugin updates - 2026-06-22

- Bumped the WordPress plugin beta to `0.2.3-beta`.
- Added a first-party WordPress update adapter for the `https://jigma.co.uk/jigma-bricks` Update URI.
- Added hosted release metadata support at `https://jigma.co.uk/releases/jigma-bricks/latest.json`.
- Added a release script for version checks, plugin core build, tests, production build, syntax checks, optional PHP lint, release ZIP creation, checksum generation, and `latest.json`.

## Jigma Bricks real-builder loading fix - 2026-06-22

- Bumped the WordPress plugin beta to `0.2.2-beta`.
- Updated the Plugin URI to `https://jigma.co.uk/`.
- Broadened Bricks builder detection to support Bricks helper functions, frontend builder request parameters such as `?bricks=run`, Bricks-prefixed query keys, and authorised `jigma_debug=1`.
- Added required asset file checks, visible development errors for missing plugin assets, and `filemtime()` beta cache-busting for plugin CSS and JavaScript.
- Hardened dock bootstrap so `#jigma-bricks-root` mounts after `document.body`, shows the bottom fallback dock before workspace detection, and renders a visible Jigma error launcher on initialization failure.
- Added debug-only `window.JigmaBricksDiagnostics` without exposing nonces, content, source code, or private data.

## Jigma Bricks dock and settings beta - 2026-06-22

- Bumped the WordPress plugin beta to `0.2.1-beta`.
- Reworked the plugin panel into one scoped `#jigma-bricks-root` bottom dock that detects the Bricks workspace bounds and falls back safely when the canvas cannot be identified.
- Added persisted expanded, collapsed, and hidden dock states, dock height resizing, editor width resizing, a hidden launcher, and compact selected-target/status feedback.
- Added a focused settings modal with General, Editor visibility, Dock, Export, and Tools sections, plus Quick Import and Saved Sections access.
- Kept insertion explicit: Run performs analysis only, Insert requires a selected nestable Bricks target, and page-level CSS/JavaScript remain review-controlled.
- Scoped plugin CSS to the Jigma root and removed global UI selectors so the dock does not style Bricks, WordPress, or builder dialogs.

## Jigma selected-target Bricks plugin beta - 2026-06-22

- Bumped the WordPress plugin beta to `0.2.0-beta`.
- Added a bundled Jigma Core browser asset for the plugin and removed the plugin panel's duplicate browser conversion implementation.
- Replaced the floating panel with a compact resizable Bricks dock focused on HTML, CSS, JavaScript, Run, Insert into Selected, Copy Structure, and Saved Sections.
- Required an explicit selected, nestable Bricks target before insertion and removed component page-root fallback.
- Added selected-target ID remapping, target children updates, content hash checks, locked/non-nestable target blocking, and post-filter class-reference validation.
- Added a controlled `Jigma Page Styles` route for confirmed page-level CSS while keeping class-owned CSS on global class records.

## Jigma Bricks plugin compatibility adapter - 2026-06-22

- Bumped the WordPress plugin adapter to `0.1.1`.
- Aligned plugin insertion with the shared Bricks Compatibility payload shape used by standalone Copy Bricks Structure.
- Preserved native Bricks class records and `_cssGlobalClasses` references instead of converting them to raw element classes.
- Added hard conflicts for existing same-name Bricks global classes with different settings.
- Validated class references before saving page content and kept global class writes ahead of element writes.
- Documented builder reload, unsigned code review, and remaining live Bricks QA requirements.

## Media SVG Overlay Code Fidelity - 2026-06-21

- Added a central asset manifest for standalone exports covering images, responsive sources, CSS URL assets, inline SVG, scripts, video, iframe embeds, and inline event handler review.
- Preserved image alt, dimensions, loading, decoding, aspect ratio, srcset, sizes, and picture sources in Bricks Image settings where available.
- Added native mapping for simple background images, gradients, background position/size/repeat/attachment/blend/clip/origin, object-fit, and object-position.
- Preserved complex overlays, pseudo-element overlays, multiple background layers, masks, and keyframes in class-owned `%root%` CSS fallbacks.
- Kept inline SVG atomic with structured sanitization reports and signature warnings.
- Added optional disabled JavaScript Code element export while keeping default JavaScript behavior review-only.
- Added media/code regression fixtures and isolated plugin-only media import/security scaffolding.

## 0.1.0-beta-hardening - 2026-06-21

- Added golden export fixtures for all seven beta templates.
- Added regression coverage for hierarchy, readable labels, stable BEM names, stable six-character class IDs, class references, repeated class reuse, base/modifier class separation, native Bricks settings, CSS fallback ownership, responsive mappings, pseudo selectors, SVG counts, generated CSS block absence, and clipboard payload validity.
- Added UI smoke coverage for template library, editor tabs, preview, inspector tabs, layer controls, warning expansion, export actions, presets, and mobile navigation surfaces.
- Generated package audit, bundle size, browser smoke, version, checksum, and plugin package artifacts for beta release review.
- Rebuilt `jigma-bricks.zip`.

## 0.1.0 - Initial plugin version

- Standalone Jigma converter workspace.
- Bricks JSON output with native Bricks class records.
- WordPress Bricks plugin foundation.
