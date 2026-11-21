"""Tests for the route GeoJSON validator (owner: Unique Ghimire). Related FR: FR2.

Most tests start from one valid, made-up route (make_route) and break one thing, then check
that the validator reports exactly that problem. The last test runs the validator on every real
file in data/routes/, so CI fails if a route file breaks the schema.

All names, positions and altitudes here are synthetic test values, not real trek data.
"""

import json

import pytest

from prep import paths
from prep.schema import (
    load_source_ids,
    main,
    parse_source_ids,
    validate_file,
    validate_route,
)

KNOWN_SOURCES = {"OSM", "TEST"}


def make_stop(stop_id: str, day: int, altitude_m: float, position: list[float]) -> dict:
    """Build one valid, synthetic stop feature."""
    return {
        "type": "Feature",
        "properties": {
            "kind": "stop",
            "id": stop_id,
            "name_en": f"Stop {stop_id}",
            "name_ne": "परीक्षण बिसौनी",
            "day": day,
            "altitude_m": altitude_m,
            "altitude_source": "TEST",
            "description_en": "Synthetic stop for tests.",
            "description_ne": "परीक्षणका लागि बिसौनी।",
        },
        "geometry": {"type": "Point", "coordinates": position},
    }


def make_route() -> dict:
    """Build a valid, synthetic route file: one route line and two stops."""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "kind": "route",
                    "id": "test-route",
                    "name_en": "Test Route",
                    "name_ne": "परीक्षण मार्ग",
                    "description_en": "A made-up route used only in tests.",
                    "description_ne": "परीक्षणका लागि मात्र बनाइएको मार्ग।",
                    "geometry_source": "OSM",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[85.0, 28.0], [85.1, 28.05], [85.2, 28.1]],
                },
            },
            make_stop("stop-a", 1, 1000, [85.0, 28.0]),
            make_stop("stop-b", 2, 1500, [85.2, 28.1]),
        ],
    }


def route_props(data: dict) -> dict:
    """The properties of the route feature (always the first feature in make_route)."""
    return data["features"][0]["properties"]


def stop_props(data: dict, number: int) -> dict:
    """The properties of stop number 0, 1, ... (stops follow the route feature)."""
    return data["features"][1 + number]["properties"]


def assert_one_error_containing(errors: list[str], fragment: str) -> None:
    """The validator found exactly one problem, and its message mentions `fragment`."""
    assert len(errors) == 1, errors
    assert fragment in errors[0], errors


# ---- the valid case -------------------------------------------------------------------------


def test_valid_route_has_no_errors():
    assert validate_route(make_route(), KNOWN_SOURCES, expected_id="test-route") == []


def test_rest_day_gap_is_allowed():
    """Day 1 then day 3 means two nights at the first stop (a rest day): that is valid."""
    data = make_route()
    stop_props(data, 1)["day"] = 3
    assert validate_route(data, KNOWN_SOURCES) == []


# ---- structure ------------------------------------------------------------------------------


def test_top_level_must_be_feature_collection():
    assert validate_route({"type": "Feature"}, KNOWN_SOURCES) == [
        "top level must be a GeoJSON FeatureCollection"
    ]


@pytest.mark.parametrize("route_count", [0, 2])
def test_needs_exactly_one_route_feature(route_count):
    data = make_route()
    route_feature = data["features"].pop(0)
    for _ in range(route_count):
        data["features"].insert(0, json.loads(json.dumps(route_feature)))  # a fresh copy
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "exactly 1 route")


def test_properties_must_be_an_object():
    data = make_route()
    data["features"].append({"type": "Feature", "properties": None})
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "'properties' must be")


def test_route_geometry_must_be_line_string():
    data = make_route()
    data["features"][0]["geometry"] = {"type": "Point", "coordinates": [85.0, 28.0]}
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "must be a LineString")


def test_needs_at_least_two_stops():
    data = make_route()
    del data["features"][2]
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "at least 2 stop")


def test_unknown_kind_is_rejected():
    data = make_route()
    data["features"].append({"type": "Feature", "properties": {"kind": "hotel"}})
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "kind must be")


def test_route_id_must_match_file_name():
    errors = validate_route(make_route(), KNOWN_SOURCES, expected_id="other-route")
    assert_one_error_containing(errors, "must match the file name")


