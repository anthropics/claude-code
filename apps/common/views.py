"""Views shared across apps.

Currently hosts the Sentry smoke-test endpoint used in P0-06.
"""
from __future__ import annotations

from django.conf import settings
from django.http import Http404, HttpRequest, HttpResponse


def debug_sentry(_request: HttpRequest) -> HttpResponse:
    """Intentionally raise to verify Sentry capture works.

    Only exposed when DEBUG is True; this view never runs in stg/prod
    where DEBUG is disabled. Returns without executing if someone wires
    it up in production by mistake.
    """
    if not settings.DEBUG:
        raise Http404("debug endpoint is only available when DEBUG=True")
    # The explicit ZeroDivisionError gives Sentry a unique fingerprint
    # that is easy to find in the dashboard.
    return HttpResponse(1 / 0)  # noqa: B018  (intentional)
