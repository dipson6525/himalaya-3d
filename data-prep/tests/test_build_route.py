"""Tests for building a route file from a spec (owner: Unique Ghimire). Related FR: FR2, FR3.

All positions, names and altitudes here are synthetic test values, not real trek data. No test
uses the network: the Overpass answer is written into a temporary cache folder first.

Useful numbers for checking by hand, near latitude 28 N:
  1 degree of latitude  is about 110.9 km, so 0.00018 deg is about 20 m and 0.000018 deg about 2 m;
  1 degree of longitude is about 111.32 km x cos(28 deg) = about 98.3 km.
"""

import json
import tomllib

import pyproj
import pytest
from shapely.geometry import LineString

from prep import schema
from prep.build_route import (
    SPECS_DIR,
    RouteBuildError,
    build_feature_collection,
    build_route,
    length_m,
    load_spec,
    main,
    merge_lines,
    orient,
    query_for,
    simplify_line,
    to_geojson_text,
    utm_epsg_for,
    ways_to_lines,
)
from prep.overpass import cache_path

KNOWN_SOURCES = {"OSM", "TEST"}

# Two OSM-style ways that meet at (85.02, 28.005); the second one is stored "backwards".
OVERPASS_ANSWER = {
    "elements": [
        {"type": "node", "id": 99, "lat": 28.0, "lon": 85.0},  # nodes are ignored
        {
            "type": "way",
            "id": 1,
            "geometry": [
                {"lat": 28.0, "lon": 85.0},
                {"lat": 28.0, "lon": 85.01},
                {"lat": 28.005, "lon": 85.02},
            ],
        },
        {
            "type": "way",
            "id": 2,
            "geometry": [
                {"lat": 28.01, "lon": 85.04},
                {"lat": 28.008, "lon": 85.03},
                {"lat": 28.005, "lon": 85.02},
            ],
        },
    ]
}

SPEC_TOML = """\
id = "test-route"
name_en = "Test Route"
name_ne = "परीक्षण मार्ग"
description_en = "A made-up route used only in tests."
description_ne = "परीक्षणका लागि मात्र बनाइएको मार्ग।"
geometry_source = "OSM"
osm_ways = [1, 2]
simplify_tolerance_m = 5

[[stops]]
id = "stop-a"
name_en = "Stop A"
name_ne = "स्टप ए"
day = 1
altitude_m = 1000
altitude_source = "TEST"
description_en = "First synthetic stop."
description_ne = "पहिलो परीक्षण बिसौनी।"
lon = 85.0
lat = 28.0

[[stops]]
id = "stop-b"
name_en = "Stop B"
name_ne = "स्टप बी"
day = 2
altitude_m = 1500
altitude_source = "TEST"
description_en = "Second synthetic stop."
description_ne = "दोस्रो परीक्षण बिसौनी।"
lon = 85.04
lat = 28.01
"""


def write_spec(folder, text=SPEC_TOML, name="test-route"):
    path = folder / f"{name}.toml"
    path.write_text(text, encoding="utf-8")
    return path


def write_cache(cache_dir, spec_path):
    """Put the synthetic Overpass answer in the cache, as if it had been fetched before."""
    spec = load_spec(spec_path)
    record = {
        "query": query_for(spec),
        "fetched_utc": "x",
        "licence": "x",
        "response": OVERPASS_ANSWER,
    }
    cache_path(f"{spec['id']}-ways", cache_dir).write_text(json.dumps(record), encoding="utf-8")


# ---- reading the spec -----------------------------------------------------------------------


def test_spec_id_must_match_file_name(tmp_path):
    path = write_spec(tmp_path, name="other-name")
    with pytest.raises(RouteBuildError, match="must equal the file name"):
        load_spec(path)


def test_spec_needs_exactly_one_kind_of_osm_id(tmp_path):
    path = write_spec(
        tmp_path, SPEC_TOML.replace("osm_ways = [1, 2]", "osm_ways = [1, 2]\nosm_relation = 7")
    )
    with pytest.raises(RouteBuildError, match="exactly one"):
        load_spec(path)


def test_every_stop_needs_lon_and_lat(tmp_path):
    path = write_spec(tmp_path, SPEC_TOML.replace("lon = 85.04\n", ""))
    with pytest.raises(RouteBuildError, match="stop 1 needs numbers"):
        load_spec(path)


# ---- geometry -------------------------------------------------------------------------------


def test_ways_become_lon_lat_lines_and_nodes_are_ignored():
    lines = ways_to_lines(OVERPASS_ANSWER)
    assert len(lines) == 2
    assert lines[0].coords[0] == (85.0, 28.0)  # (lon, lat), not (lat, lon)


def test_touching_ways_merge_into_one_line_even_if_one_is_backwards():
    merged = merge_lines(ways_to_lines(OVERPASS_ANSWER))
    assert len(merged.coords) == 5  # the shared point appears once
    assert {merged.coords[0], merged.coords[-1]} == {(85.0, 28.0), (85.04, 28.01)}


def test_a_gap_between_ways_is_an_error_not_a_drawn_line():
    lines = [LineString([(85.0, 28.0), (85.01, 28.0)]), LineString([(85.02, 28.0), (85.03, 28.0)])]
    with pytest.raises(RouteBuildError, match="2 separate pieces"):
        merge_lines(lines)