def test_route_line_needs_two_positions():
    data = make_route()
    data["features"][0]["geometry"]["coordinates"] = [[85.0, 28.0]]
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "at least 2 positions")


# ---- property names and values --------------------------------------------------------------


def test_missing_property_is_reported():
    data = make_route()
    del stop_props(data, 0)["altitude_m"]
    errors = validate_route(data, KNOWN_SOURCES)
    assert_one_error_containing(errors, "missing property 'altitude_m'")


def test_misspelled_property_is_reported():
    data = make_route()
    stop_props(data, 0)["altitude"] = stop_props(data, 0).pop("altitude_m")
    errors = validate_route(data, KNOWN_SOURCES)
    assert len(errors) == 2, errors  # 'altitude_m' missing AND 'altitude' unknown
    assert any("unknown property 'altitude'" in error for error in errors)


@pytest.mark.parametrize("bad_id", ["Namche", "namche bazaar", "namche--bazaar", "-namche", 7])
def test_bad_id_is_rejected(bad_id):
    data = make_route()
    stop_props(data, 0)["id"] = bad_id
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "lowercase words")


def test_duplicate_stop_id_is_rejected():
    data = make_route()
    stop_props(data, 1)["id"] = "stop-a"
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "used by another stop")


def test_todo_is_rejected():
    data = make_route()
    stop_props(data, 0)["description_en"] = "TODO(team): verify"
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "contains TODO")


def test_nepali_field_needs_devanagari():
    data = make_route()
    stop_props(data, 0)["name_ne"] = "Stop A"
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "Devanagari")


def test_empty_text_is_rejected():
    data = make_route()
    route_props(data)["name_en"] = "   "
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "non-empty text")


# ---- sources --------------------------------------------------------------------------------


def test_altitude_source_must_be_listed():
    data = make_route()
    stop_props(data, 0)["altitude_source"] = "MY-MEMORY"
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "not a Source ID")


def test_geometry_source_must_be_listed():
    data = make_route()
    route_props(data)["geometry_source"] = "GOOGLE"
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "not a Source ID")


def test_source_must_be_one_id_not_a_list():
    data = make_route()
    stop_props(data, 0)["altitude_source"] = ["OSM", "TEST"]
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "one Source ID as text")


# ---- days and altitudes ---------------------------------------------------------------------


@pytest.mark.parametrize("second_day", [1, 0.5])
def test_days_must_increase_in_walking_order(second_day):
    data = make_route()
    stop_props(data, 1)["day"] = second_day
    errors = validate_route(data, KNOWN_SOURCES)
    if second_day == 1:  # same day as the first stop
        assert_one_error_containing(errors, "larger than the previous")
    else:  # not a whole number at all: reported once, by the day check
        assert_one_error_containing(errors, "whole number")


def test_decreasing_days_are_rejected():
    data = make_route()
    data["features"].append(make_stop("stop-c", 2, 1200, [85.1, 28.05]))
    stop_props(data, 1)["day"] = 3  # days: 1, 3, 2
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "larger than the previous")


def test_first_stop_must_be_day_one():
    data = make_route()
    stop_props(data, 0)["day"] = 5
    stop_props(data, 1)["day"] = 6
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "first stop must be day 1")


@pytest.mark.parametrize("bad_day", [0, -1, 1.5, "2", True])
def test_day_must_be_whole_number_from_one(bad_day):
    data = make_route()
    stop_props(data, 0)["day"] = bad_day
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "whole number")


@pytest.mark.parametrize("bad_altitude", [-5, 9000, "3440", True, None, float("nan"), float("inf")])
def test_altitude_must_be_a_sensible_number(bad_altitude):
    """NaN and Infinity matter: Python's json.loads accepts the words NaN and Infinity."""
    data = make_route()
    stop_props(data, 0)["altitude_m"] = bad_altitude
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "altitude_m")


@pytest.mark.parametrize("edge_altitude", [0, 8849])
def test_altitude_limits_are_inclusive(edge_altitude):
    data = make_route()
    stop_props(data, 0)["altitude_m"] = edge_altitude
    assert validate_route(data, KNOWN_SOURCES) == []


def test_decimal_altitude_is_allowed():
    data = make_route()
    stop_props(data, 0)["altitude_m"] = 1000.5
    assert validate_route(data, KNOWN_SOURCES) == []


# ---- positions ------------------------------------------------------------------------------


