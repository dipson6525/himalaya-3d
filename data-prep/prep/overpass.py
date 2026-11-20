"""Polite, cached access to the Overpass API (owner: Unique Ghimire). Related FR: FR2.

Overpass is a free OpenStreetMap service run by volunteers, so we:
  * ask each question once, then keep the answer in data-prep/cache/ (committed to git);
  * send a descriptive User-Agent and a modest timeout;
  * never retry in a loop, and never call it from CI (GitHub Actions sets CI=true).

A cache file stores the exact query, the date it was fetched and Overpass's answer, so anyone can
see where the data came from and re-run the pipeline offline. The data is OpenStreetMap data,
(c) OpenStreetMap contributors, under the Open Database License (ODbL).
"""

from __future__ import annotations

import json
import os
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

import requests

from prep import paths

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Identifies our script to the Overpass operators. The team may add a contact URL here.
USER_AGENT = "himalaya-3d-data-prep/0.1 (university student project)"

# Seconds to wait for an answer. The query itself asks Overpass to stop after QUERY_TIMEOUT_S.
QUERY_TIMEOUT_S = 60
REQUEST_TIMEOUT_S = 90


class OverpassError(Exception):
    """Something went wrong talking to Overpass, or using its cache. The message says what to do."""


def build_query(*, relation_id: int | None = None, way_ids: list[int] | None = None) -> str:
    """Write the Overpass QL query for one trail.

    Give EITHER the id of an OSM route relation (all its ways are fetched) OR a list of way ids.
    "out geom" makes Overpass include each way's positions directly, so we need no second query
    for the nodes.
    """
    header = f"[out:json][timeout:{QUERY_TIMEOUT_S}];"
    if relation_id is not None and not way_ids:
        return f"{header}relation({relation_id});way(r);out geom;"
    if way_ids and relation_id is None:
        id_list = ",".join(str(way_id) for way_id in way_ids)
        return f"{header}way(id:{id_list});out geom;"
    raise OverpassError("give exactly one of relation_id or way_ids")


def cache_path(name: str, cache_dir: Path = paths.CACHE_DIR) -> Path:
    """Where the cached answer for `name` (e.g. "everest-base-camp-ways") is stored."""
    return cache_dir / f"{name}.json"


def fetch_cached(
    name: str,
    query: str,
    *,
    cache_dir: Path = paths.CACHE_DIR,
    allow_network: bool = True,
    post: Callable[..., requests.Response] = requests.post,
) -> dict:
    """Return Overpass's answer to `query`, from the cache if we already have it.

    Steps:
      1. If the cache file exists, check it was made by the same query and return its answer.
      2. Otherwise, unless the network is not allowed (or we are in CI), send ONE request.
      3. Check the answer, save it with the query and date, and return it.

    `post` is the function that sends the request. Tests pass a fake one, so they never touch
    the network.
    """
    path = cache_path(name, cache_dir)
    if path.exists():
        cached = json.loads(path.read_text(encoding="utf-8"))
        if cached.get("query") != query:
            raise OverpassError(
                f"{path.name} was made by a different query. If the route changed on purpose, "
                "delete that file and run again to fetch the new data."
            )
        return cached["response"]

    if os.environ.get("CI"):
        raise OverpassError(f"{path.name} is not cached, and Overpass must never be called from CI")
    if not allow_network:
        raise OverpassError(f"{path.name} is not cached and network use was turned off")

    response = post(
        OVERPASS_URL,
        data={"data": query},
        headers={"User-Agent": USER_AGENT},
        timeout=REQUEST_TIMEOUT_S,
    )
    if response.status_code != 200:
        raise OverpassError(
            f"Overpass answered HTTP {response.status_code}. Wait a few minutes and try again "
            "by hand; do not retry in a loop (429 = too many requests, 504 = server busy)."
        )
    answer = response.json()
    if "remark" in answer:
        # Overpass reports problems such as a timeout inside an otherwise normal answer.
        raise OverpassError(f"Overpass reported a problem: {answer['remark']}")

    cache_dir.mkdir(parents=True, exist_ok=True)
    record = {
        "query": query,
        "fetched_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "licence": "(c) OpenStreetMap contributors, ODbL 1.0",
        "response": answer,
    }
    text = json.dumps(record, ensure_ascii=False, indent=1) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")  # LF line endings on every OS
    return answer
