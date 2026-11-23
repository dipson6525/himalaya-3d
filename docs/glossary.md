# Glossary

Plain-English definitions of terms used in the code and docs. Add a term the first time you use it.

| Term | Meaning |
| --- | --- |
| **ADR** | Architecture Decision Record — a short note of an important choice and why (`docs/decisions.md`). |
| **Base path** | The URL folder a site is served from. Ours is `/himalaya-3d/` on GitHub Pages and `/` in dev. |
| **Catmull-Rom spline** | A smooth curve that passes through every given point; used for the flythrough path (`engine/flythrough/path.ts`). |
| **Cesium ion** | Cesium's cloud service that streams World Terrain and imagery; needs an access token. |
| **CESIUM_BASE_URL** | The URL folder where Cesium looks for its workers, assets and widget CSS at runtime. |
| **Component tree** | The nesting of React components: which component renders which. Drawn in `docs/ui-design.md`. |
| **CI** | Continuous Integration — GitHub Actions runs lint, type checks and tests on every push/PR. |
| **Bounding box** | The latitude/longitude rectangle a value must fall in. Our route validator uses a loose box around Nepal to catch swapped coordinates. |
| **Dead band** | A change is only counted once it is at least a set size (here 5 m) from the last turning point, so small wobbles are ignored. Used for the profile's total ascent and descent. |
| **Devanagari** | The script Nepali is written in (Unicode block U+0900–U+097F). |
| **Douglas–Peucker** | Line simplification: find the point farthest from the line joining the first and last points; if it is within the tolerance drop everything between them, otherwise keep it and repeat on both halves. |
| **EPSG code** | A number that names a coordinate system: 4326 = longitude/latitude (WGS84); 32645 = UTM zone 45 north. |
| **ECEF** | Earth-Centred, Earth-Fixed coordinates: x, y, z in metres from the Earth's centre. Cesium's `Cartesian3`. |
| **Exponential smoothing** | Each frame, move a fraction α = 1 − e^(−dt/τ) of the way to the target; after τ seconds about 63% of the way. Used for the flythrough heading. |
| **FeatureCollection** | A GeoJSON object holding a list of Features; each route file is one. A Feature = geometry + properties. |
| **Ellipsoid height** | Height above the smooth WGS84 ellipsoid (Cesium's terrain heights). Not the same as height above sea level, which the cited stop altitudes use. |
| **envDir** | The Vite setting for which folder `.env*` files are read from (ours: project root). |
| **GeoJSON** | JSON format for map features; coordinates are `[longitude, latitude]`. |
| **Haversine formula** | Great-circle distance between two lat/lon points on a sphere (M4). |
| **Heading and pitch** | Camera angles: heading = compass direction (0° north, 90° east); pitch = up/down angle (0° level, −90° straight down). |
| **i18n** | Internationalisation — making all text swappable per language. |
| **Daily stage** | The part of the trail walked on one day: from one overnight stop to the next (`lib/geo/stages.ts`). |
| **Landmark** | A page region a screen reader can jump to (banner, main, contentinfo = footer, …). `<header>`, `<main>` and `<footer>` get one automatically. |
| **Roving tabindex** | Only one item of a group (the selected tab) has `tabIndex=0`; the others have `-1`, so Tab reaches the group once and arrow keys move inside it. |
| **Imagery** | The map picture draped over the globe (satellite or drawn map). |
| **Projection onto a line** | Finding the point of a line nearest to a given point: for each segment, t = ((P − A)·(B − A)) / \|B − A\|², clamped to 0…1. |
| **ODbL** | Open Database License, OpenStreetMap's licence: credit OSM and share-alike derived databases. |
| **linemerge** | shapely function that joins lines sharing an end point into one line (flipping them where needed). |
| **Overpass API** | A read-only API for querying OpenStreetMap data. Free and shared — query politely. |
| **Playwright** | Tool that drives a real browser for end-to-end tests and screenshots. |
| **React context** | A way to give a value to every component below a provider without passing it as a prop through each level. We use `AppState` and `ViewerContext`. |
| **Rest day** | A day spent sleeping at the same stop to acclimatize. In our data: the next stop's `day` jumps by 2. |
| **requestRenderMode** | Cesium option to redraw only when something changes, saving CPU/GPU. |
| **Sleeping altitude** | The altitude where a trekker spends the night; the acclimatization rule is about this, not the highest point reached that day. |
| **SwiftShader** | A software (CPU) implementation of the GPU API, used for WebGL on CI machines without a GPU. |
| **Terrain** | The 3D shape of the ground (heights). Cesium World Terrain is a global terrain dataset. |
| **TOML** | A simple config-file format (`key = value`, `[[tables]]`) that Python reads with the built-in `tomllib`. Used for route specs. |
| **UTM** | Universal Transverse Mercator: splits the Earth into 6-degree-wide zones, each a flat map in metres. Nepal is in zones 44 and 45. |
| **Vite** | The build tool / dev server for our front end. |
| **Vitest** | Unit-test runner that uses Vite's configuration. |
| **WebGL** | Browser API for GPU drawing; CesiumJS is built on it. |
| **Wireframe** | A rough sketch of a screen layout (boxes and labels, no real data or styling). |
| **WMS** | Wilderness Medical Society — publishes the altitude-illness guidelines we follow (Luks et al.). |
