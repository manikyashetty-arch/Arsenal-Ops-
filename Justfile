# Arsenal-Ops root developer entrypoint.
# See: https://just.systems/

default:
    just --list

# Install all dev dependencies (backend + frontend)
install:
    cd backend && pip install -r requirements.txt
    cd app && npm install

# Run all unit tests (backend + frontend)
test:
    cd backend && python -m pytest tests/ -v
    cd app && npm run test

# Run backend unit tests only
test-backend:
    cd backend && python -m pytest tests/ -v

# Run frontend unit tests only
test-frontend:
    cd app && npm run test

# Run frontend tests in watch mode
test-watch:
    cd app && npm run test:watch

# Lint everything (Python + Frontend)
lint:
    cd backend && ruff check . && ruff format --check .
    cd app && npm run lint && npm run format:check

# Format all code (Python + Frontend)
fmt:
    cd backend && ruff format . && ruff check . --fix
    cd app && npm run format

# TypeScript typecheck
typecheck:
    cd app && npx tsc --noEmit

# Regenerate frontend API types from running backend
gen-api-types:
    cd app && npm run generate:api-types

# E2E tests (not yet implemented)
e2e:
    @echo "E2E not yet set up. See .plans/testing-infrastructure-20260521.md"
