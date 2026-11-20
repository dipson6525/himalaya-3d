# Glossary

Plain-English definitions of terms used in the code and docs. Add a term the first time you use it.

| Term | Meaning |
| --- | --- |
| **ADR** | Architecture Decision Record — a short note of an important choice and why (`docs/decisions.md`). |
| **Base path** | The URL folder a site is served from. Ours is `/himalaya-3d/` on GitHub Pages and `/` in dev. |
| **Catmull-Rom spline** | A smooth curve that passes through every given point; used for the flythrough path (M4). |
| **Cesium ion** | Cesium's cloud service that streams World Terrain and imagery; needs an access token. |
| **CESIUM_BASE_URL** | The URL folder where Cesium looks for its workers, assets and widget CSS at runtime. |
| **CI** | Continuous Integration — GitHub Actions runs lint, type checks and tests on every push/PR. |
| **Bounding box** | The latitude/longitude rectangle a value must fall in. Our route validator uses a loose box around Nepal to catch swapped coordinates. |
| **Devanagari** | The script Nepali is written in (Unicode block U+0900–U+097F). |
| **Douglas–Peucker** | Line-simplification algorithm that drops points close to the straight line between neighbours. |
| **ECEF** | Earth-Centred, Earth-Fixed coordinates: x, y, z in metres from the Earth's centre. Cesium's `Cartesian3`. |
| **FeatureCollection** | A GeoJSON object holding a list of Features; each route file is one. A Feature = geometry + properties. |
| **envDir** | The Vite setting for which folder `.env*` files are read from (ours: project root). |
| **GeoJSON** | JSON format for map features; coordinates are `[longitude, latitude]`. |
| **Haversine formula** | Great-circle distance between two lat/lon points on a sphere (M4). |
| **i18n** | Internationalisation — making all text swappable per language. |
| **Imagery** | The map picture draped over the globe (satellite or drawn map). |
| **ODbL** | Open Database License, OpenStreetMap's licence: credit OSM and share-alike derived databases. |
| **Overpass API** | A read-only API for querying OpenStreetMap data. Free and shared — query politely. |
| **Playwright** | Tool that drives a real browser for end-to-end tests and screenshots. |
| **Rest day** | A day spent sleeping at the same stop to acclimatize. In our data: the next stop's `day` jumps by 2. |
| **requestRenderMode** | Cesium option to redraw only when something changes, saving CPU/GPU. |
| **Sleeping altitude** | The altitude where a trekker spends the night; the acclimatization rule is about this, not the highest point reached that day. |
| **SwiftShader** | A software (CPU) implementation of the GPU API, used for WebGL on CI machines without a GPU. |
| **Terrain** | The 3D shape of the ground (heights). Cesium World Terrain is a global terrain dataset. |
| **Vite** | The build tool / dev server for our front end. |
| **Vitest** | Unit-test runner that uses Vite's configuration. |
| **WebGL** | Browser API for GPU drawing; CesiumJS is built on it. |
| **WMS** | Wilderness Medical Society — publishes the altitude-illness guidelines we follow (Luks et al.). |
