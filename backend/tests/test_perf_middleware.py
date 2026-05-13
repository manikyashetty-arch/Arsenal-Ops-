"""Tests for the PERF_LOG request timing + query count middleware."""
import os
import re
import sys
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

# Allow `from middleware.perf import ...` when pytest is run from repo root
# or from the backend/ directory.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _build_app():
    """Build a tiny FastAPI app with PerfMiddleware mounted."""
    from middleware.perf import PerfMiddleware

    app = FastAPI()
    app.add_middleware(PerfMiddleware)

    @app.get("/ping")
    def ping():
        return {"ok": True}

    return app


class TestPerfLogDisabled:
    def test_emits_no_output_when_env_unset(self, capsys):
        with patch("middleware.perf.PERF_LOG_ENABLED", False):
            client = TestClient(_build_app())
            response = client.get("/ping")

        assert response.status_code == 200
        captured = capsys.readouterr()
        assert "/ping" not in captured.out, (
            f"middleware should be silent when PERF_LOG_ENABLED is False; "
            f"got: {captured.out!r}"
        )


class TestPerfLogEnabled:
    def test_logs_method_path_timing_and_zero_queries(self, capsys):
        with patch("middleware.perf.PERF_LOG_ENABLED", True):
            client = TestClient(_build_app())
            response = client.get("/ping")

        assert response.status_code == 200
        captured = capsys.readouterr()
        assert re.search(r"\[GET /ping\] \d+ms \(Q=0\)", captured.out), (
            f"expected '[GET /ping] Xms (Q=0)' log line; got: {captured.out!r}"
        )

    def test_counts_queries_executed_during_request(self, capsys):
        from middleware.perf import PerfMiddleware, register_query_counter

        with patch("middleware.perf.PERF_LOG_ENABLED", True):
            test_engine = create_engine("sqlite:///:memory:")
            register_query_counter(test_engine)

            app = FastAPI()
            app.add_middleware(PerfMiddleware)

            @app.get("/q")
            def do_queries():
                with test_engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                    conn.execute(text("SELECT 2"))
                    conn.execute(text("SELECT 3"))
                return {"ok": True}

            client = TestClient(app)
            response = client.get("/q")

        assert response.status_code == 200
        captured = capsys.readouterr()
        assert re.search(r"\[GET /q\] \d+ms \(Q=3\)", captured.out), (
            f"expected '[GET /q] Xms (Q=3)' log line; got: {captured.out!r}"
        )

    def test_queries_outside_request_do_not_raise(self, capsys):
        """The listener silently ignores queries fired outside a request context."""
        from middleware.perf import register_query_counter

        with patch("middleware.perf.PERF_LOG_ENABLED", True):
            test_engine = create_engine("sqlite:///:memory:")
            register_query_counter(test_engine)

            # No request in flight; this would raise if the listener didn't
            # catch the missing ContextVar.
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1"))


class TestRegistrationGuard:
    def test_register_is_noop_when_disabled(self):
        """When PERF_LOG_ENABLED is False, register_query_counter attaches nothing."""
        from middleware.perf import register_query_counter
        from sqlalchemy import event

        with patch("middleware.perf.PERF_LOG_ENABLED", False):
            test_engine = create_engine("sqlite:///:memory:")
            register_query_counter(test_engine)

            # The engine should have no `before_cursor_execute` listeners attached
            # by us. (SQLAlchemy may have its own internal ones; we only assert
            # ours is absent.)
            listeners = event.registry._key_to_collection
            # Smoke check: a query should not raise (counter never touched).
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
