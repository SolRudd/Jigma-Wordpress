# Jigma Bricks

Beta WordPress plugin for running Jigma inside a Bricks Builder editing context.

## What it does

- Detects Bricks Builder by theme, constants, or loaded Bricks classes.
- Loads assets only for authorised Bricks builder/admin requests, including frontend builder URLs such as `?bricks=run`.
- Adds one scoped bottom Jigma dock inside the Bricks workspace with HTML, CSS, and JavaScript editors.
- Uses the bundled shared Jigma Core conversion engine.
- Generates a Bricks copied-elements payload and copies it to the clipboard.
- Inserts generated elements into the selected Bricks element only.
- Creates generated BEM classes as native Bricks global class records.
- Assigns generated class IDs to elements through `_cssGlobalClasses`.
- Preserves class-owned custom CSS from the shared Bricks Compatibility payload.
- Adds JavaScript only when enabled, as one disabled Code element for review.

## Installation

1. In WordPress admin, go to Plugins > Add New > Upload Plugin.
2. Upload `jigma-bricks.zip`.
3. Activate Jigma Bricks.
4. Open a page or template in Bricks Builder.
5. Select a nestable Bricks element, such as a Section, Container, Div, Block, or Accordion item.
6. Use the Jigma dock at the bottom of the builder workspace.

If the dock does not appear, confirm Bricks is active and reload the builder URL. Assets are intentionally enqueued only in detected Bricks builder/admin contexts.

## Loading diagnostics

For a logged-in user who can edit the current post, add `jigma_debug=1` to the Bricks builder URL to force Jigma asset loading and expose safe browser diagnostics:

```text
window.JigmaBricksDiagnostics
```

Diagnostics include enqueue status, builder detection status, core/config load state, mount state, workspace detection, dock state, plugin version, and initialization errors. They do not expose nonces, generated content, source code, or private page data.

During beta, plugin CSS and JavaScript use `filemtime()` versions to avoid stale browser or CDN caches. If `assets/jigma-core.js`, `assets/jigma-bricks.js`, or `assets/jigma-bricks.css` is missing, Jigma renders a visible development error instead of failing silently.

## Dock UI beta

- The dock mounts once under `#jigma-bricks-root` and scopes all plugin styles under that root.
- Jigma detects the central Bricks workspace bounds and docks to that area so side panels, top bars, and dialogs are not intentionally covered.
- If the workspace cannot be detected, Jigma shows a fallback warning and uses a safe bottom dock.
- The fallback dock mounts before workspace detection. Workspace detection runs asynchronously and repositions the dock when it succeeds.
- Dock state persists locally as expanded, collapsed, or hidden. Hidden mode shows a small launcher.
- Default dock height is 320px and can be resized between 180px and 65vh.
- Editors can be shown or hidden from Settings. Wide screens show active editors side by side; narrow screens use editor tabs.
- Run performs analysis only. It does not insert, reload, or modify the Bricks page.
- Insert into Selected is the only native insertion action.
- Copy Bricks Structure remains available for manual paste testing.
- Saved Sections and the last editor workspace are stored only in browser local storage.
- Reset Jigma UI clears only `jigma_bricks_ui_v1` and `jigma_bricks_workspace_v1`.

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

## Manual test flow

1. Open Bricks Builder and select a nestable target element.
2. Paste HTML, CSS, and optional JavaScript into the Jigma dock.
3. Click Run Preview.
4. Review the status drawer for page-level CSS, unsigned SVG/code, dependencies, or conflicts.
5. Click Copy Bricks Structure to inspect the exact shared compatibility payload if needed.
6. Click Insert into Selected.
7. Reload the Bricks builder when Jigma reports success.
8. Confirm generated labels, native classes, class CSS, links, attributes, SVG/code review state, save, and frontend reload behavior.

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
