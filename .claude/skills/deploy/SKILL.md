---
name: deploy
description: Build, check the base path and CESIUM_BASE_URL, trigger the GitHub Pages workflow and verify the live site with Playwright. Human-triggered only (/deploy).
disable-model-invocation: true
---

# Deploy to GitHub Pages

Deploys normally happen automatically after CI passes on `main` (`.github/workflows/deploy.yml`, ADR-014).
Use this checklist for a manual redeploy or to debug a broken live site.

1. **Local production build** (in `app/`): `npm ci && npm run build`.
   - `dist/index.html` must reference `/himalaya-3d/assets/...`.
   - `dist/cesium/` must contain `Workers/`, `ThirdParty/`, `Assets/`, `Widgets/`.
2. **Base path check:** `npm run e2e` — the smoke test serves the build under `/himalaya-3d/`
   and fails on any 404 (wrong `CESIUM_BASE_URL` shows up here first).
3. **Secret present?** `gh secret list` must show `CESIUM_ION_TOKEN`. Never print its value.
   If missing, ask a human to run `gh secret set CESIUM_ION_TOKEN`.
4. **Trigger:** `gh workflow run deploy.yml --ref main`, then `gh run watch` on the new run.
5. **Verify live:** open `https://<owner>.github.io/himalaya-3d/` with the Playwright MCP:
   - globe renders with terrain (no "No Cesium ion token" notice),
   - credits and the medical disclaimer are visible,
   - browser console has no 404s for `/himalaya-3d/cesium/...`.
6. **Token restriction:** the production ion token must have Allowed URLs set to the Pages URL
   (a human does this on ion.cesium.com).
7. Record the deploy (commit SHA, date, result) in `docs/PROGRESS.md`.
