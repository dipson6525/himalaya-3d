# Viva notes — Unique Ghimire (041053-25)

Areas: route data (`data-prep/`, `data/routes/`), trek content, acclimatization rules
(`app/src/lib/acclim/`) and itinerary UI (`app/src/features/acclimatization/`).
Labels: `area:route-data`, `area:trek-content`, `area:acclimatization`.

## Your part in one paragraph

You own the data and the safety logic. You turn OpenStreetMap trails and published trek
information into clean route files with honest, cited altitudes (M2), and you build the
acclimatization checker that flags itineraries that gain sleeping altitude too fast, following
the Wilderness Medical Society guidelines (M5). In M0 that is the Python project: a reproducible
environment, shared folder paths, a citation template, and smoke tests.

## File map (so far)

| File | Purpose | FR |
| --- | --- | --- |
| `data-prep/requirements.txt` | Pinned Python packages (gpxpy, shapely, pyproj, requests, pytest, ruff) | FR2 |
| `data-prep/pyproject.toml` | ruff + pytest settings | — |
| `data-prep/prep/paths.py` | Folder constants every script uses | FR2 |
| `data-prep/tests/test_environment.py` | Proves the libraries import and folders exist | — |
| `data-prep/cache/` | Committed Overpass responses (ODbL) | FR2 |
| `data/routes/route-sources.md` | Every altitude's source + disagreements table | FR2, NFR9 |
| `docs/data-schema.md` | The rules every route file must follow | FR2 |
| `data-prep/prep/schema.py` | Validator: checks a route file and lists every problem | FR2 |
| `data-prep/tests/test_schema.py` | One test per rule, plus a check of every real route file | FR2 |
| `app/src/features/routes/types.ts` | The same shape as TypeScript types + type guards, for the front end | FR2 |
| `app/src/features/routes/types.test.ts` | Vitest check of the type guards | FR2 |
| `data-prep/prep/overpass.py` | One cached, polite Overpass request per route; never in CI | FR2 |
| `data-prep/prep/build_route.py` | Spec → ways → one trail → simplified → checked → GeoJSON | FR2 |
| `data-prep/route-specs/` | One hand-written TOML spec per trek, plus `_template.toml` | FR2 |
| `data-prep/tests/test_overpass.py`, `test_build_route.py` | Pipeline tests with synthetic data, no network | FR2 |
| `app/src/lib/acclim/checker.ts` | The acclimatization rules (`checkItinerary`) and `nightsFromStops` | FR5 |
| `app/src/lib/acclim/checker.test.ts` | 25 test cases: safe and unsafe plans, exact 3,000 m / 500 m edges | FR5 |
| `docs/testing/acclimatization-matrix.md` | The same cases as a table for the report (results filled by you) | FR5 |

