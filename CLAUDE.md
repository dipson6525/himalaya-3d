# Himalaya 3D — KU COMP 206 (Unique Ghimire, Sparsh Gorkhali, Dipson Gurung)
Static web app: 3D Nepal (CesiumJS) + trek planning. No custom server. Deployed to GitHub Pages.

## Golden rules
- Work only inside this folder. Never read/print/commit secrets (.env.local, tokens).
- Never invent data, altitudes, test results, FPS, load times or user feedback. Unknown → "TODO(team): verify".
- Code must be explainable by a 2nd-year student: simple > clever, header comment per file, doc comment per function.
- Safety features are general guidance, NOT medical advice — disclaimer always visible.
- Feature PRs are reviewed and merged by the owning student; don't self-merge unless told.

## Ownership (use as commit scope + PR label)
- Unique: data-prep/, data/routes/, app/src/lib/acclim/, app/src/features/acclimatization/, trek content
- Sparsh: app/src/engine/, app/src/lib/geo/, flythrough, performance
- Dipson: app/src/ui/, app/src/i18n/, elevation profile, live layers, docs/

## Commands
- Front end (in app/): npm ci · npm run dev · npm run build · npm run preview
- Checks: npm run lint · npm run typecheck · npm test · npm run e2e
- One unit test: npx vitest run src/lib/acclim/checker.test.ts
- Data prep (in data-prep/): python -m venv .venv · pip install -r requirements.txt · pytest · ruff check .
  On this Windows laptop `python` is the Store alias: use `py -3.12 -m venv .venv`, then `.venv/Scripts/python`.
- Test locations: unit tests next to code (src/**/x.test.ts); cross-module checks in app/tests/; e2e in app/e2e/.
- e2e serves the production build under /himalaya-3d/ and fails on any 404. Screenshots go to
  docs/screenshots/ only with UPDATE_SCREENSHOTS=1 (PowerShell: `$env:UPDATE_SCREENSHOTS=1; npm run e2e`).
- Deploy runs only after CI passes on main (workflow_run); manual: `gh workflow run deploy.yml`.

## Conventions
- TypeScript strict; ESLint + Prettier; Python ruff.
- Conventional Commits with area scope: feat(flythrough): …, fix(i18n): …, docs(viva): …
- No AI co-author trailers or "Generated with" lines in commits/PRs (team decision, ADR-016;
  set in .claude/settings.json "attribution"). AI help is disclosed in docs/AI_USAGE.md instead.
- Branch per issue: <member>/<topic>. PR must link issue, include test evidence + screenshot.
- All UI strings in app/src/i18n/en.json and ne.json (keys must match; test enforces it).
- Route GeoJSON schema: docs/data-schema.md. Every altitude cites a source in data/routes/route-sources.md.

## Gotchas
- Cesium token: import.meta.env.VITE_CESIUM_ION_TOKEN (dev: .env.local; CI: secret CESIUM_ION_TOKEN).
  It is visible in the built site by design — protection is the Allowed-URLs restriction on the prod token.
- Vite base is /himalaya-3d/ in production; CESIUM_BASE_URL must include it or workers/assets 404 on Pages.
- Overpass API: one query at a time, cache results in data-prep/cache/; never run in CI.
- Open-Meteo free tier: <10k calls/day; batch + cache. Credit "Weather data by Open-Meteo.com".
- Credits (OSM/ODbL, Cesium, USGS, Open-Meteo) must stay visible on the map.

## Docs to keep current
docs/PROGRESS.md (log) · docs/decisions.md · docs/viva/<member>.md · docs/AI_USAGE.md · README.md
