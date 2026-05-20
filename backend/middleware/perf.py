"""Request timing + SQLAlchemy query count instrumentation.

Activated by setting the environment variable ``PERF_LOG=1``. When unset,
both the middleware and the SQLAlchemy listener short-circuit immediately,
so there is no measurable overhead in production.

When enabled, one line is logged per request to stdout::

    [GET /api/projects/] 312ms (Q=4)

Implementation notes:

* FastAPI dispatches synchronous ``def`` handlers to a worker threadpool.
  A plain ``ContextVar[int]`` cannot carry mutations from the worker thread
  back to the event-loop coroutine that wraps the request, because
  ``ContextVar.set`` propagates copy-on-write semantics only one way.
* The workaround is to store a one-element mutable list in the ContextVar.
  The reference is propagated into the worker via ``copy_context()``;
  mutations to the list itself are visible from either side.
"""

import os
import time
from contextvars import ContextVar

from sqlalchemy import event
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

PERF_LOG_ENABLED = os.getenv("PERF_LOG") == "1"

_query_counter: ContextVar[list[int]] = ContextVar("query_counter")


class PerfMiddleware(BaseHTTPMiddleware):
    """Logs ``[METHOD /path] Xms (Q=N)`` for each request when PERF_LOG=1."""

    async def dispatch(self, request: Request, call_next):
        if not PERF_LOG_ENABLED:
            return await call_next(request)

        counter = [0]
        token = _query_counter.set(counter)
        start = time.perf_counter()
        try:
            return await call_next(request)
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000
            print(
                f"[{request.method} {request.url.path}] {elapsed_ms:.0f}ms (Q={counter[0]})",
                flush=True,
            )
            _query_counter.reset(token)


def register_query_counter(engine) -> None:
    """Attach a before_cursor_execute listener that counts queries per request.

    Queries executed outside of a request context (startup migrations,
    admin scripts) are silently ignored.
    """
    if not PERF_LOG_ENABLED:
        return

    @event.listens_for(engine, "before_cursor_execute")
    def _count(conn, cursor, statement, parameters, context, executemany):
        try:
            counter = _query_counter.get()
        except LookupError:
            return
        counter[0] += 1