Coming next: the four routes (#9–#12), altitude cross-check (#13), itinerary editor (#24).

## Module walkthroughs

### Virtual environment and pinned requirements

A **venv** is a private copy of Python's package folder for one project, so our package versions
don't clash with other projects. **Pinning** (`shapely==2.2.0`) means everyone — and CI — installs
exactly the same versions, so "works on my laptop" also means "works in CI".

### `prep/paths.py`

`Path(__file__).resolve().parents[1]` is the `data-prep/` folder no matter where you run the
script from; the project root is its parent. Scripts import `ROUTES_DIR`, `CACHE_DIR` instead of
typing paths, so moving a folder means changing one line.

### Why cache Overpass responses in git?

Overpass is a free service run by volunteers. Each query can be heavy. We query **once**, save the
raw JSON in `data-prep/cache/`, and every later run reads the file. This is polite, makes the
pipeline reproducible offline, and lets reviewers see exactly what data we started from.

### The route schema and validator (`docs/data-schema.md`, `prep/schema.py`)

**What a route file is.** One GeoJSON FeatureCollection per trek: one `route` feature (the trail as
a LineString) and one `stop` feature per overnight stop (a Point), in walking order. Every feature
has `properties.kind` so the app can tell them apart.

**Data flow of the validator.**

```
route file ──json.loads──► validate_route(data, known_sources, expected_id)
                              1. top level is a FeatureCollection?
                              2. sort features into route / stops (by kind)
                              3. check each feature: names of properties, text, id, source,
                                 day, altitude, geometry, positions
                              4. compare stops: unique stop ids, first stop is day 1,
                                 days increasing
                           ──► list of error messages ([] = valid)
route-sources.md ──load_source_ids (reads the file)──► parse_source_ids (reads the text)
                 ──► {"OSM", ...} = known_sources
```

**Key functions.**
- `validate_route` — the whole-file check above; returns every problem, not just the first, so
  you can fix a file in one pass.
- `validate_file` — reads a `.geojson` file as UTF-8 and parses it. A file saved as UTF-16 (what
  Windows PowerShell 5 writes by default) raises `UnicodeDecodeError`, and broken JSON raises
  `JSONDecodeError`; both are caught and turned into one error message instead of a crash. The
  file name (without `.geojson`) is the expected route id.
- `load_source_ids` — opens `route-sources.md` and hands its text to `parse_source_ids`, which
  reads the first column of the "## Sources" table, skipping the header and `| --- |` rows.
- `_check_position` — `[lon, lat]` inside a loose box around Nepal; if the numbers look swapped
  it says "looks like [lat, lon]".
- `_check_text` — non-empty, no `TODO`, and Nepali fields must contain Devanagari.
- `main` — `python -m prep.schema` checks every file in `data/routes/` and exits with 1 on errors.

**Code details an examiner may poke at.**
- `ID_PATTERN = ^[a-z0-9]+(-[a-z0-9]+)*$` means: one or more lowercase letters/digits, then any
  number of groups "hyphen + letters/digits". So `namche-bazaar` matches, but `namche--bazaar`
  fails (a group cannot start with a second hyphen), and so do `-namche`, `Namche` and
  `namche bazaar`.
- `_is_number` rejects `bool` first (in Python `True` is an `int`), then non-numbers, then uses
  `math.isfinite`, because Python's `json.loads` accepts the words `NaN` and `Infinity` and turns
  them into floats.
- The `is_valid_day` guard in `validate_route`: the "first stop is day 1" and "days increase"
  comparisons only run when `day` is a whole number ≥ 1. A bad day such as `0.5` is already
  reported once by `_check_stop_feature`; without the guard it would also be compared and give
  a second, confusing error.
- `MAX_POSITION_ERRORS = 5`: an OSM trail can have thousands of points. If the whole line was
  saved as `[lat, lon]`, we print the first 5 problems and "... and N more bad positions".
- **How the tests are built.** `make_route()` returns a valid synthetic route; each test breaks
  exactly one thing and calls `assert_one_error_containing(errors, "fragment")`. Worked failing
  case: `test_first_stop_must_be_day_one` sets the stops to days 5 and 6. If you deleted the
  first-day rule from `schema.py`, `validate_route` would return `[]`, and the assertion
  `len(errors) == 1` would fail with `assert 0 == 1`.
- `types.test.ts` uses a route with one stop and source `TEST`, which the Python validator would
  reject (it needs 2 stops and real Source IDs). That is fine: that test only checks that the
  TypeScript type guards sort features correctly, not that the data is valid.

**Limits of the validator (say these honestly if asked).**
- It proves an altitude *names* a listed source, not that the number matches that source. A
  person still has to check the number against the book or map.
- Disagreements over 50 m are recorded **by hand** in the table in `route-sources.md`; the
  automatic comparison with Cesium terrain is issue #13.
- The `TODO` check is case-sensitive (`todo` would pass), and one Devanagari letter is enough for
  a Nepali field to pass.
- It does not check that each stop lies near the trail line.
- TypeScript types do no checking at runtime: the app trusts files that passed this validator.
- `main` has no branch protection, so a red CI run does not physically block a merge; the team
  rule is to never merge a PR whose CI is red.

**Why this design.**
- *Return a list of messages instead of raising an exception* — the first error would hide the rest.
- *Plain Python, no JSON-Schema library* — every rule is a few readable lines you can explain;
  a JSON Schema could not express "days increase" or "Source ID listed in a Markdown table" anyway.
- *Positions only in the geometry* — storing `lat`/`lon` twice would let the copies disagree.
- *No rest-day field* — nights at a stop = next stop's `day` − this stop's `day`, so the data
  cannot contradict itself.
- *Reject `TODO` and unknown property names* — makes "never invent data" and typo-catching
  automatic in CI instead of relying on reviewers.

### The route pipeline (`prep/overpass.py`, `prep/build_route.py`, issue #8)

**Data flow.**

```
route-specs/<id>.toml ──load_spec──► spec (names, OSM ids, stops)
        │
        ├─query_for──► Overpass QL text ──fetch_cached──► answer
        │                (cache hit: read data-prep/cache/<id>-ways.json; miss: ONE request, then save)
        │
        ▼
answer ──ways_to_lines──► one LineString per OSM way, (lon, lat)
       ──merge_lines───► ONE LineString   (gap, branch or closed loop → stop with an error)
       ──orient────────► starts at the end nearer the first stop
       ──check_stops_near_trail──► every stop within 500 m of the trail, or stop
       ──simplify_line─► Douglas–Peucker with the tolerance in metres (UTM)
       ──build_feature_collection + schema.validate_route──► errors? stop, write nothing
       ──to_geojson_text──► data/routes/<id>.geojson (one feature per line)
```

**Key functions.**
- `build_query` (overpass.py) — `[out:json][timeout:60];way(id:1,2);out geom;` for a way list, or
  `relation(ID);way(r);out geom;` for a route relation. `out geom` puts each way's positions in
  the answer, so one request is enough.
- `fetch_cached` — cache first; if the cached query differs from today's query it refuses (the
  spec changed, so the cache is out of date). With no cache: refuses in CI (`CI` env variable) or
  with `--offline`; otherwise sends **one** POST with the User-Agent and a 90 s timeout. A non-200
  answer or an Overpass `remark` (for example a timeout) raises an error and saves nothing; there
  is no retry loop. The saved file holds the query, the UTC date and the ODbL licence line.
