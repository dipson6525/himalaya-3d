"""The list of routes the web app can show: data/routes/index.json (owner: Unique Ghimire). FR2.

The app first downloads this small index (id + names of every route) to fill the trek selector,
and only downloads a route's full .geojson file when the user picks it.

The index is generated from the route files, never typed by hand:
    python -m prep.route_index          (prep.build_route also refreshes it after every build)
A test checks that the committed index.json matches the .geojson files, so CI catches a stale one.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from prep import paths

INDEX_NAME = "index.json"


def build_index(routes_dir: Path = paths.ROUTES_DIR) -> dict:
    """Read every route file's route feature and list its id and names, sorted by id.

    Files that cannot be read or have no route feature are reported as errors by the schema
    validator (prep.schema); here they are simply skipped.
    """
    routes = []
    for path in sorted(routes_dir.glob("*.geojson")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
        for feature in data.get("features", []) if isinstance(data, dict) else []:
            props = feature.get("properties") if isinstance(feature, dict) else None
            if isinstance(props, dict) and props.get("kind") == "route":
                routes.append(
                    {
                        "id": props.get("id"),
                        "name_en": props.get("name_en"),
                        "name_ne": props.get("name_ne"),
                    }
                )
                break
    routes.sort(key=lambda route: str(route["id"]))
    return {"routes": routes}


def index_text(index: dict) -> str:
    """The index as it is written to disk: indented JSON with Nepali kept readable, LF ending."""
    return json.dumps(index, ensure_ascii=False, indent=2) + "\n"


def write_index(routes_dir: Path = paths.ROUTES_DIR) -> Path:
    """Regenerate data/routes/index.json from the route files and return its path."""
    path = routes_dir / INDEX_NAME
    path.write_text(index_text(build_index(routes_dir)), encoding="utf-8", newline="\n")
    return path


def main() -> int:
    """Command line: rebuild the index and say how many routes it lists."""
    path = write_index()
    count = len(json.loads(path.read_text(encoding="utf-8"))["routes"])
    print(f"Wrote {path} ({count} route{'s' if count != 1 else ''})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
