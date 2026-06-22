"""Top-level pytest conftest for the backend test suite.

Runs BEFORE any test module is imported (pytest discovers conftest files
in tree order and executes their module-level code first). We use that
hook to set the security env vars the production code requires —
otherwise importing `routers.auth` (which most test modules do
transitively) raises at module load time.

`SECRET_KEY` is set to a fixed test-only value. It is intentionally NOT
the committed placeholder string — `_load_secret_key()` rejects the
placeholder unconditionally, so even tests aren't allowed to use it.
A distinct test value also means a real prod secret accidentally
leaking into the test process would still pass the placeholder check
(and produce its own loud failure if it matched, which it won't).
"""

import os

# Set BEFORE any other backend import so the env var is in place when
# `routers.auth` executes its module-level `_load_secret_key()` call.
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-use")