- `load_spec` — reads the TOML (also accepts a UTF-8 byte-order mark) and checks the spec itself:
  required keys, no unknown keys (a typo such as `simplify_tolerence_m` is an error, not silently
  ignored), whole-number OSM ids, tolerance ≥ 0, stops as `[[stops]]` tables with numeric lon/lat.
  The route properties (names, days, altitudes, sources) are left to the schema validator, so the
  two tools never disagree about those rules.
- `merge_lines` — `shapely.ops.linemerge` joins lines that share an end point. One open piece →
  done; several pieces → error listing where each piece starts and ends; one **closed** piece
  (first point = last point) → error, because a parallel alternative path (A–B–C plus A–C) or a
  way listed twice makes the "trail" go round in a circle.
- `orient` — compares the distance from the first stop to each end and reverses if needed.
- `check_stops_near_trail` — measures each stop's distance to the trail in metres (UTM) and stops
  the build if one is more than 500 m away, which catches a mistyped lon/lat that the schema
  (which only checks "inside Nepal") would let through.
- `utm_epsg_for` + `simplify_line` — project to metres, simplify, project back.
- `build_route` — runs everything and returns a report (ways merged, points before/after,
  length before/after, tolerance) that `main` prints.

**Why this design** (ADR-019).
- *A spec file per route* — the only hand-written input; everything else is generated, so
  `data/routes/*.geojson` is never edited by hand.
- *Cache with the query inside* — anyone can see exactly what was asked and when, and a stale
  cache cannot silently be used after the spec changes.
- *Stop on gaps* — joining two pieces with a straight line would invent a trail that may cross a
  river or a cliff. The fix is to find the missing OSM way.
- *Simplify in metres, not degrees* — at 28 °N one degree of latitude is about 110.9 km but one
  degree of longitude only about 98.3 km, so "0.00005 degrees" would mean different distances in
  different directions.
- *Fake `post` in tests* — `fetch_cached` takes the request function as a parameter, so tests pass
  a fake one and never touch the network.

**Limits.**
- No real route has been built yet; the first real Overpass query happens in #9.
- Choosing the right OSM ways is human work; the pipeline only checks that they join up.
- Out-and-back treks: the line is the trail one way. Stops on the way back need their own ids
  (for example `namche-bazaar-return`).
- The 5 m tolerance is reasoned, not yet checked on the globe (TODO in ADR-019, M3).
- The 500 m stop limit is a team choice, not a measured value; confirm it with the first real
  routes (TODO in ADR-019).
- The cache compares the query text exactly: changing `QUERY_TIMEOUT_S` or the order of
  `osm_ways` makes every cache file stale (on purpose re-fetch needed).

### The acclimatization checker (`app/src/lib/acclim/checker.ts`, issue #23, FR5)

