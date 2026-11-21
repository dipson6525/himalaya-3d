"""Tests for the cached Overpass access (owner: Unique Ghimire). Related FR: FR2.

No test touches the network: a fake `post` function stands in for requests.post, and every
test uses its own temporary cache folder. The Overpass answers here are tiny, made-up examples.
"""

import json

import pytest
import requests

from prep import overpass
from prep.overpass import OverpassError, build_query, cache_path, fetch_cached

QUERY = build_query(way_ids=[1, 2])
ANSWER = {"version": 0.6, "elements": [{"type": "way", "id": 1, "geometry": []}]}


class FakeResponse:
    """Just enough of requests.Response for fetch_cached."""

    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict:
        return self._payload


class FakePost:
    """Records every call and returns a prepared response."""

    def __init__(self, response: FakeResponse):
        self.response = response
        self.calls: list[dict] = []

    def __call__(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        return self.response


def refuse_network(*args, **kwargs):
    raise AssertionError("the network must not be used in this test")


@pytest.fixture
def not_in_ci(monkeypatch):
    """GitHub Actions sets CI=true; remove it so the network path can be tested (with a fake)."""
    monkeypatch.delenv("CI", raising=False)


# ---- queries --------------------------------------------------------------------------------


def test_query_for_way_ids():
    assert build_query(way_ids=[11, 22]) == "[out:json][timeout:60];way(id:11,22);out geom;"


def test_query_for_relation():
    assert build_query(relation_id=7) == "[out:json][timeout:60];relation(7);way(r);out geom;"


@pytest.mark.parametrize("arguments", [{}, {"relation_id": 7, "way_ids": [1]}])
def test_query_needs_exactly_one_kind_of_id(arguments):
    with pytest.raises(OverpassError, match="exactly one"):
        build_query(**arguments)


# ---- cache ----------------------------------------------------------------------------------


def test_cached_answer_is_used_without_network(tmp_path):
    record = {"query": QUERY, "fetched_utc": "x", "licence": "x", "response": ANSWER}
    cache_path("route-ways", tmp_path).write_text(json.dumps(record), encoding="utf-8")
    assert fetch_cached("route-ways", QUERY, cache_dir=tmp_path, post=refuse_network) == ANSWER


def test_cache_from_a_different_query_is_refused(tmp_path):
    record = {"query": "something else", "response": ANSWER}
    cache_path("route-ways", tmp_path).write_text(json.dumps(record), encoding="utf-8")
    with pytest.raises(OverpassError, match="different query"):
        fetch_cached("route-ways", QUERY, cache_dir=tmp_path, post=refuse_network)


def test_missing_cache_with_network_off_is_an_error(tmp_path, not_in_ci):
    with pytest.raises(OverpassError, match="network use was turned off"):
        fetch_cached(
            "route-ways", QUERY, cache_dir=tmp_path, allow_network=False, post=refuse_network
        )


def test_network_is_never_used_in_ci(tmp_path, monkeypatch):
    monkeypatch.setenv("CI", "true")
    with pytest.raises(OverpassError, match="never be called from CI"):
        fetch_cached("route-ways", QUERY, cache_dir=tmp_path, post=refuse_network)


# ---- one polite request ---------------------------------------------------------------------


def test_first_fetch_sends_one_polite_request_and_caches_it(tmp_path, not_in_ci):
    fake = FakePost(FakeResponse(200, ANSWER))
    assert fetch_cached("route-ways", QUERY, cache_dir=tmp_path, post=fake) == ANSWER

    assert len(fake.calls) == 1
    call = fake.calls[0]
    assert call["url"] == overpass.OVERPASS_URL
    assert call["data"] == {"data": QUERY}
    assert call["headers"]["User-Agent"] == overpass.USER_AGENT
    assert call["timeout"] == overpass.REQUEST_TIMEOUT_S

    saved = json.loads(cache_path("route-ways", tmp_path).read_text(encoding="utf-8"))
    assert saved["query"] == QUERY
    assert saved["response"] == ANSWER
    assert "OpenStreetMap" in saved["licence"]

    # A second call is answered from the cache: still only one request in total.
    fetch_cached("route-ways", QUERY, cache_dir=tmp_path, post=fake)
    assert len(fake.calls) == 1


@pytest.mark.parametrize("status", [429, 504])
def test_http_error_raises_and_caches_nothing(tmp_path, not_in_ci, status):
    fake = FakePost(FakeResponse(status, {}))
    with pytest.raises(OverpassError, match=f"HTTP {status}"):
        fetch_cached("route-ways", QUERY, cache_dir=tmp_path, post=fake)
    assert len(fake.calls) == 1  # no retry loop
    assert not cache_path("route-ways", tmp_path).exists()


def test_overpass_remark_raises_and_caches_nothing(tmp_path, not_in_ci):
    fake = FakePost(FakeResponse(200, {"elements": [], "remark": "runtime error: timeout"}))
    with pytest.raises(OverpassError, match="runtime error"):
        fetch_cached("route-ways", QUERY, cache_dir=tmp_path, post=fake)
    assert not cache_path("route-ways", tmp_path).exists()


# ---- damaged caches and bad answers: clear errors, never a crash ----------------------------


def test_cache_with_merge_conflict_markers_is_reported(tmp_path):
    cache_path("route-ways", tmp_path).write_text("<<<<<<< HEAD\n{}\n=======\n", encoding="utf-8")
    with pytest.raises(OverpassError, match="damaged"):
        fetch_cached("route-ways", QUERY, cache_dir=tmp_path, post=refuse_network)


def test_cache_without_a_saved_answer_is_reported(tmp_path):
    cache_path("route-ways", tmp_path).write_text(json.dumps({"query": QUERY}), encoding="utf-8")
    with pytest.raises(OverpassError, match="no saved Overpass answer"):
        fetch_cached("route-ways", QUERY, cache_dir=tmp_path, post=refuse_network)


def test_no_connection_becomes_a_clear_error(tmp_path, not_in_ci):
    def broken_post(*args, **kwargs):
        raise requests.ConnectionError("no route to host")

    with pytest.raises(OverpassError, match="could not reach Overpass"):
        fetch_cached("route-ways", QUERY, cache_dir=tmp_path, post=broken_post)
    assert not cache_path("route-ways", tmp_path).exists()


class NotJsonResponse(FakeResponse):
    """A 200 answer whose body is an HTML page, not JSON."""

    def json(self):
        raise ValueError("Expecting value")


def test_answer_that_is_not_json_is_reported(tmp_path, not_in_ci):
    with pytest.raises(OverpassError, match="not JSON"):
        fetch_cached(
            "route-ways", QUERY, cache_dir=tmp_path, post=FakePost(NotJsonResponse(200, {}))
        )
    assert not cache_path("route-ways", tmp_path).exists()


def test_answer_without_elements_is_reported(tmp_path, not_in_ci):
    fake = FakePost(FakeResponse(200, {"version": 0.6}))
    with pytest.raises(OverpassError, match="no list of 'elements'"):
        fetch_cached("route-ways", QUERY, cache_dir=tmp_path, post=fake)
    assert not cache_path("route-ways", tmp_path).exists()
