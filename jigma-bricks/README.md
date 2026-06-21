# Jigma Bricks

Proof-of-concept WordPress plugin for running Jigma inside a Bricks Builder editing context.

## What it does

- Detects Bricks Builder by theme, constants, or loaded Bricks classes.
- Loads assets only for likely Bricks builder/admin requests.
- Adds a floating Jigma panel with HTML, CSS, and JavaScript editors.
- Generates a Bricks copied-elements payload and copies it to the clipboard.
- Inserts generated elements into the current Bricks page as a proof of concept.
- Creates generated BEM classes as native Bricks global class records.
- Assigns generated class IDs to elements through `_cssGlobalClasses`.
- Preserves class-owned custom CSS from the shared Bricks Compatibility payload.
- Adds JavaScript only when enabled, as one disabled Code element for review.

## Native insertion proof of concept

The panel posts the same six-key Bricks Compatibility payload used by the standalone Copy Bricks Structure action:

- `content`
- `source`
- `sourceUrl`
- `version`
- `globalClasses`
- `globalElements`

The PHP adapter validates that schema, saves global class records before page elements, remaps class and element IDs, validates every `_cssGlobalClasses` reference, applies Bricks' save-security filter when available, and appends the elements at the page root.

Existing Bricks classes are reused only when the same class name has identical settings. A same-name class with different settings returns a conflict and no content is inserted.

This POC does not mutate Bricks' live canvas JavaScript state. After insertion, reload the Bricks builder to verify the saved page content.

## What it does not do yet

- Native Bricks panel registration.
- Live insertion into the current Bricks canvas without reload.
- Two-way sync with existing Bricks elements.
- Selected-element insertion.
- Non-empty Bricks `globalElements` persistence.
- Live WordPress/Bricks QA automation.
- Licensing, accounts, AI, or cloud services.

## Known limitations

- Builder reload is required after insertion.
- If Bricks changes its content meta key or global class option name, update the isolated adapter helpers in `jigma-bricks.php`.
- Inline SVG and JavaScript Code elements may require manual signing/review inside Bricks.
- The floating panel still includes a lightweight proof-of-concept browser exporter; production conversion should continue to be verified against the standalone shared exporter fixtures.
