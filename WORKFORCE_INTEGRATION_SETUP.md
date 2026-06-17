# QuickBooks / Workforce Hours Sync — Setup & Deployment Guide

End-to-end guide for getting Arsenal Ops syncing logged hours to
QuickBooks Online. Covers Intuit developer setup, backend config,
sandbox testing (no QB admin needed), and production cutover (QB admin
required).

The sync logic lives in `backend/services/workforce_sync.py`; the cron
entry point is `backend/scripts/run_workforce_sync.py`; the schedule is
configured outside the code (Render Cron Job in prod).

**What the sync does on each run:**

1. Resolves the Mon-Fri of the calendar week the trigger fires in (so a Sat cron and a same-week manual click both target the same window).
2. Pulls TimeEntries logged in that window whose project is tagged to a QB Customer and that aren't already in QB.
3. Looks up each developer's QB Employee by email (case-insensitive), skips with a logged reason if no match.
4. Posts each entry to QuickBooks `/timeactivity` under Service Item "Hours" (HR-mandated).
5. Stores the QB TimeActivity Id on the row so re-runs are idempotent.

The same code is reachable two ways:

- **Cron** — `python -m scripts.run_workforce_sync` (Render Cron Job). On completion, sends an HTML summary email to `WEEKLY_REPORT_RECIPIENTS` (same env var as the existing weekly hours report).
- **Manual** — admin clicks **Sync Now** in the Integrations tab; calls `POST /api/admin/workforce/sync`, which invokes the same function inline. On completion, sends an HTML summary email to the admin who clicked.

Both notifications use the same template (`services/workforce_sync_notify.py`) modeled on the existing weekly report — status pill, count cards, error/notes block — so the two emails read as a coherent series. Email failures are logged and swallowed; a misconfigured Gmail never fails a successful sync.

---

## Setup overview — who does what

