"""Shared folder locations for every data-prep script (owner: Unique Ghimire).

Scripts import these constants instead of hard-coding paths, so they work no matter
which folder you run them from.
"""

from pathlib import Path

# data-prep/prep/paths.py -> parents[0] = prep/, [1] = data-prep/, [2] = project root
DATA_PREP_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = DATA_PREP_DIR.parent

# Raw Overpass API responses, committed to git so we never have to re-query (ODbL data).
CACHE_DIR = DATA_PREP_DIR / "cache"

# Final, cleaned route files that the web app loads.
ROUTES_DIR = PROJECT_ROOT / "data" / "routes"

# Where every altitude and coordinate source is listed.
ROUTE_SOURCES_FILE = ROUTES_DIR / "route-sources.md"
