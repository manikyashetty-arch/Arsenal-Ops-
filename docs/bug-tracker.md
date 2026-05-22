# Arsenal-Ops Bug Tracker

Living document. Bugs are added as they are surfaced (by the audit, by tests pinning current behavior, or by Hypothesis falsification). Each entry lists:

- **Severity** — P0 (blocks production), P1 (production fragility), P2 (quality)
- **Status** — `open`, `pinned` (xfail/FIXME in test), `in progress`, `fixed`
- **Source** — where it was first surfaced
- **Pinned by** — test or marker that locks current behavior (so the fix flips the assertion)
- **Fix plan** — outline of remediation

When a bug is fixed: change status to `fixed`, link the fix commit, and flip the pinning `xfail` to a regular assertion (drop the marker).

**Last updated:** 2026-05-22 — Tier A security/correctness sprint landed. 11 entries closed across two rounds (3 IDORs + 4 silent-errors + 3 P0 hardening + 1 token expiry). Backend 224 / 1 skip / 4 xfail (down from 7 — three xfails flipped to real passing assertions). Frontend 126 / 8 skip.

---

## P0 — Blockers (must fix before production traffic)

### P0-1 — Hardcoded JWT signing secret *(fixed)*
- **Status:** fixed (commit `620284ea`)
- **Source:** Audit (production-readiness review)
- **Fix:** `SECRET_KEY = os.environ["SECRET_KEY"]` in [backend/routers/auth.py](../backend/routers/auth.py). Startup guard in [backend/main.py](../backend/main.py) raises `RuntimeError` if env var unset, empty, or equals "your-secret-key-change-in-production" / "secret".

### P0-2 — Weak password hashing (unsalted SHA-256) *(fixed)*
- **Status:** fixed (commit `620284ea`)
- **Source:** Audit
- **Fix:** `passlib.CryptContext(schemes=["bcrypt", "sha256_crypt"], deprecated=["sha256_crypt"], bcrypt__rounds=12)`. New hashes are bcrypt. Existing SHA-256 hashes continue to verify and get transparently upgraded to bcrypt on next successful login via `password_needs_update()` + re-hash + commit. Locked by `test_bcrypt_migration_on_login` in [test_auth.py](../backend/tests/test_auth.py).

### P0-3 — Dev-login endpoint always registered *(fixed)*
- **Status:** fixed (commit `620284ea`)
- **Source:** Audit
- **Fix:** Dev-login endpoints moved to a separate `dev_router` in [backend/routers/auth.py](../backend/routers/auth.py); main.py only includes it when `DEV_AUTH_BYPASS=1`. In production the endpoints don't exist at all — FastAPI returns a router-level 404. Logger warning fires at startup when dev_router is registered.

### P0-4 — Unsafe file upload (directory traversal) *(fixed)*
- **Status:** fixed (commit `620284ea`)
- **Source:** Audit
- **Fix:** `sanitize_filename()` helper in [backend/routers/projects.py](../backend/routers/projects.py) strips path components, leading dots, and non-`[A-Za-z0-9._-]` chars. 10 MB size cap (HTTP 413 on overflow). MIME whitelist for PDFs/images/Office docs. Stored files use UUID-prefixed names to prevent collision. Download handler validates the resolved path stays within `project_dir`.

