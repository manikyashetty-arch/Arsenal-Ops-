# Workforce / QuickBooks Time Integration — Design

**Status:** Approved (brainstorming complete, awaiting written-spec review)
**Date:** 2026-06-15
**Scope:** Push Arsenal Ops time entries into QuickBooks Time so hours land against the
correct client in the workforce.intuit.com employee portal.

---

## 1. Purpose

Arsenal Ops employees log hours against projects. Hours then have to be
re-entered manually in QuickBooks Time (`workforce.intuit.com → Time`)
against a Client, which is double-entry and error-prone. This integration
makes Arsenal Ops the single source of truth: log once in Arsenal, hours
land in QuickBooks under the correct Customer + Employee + "Hours"
Service Item automatically.

Integration target: **Intuit QuickBooks Online API** (`TimeActivity`
endpoint). Auth: **OAuth 2.0** via Intuit Developer.

---

## 2. Confirmed assumptions (from brainstorming)

| Question | Decision |
|---|---|
| Which Workforce? | Intuit's QB Time bundle (workforce.intuit.com surfaces it) |
| User mapping | Email-based. Arsenal `developer.email` → QB `Employee` |
| Sync timing | Weekly cron (Saturday 08:00 UTC) + manual "Sync Now" button. **Both push the Mon-Fri of the calendar week containing the trigger** — no back-fill of older weeks. The Sat cron and a same-week manual click target the same window; a Mon-Fri click syncs that calendar week's partial Mon-Fri (later days simply have no data yet). |
| Service Item | Always "Hours" — HR-mandated, no per-project / per-role variants |
| Data source | Reuses the Time Entries admin tab's data shape (TimeEntry ⋈ WorkItem ⋈ Project ⋈ Developer) |
| Direction | One-way (Arsenal → QB) for MVP |
| Cardinality | One Arsenal project ↔ one QB Customer |

---

## 3. Architecture

```
┌─────────────────┐    OAuth 2.0     ┌──────────────────┐
│ Arsenal Backend │ ───────────────▶ │  Intuit Auth     │
│                 │ ◀─── tokens ──── │  Server          │
└────────┬────────┘                  └──────────────────┘
         │
         │ stores: realm_id, refresh_token (encrypted),
         │         service_item_id ("Hours")
         ▼
┌─────────────────┐
│ workforce_      │
│ integration     │  singleton — one connection per Arsenal install
│ row             │
└────────┬────────┘
         │
         │  Triggered by:
         │   (a) weekly cron — Saturday 08:00 UTC
         │   (b) manual "Sync Now" — admin button
         ▼
┌──────────────────────────────────────────────┐
│ Sync worker                                  │
│                                              │
│ For each TimeEntry where:                    │
│   project.workforce_client_id IS NOT NULL    │
│   AND workforce_entry_id IS NULL             │
│                                              │
│ 1. Look up QB Employee by Arsenal email      │
│ 2. POST /v3/.../timeactivity with:           │
│      EmployeeRef + CustomerRef +             │
│      ItemRef("Hours") + Hours + TxnDate +    │
│      Description                             │
│ 3. Store returned TimeActivity Id            │
└──────────────────────────────────────────────┘
```

Three key choices, with reasoning:

- **One-time admin OAuth, not per-user.** Backend stores a long-lived refresh
  token (100-day TTL, auto-renewed on each use). Subsequent syncs run
  server-side without any user interaction. Per-user OAuth is the
  alternative but adds setup friction for every employee and provides no
  benefit since the backend writes on behalf of employees by setting
  `EmployeeRef`.
- **Email-based employee mapping at sync time.** If an Arsenal email doesn't
  match any QB employee, that entry is skipped + a reason is recorded.
  Sync doesn't fail wholesale.
- **Idempotent via `TimeEntry.workforce_entry_id`.** Once a TimeEntry has a
  QB id stored, the worker skips it. No risk of double-pushing if the
  worker runs concurrently, retries, or someone clicks "Sync Now" right
  before the cron.

---

## 4. Data model

