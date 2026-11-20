"""Route GeoJSON validator (owner: Unique Ghimire). Related FR: FR2 (routes), FR3 (stops).

Every file in data/routes/ must follow the rules written in docs/data-schema.md. This module
checks those rules and returns a list of plain-English error messages; an empty list means the
file is valid. It uses only the Python standard library, so it is easy to read and runs anywhere.

Check every route file from the command line (inside data-prep/):

    python -m prep.schema
"""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

from prep import paths

# A loose box around Nepal, in degrees. Nepal spans roughly 26.3-30.5 N and 80.0-88.2 E; we add a
# margin. The box only catches mistakes such as swapped latitude/longitude. It is NOT the border.
MIN_LAT, MAX_LAT = 26.0, 31.0
MIN_LON, MAX_LON = 79.5, 88.5

# Sea level up to the summit of Everest (8,848.86 m, 2020 survey). Anything outside is a typo.
MIN_ALTITUDE_M = 0
MAX_ALTITUDE_M = 8849

# Route and stop ids: lowercase words joined by single hyphens, e.g. "namche-bazaar".
ID_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

# The exact set of properties each kind of feature must have (no more, no fewer).
ROUTE_PROPERTIES = (
    "kind",
    "id",
    "name_en",
    "name_ne",
    "description_en",
    "description_ne",
    "geometry_source",
)
STOP_PROPERTIES = (
    "kind",
    "id",
    "name_en",
    "name_ne",
    "day",
    "altitude_m",
    "altitude_source",
    "description_en",
    "description_ne",
)

# Text fields that must be written in Nepali (Devanagari script).
NEPALI_FIELDS = ("name_ne", "description_ne")


# --------------------------------------------------------------------------------------------
# Reading the list of sources
# --------------------------------------------------------------------------------------------


def parse_source_ids(markdown: str) -> set[str]:
    """Return the Source IDs listed in the "## Sources" table of route-sources.md.

    The table looks like:  | Source ID | Title | URL | ... |
    We read the first cell of every row in that section, skipping the header row and the
    "| --- |" separator row. Backticks around an id (`OSM`) are removed.
    """
    source_ids: set[str] = set()
    in_sources_section = False
    for line in markdown.splitlines():
        if line.startswith("## "):
            in_sources_section = line.strip() == "## Sources"
            continue
        if not in_sources_section or not line.startswith("|"):
            continue
        first_cell = line.split("|")[1].strip().strip("`")
        if first_cell in ("", "Source ID") or set(first_cell) <= {"-", ":"}:
            continue  # header row, separator row or empty cell
        source_ids.add(first_cell)
    return source_ids


