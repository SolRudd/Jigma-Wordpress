# Bricks Compatibility QA

Use this checklist for manual Bricks beta testing. Automated tests only verify exported payload structure; they do not prove live Bricks visual parity.

## General Setup

1. Open a clean Bricks page.
2. Paste the Jigma clipboard payload.
3. Import class records when Bricks prompts.
4. Confirm the Structure panel hierarchy.
5. Save the page.
6. Reload the builder.
7. View the frontend.
8. Deactivate Jigma if testing plugin behavior.
9. Confirm pasted Bricks content still renders.

## Feature CTA

1. Paste `tests/fixtures/compatibility/feature-cta.html` into HTML.
2. Paste `tests/fixtures/compatibility/feature-cta.css` into CSS.
3. Leave JavaScript empty.
4. Run Preview.
5. Copy Bricks Structure.
6. Confirm the clipboard payload has six content elements.
7. Confirm the hierarchy is Section > Inner > Content > Heading, Text, Link.
8. Confirm the heading keeps the line break.
9. Confirm the link keeps the inline arrow.
10. Confirm `aria-labelledby` points to the heading ID.
11. Confirm the pseudo background image, gradients, overlays and responsive URLs render.

## Process Light

1. Paste `tests/fixtures/compatibility/process-light.html` into HTML.
2. Paste `tests/fixtures/compatibility/process-light.css` into CSS.
3. Leave JavaScript empty.
4. Run Preview.
5. Copy Bricks Structure.
6. Confirm the hierarchy is Process Section > Process Shell > Header, Track and Grid.
7. Confirm the four Process Step cards are semantic articles.
8. Confirm each marker, icon wrapper, SVG, h3 heading and paragraph appears correctly.
9. Confirm each inline SVG is one Bricks SVG element.
10. Review and sign SVG/code elements in Bricks if required.
11. Confirm responsive layout at desktop, tablet and mobile widths.

## Simple Inline Content

1. Test a heading with `<br>`.
2. Test a heading with inline `span`, `strong`, `em` and `code`.
3. Confirm safe inline content remains inside the native Heading text field.
4. Confirm classed inline children that need separate styling still become separate editable elements.

## Links

1. Test a simple link with an inline span.
2. Confirm Bricks creates a Text Link.
3. Confirm `href`, `target` and `rel` survive.
4. Confirm inline icon/span text survives when it is safe phrasing content.

## Article Grid

1. Test a grid of semantic `article` elements.
2. Confirm each article is a nestable Div with `article` tag/custom tag.
3. Confirm repeated card classes reuse the same Bricks class ID.

## Images And Backgrounds

1. Test semantic `img` and `picture` markup.
2. Confirm semantic images map to Bricks Image elements.
3. Test CSS background images and pseudo-element overlays.
4. Confirm Compatibility mode keeps them as literal class CSS and does not create Image elements for decorative backgrounds.
5. Confirm remote URLs are preserved and not fetched silently.

## Responsive CSS

1. Confirm media queries remain in the owning class `_cssCustom`.
2. Confirm no `%root%` appears in Bricks Compatibility mode.
3. Confirm no generated CSS Code element appears by default.

## Pass Criteria

1. No hierarchy errors.
2. No missing class references.
3. No unresolved selectors for supported fixture CSS.
4. No warning wall for successful preservation behavior.
5. Save/reload keeps the same structure and styling.
6. Frontend rendering matches the Jigma preview closely enough for beta.
