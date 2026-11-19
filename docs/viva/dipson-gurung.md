# Viva notes — Dipson Gurung (041055-25)

Areas: UI (`app/src/ui/`), translations (`app/src/i18n/`), elevation profile, live layers
(earthquakes, weather), sun slider, documentation (`docs/`). Labels: `area:ui`, `area:i18n`,
`area:elevation`, `area:live-layers`, `area:docs`.

## Your part in one paragraph

You own what the user reads and touches: the page layout, every piece of text in two languages,
and the panels that show data — the elevation profile (M4), live earthquake and weather layers
and the sun-position slider (M6). You also keep the documentation current. In M0 that is the
layout with an always-visible medical disclaimer, a tiny translation helper with a test that
keeps English and Nepali in sync, and the requirements and architecture documents.

## File map (so far)

| File | Purpose | FR |
| --- | --- | --- |
| `app/src/ui/App.tsx` | Page layout: header, globe, side panel, disclaimer footer | all, NFR6 |
| `app/src/ui/styles.css` | CSS grid layout; stacks to one column below 900 px | NFR4 |
| `app/src/main.tsx` | Entry point: loads Cesium setup + CSS, renders `<App/>` | all |
| `app/src/i18n/index.ts` | `t(key, language)` translation helper | FR9 |
| `app/src/i18n/en.json`, `ne.json` | All UI strings in English and Nepali | FR9 |
| `app/tests/i18n.test.ts` | Fails if the two dictionaries have different keys | FR9 |
| `docs/requirements.md`, `docs/architecture.md` | FR1–FR9, NFRs, diagrams | all |

## Module walkthroughs

### `i18n/index.ts` — translations without a library

Every visible string has a key such as `"disclaimer.medical"`. `en.json` and `ne.json` map the
same keys to English and Nepali text. Components call `t('disclaimer.medical')`.

Two safety nets:
1. **TypeScript**: `MessageKey = keyof typeof en`, so `t('typo.key')` is a compile error, and
   `ne` is typed as `Record<MessageKey, string>`, so a key missing from `ne.json` fails `tsc`.
2. **Vitest** (`tests/i18n.test.ts`): sorts both key lists and compares them, so an *extra*
   key in either file also fails, and checks no string is empty.

Why not `react-i18next`? We have two languages and a handful of strings; 20 lines we can explain
beat a library we can't (ADR-007). The language toggle comes in M6 (#27).

### `App.tsx` + `styles.css` — layout

A three-row CSS grid: header / main / footer. The footer holds the medical disclaimer, so it is on
screen whatever the user does (NFR6). `main` is a two-column grid (globe | side panel); a media
query below 900 px stacks them so the app works on tablets (NFR4). `min-height: 0` lets the globe
shrink inside the grid instead of pushing the footer off-screen.

## Key concepts from first principles

- **i18n** ("internationalisation", 18 letters between i and n): designing the app so text can be
  swapped per language without changing code.
- **Devanagari rendering**: Nepali needs a font with Devanagari glyphs; the CSS font stack
  includes `Noto Sans Devanagari` and falls back to the system font.
- **Accessibility roles**: the disclaimer uses `role="note"` and the no-token notice
  `role="status"`, so screen readers announce them and tests can find them by role.

## Likely viva questions (M0 part — more added with each feature)

1. **How does `t()` work?** — Looks up the key in the chosen dictionary; falls back to English,
   then to the key itself so nothing crashes.
2. **What stops someone forgetting a Nepali translation?** — `tsc` (missing key) and the Vitest
   parity test (missing or extra key); both run in CI.
3. **Why keep the disclaimer in the layout footer?** — It must be visible on every screen; putting
   it in one place guarantees that.
4. **How is the layout responsive?** — CSS grid + one media query at 900 px.
5. **Who checked the Nepali?** — Nobody yet: it is machine-drafted and listed in
   `docs/i18n-review.md` for native-speaker review.
6. **Why a static site?** — Free hosting, nothing to secure; see `docs/architecture.md`.
7. **What would you improve?** — A language toggle that remembers the choice (M6), and showing
   numbers in Nepali digits (०१२…) when Nepali is selected.

## Prove you understand it (do these by hand, no AI)

1. Add a key `"panel.title"` to `en.json` only; run `npm run typecheck` and `npm test`; read both
   failures; then add the Nepali string and make them pass.
2. Change the media-query breakpoint to 768 px and check the layout in the browser's device mode.
3. Explain (out loud) why `t()` returns the key itself when a translation is missing.
4. Add the `glossary.md` entry for a term you had to look up this week.

## Changelog

- 2026-11-19 — M0: layout, disclaimer, i18n helper + parity test, requirements, architecture.