**What it does.** Takes one sleeping altitude per night and returns a list of warnings. It is a
pure function: no React, no Cesium, no network, so the same input always gives the same output
and Vitest can test it in milliseconds. The itinerary editor (#24) will call it on every change.

**The rules** (Wilderness Medical Society; Luks et al. 2019, unchanged in the 2024 update: above
3,000 m, do not raise the *sleeping* altitude by more than 500 m a day, and rest every 3–4 days).
With S_d = sleeping altitude on night d:

1. **Too fast:** flag night d (d ≥ 2) if S_d > 3000 **and** S_d − S_{d−1} > 500.
2. **Rest day needed:** a counter g (the proposal's Figure 3.2) goes up by one for every night
   that is both above 3,000 m and higher than the night before, and goes back to 0 otherwise
   (rest day = same altitude, descent, or a night at/below 3,000 m). Every night with g > 3 is
   flagged.

Both comparisons are strict (`>`), so exactly 3,000 m and exactly 500 m are allowed.

**Data flow.**

```
route stops (day, altitude_m) ──nightsFromStops──► [S_1, S_2, ..., S_n]  (one per night)
                                   └ nights at a stop = next stop's day − this stop's day
[S_1 ... S_n] ──checkItinerary──► [{ night, rule: 'too-fast', gainM }
                                   { night, rule: 'rest-day-needed', nightsGaining }]
                                   └ the UI (#24) turns these into words with t()
```

**Worked example** (synthetic numbers, not a real trek): S = [3100, 3400, 3700, 4000, 4600].

| Night | S_d | Gain | Above 3000? | Too fast? (gain > 500) | g | Rest needed? (g > 3) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 3100 | — | yes | — (no night before) | — | — |
| 2 | 3400 | +300 | yes | no | 1 | no |
| 3 | 3700 | +300 | yes | no | 2 | no |
| 4 | 4000 | +300 | yes | no | 3 | no |
| 5 | 4600 | +600 | yes | **yes** | 4 | **yes** |

So night 5 gets both warnings. That is the test "reports both rules on the same night".

**Why this design.**
- *Return data, not sentences* — the checker does not know the language; `{rule, night, gainM}`
  is turned into English or Nepali by the UI, so the same rules serve both languages.
- *Throw on impossible input (NaN, Infinity, negative)* — that would be a bug in the caller, and
  guessing would hide it.
- *Night 1 is never flagged* — there is no night before it to compare with (the flowchart starts
  at d = 2). The trek's starting town is not in the itinerary.

**How we know the tests are good (mutation check).** Each of these deliberate bugs was put into
`checker.ts` one at a time, and the tests failed every time: dropping the 3,000 m condition from
the counter; `>` → `>=` in each of the three comparisons; never resetting the counter.

**Limits (say these honestly).**
- It applies one published rule of thumb. It knows nothing about the person's health, previous
  altitude, medicines or symptoms — hence "general guidance, not medical advice", always shown.
- It looks only at sleeping altitudes, not the highest point reached during the day.
- The proposal's flowchart does not say what to do with nights at or below 3,000 m in the run
  counter; we reset it (team decision, ADR-024) because the guideline only applies above 3,000 m.

## Key concepts from first principles

- **GeoJSON**: a JSON format for map features. Coordinates are `[longitude, latitude]` — note
  the order, the opposite of how people usually say "lat, lon".
- **Douglas–Peucker simplification** (`shapely.simplify`): draw a straight line from the first
  point to the last. Find the point **farthest** from that line. If its distance is within the
  tolerance, drop every point in between. Otherwise keep that farthest point and repeat the same
  steps on the two halves (first → farthest, farthest → last). The smoke test checks the simplest
  case: `(0,0) (1,0) (2,0)` → the farthest point `(1,0)` is 0 away from the line, which is within
  the 0.1 tolerance, so it is dropped.
- **ODbL**: OpenStreetMap's licence — you may use the data if you credit "© OpenStreetMap
  contributors" and share derived databases under the same licence.
- **Bounding box**: the smallest latitude/longitude rectangle you accept. Ours (26.0–31.0 °N,
  79.5–88.5 °E) is a loose box around Nepal. Worked example of a swap: a stop near
  `[85.0, 28.0]` typed as `[28.0, 85.0]` has "longitude" 28.0 (outside 79.5–88.5) but both
  numbers fit the box the other way round, so the validator says "looks like [lat, lon]".
- **Nights from days (worked example with the test data)**: stop A `day: 1`, stop B `day: 3`
  → nights at A = 3 − 1 = 2, so day 2 is a rest day at A. Sleeping altitudes per night:
  night 1 = A, night 2 = A, night 3 = B. M5's checker starts from exactly this list.
- **Devanagari**: the script Nepali is written in; Unicode block U+0900–U+097F. Checking for at
  least one such character catches English accidentally pasted into `name_ne`.
- **UTM zones (worked example)**: zones are 6° wide, numbered from 180° W. Zone number =
  floor((lon + 180) / 6) + 1. For a longitude of 86.7 °E: (86.7 + 180) / 6 = 44.45 → floor 44 →
  zone 45 → EPSG 32645 (326xx = UTM north). For 83.9 °E: 263.9 / 6 = 43.98 → zone 44 → EPSG 32644.
  Exactly 84 °E gives 264 / 6 = 44 → zone 45, so a boundary belongs to the eastern zone (tested).
- **Why a metre tolerance needs a projection (worked example)**: the tests put a middle point
  0.000018° north of a straight east–west line at 28 °N. 0.000018 × 110.9 km ≈ 2 m, which is less
  than the 5 m tolerance, so Douglas–Peucker drops it. Moved 0.00018° (≈ 20 m) it is kept.
- **Length check (worked example)**: 0.01° of longitude at 28 °N ≈ 0.01 × 111.32 km × cos 28°
  = 0.01 × 111.32 × 0.883 ≈ 0.983 km. `length_m` (pyproj `Geod` on the WGS84 ellipsoid) agrees
  within 1%; the test checks exactly this.
- **Overpass `out geom`**: asks Overpass to include each way's list of `{lat, lon}` positions in
  the answer. Note Overpass writes lat first, while shapely and GeoJSON use (lon, lat):
  `ways_to_lines` swaps them.
- **The acclimatization rule (preview for M5)**: above 3,000 m, don't raise your *sleeping*
  altitude by more than 500 m per day, and take a rest day every 3–4 days (Luks et al. 2019;
  unchanged in the 2024 update).

## Likely viva questions

1. **Why Python for data prep and not the browser?** — It runs once, offline; Python has mature
   geometry libraries; the browser only loads the small result.
2. **Why no GDAL?** — Doesn't install cleanly on Windows; gpxpy/shapely/pyproj cover our needs (ADR-006).
3. **What does pinning versions protect against?** — A new library release changing behaviour
   between laptops or between laptop and CI.
4. **How do you make sure an altitude is not made up?** — Every stop must name a Source ID listed
   in `route-sources.md` (the validator enforces that). A person checks the number against that
   source, and differences over 50 m are recorded by hand in the Disagreements table; the
   automatic comparison with Cesium terrain is issue #13.
5. **Why commit the cache?** — Reproducibility and Overpass etiquette.
6. **What is GeoJSON coordinate order?** — `[lon, lat]`.
7. **How does CI catch a broken route file?** — `test_every_route_file_follows_the_schema` runs
   `validate_file` on each file in `data/routes/`; any error fails `pytest` in the data-prep job of
   the pull request, so the PR shows red. (Right now there are no route files, so pytest reports
   that test as skipped.) `main` has no branch protection, so the team rule "never merge a red PR"
   is what keeps bad files out.
8. **Why are `lat`/`lon` not properties?** — They are already the Point's coordinates; a second
   copy could disagree with the first.
9. **How do you represent a rest day?** — Not with a field: the next stop's `day` jumps by 2.
   Nights at a stop = next day − this day.
10. **Why reject `TODO` in `data/routes/`?** — The app shows these values to trekkers; unverified
    numbers must never look like facts. Drafts stay in data-prep working files.
11. **Why plain Python instead of a JSON Schema library?** — Some of our rules (days increasing,
    Source IDs from a Markdown table) cannot be expressed in JSON Schema, and plain code is easy
    to explain line by line.
12. **Why does the validator return a list instead of stopping at the first error?** — So you see
    every problem in one run.
13. **What happens if `day` is `true` in the JSON?** — In Python `True` is an `int` subclass, so
    `isinstance(True, int)` is true. The validator therefore also checks
    `isinstance(day, bool)` and rejects booleans.
14. **Why must the first stop be day 1?** — The acclimatization checker (M5) builds one sleeping
    altitude per night starting at night 1; a file starting at day 5 would leave nights 1–4 empty.
15. **How does the front end know a feature is the route and not a stop?** — The type guards
    `isRouteFeature` / `isStopFeature` in `types.ts` check `properties.kind`; after the check
    TypeScript knows the geometry type (tested in `types.test.ts`).
16. **What would you improve?** — Check that each stop lies close to the trail line (needs
    shapely + a metric projection); validate `route-sources.md` itself (no duplicate IDs); make
    the `TODO` check case-insensitive; protect `main` so a red CI blocks merging.
17. **Which parts of #6 did the AI tool write, and how did you check them?** — See "AI use in
    this part" below. Answer in your own words after you have done exercises 5–7.
18. **What was hardest?** — TODO(Unique): answer from your own experience. Do not memorise a
    model answer here; examiners can tell.
19. **How do you make sure you never overload Overpass?** — One query per route per run, answers
    cached and committed, a 90 s timeout and `[timeout:60]` in the query, a User-Agent, no retry
    loop, and the code refuses to call it when `CI` is set.
20. **What happens if you change the way list in a spec?** — The new query no longer matches the
    one saved in the cache file, so `fetch_cached` refuses and tells you to delete the cache file
    and fetch again (on purpose, by hand).
21. **What does the pipeline do if two OSM ways do not touch?** — `linemerge` returns several
    pieces and `merge_lines` stops with an error listing their ends. We never bridge the gap.
22. **Why project to UTM before simplifying?** — The tolerance is in metres; degrees are not the
    same length east–west and north–south. In UTM, x and y are metres.
23. **Which UTM zone is used, and why not always 45?** — The zone of the line's centre:
    floor((lon + 180) / 6) + 1. Most treks are in zone 45, but western Nepal (and the Annapurna
    area near 84 °E) can fall in zone 44.
24. **Why one feature per line in the output file?** — Small, readable git diffs; pretty-printing
    every coordinate would make thousands of lines.
25. **How are the network parts tested without the internet?** — `fetch_cached` takes `post` as a
    parameter; tests pass a fake that records the call, and `monkeypatch` removes or sets `CI`.
26. **What does `orient` do and why?** — OSM ways have no walking direction; after merging the
    line may run backwards, so it is flipped to start at the end nearer the first stop.
27. **Why refuse a closed loop?** — A closed line has no start and end, so `orient` cannot put the
    first stop at the start, and the trail would be roughly twice as long (both the main path and
    the alternative). It means the way list includes an alternative path or a duplicate way.
28. **How do you catch a stop whose lon/lat has a typo?** — The schema only checks the position
    is inside Nepal; `check_stops_near_trail` checks it is within 500 m of the trail line.
29. **What happens if the spec has `simplify_tolerence_m = 500` (misspelt)?** — `load_spec`
    rejects unknown keys, so the build stops with "unknown key(s) simplify_tolerence_m (typo?)"
    instead of silently using the 5 m default.

30. **State the acclimatization rule you implemented and cite it.** — Wilderness Medical Society
    (Luks et al. 2019; 2024 update keeps it): above 3,000 m, don't raise the sleeping altitude by
    more than 500 m a day, and rest every 3–4 days. Our checks: S_d > 3000 and S_d − S_{d−1} > 500;
    and more than 3 nights in a row sleeping higher above 3,000 m.
31. **Is 3,000 m flagged? Is a 500 m gain flagged?** — No and no: both comparisons are strict
    (`>`). Tests cover exactly 3,000 m, exactly 500 m, 3,001 m and 501 m.
32. **Why is night 1 never flagged?** — There is no night before it; the flowchart starts at d = 2.
33. **What resets the "nights gaining" counter?** — A rest day (same altitude), a descent, or a
    night at or below 3,000 m (ADR-024).
34. **Why does the checker return objects, not sentences?** — So the UI can show the warning in
    English or Nepali; the rules don't depend on the language.
35. **How do you know your tests would catch a mistake?** — Mutation check: five deliberate bugs
    (for example `>` → `>=`) were put in one at a time and the tests failed every time.
36. **Is this medical advice?** — No. It applies one rule of thumb to sleeping altitudes only and
    knows nothing about the person; the disclaimer is always shown.

## AI use in this part

- **Issue #6 (2026-11-20):** Claude Code drafted `docs/data-schema.md`, `prep/schema.py`,
  `tests/test_schema.py`, `types.ts` and these notes.
- **Review before the PR:** a code-reviewer subagent found two crashes (a list as a source,
  UTF-16 files) and a rule the doc promised but the code did not enforce (first stop on day 1).
  They were fixed in a second commit, with tests.
- **Notes check:** a viva-examiner subagent then checked these notes against the code and found
  wrong statements (including the Douglas–Peucker description), which were corrected.
- **What you must still do:** read every function, run `pytest` yourself, do exercises 5–7 by hand,
  and be able to explain the "Code details" and "Limits" sections without the notes.
- **Issue #8 (2026-11-21):** Claude Code drafted `prep/overpass.py`, `prep/build_route.py`, the
  spec template, their tests, ADR-019 and the pipeline sections of these notes. A code-reviewer
  subagent found real problems before the PR, all fixed with tests:
  - closed loops (parallel or duplicate ways) were accepted;
  - stops far from the trail were not caught;
  - one test could have reached the real network if a guard broke;
  - many bad inputs crashed with a traceback instead of a clear message.

  No real Overpass query was made; the first one is yours, in #9.
- **Issue #23 (2026-11-21):** Claude Code wrote `checker.ts`, its 25 tests, ADR-024 and this
  section, and ran the mutation check. Hand-checking the test matrix found one weak test (a
  "reset" case that used a descent, so it could not fail for the reason it claimed); it was
  replaced before the PR.

## Prove you understand it (do these by hand, no AI)

1. In `test_simplify_removes_a_2_m_wiggle_but_keeps_a_20_m_bend`, change the tolerance from 5 to
   25 m. Predict which assertion fails and why, run `pytest` to check, then revert.
2. Add a `GPX_DIR` constant to `paths.py` for raw GPX files and a test that it is under `data-prep/`.
3. Explain, using a sketch, how Douglas–Peucker decides which points to drop.
4. Find one published source for Namche Bazaar's altitude and add it to `route-sources.md`.
5. Add an optional `notes_en` property to stops: update `docs/data-schema.md`,
   `STOP_PROPERTIES` handling (it must be allowed but not required), a test, and `types.ts`.
6. Change the bounding box so it is tighter on the west side, predict which existing test (if any)
   breaks, then run `pytest` to check your prediction. Revert afterwards.
7. Write the list of sleeping altitudes per night for a 3-stop synthetic route with days 1, 2, 4
   using the "nights from days" rule — on paper.
8. Work out by hand the UTM zone and EPSG code for 80.5 °E and for 88.0 °E, then check them with
   `utm_epsg_for` in a Python shell.
9. Write a test where three ways form a "Y" (a side branch). Predict what `merge_lines` returns
   before you run it.
10. Make the first real route: copy `_template.toml`, choose the OSM ways for the first EBC stage
    on openstreetmap.org, run `python -m prep.build_route` once, and commit the cache file (#9).
11. Change the rest-day rule to "every 3 days" (flag the 3rd night in a row instead of the 4th):
    which constant do you change, which tests break, and how must they change? Do it, then revert.
12. Work through the itinerary [2800, 3300, 3900, 3900, 4300, 4800, 5100] on paper with the table
    from the worked example (gain, above 3000?, too fast?, g, rest needed?), then check your answer
    by adding it as a test.
13. Explain to a teammate why `nightsFromStops` for stops on days 1, 2, 4 gives four nights.

## Changelog

- 2026-11-19 — M0: venv, pinned requirements, paths, cache policy, citation template.
- 2026-11-20 — M1 #6: route schema, validator walkthrough, code details, limits, worked examples,
  questions 7–18, exercises 5–7, AI-use section; corrected Douglas–Peucker and Q4/Q7/Q13 after
  the viva-examiner check.
- 2026-11-21 — M2 #8: pipeline walkthrough, UTM/metre-tolerance/length worked examples,
  questions 19–29, exercises 8–10 (exercise 1 changed: the test it asked for now exists);
  closed-loop, stop-distance and input checks added after the code review.
- 2026-11-21 — M5 #23: checker walkthrough, worked example table, mutation check, limits,
  questions 30–36, exercises 11–13.
