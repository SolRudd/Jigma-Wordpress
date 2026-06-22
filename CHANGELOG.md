# Changelog

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
