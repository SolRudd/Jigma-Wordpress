# Jigma Bricks

Beta WordPress plugin for running Jigma inside a Bricks Builder editing context.

## What it does

- Detects Bricks Builder by theme, constants, or loaded Bricks classes.
- Loads assets only for likely Bricks builder/admin requests.
- Adds a compact bottom Jigma dock with HTML, CSS, and JavaScript editors.
- Uses the bundled shared Jigma Core conversion engine.
- Generates a Bricks copied-elements payload and copies it to the clipboard.
- Inserts generated elements into the selected Bricks element only.
- Creates generated BEM classes as native Bricks global class records.
- Assigns generated class IDs to elements through `_cssGlobalClasses`.
- Preserves class-owned custom CSS from the shared Bricks Compatibility payload.
- Adds JavaScript only when enabled, as one disabled Code element for review.

## Native insertion beta

The dock runs the same Bricks Compatibility exporter used by the standalone Copy Bricks Structure action. The PHP adapter persists only this six-key payload:

- `content`
- `source`
- `sourceUrl`
- `version`
- `globalClasses`
- `globalElements`

The PHP adapter validates that schema, requires a selected nestable Bricks target, saves global class records before page elements, remaps class and element IDs, validates every `_cssGlobalClasses` reference, applies Bricks' save-security filter when available, and appends imported roots to the selected target's `children` array.

Jigma never silently inserts component structure at the page root. If no selected target is available, or the selected element cannot contain children, insertion is blocked. Page root is used only for the optional `Jigma Page Styles` CSS Code element when page-level CSS is explicitly included.

Existing Bricks classes are reused only when the same class name has identical settings. A same-name class with different settings returns a conflict and no content is inserted.

This beta does not mutate Bricks' live canvas JavaScript state. After insertion, reload the Bricks builder to verify the saved page content.

## What it does not do yet

- Native Bricks panel registration.
- Live insertion into the current Bricks canvas without reload.
- Two-way sync with existing Bricks elements.
- Non-empty Bricks `globalElements` persistence.
- Live WordPress/Bricks QA automation.

## Known limitations

- Builder reload is required after insertion.
- Selected-target detection depends on available Bricks builder globals and saved content summaries. If detection is unavailable, insertion is disabled and Copy Structure remains available.
- Non-nestable targets such as Heading, Text, Button, Image, SVG and Code elements are unsupported insertion targets.
- If Bricks changes its content meta key or global class option name, update the isolated adapter helpers in `jigma-bricks.php`.
- Inline SVG and JavaScript Code elements may require manual signing/review inside Bricks.
- Page-level CSS is stored in one reusable `Jigma Page Styles` CSS Code element only when explicitly included.
