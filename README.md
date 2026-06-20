# Jigma

Jigma is a local Vite React tool for converting pasted HTML and CSS into a
strict BEM, Bricks Builder-oriented clipboard structure.

The MVP workflow is intentionally narrow:

1. Paste HTML and CSS.
2. Run the sandboxed preview.
3. Inspect/select/delete layers.
4. Set a project prefix and BEM block name.
5. Copy the Bricks structure.
6. Manually paste-test in Bricks.

## Local Setup

Install Node 20.19+ or 22.12+, then run:

```sh
npm install
npm run dev
```

Run tests:

```sh
npm run test
```

Production-style run:

```sh
npm run build
npm run preview
```

The app uses Vite directly. Fresh SSR is not part of the runtime.

## MVP Behavior

- Generates BEM classes for every exported element.
- Defaults to strict BEM mode, which does not preserve original source classes.
- Hybrid/preserve modes keep valid original classes in addition to generated BEM.
- Scopes CSS to generated BEM classes where selectors can be mapped safely.
- Drops and warns on unmapped selectors, unused selectors, pseudo selectors,
  unsupported at-rules, unsupported HTML-to-Bricks mappings, dependencies, and
  detected JavaScript.
- Respects selected, deselected, and deleted layer state during export.
- Treats JavaScript as custom code/dependency only. It is not converted or
  embedded as executable Bricks behavior.

## Important Limitations

- Bricks clipboard data is not a stable public schema. Manual Bricks paste tests
  are required after this pass.
- GUI/native Bricks style mapping is disabled for the MVP; generated BEM CSS is
  the reliable path.
- Complex selectors, pseudo-elements, pseudo-classes, tag-only selectors,
  unsupported at-rules, and selectors that reference deleted/deselected layers
  are dropped with warnings.
- External stylesheets, scripts, fonts, SVGs, and custom JavaScript require
  manual review/signing in Bricks.
- The parser is designed for section-level HTML, not full browser-grade document
  recovery.

## Manual Bricks Paste Test Checklist

1. Run `npm run dev`.
2. Paste a real section into HTML/CSS.
3. Click Run Code and verify preview.
4. Confirm layer tree matches the section structure.
5. Deselect one child layer and confirm it is absent from the JSON.
6. Delete one child layer and confirm siblings/parents remain valid.
7. Set prefix/block name and confirm generated classes use that BEM block.
8. Copy Bricks Structure.
9. Paste into a clean Bricks page.
10. Confirm structure panel hierarchy, headings, links, buttons, images, and text.
11. Confirm generated BEM classes are attached.
12. Confirm scoped CSS applies where expected.
13. Review warnings for dropped CSS/dependencies/JS and rebuild those manually.

## Key Files

- `src/components/JigmaBuilder.tsx` - UI shell and layer state.
- `src/App.tsx` and `src/main.tsx` - Vite React entry.
- `lib/bricks/export.ts` - Bricks-oriented strict BEM exporter.
- `lib/bem/classes.ts` - BEM class generation.
- `lib/css/scope.ts` - CSS selector scoping to generated BEM classes.
- `lib/parser/html.ts` - HTML parsing, layers, and serialization.
- `lib/dependencies/inspect.ts` - dependency detection.
- `lib/preview/document.ts` - sandbox preview document.
- `tests/fixtures/sections.ts` - real section fixtures.
- `tests/bricks_export_test.ts` - exporter regression tests.