def test_orient_reverses_a_line_that_runs_backwards():
    line = LineString([(85.04, 28.01), (85.02, 28.005), (85.0, 28.0)])
    oriented = orient(line, start=(85.0, 28.0))
    assert oriented.coords[0] == (85.0, 28.0)
    assert orient(oriented, start=(85.0, 28.0)) == oriented  # already the right way: unchanged


@pytest.mark.parametrize(
    "longitude, epsg", [(86.7, 32645), (85.3, 32645), (84.0, 32645), (83.999, 32644), (80.5, 32644)]
)
def test_utm_zone_for_nepal_longitudes(longitude, epsg):
    """Zone 44 covers 78-84 E and zone 45 covers 84-90 E; exactly 84 E belongs to zone 45."""
    assert utm_epsg_for(longitude) == epsg


def test_simplify_removes_a_2_m_wiggle_but_keeps_a_20_m_bend():
    wiggle = LineString([(85.0, 28.0), (85.005, 28.000018), (85.01, 28.0)])  # middle point ~2 m off
    bend = LineString([(85.0, 28.0), (85.005, 28.00018), (85.01, 28.0)])  # middle point ~20 m off
    assert len(simplify_line(wiggle, 5).coords) == 2
    assert len(simplify_line(bend, 5).coords) == 3


def test_simplify_keeps_the_end_points():
    line = merge_lines(ways_to_lines(OVERPASS_ANSWER))
    simplified = simplify_line(line, 5)
    assert simplified.coords[0] == pytest.approx(line.coords[0], abs=1e-9)
    assert simplified.coords[-1] == pytest.approx(line.coords[-1], abs=1e-9)


def test_length_of_0_01_degrees_of_longitude_at_28_n():
    """By hand: 0.01 deg x 111.32 km x cos(28 deg) = about 983 m (sphere). The ellipsoid answer
    from pyproj.Geod is a little different, so we allow 1%."""
    line = LineString([(85.0, 28.0), (85.01, 28.0)])
    assert length_m(line) == pytest.approx(983, rel=0.01)
    assert length_m(line) == pytest.approx(pyproj.Geod(ellps="WGS84").geometry_length(line))


# ---- output ---------------------------------------------------------------------------------


def test_built_collection_passes_the_schema(tmp_path):
    spec = load_spec(write_spec(tmp_path))
    collection = build_feature_collection(spec, merge_lines(ways_to_lines(OVERPASS_ANSWER)))
    assert schema.validate_route(collection, KNOWN_SOURCES, expected_id="test-route") == []


def test_geojson_text_has_one_feature_per_line_and_parses_back(tmp_path):
    spec = load_spec(write_spec(tmp_path))
    collection = build_feature_collection(spec, merge_lines(ways_to_lines(OVERPASS_ANSWER)))
    text = to_geojson_text(collection)
    assert json.loads(text) == collection
    assert len(text.splitlines()) == 2 + len(collection["features"])  # opening + features + closing


# ---- the whole pipeline ---------------------------------------------------------------------


def test_build_route_end_to_end_offline(tmp_path):
    specs, cache, routes = tmp_path / "specs", tmp_path / "cache", tmp_path / "routes"
    for folder in (specs, cache, routes):
        folder.mkdir()
    spec_path = write_spec(specs)
    write_cache(cache, spec_path)

    report = build_route(
        spec_path,
        cache_dir=cache,
        routes_dir=routes,
        known_sources=KNOWN_SOURCES,
        allow_network=False,
    )

    out_file = routes / "test-route.geojson"
    assert report["file"] == out_file
    assert report["ways"] == 2
    assert report["points_after"] <= report["points_before"]
    assert schema.validate_file(out_file, KNOWN_SOURCES) == []
    first_position = json.loads(out_file.read_text(encoding="utf-8"))["features"][0]["geometry"]
    assert first_position["coordinates"][0] == [85.0, 28.0]  # starts at the first stop
    assert b"\r\n" not in out_file.read_bytes()  # LF line endings on every OS


def test_nothing_is_written_when_the_result_breaks_the_schema(tmp_path):
    specs, cache, routes = tmp_path / "specs", tmp_path / "cache", tmp_path / "routes"
    for folder in (specs, cache, routes):
        folder.mkdir()
    spec_path = write_spec(
        specs, SPEC_TOML.replace('altitude_source = "TEST"', 'altitude_source = "NOPE"', 1)
    )
    write_cache(cache, spec_path)

    with pytest.raises(RouteBuildError, match="not a Source ID"):
        build_route(
            spec_path,
            cache_dir=cache,
            routes_dir=routes,
            known_sources=KNOWN_SOURCES,
            allow_network=False,
        )
    assert list(routes.iterdir()) == []


# ---- the template and the command line ------------------------------------------------------


def test_template_lists_every_property_the_schema_needs():
    """If the schema gains or loses a property, this reminds us to update _template.toml."""
    template = tomllib.loads((SPECS_DIR / "_template.toml").read_text(encoding="utf-8"))
    route_keys = set(schema.ROUTE_PROPERTIES) - {"kind"}
    stop_keys = (set(schema.STOP_PROPERTIES) - {"kind"}) | {"lon", "lat"}
    assert route_keys <= set(template)
    assert set(template["stops"][0]) == stop_keys


def test_command_line_reports_a_missing_spec(capsys):
    assert main(["no-such-route"]) == 1
    assert "No spec at" in capsys.readouterr().out