def test_swapped_lat_lon_gets_a_helpful_message():
    data = make_route()
    data["features"][1]["geometry"]["coordinates"] = [28.0, 85.0]  # [lat, lon] by mistake
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "looks like [lat, lon]")


def test_position_outside_nepal_is_rejected():
    data = make_route()
    data["features"][1]["geometry"]["coordinates"] = [2.35, 48.86]  # Paris
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "outside the box")


def test_position_with_height_is_rejected():
    data = make_route()
    data["features"][1]["geometry"]["coordinates"] = [85.0, 28.0, 1000]
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "[longitude, latitude]")


def test_many_bad_positions_are_summarised():
    """A whole trail saved as [lat, lon] gives 5 messages and a count, not one per position."""
    data = make_route()
    data["features"][0]["geometry"]["coordinates"] = [[28.0, 85.0]] * 8
    errors = validate_route(data, KNOWN_SOURCES)
    assert len(errors) == 6, errors
    assert "and 3 more bad positions" in errors[-1]


def test_stop_geometry_must_be_point():
    data = make_route()
    data["features"][1]["geometry"] = {"type": "LineString", "coordinates": [[85, 28], [85, 28]]}
    assert_one_error_containing(validate_route(data, KNOWN_SOURCES), "must be a Point")


# ---- route-sources.md and files -------------------------------------------------------------


def test_parse_source_ids_reads_only_the_sources_table():
    markdown = "\n".join(
        [
            "# Route data sources",
            "## Sources",
            "| Source ID | Title |",
            "| --- | --- |",
            "| OSM | OpenStreetMap |",
            "| `NTB` | A book |",
            "## Disagreements (> 50 m)",
            "| Route | Stop |",
            "| EBC | Namche |",
        ]
    )
    assert parse_source_ids(markdown) == {"OSM", "NTB"}


def test_parse_source_ids_skips_any_header_wording():
    """The first table row is the header whatever it says; spaces inside backticks are trimmed."""
    markdown = "## Sources\n| Source id | Title |\n|:---|---|\n| ` NTB ` | A book |"
    assert parse_source_ids(markdown) == {"NTB"}


def test_real_route_sources_file_lists_osm():
    assert "OSM" in load_source_ids()


def test_invalid_json_file_is_reported(tmp_path):
    path = tmp_path / "broken.geojson"
    path.write_text("{ not json", encoding="utf-8")
    assert_one_error_containing(validate_file(path, KNOWN_SOURCES), "not valid JSON")


def test_utf16_file_is_reported_not_crashed(tmp_path):
    """PowerShell 5 saves files as UTF-16 by default: that must give an error, not a crash."""
    path = tmp_path / "test-route.geojson"
    path.write_text(json.dumps(make_route(), ensure_ascii=False), encoding="utf-16")
    assert_one_error_containing(validate_file(path, KNOWN_SOURCES), "UTF-8")


def test_valid_file_on_disk_passes(tmp_path):
    path = tmp_path / "test-route.geojson"
    path.write_text(json.dumps(make_route(), ensure_ascii=False), encoding="utf-8")
    assert validate_file(path, KNOWN_SOURCES) == []


def test_main_exit_code_is_0_for_valid_and_1_for_invalid(tmp_path, monkeypatch, capsys):
    """main() reads data/routes/; we point it at a temporary folder instead.
    The real route-sources.md lists OSM, so the synthetic stops cite OSM here."""
    monkeypatch.setattr(paths, "ROUTES_DIR", tmp_path)
    data = make_route()
    for number in (0, 1):
        stop_props(data, number)["altitude_source"] = "OSM"
    path = tmp_path / "test-route.geojson"
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    assert main() == 0
    assert "OK   test-route.geojson" in capsys.readouterr().out

    stop_props(data, 0)["altitude_m"] = -1
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    assert main() == 1
    assert "FAIL test-route.geojson" in capsys.readouterr().out


# ---- the real data --------------------------------------------------------------------------

ROUTE_FILES = sorted(paths.ROUTES_DIR.glob("*.geojson"))


@pytest.mark.parametrize("route_file", ROUTE_FILES, ids=[path.name for path in ROUTE_FILES])
def test_every_route_file_follows_the_schema(route_file):
    """Runs once per file in data/routes/. (Skipped while there are no route files yet.)"""
    assert validate_file(route_file, load_source_ids()) == []
