# Lighthouse CI

Arsenal-Ops uses Lighthouse CI to measure frontend performance on key routes. This document covers local execution, interpreting results, and the path to authenticated-route testing.

## Metrics

Lighthouse measures:

- **Performance Score**: 0-100 overall performance rating.
- **LCP (Largest Contentful Paint)**: Time for main content to render; target ≤3s.
- **CLS (Cumulative Layout Shift)**: Visual stability; target ≤0.1.
- **FCP (First Contentful Paint)**: Time for any content to render; target ≤2s.
- **Accessibility & Best Practices**: Compliance with WCAG and web standards.

## Current Scope

MVP measures the **login page only** (`http://localhost:4173/`), the only fully public route. Budgets are conservative starting points; initial runs may show worse numbers—that's acceptable for baseline establishment.

## Running Locally

Ensure the frontend is built first, then run Lighthouse CI:

```bash
just lighthouse
```

This builds the app, starts the preview server, and runs Lighthouse 3 times (taking ~60–90s). Results are saved to `.lighthouseci/` and uploaded to Google Cloud Storage. Check the terminal for the temporary-public-storage URL to view full reports.

## Reading CI Results

In the GitHub Actions workflow, the `lighthouse` job:

1. **Always runs** but doesn't block merges (`continue-on-error: true`).
2. **Uploads results** to temporary-public-storage (free Google Cloud Storage).
3. **Posts a comment** with a summary link—click it to view detailed audits, screenshots, and metric timelines.

Budgets use `warn` (not `error`), so regressions surface as warnings, not failures. A yellow/orange warning on a PR comment indicates a metric crossed its threshold.

## Updating Budgets

Edit `.lighthouserc.json` `assertions` to adjust thresholds:

```json
"largest-contentful-paint": ["warn", { "maxNumericValue": 2500 }]
```

Change `maxNumericValue` from 3000 to 2500 (or your target in milliseconds). Re-run CI and verify the metric passes.

## Expanding to Authenticated Routes

Login-gated routes (e.g., dashboard, project board) can be added to Lighthouse by:

1. **Bearer Token Approach**: Use `extraHeaders` in `.lighthouserc.json`:
   ```json
   "extraHeaders": "{\"Authorization\": \"Bearer <token>\"}"
   ```
   Issue a valid JWT via the test backend and inject it.

2. **Storage State Approach** (preferred): Use `puppeteer-extra` with a `storageState` file to preserve cookies/localStorage:
   - Reference the pattern in `app/e2e/auth.ts` (the fixture pattern) as a model.
   - Generate a storage state via Playwright, save it, and pass it to Lighthouse.

For now, defer this work until the login-page MVP is stable and budgets have been tuned to reflect realistic client conditions. Authenticated routes require a running backend (unlike the public login page), adding complexity to CI; plan that as a follow-up.

## CI Job Configuration

The `lighthouse` job in `.github/workflows/test.yml` runs after the build completes:

```yaml
lighthouse:
  name: Lighthouse CI
  runs-on: ubuntu-latest
  continue-on-error: true
```

It rebuilds the frontend in CI to ensure a clean, production-like build. No changes to existing jobs are needed; Lighthouse runs independently and in parallel with other tests.