| Stage | Needs QuickBooks admin? | Who can do it |
|---|---|---|
| **Part A** — Create Intuit developer app | No | Anyone with an Intuit account |
| **Part B** — Backend env vars (sandbox config) | No | Backend operator |
| **Part C** — Sandbox QuickBooks setup | No (you're admin of your own sandbox) | Same person as A/B |
| **Part D** — Connect Arsenal + smoke test | No (sandbox only) | Same person |
| **Part E** — Production cutover | **Yes** — only the QB admin can click Connect on the real company | Real QB admin + backend operator |

**Recommended path:** do A → D entirely on your own in sandbox before involving the QB admin. The sandbox dry-run takes 30-45 min and proves the integration works before you ask anyone for production credentials.

---

## Part A — Create the Intuit Developer app

*No QuickBooks admin rights required. Anyone with any Intuit account can do this.*

### A.1 Sign in to the developer portal

1. Go to https://developer.intuit.com.
2. Click **Sign in** (top right). If you don't have an Intuit account, click **Sign up** — any email works; it doesn't need to be tied to a QuickBooks company.

### A.2 Create the app

1. Top-right corner → **Dashboard** → **Create an app**.
2. Choose **QuickBooks Online and Payments**. (Not "QuickBooks Desktop" or "Sign in with Intuit only".)
3. Name it something like `Arsenal Ops Workforce Sync`.
4. On the scope picker, select **`com.intuit.quickbooks.accounting`** only. (We don't use payments or payroll APIs.)
5. Click **Create app**.

### A.3 Grab the development credentials

1. Left sidebar of the app → **Keys and credentials** → make sure you're on the **Development** section (top toggle).
2. Copy these two values somewhere safe:
   - **Client ID**
   - **Client Secret**

### A.4 Register the redirect URI

On the same page, find **Redirect URIs** and add:

```
http://localhost:8000/api/auth/workforce/callback
```

Click **Save**.

> The URI you register here must **exactly match** the `INTUIT_REDIRECT_URI` env var (Part B). Protocol, host, port, path — all must match. Trailing slashes matter.

### A.5 Create a sandbox company

Sandboxes are **account-level**, not per-app (the UI moved this in 2024 — there's no "Sandbox" item in the per-app sidebar anymore).

1. Open https://developer.intuit.com/app/developer/sandbox directly.
2. If the table is empty (`QuickBooks Online (0)`), click the blue **Add** button (top right).
3. Pick:
   - **Product:** QuickBooks Online
   - **Region:** United States (most features supported)
4. Click **Create**. Takes ~10 seconds.
5. The table now shows one row. In the **Actions** column there's a launch icon — click it. A new tab opens with a fully-functional QuickBooks Online session. You're the admin of this sandbox by default.

> **Keep this sandbox tab open** — you'll need it in Part C and again in Part D for verification.

---

## Part B — Backend env vars (sandbox config)

### B.1 Generate the encryption key

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

You'll get a 44-char base64 string like `EAB9...xK4=`. Save it.

### B.2 Add to your local backend `.env`

Add these five variables (keep any existing vars):

```
INTUIT_CLIENT_ID=<from A.3>
INTUIT_CLIENT_SECRET=<from A.3>
INTUIT_REDIRECT_URI=http://localhost:8000/api/auth/workforce/callback
INTUIT_API_BASE_URL=https://sandbox-quickbooks.api.intuit.com
WORKFORCE_TOKEN_ENCRYPTION_KEY=<from B.1>
```

> The OAuth + token + revoke URLs default to Intuit's production endpoints, which is correct — those are the same for sandbox and production. **Only the API base URL** differs between sandbox and production.

### B.3 Restart the backend

**If running directly via uvicorn:**

```bash
cd backend && python -m uvicorn main:app --reload --port 8000
```

**If running via Docker Compose** (which is the local default), the env
vars in `.env` only reach the backend container when they're forwarded
in `docker-compose.yml`. The five workforce vars (plus the optional
overrides) are already wired in `docker-compose.yml` under
`services.backend.environment`, so all you need to do is **recreate the
backend container** (a plain `restart` won't pick up new env from
`.env`):

```bash
docker compose up -d --force-recreate backend
docker compose logs -f backend
```

On first boot watch for these migration log lines:

```
[MIGRATION] Adding projects.workforce_client_id...
[MIGRATION] Adding projects.workforce_client_name...
[MIGRATION] Adding time_entries.workforce_entry_id...
```

If you see them, schema is ready. They run once per fresh column; subsequent restarts skip them silently.

---

## Part C — Sandbox QuickBooks setup

*You're admin of your own sandbox — all three steps below are within your control.*

Open your sandbox QuickBooks tab from Part A.5.

### C.1 Create the Hours service item

1. Gear icon (top right) → **Products and services** (alternative path: **Lists → Products and services**).
2. Click the green **New** button → **Service**.
3. **Name:** `Hours` — exact spelling, case-sensitive. The sync queries for this exact name; `hours` or `HOURS` won't match.
4. **Income account:** pick any service-revenue account from the dropdown (defaults are fine for sandbox).
5. Click **Save and close**.

### C.2 Set an employee email matching your Arsenal login

1. Left nav → **Payroll** (or **Workers** in some layouts) → **Employees**.
2. Click any pre-seeded employee → **Edit** at the top of their profile.
3. Set **Email** to whatever your Arsenal user's email is (e.g. `sahil.fayaz@arsenalai.com`).
4. **Save**.

> The sync matches Arsenal `developer.email` against QB `Employee.PrimaryEmailAddr` case-insensitively. An exact match (ignoring case) is required.

### C.3 Create a test customer

1. **Sales** (left nav) → **Customers** → green **New customer** button.
2. **Customer display name:** `Test Client` (or anything memorable).
3. Click **Save**.

This customer is what you'll tag to an Arsenal project in Part D.

---

## Part D — Connect Arsenal + smoke test (sandbox)

*Everything in this part is in the Arsenal Ops UI plus a verification trip back to the sandbox QB tab.*

### D.1 Open Arsenal as a system admin

1. Browser → `http://localhost:5173` (or wherever the frontend runs).
2. Sign in with an account that has the `admin.workforce_connect` capability. The default `admin` system role has it.

### D.2 Connect QuickBooks

1. **Admin → Integrations** tab.
2. Click **Connect QuickBooks**.
3. You're redirected to Intuit's consent page. Sign in with your developer account if prompted.
4. On the company picker, choose your **sandbox** company.
5. Click **Connect**.
6. You bounce back to Arsenal at `/admin?tab=integrations&workforce=connected`.

**Expected outcome on the Integrations card:**
- Green "Connected" pill
- **QuickBooks Realm:** numeric id
- **Service Item:** Hours
- **Connected:** today's timestamp
- **Last Sync:** Never
- Status badge: "Not yet run"

**If you instead see `?workforce=connected&warn=service_item_missing`:** you didn't create the Hours item (Part C.1). Create it, then click Disconnect → Connect again. (Or just run Sync Now once — the worker resolves the service item lazily and saves it.)

### D.3 Tag a project to the sandbox customer

1. **Admin → Projects** tab.
2. Pick any project. You'll see two chips below the title — the **category chip** (Tag icon) and a new **QB client chip** (Building icon).
3. The QB client chip says **No QB client** by default. Click it.
4. Select **Test Client** from the dropdown. The chip turns green and shows "Test Client".

### D.4 Log a test time entry inside the previous Mon-Fri window

Today is **2026-06-16 (Tuesday)**, so the calendar week is Mon 2026-06-15 → Sun 2026-06-21, and the previous full Mon-Fri is **2026-06-08 → 2026-06-12**. Log a TimeEntry with a `logged_at` in that range, on the tagged project, for the developer whose email you set in C.2.

**Easiest path — log through Arsenal UI:**
- Find a work item in the tagged project.
- Use the normal Arsenal "Log hours" flow against today's date.
- Then backdate the row directly in the DB so it lands in the window:

```sql
UPDATE time_entries
SET logged_at = '2026-06-10 10:00:00'
WHERE id = <the entry id you just created>;
```

### D.5 Run the manual sync

1. Back to **Admin → Integrations**.
2. Click **Sync Now**.

**Expected toast:** `Synced 1 entry for 2026-06-08 - 2026-06-12.`

**Expected card refresh:**
- **Last Sync:** updated to now
- Status badge: green **Healthy**
- "1 synced" footer

### D.6 Verify the TimeActivity in QuickBooks

1. Switch to your sandbox QB tab.
2. Left nav → **Time** (sometimes under **Workers → Time**).
3. You should see a new entry with:
   - **Employee:** the one whose email you set in C.2
   - **Customer:** Test Client
   - **Service:** Hours
   - **Date:** 2026-06-10 (or whatever you backdated to)
   - **Hours:** whatever you logged
   - **Description:** `[<work-item-key>] <work-item-title> — <your description>`

If it's there, the integration works end-to-end. 🎉

### D.7 Verify idempotency

1. Without making any changes, click **Sync Now** again in Arsenal.
2. **Expected toast:** `Nothing to sync in 2026-06-08 - 2026-06-12.`
3. Switch to QB sandbox → confirm **no new TimeActivity** was created. Only the one from D.6 exists.

This proves the worker isn't double-pushing.

### D.8 Negative-path checks

Pick at least one of these to confirm the failure modes surface cleanly.

**D.8.a — Unmatched email**
1. In sandbox QB, change the employee's email to something Arsenal doesn't know (e.g. `nobody@nowhere.test`).
2. In Arsenal, log a NEW time entry, backdate it into the window (same SQL as D.4).
3. Click **Sync Now**.
4. **Expected:** Integration card "Last sync notes" shows `skipped: <your-arsenal-email>: not in QuickBooks`. No new QB TimeActivity.
5. Restore the email afterwards.

**D.8.b — Project not tagged**
1. Unlink the project (chip → **No QB client**).
2. Log a new time entry on that project, backdate into window.
3. Click **Sync Now**.
4. **Expected:** `Nothing to sync in <window>.` The entry is simply ineligible.

**D.8.c — Hours item missing**
1. In sandbox QB, mark the "Hours" service item as inactive (or delete it).
2. Click **Disconnect** then **Connect** in Arsenal.
3. **Expected:** OAuth completes but you land with `?workforce=connected&warn=service_item_missing`. A subsequent Sync Now returns `Sync failed: 'Hours' service item not found in QuickBooks. Create it in QB then retry.`
4. Recreate the item afterwards.

---

## Part E — Production cutover

*Requires the real QB Online admin. Everything below assumes Parts A-D have been validated in sandbox.*

### E.1 Get production credentials from Intuit

1. Open the Intuit developer dashboard for your app.
2. Left sidebar → switch from **Development** to **Production** (top toggle on the Keys and credentials page).
3. If you don't have production keys yet, click **Get production keys**. Intuit asks you to fill out app metadata (name, support email, privacy policy URL, etc.). For internal use the form is short; approval is usually instant.
4. Copy:
   - **Production Client ID**
   - **Production Client Secret**

> **These are DIFFERENT from the sandbox values.** Don't reuse the development keys.

### E.2 Register the production redirect URI

Same Keys and credentials page, **Production** section → **Redirect URIs** → add the production callback:

```
https://<your-api-host>/api/auth/workforce/callback
```

Match it exactly to the `INTUIT_REDIRECT_URI` you'll set in E.3.

### E.3 Update Render env vars (BOTH services)

The web service (the API) and the cron job both need the production env. Set these on **both**:

```
INTUIT_CLIENT_ID=<production value>
INTUIT_CLIENT_SECRET=<production value>
INTUIT_REDIRECT_URI=https://<your-api-host>/api/auth/workforce/callback
INTUIT_API_BASE_URL=https://quickbooks.api.intuit.com
WORKFORCE_TOKEN_ENCRYPTION_KEY=<your prod Fernet key>
```

> **Critical:** the encryption key must be **identical** on the web service and the cron job. If they differ, the cron can't decrypt the tokens the web service wrote, and the sync fails with "Stored workforce token could not be decrypted."

> **Don't reuse the local-dev Fernet key in production.** Generate a fresh one (Part B.1) for production, and store it in Render's secrets — never commit it to git.

Cleaner approach: create a Render **Environment Group** with these five variables and link it to both the web service and the cron job.

### E.4 Set up the production QuickBooks company (QB admin task)

The QB admin needs to do these inside the real QB Online company:

1. **Create the Hours service item** — same steps as Part C.1, in the real company.
2. **Verify employee emails** — each Arsenal developer who'll log billable hours must have a matching QB Employee record with the right email (case-insensitive match).
3. (Optional) Pre-create the QB Customers you'll tag projects to.

### E.5 First production connection (QB admin task)

The QB admin must be the one to click Connect — the OAuth flow inherits *their* QB permissions. If a non-admin clicks, Intuit will either refuse or return a read-only token that can't write TimeActivity.

Send the QB admin this one-liner:
> "Two things needed, ~10 minutes total: (1) make sure a Service Item called exactly 'Hours' exists in QuickBooks; (2) sign into Arsenal Ops, go to **Admin → Integrations**, click **Connect QuickBooks**, and pick our real QB company on the Intuit consent page."

After that one-time click, the refresh token rolls forever as long as we sync at least once every 100 days — which the Saturday cron handles automatically.

### E.6 Tag projects to QB customers

Once connected:

1. **Admin → Projects** → for each project that should be billed.
2. Click its QB client chip → pick the QB customer from the dropdown.
3. Repeat for every billable project.

Projects without a QB client tag are simply ignored by the sync.

### E.7 Set up the Render Cron Job

Dashboard → **New +** → **Cron Job**.

| Field | Value |
|---|---|
| Name | `arsenal-ops-workforce-sync` |
| Region | same as the backend web service |
| Branch | `main` (or your prod branch) |
| Runtime | `Docker` |
| Dockerfile Path | `backend/Dockerfile`  *(reuses the backend image)* |
| Docker Build Context Directory | `backend` |
| Schedule | `0 8 * * 6`   *(Saturday 08:00 UTC — see DST note below)* |
| Command | `python -m scripts.run_workforce_sync` |
| Instance type | `Starter` is plenty |

Env vars on the cron job: same five from E.3, plus `DATABASE_URL` (same Render Postgres as the web service).

### E.8 Verify the cron before its first scheduled fire

1. In the cron job's Render dashboard → click **Trigger Run**.
2. Open the **Logs** tab. You should see a line like:
   ```
   result: {"status": "ok", "synced": N, "failed": 0, "skipped": M, "window_start": "...", "window_end": "..."}
   ```
3. Confirm the **Next run** timestamp on the cron overview page is the upcoming Saturday at 08:00 UTC.

---

## DST gotcha (Render is UTC-only)

Render cron expressions are **UTC**; there is no timezone field. `0 8 * * 6` (Sat 08:00 UTC) corresponds to:

- **EST (winter):** Sat 03:00 ET — early morning, before anyone is in the office.
- **EDT (summer):** Sat 04:00 ET — also early morning, drifts by 1h.
- **IST (India):** Sat 13:30 IST.

If a different local Saturday time fits the team better, pick a different UTC expression — there's no business reason it must be 08:00.

---

## Optional: `render.yaml` (Infrastructure as Code)

Committing a blueprint makes the cron job reproducible:

```yaml
services:
  - type: cron
    name: arsenal-ops-workforce-sync
    runtime: docker
    dockerfilePath: backend/Dockerfile
    schedule: "0 8 * * 6"                         # Sat 08:00 UTC
    buildCommand: ""
    startCommand: python -m scripts.run_workforce_sync
    envVars:
      - fromGroup: arsenal-ops-shared              # DATABASE_URL etc.
      - key: INTUIT_CLIENT_ID
        sync: false
      - key: INTUIT_CLIENT_SECRET
        sync: false
      - key: INTUIT_REDIRECT_URI
        sync: false
      - key: WORKFORCE_TOKEN_ENCRYPTION_KEY
        sync: false
```

`sync: false` means "set the value in the Render dashboard, don't sync from this file" — keeps secrets out of git.

---

## Local development (Docker Compose)

The current `docker-compose.yml` doesn't ship a scheduler container. Two options for local exercise:

```bash
# A. Run the sync on demand against the dev DB.
docker compose exec backend python -m scripts.run_workforce_sync

# B. Run via the manual API endpoint (must be signed in as an admin
# with the admin.workforce_connect capability).
curl -X POST http://localhost:8000/api/admin/workforce/sync \
  -H "Authorization: Bearer $TOKEN"
```

For automatic local scheduling, add a `scheduler` container to `docker-compose.yml` running supercronic (mirrors the pattern in `WEEKLY_EMAIL_REPORT_SETUP.md`). Not shipped by default — Render's managed cron is the canonical scheduler.

---

## Configuration reference

| Variable | Default | Purpose |
|---|---|---|
| `INTUIT_CLIENT_ID` | — | Intuit developer app client id (different between Development and Production keys) |
| `INTUIT_CLIENT_SECRET` | — | Intuit developer app client secret |
| `INTUIT_REDIRECT_URI` | — | OAuth redirect URI — must match the URI registered in the Intuit app exactly. Web service uses this; cron does not. |
| `INTUIT_OAUTH_BASE_URL` | `https://appcenter.intuit.com` | Override for tests; same for sandbox + production |
| `INTUIT_TOKEN_URL` | `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer` | Override for tests; same for sandbox + production |
| `INTUIT_REVOKE_URL` | `https://developer.api.intuit.com/v2/oauth2/tokens/revoke` | Override for tests; same for sandbox + production |
| `INTUIT_API_BASE_URL` | `https://quickbooks.api.intuit.com` | **THIS is the sandbox/prod toggle.** Set to `https://sandbox-quickbooks.api.intuit.com` for sandbox. |
| `WORKFORCE_TOKEN_ENCRYPTION_KEY` | — | Fernet key. Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. **MUST match between web and cron services.** |
| `WORKFORCE_POST_OAUTH_REDIRECT` | `<FRONTEND_URL>/admin?tab=integrations` (falls back to `http://localhost:5173/admin?tab=integrations`) | Where the OAuth callback redirects the admin's browser when done. Accepts absolute URLs (`https://app.foo/...`) or paths (`/...`); paths anchor against `FRONTEND_URL`. |
| `FRONTEND_URL` | `http://localhost:5173` | Origin of the SPA. Used to build the post-OAuth redirect when `WORKFORCE_POST_OAUTH_REDIRECT` is unset or relative. Already used by other Arsenal flows. |
| `WORKFORCE_SYNC_BATCH_CAP` | `500` | Per-run cap on entries pushed to QB |
| `WORKFORCE_SYNC_LOG_LEVEL` | `INFO` | Log verbosity for the cron script |
| `DATABASE_URL` | — | Postgres connection string — must point at the same DB the API uses |
| `WEEKLY_REPORT_RECIPIENTS` | *empty* | Comma-separated emails that receive both the weekly hours report AND the Saturday QuickBooks sync summary. Empty / unset → cron sync runs silently (no email). Shared with `scripts/send_weekly_report.py` deliberately. |
| Gmail OAuth2 env (`MAIL_REFRESH_TOKEN`, `BOT_EMAIL`, `SMTP_FROM_NAME`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) | — | Required to actually deliver the sync notification email. Same setup as the existing weekly report (see `EMAIL_SETUP.md`). If not configured, the sync still runs — the email send logs a warning and is skipped. |

---

## Schedule changes

- **Render:** edit the cron job's `Schedule` field in the dashboard (or update `render.yaml` and redeploy).
- **Local Compose:** if you add a `scheduler` container, edit `backend/crontab` and `docker compose restart scheduler`.

---

## Rate limits & costs

### Cost

The integration itself is **free**. Intuit doesn't charge per API call,
per OAuth handshake, or for sandbox usage. You pay for your existing
QuickBooks Online subscription (any QBO tier — Simple Start, Essentials,
Plus, Advanced — supports the TimeActivity endpoint we use); the
integration doesn't push you to a higher tier.

The only incremental cost is the Render Cron Job container — currently
~$1-2/month on Render's Starter tier (verify against current Render
pricing). If you'd rather avoid it, trigger `POST /api/admin/workforce/sync`
from any cron source you already pay for (GitHub Actions scheduled
workflows, an existing crontab, etc.). The sync code is indifferent to
who triggers it.

### Intuit QBO API rate limits

Intuit publishes the following limits per QB Online realm (your QB
company). These are **soft** — bursts above them get throttled but
don't permanently penalize the account.

| Limit | Value | Notes |
|---|---|---|
| Throttle limit per realm | **500 requests / minute** | Sustained. Bursting above briefly is OK. |
| Per-second cap | **40 requests / second** | Effectively the same as above, just smaller window. |
| Concurrent connection limit | 10 connections per realm | We never come close — sync is sequential. |
| Daily soft cap | Not officially published; reports suggest >100k/day | Far above any plausible Arsenal workload. |

> Always cross-check against Intuit's current docs at
> https://developer.intuit.com/app/developer/qbo/docs/learn/rest-api-features#limits-and-throttles
> — they revise these periodically.

### Arsenal's expected volume

A typical weekly sync at Arsenal makes:

| Operation | Calls / week |
|---|---|
| `fetch_qb_employees` (one query at sync start) | 1 |
| `resolve_service_item` (only if `service_item_id` is null) | 0-1 |
| `post_time_activity` (one per eligible TimeEntry) | ~50-200 |
| **Total per Saturday cron** | **~50-202** |

Spread across ~30 seconds. **That's about 7 requests/second peak —
roughly 1.4% of the 500/min limit.** You will never hit the limit in
normal operation.

### What happens if we do hit a limit

Intuit returns HTTP 429. Our sync worker catches this and:

1. **Stops the run gracefully** — no further `post_time_activity` calls
   in the same run. The remaining entries are *not* counted as failed;
   they're just untried.
2. **Returns `status=partial`** with reason `rate_limited; resumes next
   run` — surfaced to the admin in the Integrations card.
3. **Commits whatever was already pushed** — per-entry commits inside
   the loop mean nothing is lost; the next run picks up where we left off.

So the worst case from hitting a rate limit is a one-week delay in
fully draining the queue. No double-posts, no lost work, no need for
manual intervention.

### Other rate-limit-adjacent things to know

- **OAuth handshake** is unmetered. The Connect button doesn't consume
  API quota.
- **Refresh token** rolls every time we mint an access token (about
  once an hour during a sync). Intuit doesn't rate-limit refreshes
  separately from API calls.
- **The 100-day refresh-token TTL** is the only timer that can quietly
  kill the integration. The Saturday cron's once-a-week activity is
  more than enough to keep it rolling. If the integration sits idle
  for >100 days without a sync, the next run will fail with
  `status=error, reason=oauth_failed` — see Troubleshooting below
  for the disconnect/reconnect fix.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `status=not_connected` in logs / UI | No admin has finished the QB OAuth flow yet | Admin → Integrations → **Connect QuickBooks** |
| `status=error, reason=could_not_resolve_service_item` | "Hours" Service Item doesn't exist in the QB realm | Create a Service Item named exactly `Hours` in QuickBooks, then re-run the sync |
| `status=partial, reason=rate_limited; resumes next run` | Hit Intuit's per-realm rate limit (rare at our volume) | None — next run picks up the remainder |
| Many `skipped` entries with `not in QuickBooks` | Developer emails don't match QB employee emails | Check each developer's Arsenal email matches their QB Employee primary email exactly (case-insensitive) |
| `status=error, reason=oauth_failed` | Refresh token revoked or aged out (100-day TTL with no refresh) | Admin → Integrations → **Disconnect** then **Connect** again |
| Cron job runs but no entries push | No projects have been tagged with a QB Customer | Admin → Projects → click the QB client chip on each billable project |
| `Stored workforce token could not be decrypted` | `WORKFORCE_TOKEN_ENCRYPTION_KEY` differs between web service and cron job | Set the same value on both, then Disconnect + Connect again |
| `INTUIT_REDIRECT_URI is not set` on Connect | Env var missing on web service | Set it, redeploy. URI must match the one registered in the Intuit app. |
| OAuth completes but lands on `workforce=error&reason=bad_state` | State token expired (10-min TTL) — admin took too long to click through Intuit | Click Connect again and complete within 10 minutes |
| OAuth lands on `workforce=connected&warn=service_item_missing` | "Hours" item didn't exist at connect time | Create the item in QB, then click Sync Now — the worker will resolve it lazily |
| After Connect, browser shows `{"detail":"Not Found"}` at `:8000/admin?...` | `FRONTEND_URL` / `WORKFORCE_POST_OAUTH_REDIRECT` resolves to a relative path — browser anchors it against the backend host instead of the SPA | Set `FRONTEND_URL=http://localhost:5173` (or your SPA origin) in `.env`, recreate the backend container |

---

## Tests

Unit tests for the sync worker live at `backend/tests/test_workforce_sync.py` — 34 tests covering window resolution, eligibility filtering, idempotency, skip paths, error paths, OAuth failures mid-run, lazy service-item resolution, and observability writes. Network-dependent code (QB API, OAuth refresh) is mocked at the import site — no real Intuit calls happen during tests.

```bash
cd backend
python -m pytest tests/test_workforce_sync.py -v
```

---

## Architecture notes

- **OAuth tokens** are stored encrypted at rest (Fernet, key from `WORKFORCE_TOKEN_ENCRYPTION_KEY`) in the `workforce_integration` table. Token ciphertext is never returned to the frontend; the status endpoint redacts it via `to_safe_dict()`.
- **Refresh token rotation**: Intuit rotates refresh tokens on every refresh call. The sync worker handles persistence via `ensure_fresh_access_token` → `persist_tokens`. Don't try to use an env var instead of the DB row — refresh tokens are mutable per-refresh, and env vars are immutable from the app's perspective.
- **Singleton integration row**: the `workforce_integration` table holds at most one row (`id=1`). One Arsenal install = one QB realm.
- **Per-project tagging**: a project is "eligible for sync" when `projects.workforce_client_id IS NOT NULL`. Removing the tag stops new entries from being eligible but doesn't undo any entries already pushed.
- **Idempotency**: `time_entries.workforce_entry_id IS NULL` is the eligibility filter. A successful push sets it to the QB TimeActivity Id, which is why re-running the sync never duplicates work.
- **Concurrency**: a Postgres advisory lock prevents the Saturday cron and a manual click from overlapping. On SQLite (tests) the lock is a no-op; idempotency from `workforce_entry_id IS NULL` is sufficient there.
