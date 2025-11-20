"""
Basic tests for Claude Code API Server.

Run with: pytest test_server.py
"""

import pytest
from fastapi.testclient import TestClient
from server import app, ENABLE_AUTH, API_KEY


client = TestClient(app)


def test_health_check():
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "claude_code_available" in data


def test_root_endpoint():
    """Test the root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data
    assert "endpoints" in data


def test_execute_without_auth():
    """Test execute endpoint without authentication."""
    if ENABLE_AUTH:
        response = client.post(
            "/api/execute",
            json={"prompt": "echo test"}
        )
        assert response.status_code == 401
    else:
        response = client.post(
            "/api/execute",
            json={"prompt": "echo test"}
        )
        assert response.status_code in [200, 500]  # May fail if Claude not available


def test_execute_with_auth():
    """Test execute endpoint with authentication."""
    if ENABLE_AUTH and API_KEY:
        headers = {"X-API-Key": API_KEY}
        response = client.post(
            "/api/execute",
            json={"prompt": "echo test", "timeout": 10},
            headers=headers
        )
        assert response.status_code in [200, 500]


def test_execute_with_stream_flag():
    """Test that stream flag triggers error for non-stream endpoint."""
    headers = {}
    if ENABLE_AUTH and API_KEY:
        headers["X-API-Key"] = API_KEY

    response = client.post(
        "/api/execute",
        json={"prompt": "test", "stream": True},
        headers=headers if headers else None
    )

    if not ENABLE_AUTH or API_KEY:
        assert response.status_code == 400


def test_invalid_api_key():
    """Test with invalid API key."""
    if ENABLE_AUTH:
        headers = {"X-API-Key": "invalid-key"}
        response = client.post(
            "/api/execute",
            json={"prompt": "test"},
            headers=headers
        )
        assert response.status_code == 401


def test_missing_prompt():
    """Test execute without required prompt field."""
    headers = {}
    if ENABLE_AUTH and API_KEY:
        headers["X-API-Key"] = API_KEY

    response = client.post(
        "/api/execute",
        json={},
        headers=headers if headers else None
    )
    assert response.status_code == 422  # Validation error


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