def load_source_ids(sources_file: Path = paths.ROUTE_SOURCES_FILE) -> set[str]:
    """Read route-sources.md and return the Source IDs it lists."""
    return parse_source_ids(sources_file.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------------------------
# Small checks used by the feature checks below
# --------------------------------------------------------------------------------------------


def _is_number(value: object) -> bool:
    """True for a real int or float. JSON true/false become Python bools, which we reject."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    return math.isfinite(value)


def _has_devanagari(text: str) -> bool:
    """True if the text contains at least one Devanagari character (Unicode U+0900 to U+097F)."""
    return any("ऀ" <= character <= "ॿ" for character in text)


def _check_position(position: object, where: str) -> list[str]:
    """Check one GeoJSON position: exactly [longitude, latitude], inside the box around Nepal."""
    if not isinstance(position, list) or len(position) != 2:
        return [f"{where}: position must be [longitude, latitude], got {position!r}"]
    lon, lat = position
    if not (_is_number(lon) and _is_number(lat)):
        return [f"{where}: position must contain two numbers, got {position!r}"]

    lon_ok = MIN_LON <= lon <= MAX_LON
    lat_ok = MIN_LAT <= lat <= MAX_LAT
    if lon_ok and lat_ok:
        return []
    swapped = MIN_LON <= lat <= MAX_LON and MIN_LAT <= lon <= MAX_LAT
    if swapped:
        return [f"{where}: {position!r} looks like [lat, lon]; GeoJSON order is [lon, lat]"]
    return [f"{where}: {position!r} is outside the box around Nepal"]


def _check_property_names(props: dict, expected: tuple[str, ...], where: str) -> list[str]:
    """Report missing properties and unknown ones (an unknown name is usually a typo)."""
    errors = []
    for name in expected:
        if name not in props:
            errors.append(f"{where}: missing property '{name}'")
    for name in props:
        if name not in expected:
            errors.append(f"{where}: unknown property '{name}' (see docs/data-schema.md)")
    return errors


def _check_text(props: dict, name: str, where: str) -> list[str]:
    """Check a text property: a non-empty string with no TODO (Nepali fields need Devanagari)."""
    if name not in props:
        return []  # already reported as missing
    value = props[name]
    if not isinstance(value, str) or value.strip() == "":
        return [f"{where}: '{name}' must be non-empty text"]
    if "TODO" in value:
        return [f"{where}: '{name}' contains TODO; only verified values belong in data/routes/"]
    if name in NEPALI_FIELDS and not _has_devanagari(value):
        return [f"{where}: '{name}' must be written in Nepali (Devanagari script)"]
    return []


def _check_id(props: dict, where: str) -> list[str]:
    """Check an id: lowercase words joined by hyphens, e.g. 'namche-bazaar'."""
    value = props.get("id")
    if "id" in props and not (isinstance(value, str) and ID_PATTERN.match(value)):
        return [f"{where}: id {value!r} must be lowercase words joined by hyphens"]
    return []


def _check_source(props: dict, name: str, known_sources: set[str], where: str) -> list[str]:
    """Check that a source property names a Source ID listed in route-sources.md."""
    value = props.get(name)
    if name in props and value not in known_sources:
        return [f"{where}: '{name}' {value!r} is not a Source ID in route-sources.md"]
    return []


# --------------------------------------------------------------------------------------------
# Checking one feature
# --------------------------------------------------------------------------------------------


def _check_route_feature(
    feature: dict, where: str, known_sources: set[str], expected_id: str | None
) -> list[str]:
    """Check the single route feature: its properties and its LineString geometry."""
    props = feature["properties"]
    errors = _check_property_names(props, ROUTE_PROPERTIES, where)
    errors += _check_id(props, where)
    for name in ("name_en", "name_ne", "description_en", "description_ne"):
        errors += _check_text(props, name, where)
    errors += _check_source(props, "geometry_source", known_sources, where)
    if expected_id is not None and props.get("id") != expected_id:
        errors.append(f"{where}: id {props.get('id')!r} must match the file name '{expected_id}'")

    geometry = feature.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") != "LineString":
        return errors + [f"{where}: geometry must be a LineString"]
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        return errors + [f"{where}: LineString needs at least 2 positions"]
    for number, position in enumerate(coordinates):
        errors += _check_position(position, f"{where}, position {number}")
    return errors


def _check_stop_feature(feature: dict, where: str, known_sources: set[str]) -> list[str]:
    """Check one stop feature: its properties and its Point geometry."""
    props = feature["properties"]
    errors = _check_property_names(props, STOP_PROPERTIES, where)
    errors += _check_id(props, where)
    for name in ("name_en", "name_ne", "description_en", "description_ne"):
        errors += _check_text(props, name, where)
    errors += _check_source(props, "altitude_source", known_sources, where)

    day = props.get("day")
    if "day" in props and (not isinstance(day, int) or isinstance(day, bool) or day < 1):
        errors.append(f"{where}: 'day' must be a whole number from 1 upwards, got {day!r}")

    altitude = props.get("altitude_m")
    if "altitude_m" in props:
        if not _is_number(altitude):
            errors.append(f"{where}: 'altitude_m' must be a number, got {altitude!r}")
        elif not MIN_ALTITUDE_M <= altitude <= MAX_ALTITUDE_M:
            errors.append(f"{where}: 'altitude_m' {altitude} is outside 0 to {MAX_ALTITUDE_M} m")

    geometry = feature.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") != "Point":
        return errors + [f"{where}: geometry must be a Point"]
    return errors + _check_position(geometry.get("coordinates"), where)


# --------------------------------------------------------------------------------------------
# Checking a whole route file
# --------------------------------------------------------------------------------------------


def validate_route(
    data: object, known_sources: set[str], expected_id: str | None = None
) -> list[str]:
    """Check a parsed route file against docs/data-schema.md and return a list of errors.

    data          -- the parsed JSON (whatever json.load returned)
    known_sources -- Source IDs from route-sources.md
    expected_id   -- the file name without ".geojson"; the route id must equal it

    Steps: 1) the top level is a FeatureCollection; 2) sort features into route and stops;
    3) check each feature; 4) check rules that compare stops with each other
    (unique ids, days increasing in walking order).
    """
    if not isinstance(data, dict) or data.get("type") != "FeatureCollection":
        return ["top level must be a GeoJSON FeatureCollection"]
    features = data.get("features")
    if not isinstance(features, list):
        return ["'features' must be a list"]

    errors: list[str] = []
    routes: list[tuple[int, dict]] = []
    stops: list[tuple[int, dict]] = []
    for index, feature in enumerate(features):
        where = f"feature {index}"
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            errors.append(f"{where}: must be a GeoJSON Feature")
        elif not isinstance(feature.get("properties"), dict):
            errors.append(f"{where}: 'properties' must be an object")
        elif feature["properties"].get("kind") == "route":
            routes.append((index, feature))
        elif feature["properties"].get("kind") == "stop":
            stops.append((index, feature))
        else:
            errors.append(f"{where}: properties.kind must be 'route' or 'stop'")

    if len(routes) != 1:
        errors.append(f"expected exactly 1 route feature, found {len(routes)}")
    if len(stops) < 2:
        errors.append(f"expected at least 2 stop features, found {len(stops)}")

    for index, feature in routes:
        where = f"feature {index} (route)"
        errors += _check_route_feature(feature, where, known_sources, expected_id)

    seen_ids: set[str] = set()
    previous_day = 0
    for index, feature in stops:
        props = feature["properties"]
        where = f"feature {index} (stop {props.get('id')!r})"
        errors += _check_stop_feature(feature, where, known_sources)

        stop_id = props.get("id")
        if isinstance(stop_id, str):
            if stop_id in seen_ids:
                errors.append(f"{where}: id is used by another stop")
            seen_ids.add(stop_id)

        day = props.get("day")
        if isinstance(day, int) and not isinstance(day, bool) and day >= 1:
            if day <= previous_day:
                errors.append(f"{where}: day {day} must be larger than the previous stop's day")
            previous_day = day
    return errors


def validate_file(path: Path, known_sources: set[str]) -> list[str]:
    """Load one .geojson file and validate it. The route id must match the file name."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        return [f"not valid JSON: {error}"]
    return validate_route(data, known_sources, expected_id=path.stem)


def main() -> int:
    """Validate every route file in data/routes/ and print the result. Returns the exit code."""
    known_sources = load_source_ids()
    route_files = sorted(paths.ROUTES_DIR.glob("*.geojson"))
    if not route_files:
        print(f"No .geojson files in {paths.ROUTES_DIR} yet.")
        return 0

    failed = 0
    for path in route_files:
        errors = validate_file(path, known_sources)
        if errors:
            failed += 1
            print(f"FAIL {path.name}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"OK   {path.name}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
