# Jigma Beta Release Checklist

Use this checklist before a manual Bricks beta build is shared. Do not mark Bricks-specific items complete unless they were tested in WordPress with Bricks Builder active.

## Standalone QA

- [ ] Run `npm install` on a clean checkout.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Review `reports/package-audit.json`.
- [ ] Review `reports/bundle-size.json`.
- [ ] Review `reports/browser-smoke.json`.
- [ ] Confirm no Jigma console errors in the standalone app.
- [ ] Confirm no horizontal overflow at 1920, 1440, 1280, 1024, 768, and 390 px widths.
- [ ] Load each built-in template: Jigma Hero, Proof Bar, Services, iPhone/Product Showcase, Pricing, Testimonials, CTA.
- [ ] Confirm HTML, CSS, and JavaScript tabs preserve editor values.
- [ ] Confirm Run Preview updates only on explicit action.
- [ ] Confirm Layers, Dependencies, Warnings, and Export tabs are visible and usable.
- [ ] Confirm Copy Bricks Structure copies valid JSON.
- [ ] Confirm Download JSON saves the same export payload.
- [ ] Confirm preset save/load/import/export works locally.

## Bricks Paste QA

- [ ] Paste Jigma Hero into Bricks.
- [ ] Paste Proof Bar into Bricks.
- [ ] Paste Services into Bricks.
- [ ] Paste iPhone/Product Showcase into Bricks.
- [ ] Paste Pricing into Bricks.
- [ ] Paste Testimonials into Bricks.
- [ ] Paste CTA into Bricks.
- [ ] Confirm readable Structure labels.
- [ ] Confirm generated BEM classes are present as native Bricks class records.
- [ ] Confirm `_cssGlobalClasses` references resolve to existing class records.
- [ ] Confirm base and modifier classes are separate.
- [ ] Confirm native Bricks properties appear where mapped.
- [ ] Confirm fallback custom CSS remains owned by the correct class.
- [ ] Confirm responsive mappings apply after save/reload.
- [ ] Confirm pseudo selector behavior where templates use it.
- [ ] Confirm there is no Generated BEM CSS element by default.

## Plugin Insertion QA

- [ ] Install `jigma-bricks.zip` in a WordPress site with Bricks active.
- [ ] Confirm the Jigma panel appears only in the Bricks builder/admin context.
- [ ] Confirm the panel detects Bricks.
- [ ] Generate a structure inside the Bricks environment.
- [ ] Insert into the current page.
- [ ] Reload the Bricks builder.
- [ ] Confirm inserted elements persist.
- [ ] Confirm native class records persist.
- [ ] Confirm duplicate class names reuse existing class IDs when expected.
- [ ] Confirm no unrelated Bricks page data is modified.

## SVG Signing QA

- [ ] Paste a section with inline SVG.
- [ ] Confirm one inline SVG becomes one Bricks SVG element.
- [ ] Confirm child `path`, `rect`, `circle`, `defs`, `mask`, and `g` nodes do not become layers.
- [ ] Confirm unsafe SVG markup is removed.
- [ ] Confirm exactly one grouped sanitization warning appears per affected SVG.
- [ ] Confirm Bricks shows SVG/code signature review where applicable.
- [ ] Sign/review SVG code in Bricks and confirm the page still renders after reload.

## Save/Reload QA

- [ ] Save the Bricks page after paste.
- [ ] Reload the builder.
- [ ] Reload the frontend page.
- [ ] Confirm labels, class references, native settings, and fallback CSS remain intact.
- [ ] Confirm no generated content depends on the standalone app.

## Deactivate-Plugin QA

- [ ] Insert content with the Jigma plugin active.
- [ ] Save the page.
- [ ] Deactivate the Jigma plugin.
- [ ] Reload the frontend page.
- [ ] Confirm generated Bricks content still renders where Bricks itself supports the saved data.
- [ ] Reactivate Jigma and confirm the panel returns.

## Responsive QA

- [ ] Check standalone app at 1920x1080.
- [ ] Check standalone app at 1440x900.
- [ ] Check standalone app at 1280x800.
- [ ] Check standalone app at 1024x768.
- [ ] Check standalone app at 768x1024.
- [ ] Check standalone app at 390x844.
- [ ] Confirm mobile navigation exposes Code, Preview, Inspect, and Export.
- [ ] Confirm Run Preview and Copy Structure remain reachable on mobile.

## Known Limitations

- Live WordPress/Bricks QA is not covered by automated tests in this repository.
- PHP lint requires local PHP or Docker; this environment had neither available during this pass.
- Bricks internal schema fields can change between Bricks versions.
- Inline SVG/code elements require Bricks signature review after import.
- JavaScript is review-required and is not converted to native Bricks behavior.
- The current Vite bundle exceeds the default 500 kB chunk warning threshold.
