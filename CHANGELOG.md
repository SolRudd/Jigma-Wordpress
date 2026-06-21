# Changelog

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

## 0.1.0 - Initial POC

- Standalone Jigma converter workspace.
- Bricks JSON output with native Bricks class records.
- WordPress Bricks plugin proof of concept.
