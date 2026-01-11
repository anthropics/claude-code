"""HTTP client utilities for OAuth and API requests.

Uses only Python standard library (urllib).
"""

import json
import urllib.request
import urllib.parse
import urllib.error
from typing import Dict, Any, Optional, Iterator
import ssl

import sys
import os
_cli_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _cli_dir not in sys.path:
    sys.path.insert(0, _cli_dir)
from config import REQUEST_TIMEOUT, MAX_RETRIES, DEBUG


def _debug(msg: str, data: Optional[Dict] = None):
    """Log debug message if DEBUG is enabled."""
    if DEBUG:
        if data:
            sys.stderr.write(f"[HTTP] {msg}: {json.dumps(data)}\n")
        else:
            sys.stderr.write(f"[HTTP] {msg}\n")
        sys.stderr.flush()


class HttpClientError(Exception):
    """Base exception for HTTP client errors."""
    pass


class HttpClient:
    """HTTP client for making API requests."""

    def __init__(self, timeout: int = REQUEST_TIMEOUT):
        """Initialize HTTP client.

        Args:
            timeout: Request timeout in seconds
        """
        self.timeout = timeout
        # Create SSL context for HTTPS
        self.ssl_context = ssl.create_default_context()

    def request(
        self,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        data: Optional[Dict[str, Any]] = None,
        form_data: Optional[Dict[str, str]] = None,
        retries: int = MAX_RETRIES
    ) -> Dict[str, Any]:
        """Make HTTP request and return JSON response.

        Args:
            method: HTTP method (GET, POST, etc.)
            url: Request URL
            headers: Optional request headers
            data: Optional JSON body data
            form_data: Optional form-urlencoded data
            retries: Number of retries on failure

        Returns:
            JSON response as dictionary

        Raises:
            HttpClientError: On request failure
        """
        headers = headers or {}

        # Prepare body
        body = None
        if data is not None:
            body = json.dumps(data).encode("utf-8")
            headers.setdefault("Content-Type", "application/json")
        elif form_data is not None:
            body = urllib.parse.urlencode(form_data).encode("utf-8")
            headers.setdefault("Content-Type", "application/x-www-form-urlencoded")

        # Create request
        req = urllib.request.Request(
            url,
            data=body,
            headers=headers,
            method=method
        )

        _debug(f"Making {method} request", {"url": url})

        last_error = None
        for attempt in range(retries + 1):
            try:
                _debug(f"Request attempt {attempt + 1}/{retries + 1}")
                with urllib.request.urlopen(
                    req,
                    timeout=self.timeout,
                    context=self.ssl_context
                ) as response:
                    response_body = response.read().decode("utf-8")
                    _debug(f"Response status: {response.status}")
                    _debug(f"Response body length: {len(response_body)}")
                    if response_body:
                        try:
                            return json.loads(response_body)
                        except json.JSONDecodeError as je:
                            _debug(f"JSON parse error: {je}")
                            _debug(f"Response text: {response_body[:200]}")
                            raise HttpClientError(f"Invalid JSON response: {je}")
                    return {}
            except urllib.error.HTTPError as e:
                # Read error response body
                error_body = ""
                try:
                    error_body = e.read().decode("utf-8")
                except Exception:
                    pass

                _debug(f"HTTP error: {e.code}", {"reason": e.reason, "body": error_body[:200]})

                # Don't retry on client errors (4xx)
                if 400 <= e.code < 500:
                    raise HttpClientError(
                        f"HTTP {e.code}: {e.reason}. {error_body}"
                    )

                last_error = HttpClientError(
                    f"HTTP {e.code}: {e.reason}. {error_body}"
                )
            except urllib.error.URLError as e:
                _debug(f"URL error: {e.reason}")
                last_error = HttpClientError(f"Network error: {e.reason}")
            except HttpClientError as e:
                raise
            except Exception as e:
                _debug(f"Unexpected error: {type(e).__name__}: {e}")
                last_error = HttpClientError(f"Request failed: {e}")

        if last_error:
            _debug(f"Request failed after {retries + 1} attempts")
            raise last_error

        raise HttpClientError("Request failed for unknown reason")

    def get(self, url: str, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Make GET request.

        Args:
            url: Request URL
            headers: Optional request headers

        Returns:
            JSON response as dictionary
        """
        return self.request("GET", url, headers=headers)

    def post(
        self,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        data: Optional[Dict[str, Any]] = None,
        form_data: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make POST request.

        Args:
            url: Request URL
            headers: Optional request headers
            data: Optional JSON body data
            form_data: Optional form-urlencoded data

        Returns:
            JSON response as dictionary
        """
        return self.request("POST", url, headers=headers, data=data, form_data=form_data)

    def stream_post(
        self,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        data: Optional[Dict[str, Any]] = None
    ) -> Iterator[str]:
        """Make streaming POST request.

        Args:
            url: Request URL
            headers: Optional request headers
            data: Optional JSON body data

        Yields:
            Response lines
        """
        headers = headers or {}

        body = None
        if data is not None:
            body = json.dumps(data).encode("utf-8")
            headers.setdefault("Content-Type", "application/json")

        req = urllib.request.Request(
            url,
            data=body,
            headers=headers,
            method="POST"
        )

        try:
            with urllib.request.urlopen(
                req,
                timeout=self.timeout * 10,  # Longer timeout for streaming
                context=self.ssl_context
            ) as response:
                for line in response:
                    yield line.decode("utf-8")
        except urllib.error.HTTPError as e:
            error_body = ""
            try:
                error_body = e.read().decode("utf-8")
            except Exception:
                pass
            raise HttpClientError(f"HTTP {e.code}: {e.reason}. {error_body}")
        except Exception as e:
            raise HttpClientError(f"Stream request failed: {e}")
