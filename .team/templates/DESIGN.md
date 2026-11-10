# DESIGN.md

The design rules every agent follows when it builds or changes a screen. Keep it short; the owner approves changes to it.

## Brand
- Product name, one-line personality (for example: calm, precise, friendly):
- Voice for UI copy: plain words, sentence case, real content (never lorem ipsum).

## Tokens (the only allowed values)
Defined once as CSS variables (or the platform equivalent) in `<path>`. Components use tokens, never raw values; a lint rule blocks raw colours.

| Token group | Names | Notes |
|---|---|---|
| Colour | `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--color-accent`, `--color-danger` | Light and dark values for each; text contrast at least 4.5:1 |
| Type | `--font-body`, `--font-display`, sizes `--text-sm` … `--text-2xl` | Pick fonts on purpose; avoid the defaults every AI reaches for |
| Space | `--space-1` … `--space-8` | One scale for padding, gaps and margins |
| Radius, shadow | `--radius-*`, `--shadow-*` | |

## Components
- Library: `<one standard library>`, kept close to its defaults (agents know the defaults; heavy customisation confuses them).
- New components live in `<path>` and need a keyboard-only check before merge.

## Do
- Design for phone first, then desktop; check both, in light and dark.
- Show empty, loading, error and refusal states for every screen.
- Use cards only for things you can act on.

## Don't
- Raw hex or pixel values outside the token file.
- Purple-on-white gradients, stock hero blobs, emoji as icons, centred everything.
- New fonts, colours or components without a change to this file.
