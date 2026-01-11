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
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import REQUEST_TIMEOUT, MAX_RETRIES


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

        last_error = None
        for attempt in range(retries + 1):
            try:
                with urllib.request.urlopen(
                    req,
                    timeout=self.timeout,
                    context=self.ssl_context
                ) as response:
                    response_body = response.read().decode("utf-8")
                    if response_body:
                        return json.loads(response_body)
                    return {}
            except urllib.error.HTTPError as e:
                # Read error response body
                error_body = ""
                try:
                    error_body = e.read().decode("utf-8")
                except Exception:
                    pass

                # Don't retry on client errors (4xx)
                if 400 <= e.code < 500:
                    raise HttpClientError(
                        f"HTTP {e.code}: {e.reason}. {error_body}"
                    )

                last_error = HttpClientError(
                    f"HTTP {e.code}: {e.reason}. {error_body}"
                )
            except urllib.error.URLError as e:
                last_error = HttpClientError(f"Network error: {e.reason}")
            except Exception as e:
                last_error = HttpClientError(f"Request failed: {e}")

        raise last_error

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
