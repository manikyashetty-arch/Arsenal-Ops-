# Branch Protection: Required Status Checks

To enforce test and typecheck workflows on the `main` branch, manually add these status checks in GitHub UI.

## Steps

1. Go to **Repo → Settings → Branches**
2. Click **Edit** on the `main` branch rule (or create one if missing)
3. Under "Require status checks to pass before merging", search for and select:
   - `typecheck-backend`
   - `typecheck-frontend`
   - `unit-backend`
   - `unit-frontend`
4. Ensure **"Require branches to be up to date before merging"** is enabled
5. Save

## Notes

- The **Lint** workflow is not in the required list and remains advisory only
- All four test jobs must pass before merge
- Codecov integration will be added in a later phase