### P0-5 — JWT in `localStorage` (XSS-exposed)
- **Status:** open
- **Source:** Audit
- **Location:** [app/src/lib/api.ts:30](../app/src/lib/api.ts#L30), [app/src/contexts/AuthContext.tsx:87](../app/src/contexts/AuthContext.tsx#L87)
- **Impact:** Any injected JS can read the token. Also blocks adding a refresh-token flow cleanly.
- **Pinned by:** not yet
- **Fix plan:** Move to httpOnly cookies; backend sets `Set-Cookie: HttpOnly; Secure; SameSite=Lax`.

### P0-6 — Frontend Dockerfile runs `npm run dev` in production
- **Status:** open
- **Source:** Audit
- **Location:** [app/Dockerfile:13](../app/Dockerfile#L13)
- **Impact:** Vite dev server in production; no static build, no security headers, no minification.
- **Pinned by:** N/A (config, not runtime behavior)
- **Fix plan:** Multi-stage build: `npm run build` → serve `/dist` via Nginx; add CSP, HSTS, X-Frame-Options.

### P0-7 — Stack-trace leak via global 500 handler *(fixed)*
- **Status:** fixed (commit `620284ea`)
- **Source:** Audit
- **Fix:** [backend/main.py](../backend/main.py) `global_exception_handler` now generates an 8-char correlation ID, logs the full exception+traceback server-side (with the ID in the prefix for grep), and returns opaque `{"detail": "Internal error", "request_id": "<id>"}` to the client.

### P0-8 — DB password hardcoded in docker-compose.yml *(fixed)*
- **Status:** fixed (commit `620284ea`)
- **Source:** Audit
- **Fix:** `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}` in [docker-compose.yml](../docker-compose.yml). Documented in [.env.example](../.env.example). Compose now fails with a clear error if the var is unset.

### P0-9 — No migration system (ad-hoc `migrate_*.py` scripts)
- **Status:** open
- **Source:** Audit
- **Location:** [backend/migrate_*.py](../backend/), called from [backend/main.py](../backend/main.py) startup
- **Impact:** Racy under multiple Gunicorn workers, no versioning, no rollback, no dialect awareness.
- **Pinned by:** `test_capacity.py` and friends exercise the post-migration schema; a future testcontainers Postgres suite (Week 7) will pin migration correctness.
- **Fix plan:** Adopt Alembic with `pg_advisory_lock` for concurrency. Baseline against current prod schema via `pg_dump --schema-only` → `alembic stamp head`. See plan.

---

## P1 — Production Fragility

### P1-1 — IDOR: cross-project comment reads *(fixed)*
- **Status:** fixed (commit `a59d3ac1`)
- **Source:** Audit (P1 #14) — confirmed by test
- **Fix:** GET handler in [backend/routers/comments.py](../backend/routers/comments.py) loads `work_item.project` and rejects with 404 (not 403, prevents enumeration) when the user isn't a project member or system admin. Reused existing `has_project_access()` helper from `routers/projects.py`. Test flipped from xfail to a regular pass.

### P1-2 — IDOR: cross-project comment writes *(fixed)*
- **Status:** fixed (commit `a59d3ac1`)
- **Source:** Audit (P1 #14) — confirmed by test
- **Fix:** Same guard as P1-1 applied to the POST handler — verify project access before insert; 404 if denied. Test flipped from xfail to a regular pass that also asserts no comment was persisted on rejection.

### P1-3 — IDOR: `convert_to_ticket` accepts cross-project assignee *(fixed)*
- **Status:** fixed (commit `a59d3ac1`)
- **Source:** Audit (P1 #14) — confirmed by test
- **Fix:** `convert_to_ticket` handler in [backend/routers/personal_tasks.py](../backend/routers/personal_tasks.py) now validates `assignee_developer_id` against the target project's developer list before accepting. Returns 422 with a "developer not in project" message if not. Test flipped from xfail to regular pass asserting 422.

### P1-4 — Admin: `specialization` field accepted but not persisted
- **Status:** pinned
- **Source:** Test (`test_admin.py`) — new finding, not in original audit
- **Location:** API contract in [backend/routers/admin.py](../backend/routers/admin.py) (`EmployeeCreate`); model in [backend/models/developer.py](../backend/models/developer.py) lacks the column.
- **Pinned by:** `backend/tests/test_admin.py::test_create_employee_specialization_persists` (xfail)
- **Impact:** Field is echoed in response from input but silently dropped. Frontend forms that send it will show the value once and lose it on refresh.
- **Fix plan:** Either add `specialization: Column(String)` to `Developer` model (with migration) OR remove from API contract.

### P1-5 — No rate limiting on `/login`
- **Status:** open
- **Source:** Audit
- **Location:** [backend/routers/auth.py:183-223](../backend/routers/auth.py#L183-L223)
- **Impact:** Brute-force is wide open. No failed-attempt counter, no lockout, no CAPTCHA.
- **Fix plan:** `slowapi` middleware: 5 attempts / 15 min per (IP + email).

### P1-6 — GitHub tokens stored plaintext
- **Status:** open
- **Source:** Audit
- **Location:** [backend/routers/admin.py:512-513](../backend/routers/admin.py#L512-L513), [backend/routers/projects.py](../backend/routers/projects.py)
- **Impact:** Plaintext storage; admin responses leak token existence via `has_github_token` field.
- **Fix plan:** Encrypted column via `cryptography.fernet`; never echo token state in admin responses.

### P1-7 — Render Postgres exposed to public internet
- **Status:** open
- **Source:** Audit
- **Location:** [render.yaml:50](../render.yaml#L50) — `ipAllowList: []`
- **Impact:** DB reachable from anywhere on the internet.
- **Fix plan:** Restrict to backend service IP only; set `DATABASE_SSL_MODE=require`.

### P1-8 — No DB backups configured
- **Status:** open
- **Source:** Audit
- **Location:** [render.yaml](../render.yaml) — no backup block
- **Fix plan:** Enable Render's PITR or schedule daily `pg_dump` to S3.

### P1-9 — Foreign keys not enforced in SQLite dev
- **Status:** open
- **Source:** Audit
- **Location:** [backend/database.py:18](../backend/database.py#L18)
- **Impact:** Dev tolerates referential bugs that explode in Postgres prod.
- **Fix plan:** Add `PRAGMA foreign_keys=ON` via SQLAlchemy `Engine.connect` event.

### P1-10 — Render service-name mismatch
- **Status:** open
- **Source:** Audit
- **Location:** [render.yaml](../render.yaml) uses `arsenal-ops-db`; [docker-compose.yml](../docker-compose.yml) and [.env.example](../.env.example) reference `productmind-db`.
- **Impact:** One environment will break on the name mismatch.
- **Fix plan:** Pick one canonical name; update both files.

### P1-11 — N+1 queries on project & work-item lists
- **Status:** open
- **Source:** Audit
- **Location:** [backend/routers/projects.py:390-401](../backend/routers/projects.py#L390-L401); similar pattern in [backend/routers/workitems.py:114](../backend/routers/workitems.py#L114)
- **Impact:** O(N) extra queries per list call. Latency blows up with project/item count.
- **Pinned by:** `test_developers.py::test_developers_list_query_count_bounded`, `test_admin.py::test_admin_list_endpoint_query_count` — pin current bounds; will detect regressions.
- **Fix plan:** Add `selectinload(Project.developers)` and equivalents.

### P1-12 — Concurrent-write races on `log_hours`
- **Status:** open
- **Source:** Audit; caused the May 21 capacity hotfix
- **Location:** [backend/routers/workitems.py:983-1093](../backend/routers/workitems.py#L983-L1093)
- **Pinned by:** `test_capacity_properties.py::test_transfer_conservation_invariant` (passing) would have caught it pre-incident. `test_log_hours_defenses.py` pins three defenses already.
- **Fix plan:** Wrap critical section in explicit `SERIALIZABLE` isolation transaction.

### P1-13 — Token expiry 24h, no refresh, no revocation *(partially fixed)*
- **Status:** partially fixed (commit `620284ea`)
- **Source:** Audit
- **Fix (partial):** `ACCESS_TOKEN_EXPIRE_MINUTES` reduced from 1440 (24h) to 60 (1h).
- **Remaining:** Refresh-token endpoint with rotation; token revocation/blacklist. Deferred to a follow-up — the 1h expiry materially reduces the blast radius of a stolen token without requiring the bigger refresh-flow refactor.

### P1-14 — Logging on Render is unstructured stdout
- **Status:** open
- **Source:** Audit
- **Location:** [backend/logging_config.py:14](../backend/logging_config.py#L14) — file logs skipped on Render, flat-string format
- **Fix plan:** `structlog` + request-ID middleware; JSON output for aggregator ingestion.

### P1-15 — No graceful shutdown handler
- **Status:** open
- **Source:** Audit
- **Location:** [backend/main.py](../backend/main.py)
- **Impact:** Gunicorn `--graceful-timeout 30` is set but no `@app.on_event("shutdown")` closes DB sessions or flushes logs.
- **Fix plan:** Add shutdown event; close `SessionLocal`, flush logger.

### P1-16 — Epic hour rollup may not sum from children (Hypothesis-found)
- **Status:** pinned (suspected — needs investigation)
- **Source:** Test (`test_capacity_properties.py`) — Hypothesis falsification
- **Pinned by:** Three xfail tests in `test_capacity_properties.py`:
  - `test_epic_rollup_sum_invariant` — epic.logged_hours doesn't sum from children
  - `test_epic_rollup_always_sums_correctly` — epic.estimated_hours doesn't sum from children
  - `test_developer_independence` — multi-developer interaction issue
- **Impact:** Unclear — could be a real rollup bug, could be a test setup issue (the rollup may be triggered only on specific mutations). Needs investigation before claiming as a confirmed bug.
- **Fix plan:** Manually exercise the falsifying examples Hypothesis produced; if reproducible, fix `update_epic_hours()` in [backend/routers/workitems.py](../backend/routers/workitems.py).

---

## P2 — Quality / Polish

### P2-1 — No client-side admin role guard
- **Status:** pinned
- **Source:** Audit (P2 #31) — confirmed by test
- **Location:** [app/src/App.tsx:159](../app/src/App.tsx#L159) — `/admin` route renders for any authenticated user; only backend 403s gate access.
- **Pinned by:** `app/src/pages/AdminDashboard/AdminDashboard.test.tsx` — non-admin renders the same UI; locked with FIXME.
- **Impact:** Non-admins see admin UI flash before backend rejections; bad UX, slight info leak.
- **Fix plan:** Wrap `<AdminDashboard />` route with `<RequireRole role="admin">` redirect-to-`/` HOC.

### P2-2 — ProjectBoard silently swallows API errors *(fixed)*
- **Status:** fixed (commit `760c9d95`)
- **Source:** Test (`ProjectBoard.test.tsx`) — finding
- **Fix:** Closed as part of the unified silent-error PR. Global error handler wired into [app/src/lib/queryClient.ts](../app/src/lib/queryClient.ts) via `QueryCache` + `MutationCache` onError → sonner toast (skipping 401 since AuthContext handles those). Also added [app/src/components/RouteErrorBoundary.tsx](../app/src/components/RouteErrorBoundary.tsx) wrapping each top-level route in `App.tsx`.

### P2-3 — ProjectsPage swallows API errors silently *(fixed)*
- **Status:** fixed (commit `760c9d95`)
- **Source:** Test (`ProjectsPage.test.tsx`) — Week 2 finding
- **Fix:** Same global QueryCache/MutationCache onError handler as P2-2. Pinning test (`ProjectsPage.test.tsx`) updated to use the correct `{ detail: ... }` FastAPI error envelope. Test assertion is intentionally light ("page renders without crashing"); strengthening to assert toast appearance is a TODO follow-up.

### P2-3a — ItemDetailDrawer silently fails on 500 errors *(fixed)*
- **Status:** fixed (commit `760c9d95`)
- **Source:** Test (`ItemDetailDrawer.test.tsx`) — Tier-2 batch finding
- **Fix:** Global query error handler surfaces a toast on the 500. The drawer continues to render `selectedItem` prop as a fallback (intentional — better UX than blanking out), but the toast informs the user the fresh fetch failed.

### P2-3b — ProjectDetail shows "Project not found" on any error *(fixed)*
- **Status:** fixed (commit `760c9d95`)
- **Source:** Test (`ProjectDetail.test.tsx`) — Tier-2 batch finding
- **Fix:** [app/src/pages/ProjectDetail/ProjectDetail.tsx](../app/src/pages/ProjectDetail/ProjectDetail.tsx) now distinguishes 404 (renders "Project not found") from other errors (renders "Could not load project" with a Retry button). Uses `ApiError.status === 404` for the discriminator.

### P2-4 — 85 `any` types in frontend
- **Status:** open
- **Source:** Audit
- **Fix plan:** Generate types from FastAPI's `/openapi.json` via `openapi-typescript`; migrate `app/src/lib/api.ts` to `openapi-fetch`. Codegen script already wired in Week 1 (`npm run generate:api-types`).

### P2-5 — No React error boundaries
- **Status:** open
- **Source:** Audit
- **Impact:** One render error kills the whole app.
- **Fix plan:** Wrap each top-level route in an error boundary with a fallback UI.

### P2-6 — Monaco bundled eagerly
- **Status:** open
- **Source:** Audit
- **Location:** [app/vite.config.ts](../app/vite.config.ts), [app/src/pages/ProjectDetail/sections/ArchitectureSection.tsx](../app/src/pages/ProjectDetail/sections/ArchitectureSection.tsx)
- **Impact:** ~3 MB shipped to every user even when ArchitectureEditor is never opened.
- **Fix plan:** `React.lazy(() => import('./ArchitectureEditor'))`.

### P2-7 — `console.log` in shipped frontend
- **Status:** open
- **Source:** Audit
- **Impact:** 15+ instances; ESLint rule is `warn`, not `error`.
- **Fix plan:** Set `no-console: error`; strip via Terser config in vite.

### P2-8 — No API versioning
- **Status:** open
- **Source:** Audit
- **Fix plan:** Mount routers under `/api/v1/*`; future breaking changes use `/api/v2`.

### P2-9 — Hard deletes only (no soft delete)
- **Status:** open
- **Source:** Audit
- **Fix plan:** Add `is_deleted` + `deleted_at` columns; filter queries; soft-cascade.

### P2-10 — CORS `allow_headers=["*"]` with `allow_credentials=True`
- **Status:** open
- **Source:** Audit
- **Location:** [backend/main.py:85](../backend/main.py#L85)
- **Fix plan:** Whitelist headers explicitly.

### P2-11 — No security headers (CSP/HSTS/X-Frame-Options)
- **Status:** open
- **Source:** Audit
- **Fix plan:** `secure` middleware or hand-rolled middleware.

### P2-12 — Mixed Python dep manifests
- **Status:** open
- **Source:** Audit
- **Location:** `backend/requirements.txt` + `backend/pyproject.toml` (no `[project]`) + `backend/uv.lock`
- **Fix plan:** Move all deps to `pyproject.toml [project]`; keep `uv.lock` as the lockfile; delete `requirements.txt` or regenerate from pyproject.

### P2-13 — `print()` in shipped backend code
- **Status:** open
- **Source:** Audit
- **Location:** [backend/routers/projects.py:439](../backend/routers/projects.py#L439)
- **Fix plan:** Replace with `logger.debug(...)`.

### P2-14 — Email service uses sync SMTP
- **Status:** open
- **Source:** Audit
- **Location:** [backend/services/email_service.py:62-65](../backend/services/email_service.py#L62-L65)
- **Impact:** Safe behind `BackgroundTasks` today, but a future refactor lands it on the event loop.
- **Fix plan:** Wrap in `ThreadPoolExecutor` or migrate to `aiosmtplib`.

### P1-18 — OpenAPI schema systematically underspecifies input validation
- **Status:** pinned (schemathesis contract suite, currently 108 failures)
- **Source:** Week 6 schemathesis fuzzing
- **Pinned by:** `backend/tests/test_contract.py` — every endpoint is fuzzed against its OpenAPI schema; ~88% of endpoints currently fail because the schema declares fields as `string` without `minLength`, `pattern`, or `format` constraints, but the endpoints enforce stricter validation (e.g., `POST /api/auth/login` rejects empty username with 422, but the schema permits it).
- **Impact:** Frontend codegen (`openapi-typescript`) produces types that are looser than the backend actually accepts. Any client generated from the schema cannot rely on the declared shape. This is also the proximate cause of the 85 `any` types flagged in P2-4 — the codegen-from-schema path is unusable until the schema is tightened.
- **Fix plan:** Add Pydantic `Field(...)` validators with constraints (`min_length`, `pattern`, `regex`) to every request model. Each tightening reduces schemathesis failures by ~5–10 endpoints. The contract job's failure count is a free regression metric — every PR that adds field constraints should reduce it.
- **Notes:** Contract job is `continue-on-error: true` in CI; flip to required once failure count is in single digits.

### P1-17 — `dev_login` had TOCTOU race on Developer insert *(fixed in Week 5)*
- **Status:** fixed
- **Source:** Surfaced during concurrent E2E agent runs (Week 5)
- **Location:** [backend/routers/auth.py:566-578](../backend/routers/auth.py#L566-L578)
- **Impact:** When `DEV_AUTH_BYPASS=1` and multiple concurrent requests hit `/api/auth/dev-login` simultaneously, the check-then-insert sequence for the `dev@local` Developer row raced on the email-unique constraint. One request would 500 with an `IntegrityError` while another committed.
- **Fix:** Wrap the `Developer` insert in try/except, rollback on conflict, re-check existence. Production is unaffected (`DEV_AUTH_BYPASS` never set in prod), but the defensive pattern is correct.
- **Commit:** Week 5 E2E commit on `testing-infrastructure` branch (capacity-transfer agent surfaced and fixed it).

### P2-15 — Kanban + modals not keyboard-accessible
- **Status:** open
- **Source:** Audit
- **Fix plan:** Focus traps on modals; ARIA labels; keyboard alternative for drag-drop.

---

## Process

- **When a new bug is surfaced**, add an entry here and (if pinning current behavior) add an xfail test with `reason="..."` that references this tracker entry by ID.
- **When a fix lands**, change status to `fixed`, add the commit SHA, and flip the pinning xfail to a regular assertion (drop the marker).
- **When in doubt about a Hypothesis-found issue**, mark status `pinned (suspected)` and investigate before promoting to a confirmed bug.

The xfail markers are the safety net: as bugs are fixed, those tests will start passing — pytest reports `XPASS` and (with `strict_markers`) can fail the build, forcing the developer to remove the xfail in the same PR as the fix.
