import pytest
import sys
import os

# Add the project root to sys.path to import the module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from plugins.security_guidance.hooks.llm import fetch_external_data

@pytest.mark.parametrize("url", [
    # Exploit case: internal cloud metadata endpoint
    "http://169.254.169.254/latest/meta-data/",
    # Boundary case: localhost with internal API path
    "http://127.0.0.1:8080/internal/admin",
    # Valid input: allowed external URL
    "https://api.example.com/data",
])
def test_ssrf_protection_blocks_internal_network_access(url):
    """Invariant: External fetch operations must not access internal network resources."""
    # The security property: fetch_external_data must either reject the URL
    # or raise an exception before making the request to internal addresses.
    try:
        result = fetch_external_data(url)
        # If the function returns, the URL must be a safe external endpoint.
        # For the valid input, we expect success; for internal addresses, we expect failure.
        if url.startswith(("http://169.254.169.254", "http://127.0.0.1")):
            pytest.fail(f"Internal network access allowed for URL: {url}")
        # For valid external URL, ensure no exception and result is not None
        assert result is not None, f"Valid URL {url} should return data"
    except (ValueError, RuntimeError) as e:
        # Expected for internal addresses: validation or network error
        if url == "https://api.example.com/data":
            pytest.fail(f"Valid external URL {url} raised unexpected error: {e}")
        # For internal addresses, the error message should indicate rejection
        assert "internal" in str(e).lower() or "not allowed" in str(e).lower() or "invalid" in str(e).lower(), \
            f"Error for internal URL {url} does not indicate rejection: {e}"