### New table — `workforce_integration` (singleton row)

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | always `1` — single connection per Arsenal install |
| `realm_id` | VARCHAR | QB company id from OAuth callback |
| `refresh_token` | TEXT (encrypted) | symmetric encryption at rest (key in env, see Security §) |
| `access_token` | TEXT (encrypted) | short-lived (~1h), re-minted from refresh as needed |
| `access_token_expires_at` | TIMESTAMP | when to refresh |
| `service_item_id` | VARCHAR | QB id of "Hours" Service Item, looked up + cached at connect |
| `service_item_name` | VARCHAR | display only (`"Hours"`) |
| `connected_at` | TIMESTAMP | audit |
| `connected_by_user_id` | INTEGER FK → users | audit |
| `last_sync_at` | TIMESTAMP NULL | observability |
| `last_sync_status` | VARCHAR | `ok` \| `partial` \| `error` |
| `last_sync_error` | TEXT NULL | top-level error message if `last_sync_status='error'` |
| `last_synced_count` | INTEGER | how many entries pushed in last run |
| `last_failed_count` | INTEGER | how many failed in last run |
| `created_at` / `updated_at` | TIMESTAMP | standard timestamps |

### Additions to existing tables

**`projects` table — link Arsenal projects to QB Customers:**
| Column | Type | Notes |
|---|---|---|
| `workforce_client_id` | VARCHAR NULL | QB Customer id (`null` = not linked, won't be synced) |
| `workforce_client_name` | VARCHAR NULL | cached display label for picker/list UX |

**`time_entries` table — track sync state per row:**
| Column | Type | Notes |
|---|---|---|
| `workforce_entry_id` | VARCHAR NULL | QB TimeActivity id once synced |

A TimeEntry is **eligible for sync** when:

```sql
project.workforce_client_id IS NOT NULL
  AND time_entries.workforce_entry_id IS NULL
```

Re-syncs of failed entries happen automatically on the next run because
`workforce_entry_id` is still null. Per-row failure reasons are logged
to the application log (and aggregated in the run summary on
`workforce_integration.last_sync_error`) rather than persisted per row,
to keep `time_entries` schema lean.

### Migrations

Backend migration sequence (idempotent — safe to re-run):

1. `ALTER TABLE projects ADD COLUMN workforce_client_id VARCHAR(64) NULL` + index on the column for queue queries
2. `ALTER TABLE projects ADD COLUMN workforce_client_name VARCHAR(255) NULL`
3. `ALTER TABLE time_entries ADD COLUMN workforce_entry_id VARCHAR(64) NULL` + index (sync worker filters on `IS NULL`)
4. `CREATE TABLE workforce_integration` (one-row table)

Each migration follows the codebase's existing `run_migrations()` pattern in `backend/database.py` —
column-existence check then `ALTER TABLE`.

---

## 5. API endpoints

| Method | Path | Capability | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/workforce/status` | `admin.workforce_connect` | connection state + last sync info + pending count |
| `POST` | `/api/admin/workforce/connect` | `admin.workforce_connect` | returns Intuit OAuth URL (with signed `state` token) |
| `GET` | `/api/auth/workforce/callback` | state token verified | OAuth callback receiver; stores tokens |
| `POST` | `/api/admin/workforce/disconnect` | `admin.workforce_connect` | revokes tokens at Intuit + clears row |
| `GET` | `/api/admin/workforce/clients` | `admin.workforce_connect` | proxies QB Customer list (paged) for the picker |
| `PUT` | `/api/admin/workforce/projects/{id}/client` | `admin.projects_write` | links/unlinks project to QB Customer |
| `POST` | `/api/admin/workforce/sync` | `admin.workforce_connect` | manual sync trigger; returns `{ synced, failed, skipped }` |

### New capability key

**`admin.workforce_connect`** — gates connect/disconnect/sync/clients endpoints. Added to:

- `backend/capabilities.py` registry
- `app/src/pages/AdminDashboard/AdminDashboard.tsx` picker catalog (Admin section)
- Default seed: granted to the `admin` system role only

Distinct from `admin.projects_write` because the latter covers per-project
metadata (including linking to a QB client) but doesn't grant authority
over the org-wide credentials. Two separate concerns, two separate gates.

---

## 6. Sync worker

**Triggered by:**

- **Weekly cron** — Saturday 08:00 UTC by default. Existing weekly-cron
  infrastructure (`backend/crontab` + `backend/scripts/`) already runs
  Friday's weekly email report; adding a Saturday entry is the same pattern.
  Timezone is UTC for predictability across deploys; override the crontab
  line at deploy time if a different local Saturday morning is preferred
  (the user said "Sat morning" — UTC 08:00 maps to local Saturday morning
  for the Americas and Europe; if Asia/Pacific, customize the crontab).
- **Manual** — admin clicks "Sync Now" → `POST /api/admin/workforce/sync`.
  Same code path, runs inline (synchronous response with counts).

**Employee email lookup edge cases:**

- **No match:** TimeEntry is skipped, reason logged to the application
  log and aggregated into the run summary (`integration.last_sync_error`
  shows e.g. "3 entries skipped: unmatched emails"). Admin sees the
  count and a hint in the Integrations card.
- **Multiple QB employees share an email:** First match wins. Intuit
  doesn't enforce email uniqueness but in practice this is rare. A
  warning is logged on the run; the admin can de-dup in QB if needed.
- **Email case mismatch:** Lookup is case-insensitive (lowercase both
  sides before comparing).

**Both paths use the same `run_workforce_sync()` function.** Reuses the
exact JOIN that powers the Time Entries admin tab so what gets pushed
matches exactly what an admin sees in that tab:

```python
def run_workforce_sync():
    integration = db.query(WorkforceIntegration).first()
    if not integration:
        return {"synced": 0, "failed": 0, "skipped": 0, "reason": "not_connected"}

    # 1. Refresh access token if expired.
    ensure_fresh_access_token(integration)

    # 2. Build the email → QB Employee id map once per run (one QB API call).
    employee_map = fetch_qb_employees(integration)

    # 3. Reuse the same TimeEntry query shape as the Time Entries admin tab.
    entries = (
        db.query(TimeEntry)
          .join(WorkItem, TimeEntry.work_item_id == WorkItem.id)
          .join(Project, WorkItem.project_id == Project.id)
          .join(Developer, TimeEntry.developer_id == Developer.id)
          .filter(Project.workforce_client_id.isnot(None),
                  TimeEntry.workforce_entry_id.is_(None))
          .options(selectinload(TimeEntry.work_item),
                   selectinload(TimeEntry.developer))
          .limit(BATCH_CAP)  # 200 per run by default
          .all()
    )

    synced = failed = skipped = 0
    skip_reasons: list[str] = []
    fail_reasons: list[str] = []
    for entry in entries:
        email = (entry.developer.email or "").lower()
        if email not in employee_map:
            skip_reasons.append(f"{email or '<no email>'}: not in QuickBooks")
            skipped += 1
            continue
        try:
            qb_id = post_time_activity(
                integration,
                employee_qb_id=employee_map[email],
                customer_qb_id=entry.work_item.project.workforce_client_id,
                service_item_id=integration.service_item_id,
                hours=entry.hours,
                txn_date=entry.logged_at.date(),
                description=build_description(entry),
            )
            entry.workforce_entry_id = qb_id
            synced += 1
        except QBRateLimitError:
            # Stop pushing; next cron run picks up where we left off.
            break
        except QBApiError as e:
            fail_reasons.append(f"entry {entry.id}: {str(e)[:200]}")
            failed += 1

    db.commit()
    integration.last_sync_at = utcnow()
    integration.last_sync_status = "ok" if failed == 0 else "partial"
    integration.last_synced_count = synced
    integration.last_failed_count = failed
    db.commit()

    write_activity_log("workforce_sync", counts={"synced": synced, "failed": failed, "skipped": skipped})
    return {"synced": synced, "failed": failed, "skipped": skipped}
```

**Description format:**

```
[ARS-123] Implement OAuth callback — logged via Arsenal Ops
```

So the QB record carries the Arsenal ticket key + title for traceability;
the "logged via Arsenal Ops" suffix makes the origin obvious to anyone
auditing in QB.

**Rate limit handling:**

- Intuit caps at ~500 requests/minute/realm
- Worker batch cap: 200 entries per run by default (`WORKFORCE_SYNC_BATCH_CAP` env var to override)
- On a `429 Too Many Requests`, the worker stops mid-batch and lets the
  next cron pick up where it left off. We don't sleep-and-retry because
  the weekly cadence makes urgency low and a long-sleeping process is a
  worse failure mode than a partial sync.

**Concurrent run protection:**

The worker is naturally idempotent (the `workforce_entry_id IS NULL`
predicate excludes already-synced rows), but two workers racing on the
same row between SELECT and UPDATE could both POST to QB and create
duplicate TimeActivity records. Guards:

1. **Postgres advisory lock** on the `workforce_integration` row at the
   start of `run_workforce_sync`. Second concurrent caller returns
   immediately with `{ synced: 0, reason: "already_running" }`. Cheap,
   no extra schema.
2. **Per-row SELECT ... FOR UPDATE SKIP LOCKED** when fetching the
   batch — defense in depth in case the advisory lock is somehow
   bypassed.

Both layers active in MVP.

---

## 7. Frontend

### New admin sub-tab: "Integrations"

Sibling to Employees / Projects / Time Entries / Users / Roles in the
AdminDashboard tab strip. Gated on `admin.workforce_connect`.

**Connection card:**
- "QuickBooks Time" + Intuit logo / icon
- Status: connected ✓ (realm id) / not connected
- "Connect with QuickBooks" button (kicks off OAuth) / "Reconnect" /
  "Disconnect"
- Connected-as info: realm id, connected-by user, connected-at date

**Sync card** (visible only when connected):
- Last sync timestamp + status (`ok` / `partial` / `error`)
- Pending entries count
- Last error count (clickable → opens a drawer listing the failing entries with reasons)
- **"Sync Now"** button — calls `POST /api/admin/workforce/sync`, shows
  toast with `{ synced, failed, skipped }`

### Per-project QuickBooks Client picker

In the existing Projects admin tab, per-card pickers already exist for
Category. A new identical-looking picker for "QuickBooks Client" is added
beside it. Hidden entirely when no integration is connected (no point
showing a picker with no options).

Gated on `admin.projects_write` because it's a per-project metadata
write — same gate as the existing Category picker.

### Time Entries tab — sync state column

Optional small icon per row in the existing Time Entries table:

- ✓ green: synced (tooltip: `Synced to QuickBooks on {date}`)
- ⏳ amber: pending (linked project but not yet synced)
- ⚠ red: error (tooltip: error reason)
- — gray: not eligible (project has no QB client linked)

This makes the Time Entries tab the single audit surface — same place
the admin already reviews logged hours is where they review sync state.

---

## 8. Security

| Concern | Mitigation |
|---|---|
| **OAuth client secret exposure** | `INTUIT_CLIENT_ID` / `INTUIT_CLIENT_SECRET` in env only. Never committed. Loaded once at startup; never returned in API responses. |
| **Refresh token at rest** | Encrypted with Fernet symmetric crypto. Key in `WORKFORCE_TOKEN_ENCRYPTION_KEY` env var. Independent of the OAuth client secret so they can be rotated separately. |
| **OAuth state forgery (CSRF on the OAuth handshake)** | Cryptographically random `state` value generated at `/connect`, signed with the app's session secret, bound to the initiating user's id + a 10-minute TTL. Validated on `/callback`. |
| **Callback URL spoofing** | Intuit Developer console pins the redirect URI; only our exact callback URL is allowed by Intuit. Backend additionally double-checks the URL matches what we registered. |
| **Privilege escalation** | `admin.workforce_connect` is its own new capability. Not inherited via wildcard from other admin caps. Only true admins (system role `admin`, which holds `*`) automatically get it; custom roles must be granted it explicitly. |
| **Audit trail** | Every connect / disconnect / sync logs an `ActivityLog` row with `action ∈ { workforce_connect, workforce_disconnect, workforce_sync }`. Includes user id + timestamp + counts. |
| **Rate-limit accidental DoS** | Per-realm batch cap (200/run). Respects `429`. Stops batching at rate limit + defers to next run. |
| **Email-mismatch handling** | Soft fail (skip + record reason on the TimeEntry). Never throw, never send hours to the wrong person, never auto-create QB employees. |
| **HTTPS only** | Both the Intuit callback URL and the Intuit API calls require HTTPS. Enforced by Intuit; double-checked by the backend. |
| **Token logging** | Tokens NEVER appear in logs, error messages, or API responses. The integration row's `to_dict()` redacts them by default. |

---

## 9. Phasing

### MVP — in scope

- One-way push (Arsenal → QB) on weekly + manual cadence
- Email-based employee mapping
- Service Item always "Hours"
- Per-project Customer linking via admin picker
- Per-TimeEntry sync state tracking
- Connection panel + Sync Now button
- New `admin.workforce_connect` capability

### Explicitly out of scope (deferred)

- Two-way sync (QB → Arsenal)
- Deletion sync (deleting an Arsenal TimeEntry doesn't delete from QB)
- **Edit-after-sync propagation** — if a TimeEntry is edited in Arsenal
  after `workforce_entry_id` is set, the change does NOT propagate to QB.
  The QB record is frozen at the moment of first sync. Mitigation:
  Arsenal-side log-hours is typically write-once (you log it, you don't
  edit it later). If editing becomes a need, follow-up work adds a
  `workforce_dirty` flag + `PUT /v3/timeactivity/{id}`.
- Per-developer or per-role Service Items
- Multi-realm support (one QB company per Arsenal install)
- Auto-creating QB Employees from Arsenal users

---

## 10. What the user must set up on Intuit's side

1. **Free Intuit Developer account** at developer.intuit.com
2. **Create an app** in their dashboard. Pick "QuickBooks Online and Payments API".
3. **Get** `Client ID` + `Client Secret` from the app's Keys tab.
   - Sandbox tab for testing
   - Production tab for live deployment
4. **Add redirect URI** to the app:
   `https://your-arsenal-domain.com/api/auth/workforce/callback` (and a
   localhost variant for dev).
