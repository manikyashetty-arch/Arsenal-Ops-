"""ETag middleware for cacheable GET responses on heavy collection endpoints.

Strategy
--------
* Only acts on ``GET`` requests for paths under ``/api/projects/``,
  ``/api/workitems/``, and ``/api/developers/``. Everything else passes
  through untouched.
* Hashes the response body with MD5 (we only need cache-validation
  uniqueness, not cryptographic strength) and emits a weak ``ETag`` header.
* If the request carries an ``If-None-Match`` header whose value matches the
  computed ETag, the response is replaced with a bare 304 — letting the
  browser serve its cached copy and saving the wire transfer.

Ordering
--------
This middleware MUST sit *between* CORSMiddleware (innermost) and
GZipMiddleware (further out) so it sees the uncompressed body on the way
back out. With Starlette's ``insert(0, ...)`` semantics, the call order in
``main.py`` is therefore::

    add_middleware(CORSMiddleware)   # innermost
    add_middleware(ETagMiddleware)   # next layer out
    add_middleware(GZipMiddleware)   # compresses AFTER we hash
    add_middleware(PerfMiddleware)   # outermost

Kill switch
-----------
Enable explicitly via ``ENABLE_ETAG_MIDDLEWARE=true``. It ships disabled.
"""

from __future__ import annotations

import hashlib
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

_CACHEABLE_PREFIXES = (
    "/api/projects/",
    "/api/workitems/",
    "/api/developers/",
)


class ETagMiddleware(BaseHTTPMiddleware):
    """Adds ETag + 304 short-circuit support on selected GET endpoints."""

    async def dispatch(self, request: Request, call_next):
        # Bail fast on anything we don't want to instrument.
        if request.method != "GET":
            return await call_next(request)
        if not request.url.path.startswith(_CACHEABLE_PREFIXES):
            return await call_next(request)

        response = await call_next(request)

        # Only attach an ETag to successful responses. 304s/4xx/5xx etc.
        # already encode "nothing useful to cache" semantics.
        if response.status_code != 200:
            return response

        # Drain the streaming body so we can hash it. Once consumed, we have
        # to rebuild a concrete Response with the same headers + media_type
        # (notably preserving X-Total-Count, Cache-Control, etc.).
        body_chunks: list[bytes] = []
        async for chunk in response.body_iterator:
            body_chunks.append(chunk)
        body = b"".join(body_chunks)

        etag = f'W/"{hashlib.md5(body, usedforsecurity=False).hexdigest()}"'

        # If the client already has this version, return a bare 304 — no body,
        # but we keep the existing response headers so cache-control,
        # X-Total-Count, CORS, etc. flow through unchanged.
        if request.headers.get("if-none-match") == etag:
            headers = dict(response.headers)
            headers["ETag"] = etag
            headers.pop("content-length", None)
            return Response(status_code=304, headers=headers)

        # Otherwise rebuild the response with the same body + headers and
        # tack on the new ETag.
        new_response = Response(
            content=body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )
        new_response.headers["ETag"] = etag
        return new_response
