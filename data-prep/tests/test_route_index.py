"""Tests for data/routes/index.json (owner: Unique Ghimire). Related FR: FR2.

Uses synthetic route files in a temporary folder, plus one check on the real data/routes/.
"""

import json

from prep import paths
from prep.route_index import INDEX_NAME, build_index, index_text, write_index


def write_route(folder, route_id, name_en, name_ne):
    """A minimal file with just a route feature (enough for the index; not a full valid route)."""
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "kind": "route",
                    "id": route_id,
                    "name_en": name_en,
                    "name_ne": name_ne,
                },
                "geometry": {"type": "LineString", "coordinates": [[85, 28], [85.1, 28]]},
            }
        ],
    }
    (folder / f"{route_id}.geojson").write_text(
        json.dumps(data, ensure_ascii=False), encoding="utf-8"
    )


def test_empty_folder_gives_an_empty_list(tmp_path):
    assert build_index(tmp_path) == {"routes": []}


def test_index_lists_routes_sorted_by_id(tmp_path):
    write_route(tmp_path, "zeta-route", "Zeta Route", "जेटा मार्ग")
    write_route(tmp_path, "alpha-route", "Alpha Route", "अल्फा मार्ग")
    assert build_index(tmp_path) == {
        "routes": [
            {"id": "alpha-route", "name_en": "Alpha Route", "name_ne": "अल्फा मार्ग"},
            {"id": "zeta-route", "name_en": "Zeta Route", "name_ne": "जेटा मार्ग"},
        ]
    }


def test_unreadable_files_are_skipped_not_crashed(tmp_path):
    (tmp_path / "broken.geojson").write_text("{ not json", encoding="utf-8")
    (tmp_path / "null-features.geojson").write_text('{"features": null}', encoding="utf-8")
    no_id = '{"features": [{"properties": {"kind": "route", "name_en": "X"}}]}'
    (tmp_path / "no-id.geojson").write_text(no_id, encoding="utf-8")
    write_route(tmp_path, "alpha-route", "Alpha Route", "अल्फा मार्ग")
    assert [route["id"] for route in build_index(tmp_path)["routes"]] == ["alpha-route"]


def test_write_index_keeps_nepali_readable_and_uses_lf(tmp_path):
    write_route(tmp_path, "alpha-route", "Alpha Route", "अल्फा मार्ग")
    path = write_index(tmp_path)
    raw = path.read_bytes()
    assert "अल्फा".encode() in raw  # not \\u escapes
    assert b"\r\n" not in raw


def test_committed_index_matches_the_route_files():
    """CI fails if someone adds or renames a route without regenerating index.json."""
    committed = (paths.ROUTES_DIR / INDEX_NAME).read_text(encoding="utf-8")
    assert committed == index_text(build_index(paths.ROUTES_DIR))
