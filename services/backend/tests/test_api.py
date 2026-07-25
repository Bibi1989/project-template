"""API unit tests (TestClient — no live server)."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Ensure deterministic settings before app import side effects.
os.environ["APP_NAME"] = "template-api"
os.environ["ENVIRONMENT"] = "test"
os.environ["STRUCTURED_LOGS"] = "false"
os.environ.setdefault("CORS_ORIGINS", "*")

from app.main import app  # noqa: E402


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


def test_health(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "template-api"
    assert body["environment"] == "test"


def test_root(client: TestClient) -> None:
    res = client.get("/")
    assert res.status_code == 200
    body = res.json()
    assert body["service"] == "template-api"
    assert "metrics" in body


def test_echo(client: TestClient) -> None:
    res = client.post("/echo", json={"message": "hello"})
    assert res.status_code == 200
    assert res.json()["echo"] == "hello"


def test_echo_rejects_empty(client: TestClient) -> None:
    res = client.post("/echo", json={"message": ""})
    assert res.status_code == 422
