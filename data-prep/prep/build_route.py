"""Build one route file in data/routes/ from a route spec (owner: Unique Ghimire). FR2, FR3.

A route spec (data-prep/route-specs/<route-id>.toml) says which OpenStreetMap ways make up the
trail and lists the overnight stops with their cited altitudes. This module turns it into
data/routes/<route-id>.geojson:

    spec ──► Overpass query ──► cached answer (prep/overpass.py)
         ──► one LineString per OSM way ──► merge into one trail ──► point it the right way
         ──► simplify (in metres) ──► add the stops ──► check the schema ──► write the file

Run it for one route (inside data-prep/):

    python -m prep.build_route everest-base-camp
    python -m prep.build_route everest-base-camp --offline   # fail instead of using the network

Rules: we never invent geometry. If the OSM ways do not join into one continuous line, we stop
and say where the gap is; the fix is to add the missing way ids to the spec, not to draw a line.
"""

from __future__ import annotations

import argparse
import json
import sys
import tomllib
from pathlib import Path

import pyproj
import shapely
from shapely.geometry import LineString, MultiLineString, Point
from shapely.ops import linemerge

from prep import overpass, paths, schema

# Default Douglas-Peucker tolerance in metres: every point of the simplified trail stays within
# this distance of the OSM line. See ADR-019 for why 5 m.
DEFAULT_TOLERANCE_M = 5.0

# Decimal places kept for longitude/latitude. 6 places is about 0.1 m, far finer than OSM accuracy.
COORDINATE_DECIMALS = 6

# Where route specs live.
SPECS_DIR = paths.DATA_PREP_DIR / "route-specs"


class RouteBuildError(Exception):
    """The route could not be built. The message says what to fix."""


# --------------------------------------------------------------------------------------------
# Reading the spec
# --------------------------------------------------------------------------------------------


def load_spec(path: Path) -> dict:
    """Read a route spec (TOML). The file name without .toml must equal the spec's `id`."""
    with path.open("rb") as file:
        spec = tomllib.load(file)
    if spec.get("id") != path.stem:
        raise RouteBuildError(f"{path.name}: id {spec.get('id')!r} must equal the file name")
    has_relation = "osm_relation" in spec
    has_ways = bool(spec.get("osm_ways"))
    if has_relation == has_ways:
        raise RouteBuildError(f"{path.name}: give exactly one of osm_relation or osm_ways")
    stops = spec.get("stops")
    if not stops:
        raise RouteBuildError(f"{path.name}: list the overnight stops ([[stops]] tables)")
    for number, stop in enumerate(stops):
        lon, lat = stop.get("lon"), stop.get("lat")
        if not (isinstance(lon, (int, float)) and isinstance(lat, (int, float))):
            raise RouteBuildError(f"{path.name}: stop {number} needs numbers for lon and lat")
    return spec


def query_for(spec: dict) -> str:
    """The Overpass query that fetches this route's ways."""
    if "osm_relation" in spec:
        return overpass.build_query(relation_id=spec["osm_relation"])
    return overpass.build_query(way_ids=spec["osm_ways"])


# --------------------------------------------------------------------------------------------
# Geometry: OSM ways -> one clean trail line
# --------------------------------------------------------------------------------------------


def ways_to_lines(overpass_answer: dict) -> list[LineString]:
    """Turn each OSM way in an Overpass "out geom" answer into a LineString of (lon, lat).

    Overpass lists a way's positions as {"lat": ..., "lon": ...}; shapely, like GeoJSON, wants
    (x, y) = (longitude, latitude), so we swap the order here.
    """
    lines = []
    for element in overpass_answer.get("elements", []):
        if element.get("type") != "way":
            continue
        positions = [(point["lon"], point["lat"]) for point in element.get("geometry", [])]
        if len(positions) >= 2:
            lines.append(LineString(positions))
    if not lines:
        raise RouteBuildError("the Overpass answer contains no ways with geometry")
    return lines