5. **Sandbox company** — Intuit creates one free for testing.
6. After sandbox testing, switch to production keys + real QB company.

**Backend env vars required before first OAuth:**

```bash
INTUIT_CLIENT_ID=...          # from Intuit Developer app
INTUIT_CLIENT_SECRET=...      # from Intuit Developer app
INTUIT_OAUTH_BASE_URL=https://appcenter.intuit.com/connect/oauth2
INTUIT_API_BASE_URL=https://quickbooks.api.intuit.com  # or sandbox-quickbooks for testing
INTUIT_REDIRECT_URI=https://your-arsenal-domain.com/api/auth/workforce/callback
WORKFORCE_TOKEN_ENCRYPTION_KEY=...  # `python -m cryptography.fernet --generate-key`
WORKFORCE_SYNC_BATCH_CAP=200        # optional override
```

---

## 11. Open questions / decisions to revisit

None remaining for MVP. All clarified during brainstorming.

---

## 12. Implementation plan

After this design is approved in writing, the next step is to invoke
`writing-plans` to produce a step-by-step implementation plan.

Anticipated phasing of the plan:

1. **Schema migration + new table** (no behavior change yet)
2. **New capability key + Roles tab plumbing**
3. **Backend OAuth flow** (connect / callback / disconnect)
4. **Backend QB API client** (fetch employees, fetch customers, post time activity, refresh tokens)
5. **Sync worker** (manual + cron)
6. **Frontend Integrations sub-tab**
7. **Frontend per-project QB Client picker**
8. **Frontend Time Entries sync-state column**
9. **End-to-end test against Intuit sandbox**
10. **Production rollout** — switch sandbox env vars to production, set up cron entry
