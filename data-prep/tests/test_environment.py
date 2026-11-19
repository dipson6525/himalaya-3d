"""Smoke tests for the data-prep setup (owner: Unique Ghimire).

These do not test route logic yet (that arrives with issues #6 and #8). They prove that
the pinned libraries import and that the folders our scripts rely on exist.
"""

import gpxpy
import pyproj
import shapely
from shapely.geometry import LineString

from prep import paths


def test_geo_libraries_import():
    """The three geo libraries we chose instead of GDAL are installed."""
    assert gpxpy.__version__
    assert pyproj.__version__
    assert shapely.__version__


def test_shapely_can_simplify_a_line():
    """Douglas-Peucker simplification drops a point that lies exactly on a straight line."""
    line = LineString([(0, 0), (1, 0), (2, 0)])
    assert list(line.simplify(0.1).coords) == [(0.0, 0.0), (2.0, 0.0)]


def test_project_folders_exist():
    """Scripts read and write these folders, so they must exist in the repo."""
    assert paths.CACHE_DIR.is_dir()
    assert paths.ROUTES_DIR.is_dir()
    assert paths.ROUTE_SOURCES_FILE.is_file()