def merge_lines(lines: list[LineString]) -> LineString:
    """Join the ways end-to-end into ONE continuous LineString.

    shapely's linemerge joins lines that share an end point, flipping them where needed. If the
    result is still several pieces, the trail has a gap (or a branch) and we refuse to continue.
    """
    merged = linemerge(MultiLineString(lines))
    if isinstance(merged, LineString):
        return merged
    pieces = list(merged.geoms)
    ends = "; ".join(
        f"piece {number}: {_short(piece.coords[0])} to {_short(piece.coords[-1])}"
        for number, piece in enumerate(pieces)
    )
    raise RouteBuildError(
        f"the ways form {len(pieces)} separate pieces, not one trail ({ends}). Add the OSM ways "
        "that fill the gaps to the spec, or remove side branches. Never draw a line by hand."
    )


def _short(position: tuple[float, float]) -> str:
    """A position as '[lon, lat]' with 5 decimals, for error messages."""
    return f"[{position[0]:.5f}, {position[1]:.5f}]"


def orient(line: LineString, start: tuple[float, float]) -> LineString:
    """Return the line running from the end nearer `start` (the trek's first stop) to the other.

    OSM ways have no "walking direction", so after merging the line may run backwards.
    """
    start_point = Point(start)
    first, last = Point(line.coords[0]), Point(line.coords[-1])
    if start_point.distance(last) < start_point.distance(first):
        return LineString(list(line.coords)[::-1])
    return line


