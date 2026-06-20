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
- Attaches matching simple CSS rules as class custom CSS using `%root%`.
- Keeps JavaScript out of the inserted structure by default; it can be added only as a disabled Code element for review.

## Native insertion proof of concept

The panel posts generated Bricks elements and generated BEM class records to a WordPress AJAX endpoint. The PHP adapter normalizes IDs, strips Jigma-only metadata, merges generated class records into Bricks' `bricks_global_classes` option, reuses exact class-name matches, reports style conflicts, applies Bricks' save-security filter when available, and appends the elements to the documented Bricks content meta key.

This POC does not mutate Bricks' live canvas JavaScript state. After insertion, reload the Bricks builder to verify the saved page content.

## What it does not do yet

- Native Bricks panel registration.
- Live insertion into the current Bricks canvas without reload.
- Two-way sync with existing Bricks elements.
- Licensing, accounts, AI, or cloud services.