def utm_epsg_for(longitude: float) -> int:
    """EPSG code of the UTM zone (northern hemisphere) that contains this longitude.

    UTM zones are 6 degrees wide, starting at 180 W: zone = floor((lon + 180) / 6) + 1.
    Nepal falls in zones 44 (78-84 E) and 45 (84-90 E): EPSG 32644 and 32645.
    """
    zone = int((longitude + 180) // 6) + 1
    return 32600 + zone


def simplify_line(line: LineString, tolerance_m: float) -> LineString:
    """Douglas-Peucker simplification with the tolerance in METRES.

    Longitude/latitude are degrees, and one degree of longitude is a different number of metres
    at different latitudes, so we cannot use a metre tolerance on degrees directly. Instead we
    1) project the line to UTM (x, y in metres), 2) simplify there, 3) project back.
    """
    epsg = utm_epsg_for(line.centroid.x)
    to_metres = pyproj.Transformer.from_crs(4326, epsg, always_xy=True).transform
    to_degrees = pyproj.Transformer.from_crs(epsg, 4326, always_xy=True).transform
    in_metres = shapely.transform(line, to_metres, interleaved=False)
    simplified = in_metres.simplify(tolerance_m, preserve_topology=False)
    return shapely.transform(simplified, to_degrees, interleaved=False)


def length_m(line: LineString) -> float:
    """Length of a lon/lat line in metres along the WGS84 ellipsoid (the Earth's shape in GPS).

    pyproj.Geod measures each segment on the ellipsoid itself, so no projection error is added.
    It ignores height: this is the map distance, not the distance walked up and down hills.
    """
    return pyproj.Geod(ellps="WGS84").geometry_length(line)


# --------------------------------------------------------------------------------------------
# Building the GeoJSON
# --------------------------------------------------------------------------------------------


def _rounded(position) -> list[float]:
    """[lon, lat] rounded to COORDINATE_DECIMALS places."""
    return [round(position[0], COORDINATE_DECIMALS), round(position[1], COORDINATE_DECIMALS)]


def build_feature_collection(spec: dict, line: LineString) -> dict:
    """Combine the spec's text and stops with the trail line into the schema's FeatureCollection."""
    route_feature = {
        "type": "Feature",
        "properties": {
            "kind": "route",
            "id": spec["id"],
            "name_en": spec["name_en"],
            "name_ne": spec["name_ne"],
            "description_en": spec["description_en"],
            "description_ne": spec["description_ne"],
            "geometry_source": spec["geometry_source"],
        },
        "geometry": {"type": "LineString", "coordinates": [_rounded(p) for p in line.coords]},
    }
    stop_features = []
    for stop in spec.get("stops", []):
        properties = {key: value for key, value in stop.items() if key not in ("lon", "lat")}
        stop_features.append(
            {
                "type": "Feature",
                "properties": {"kind": "stop", **properties},
                "geometry": {"type": "Point", "coordinates": _rounded((stop["lon"], stop["lat"]))},
            }
        )
    return {"type": "FeatureCollection", "features": [route_feature, *stop_features]}


def to_geojson_text(collection: dict) -> str:
    """Write the FeatureCollection with ONE FEATURE PER LINE.

    Pretty-printing every number on its own line would make the file thousands of lines long;
    one line for everything would make git diffs useless. One feature per line is a middle way:
    a diff shows exactly which stop (or the trail) changed.
    """
    lines = [json.dumps(feature, ensure_ascii=False) for feature in collection["features"]]
    return '{"type": "FeatureCollection", "features": [\n' + ",\n".join(lines) + "\n]}\n"


# --------------------------------------------------------------------------------------------
# The whole pipeline
# --------------------------------------------------------------------------------------------


def build_route(
    spec_path: Path,
    *,
    cache_dir: Path = paths.CACHE_DIR,
    routes_dir: Path = paths.ROUTES_DIR,
    known_sources: set[str] | None = None,
    allow_network: bool = True,
) -> dict:
    """Run every step for one spec and write data/routes/<id>.geojson. Returns a short report.

    Nothing is written unless the result passes the schema validator.
    """
    spec = load_spec(spec_path)
    answer = overpass.fetch_cached(
        f"{spec['id']}-ways", query_for(spec), cache_dir=cache_dir, allow_network=allow_network
    )

    ways = ways_to_lines(answer)
    merged = merge_lines(ways)
    first_stop = spec["stops"][0]
    trail = orient(merged, (first_stop["lon"], first_stop["lat"]))
    tolerance_m = float(spec.get("simplify_tolerance_m", DEFAULT_TOLERANCE_M))
    simplified = simplify_line(trail, tolerance_m)

    collection = build_feature_collection(spec, simplified)
    if known_sources is None:
        known_sources = schema.load_source_ids()
    errors = schema.validate_route(collection, known_sources, expected_id=spec["id"])
    if errors:
        raise RouteBuildError("the built route breaks the schema:\n  - " + "\n  - ".join(errors))

    out_path = routes_dir / f"{spec['id']}.geojson"
    out_path.write_text(to_geojson_text(collection), encoding="utf-8", newline="\n")
    return {
        "file": out_path,
        "ways": len(ways),
        "points_before": len(trail.coords),
        "points_after": len(simplified.coords),
        "length_km_before": length_m(trail) / 1000,
        "length_km_after": length_m(simplified) / 1000,
        "tolerance_m": tolerance_m,
    }


def main(argv: list[str] | None = None) -> int:
    """Command line: build one route by its id. Returns the exit code."""
    parser = argparse.ArgumentParser(description="Build data/routes/<route-id>.geojson")
    parser.add_argument("route_id", help="name of a file in data-prep/route-specs/ without .toml")
    parser.add_argument("--offline", action="store_true", help="only use cached Overpass data")
    args = parser.parse_args(argv)

    spec_path = SPECS_DIR / f"{args.route_id}.toml"
    if not spec_path.exists():
        print(f"No spec at {spec_path}")
        return 1
    try:
        report = build_route(spec_path, allow_network=not args.offline)
    except (RouteBuildError, overpass.OverpassError) as error:
        print(f"FAILED: {error}")
        return 1

    print(f"Wrote {report['file']}")
    print(f"  OSM ways merged:  {report['ways']}")
    print(f"  points:           {report['points_before']} -> {report['points_after']}")
    print(
        f"  length:           {report['length_km_before']:.2f} km -> "
        f"{report['length_km_after']:.2f} km (tolerance {report['tolerance_m']} m)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
