# Testing Strategy

This document outlines the testing approach for AlwaysMap, including when to use Docker vs local development, and how to validate deployment readiness for Google Cloud Run.

## Testing Pyramid

```
         /\
        /E2E\         ← Docker (Cloud Run simulation)
       /______\
      /        \
     /Integration\   ← Docker (multi-container validation)
    /____________\
   /              \
  /   Unit Tests   \  ← Local (fast feedback)
 /__________________\
```

## Test Types and Tools

### 1. Unit Tests (Local with pnpm)

**Purpose**: Fast feedback on pure functions and business logic

**Tools**: Vitest

**Run with**:
```bash
pnpm test           # Run all unit tests
pnpm test:watch     # Watch mode for TDD
```

**What to test**:
- Pure functions in `src/lib/map-renderer/`
- Utility functions (dimensions, validation, rotation)
- Type checking with `svelte-check`

**Why local**:
- ✅ Instant feedback (< 1 second)
- ✅ No container overhead
- ✅ Easy to debug with VSCode
- ✅ Fast iteration during development

**Coverage**: 61 unit tests across:
- `tests/unit/dimensions.test.ts`
- `tests/unit/fonts.test.ts`
- `tests/unit/qrcode.test.ts`
- `tests/unit/rotation.test.ts`
- `tests/unit/validation.test.ts`

### 2. Integration Tests (Docker Compose)

**Purpose**: Validate multi-container interactions and environment variable injection

**Tools**: Vitest running against Docker containers

**Run with**:
```bash
# Start containers
docker compose up -d

# Run integration tests (connects to containers)
pnpm test:integration

# View logs
docker compose logs -f

# Teardown
docker compose down
```

**What to test**:
- API endpoints work across containers
- Worker picks up jobs from pg-boss queue
- Database migrations applied correctly
- Environment variables correctly injected
- Export workflow end-to-end (API → Queue → Worker → Storage)

**Why Docker**:
- ✅ Validates container isolation
- ✅ Tests environment variable injection (critical for Cloud Run)
- ✅ Validates network communication between services
- ✅ Simulates production architecture

**Coverage**: Integration tests in `tests/integration/`:
- `mvp-workflow.test.ts` - Full export pipeline
- `job-api.test.ts` - API job creation/status
- `print-jobs-repository.test.ts` - Database operations
- `queue-initialization.test.ts` - pg-boss setup
- `idempotency.test.ts` - Retry behavior

### 3. E2E Tests (Docker Compose)

**Purpose**: Validate complete user workflows in production-like environment

**Tools**: Playwright running against Docker containers

**Run with**:
```bash
# Start containers
docker compose up -d

# Run E2E tests
pnpm test:e2e

# Run E2E with UI
pnpm test:e2e:ui

# Teardown
docker compose down
```

**What to test**:
- User can create a map via web UI
- User can trigger export and download PNG
- Map renders correctly at different sizes
- Interactive rotation works
- Mobile responsive behavior

**Why Docker**:
- ✅ Tests complete stack like Cloud Run
- ✅ Validates production build configuration
- ✅ Tests real Puppeteer rendering (not mocked)
- ✅ Validates file system permissions

**Coverage**: 26 E2E tests in `tests/e2e/`:
- `navigation.test.ts` - Page routing
- `rotation.test.ts` - Interactive globe
- `responsive.test.ts` - Mobile/desktop
- `export.test.ts` - PNG generation

## Google Cloud Run Preparation

Since we're deploying to Google Cloud Run, our Docker setup must validate:

### ✅ Environment Variable Injection

Cloud Run injects environment variables at runtime. Our docker-compose.yml mirrors this:

```yaml
services:
  app:
    environment:
      DATABASE_HOST: postgres
      DATABASE_USER: postgres
      GOOGLE_APPLICATION_CREDENTIALS: /app/gcp-credentials.json
      PRINTFUL_API_KEY: ${PRINTFUL_API_KEY}  # Injected from .env

  worker:
    environment:
      DATABASE_HOST: postgres
      RENDER_BASE_URL: http://app:5173
      API_URL: http://app:5173
```

**Test this**:
```bash
# Verify all env vars are accessible
docker compose exec app sh -c 'echo $DATABASE_HOST'
docker compose exec worker sh -c 'echo $API_URL'
```

### ✅ Container Isolation

Each Cloud Run service runs in isolation. Test this:

```bash
# App should only access database
docker compose exec app ping postgres  # Should work
docker compose exec app ping worker    # Should fail (isolated)

# Worker should access both app and database
docker compose exec worker ping app      # Should work
docker compose exec worker ping postgres # Should work
```

### ✅ Stateless Containers

Cloud Run containers must be stateless. Validate:
- No data stored in container filesystem (use volumes)
- No shared memory between containers
- Worker can restart without losing jobs (pg-boss persistence)

### ✅ Health Checks

Cloud Run uses health checks to determine container readiness:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 10s
  timeout: 5s
  retries: 5
```

Test with:
```bash
docker compose ps  # Check "healthy" status
docker inspect awm-postgres | grep -A 5 Health
```

## Development Workflow

### During Active Development

Use local pnpm commands for fast iteration:

```bash
# Terminal 1: Run dev server
pnpm dev

# Terminal 2: Run unit tests in watch mode
pnpm test:watch

# Terminal 3: Run worker (if needed)
pnpm worker
```

**Why**: Sub-second hot reload, instant test feedback

### Before Committing

Run integration tests with Docker:

```bash
# Start containers
docker compose up -d

# Run all tests
pnpm test              # Unit tests (local)
pnpm test:integration  # Integration (against containers)
pnpm test:e2e          # E2E (against containers)

# Teardown
docker compose down
```

**Why**: Validates deployment configuration

### Pre-Production Validation

Test with production-like environment variables:

```bash
# Create .env.production
cat > .env.production << EOF
DATABASE_HOST=postgres
DATABASE_NAME=alwaysmap
DATABASE_USER=postgres
DATABASE_PASSWORD=production-secret
PRINTFUL_API_KEY=sk_live_xxx
GCS_BUCKET=production-bucket
EOF

# Run with production env
docker compose --env-file .env.production up -d

# Validate all integrations
pnpm test:integration
pnpm test:e2e

# Teardown
docker compose down
```

## Test Commands Reference

```bash
# Unit Tests (Local, Fast)
pnpm test           # Run all unit tests
pnpm test:watch     # Watch mode for TDD
pnpm run check      # TypeScript + Svelte type checking

# Integration Tests (Docker, Validates Deployment)
docker compose up -d              # Start containers
pnpm test:integration             # Run integration tests
docker compose logs -f worker     # View worker logs
docker compose down               # Teardown

# E2E Tests (Docker, Full Stack)
docker compose up -d              # Start containers
pnpm test:e2e                     # Run E2E tests
pnpm test:e2e:ui                  # Run with Playwright UI
docker compose down               # Teardown

# Database (Local or Docker)
pnpm db:setup       # Create schema and run migrations
pnpm db:teardown    # Drop all tables
pnpm db:reset       # Teardown + Setup

# Export (Local)
pnpm export --sample output.png   # CLI export tool
```

## CI/CD Pipeline

For CI/CD (GitHub Actions, etc.), run all tests with Docker:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Unit tests (fast)
      - run: pnpm install
      - run: pnpm test

      # Integration + E2E (slow but thorough)
      - run: docker compose up -d
      - run: pnpm test:integration
      - run: pnpm test:e2e
      - run: docker compose down
```

## Cloud Run Deployment Checklist

Before deploying to Cloud Run:

- [ ] All unit tests passing (`pnpm test`)
- [ ] All integration tests passing with Docker (`pnpm test:integration`)
- [ ] All E2E tests passing with Docker (`pnpm test:e2e`)
- [ ] Environment variables validated in docker-compose.yml
- [ ] Health checks configured and working
- [ ] Container isolation validated
- [ ] No data stored in container filesystem
- [ ] Secrets managed via Cloud Secret Manager (not hardcoded)
- [ ] Database connection pooling configured
- [ ] Worker can scale horizontally (stateless)

## Troubleshooting

### Tests Fail in Docker but Pass Locally

**Cause**: Environment variable differences or network isolation

**Fix**:
```bash
# Check environment variables
docker compose exec app env | grep DATABASE
docker compose exec worker env | grep API_URL

# Check network connectivity
docker compose exec worker ping app
docker compose exec worker curl http://app:5173
```

### Worker Can't Connect to Database

**Cause**: Incorrect DATABASE_HOST or network isolation

**Fix**:
```bash
# Verify postgres is healthy
docker compose ps postgres

# Check worker environment
docker compose exec worker env | grep DATABASE

# Test connection from worker
docker compose exec worker sh -c 'apk add postgresql-client && psql $DATABASE_URL'
```

### Playwright Tests Timeout

**Cause**: App container not ready or port not exposed

**Fix**:
```bash
# Verify app is running
docker compose logs app

# Verify port is accessible
curl http://localhost:5173

# Increase Playwright timeout in playwright.config.ts
timeout: 60000  // 60 seconds
```

## 12-Factor App Compliance

This testing strategy enforces [12-Factor App](https://12factor.net/) principles:

### I. Codebase
✅ **Single codebase tracked in git, many deploys**
- Docker containers built from same codebase
- Environment-specific config via env vars (not code)

### II. Dependencies
✅ **Explicitly declare and isolate dependencies**
- `package.json` + `pnpm-lock.yaml` lock all versions
- Docker containers include all dependencies
- No reliance on system packages (except Puppeteer deps)

### III. Config
✅ **Store config in environment variables**
```yaml
# docker-compose.yml validates this
environment:
  DATABASE_HOST: postgres          # ← Cloud Run will inject real values
  PRINTFUL_API_KEY: ${PRINTFUL_API_KEY}
  GOOGLE_APPLICATION_CREDENTIALS: /app/gcp-credentials.json
```

**Test this**:
```bash
# Verify env vars work across environments
docker compose --env-file .env.production up -d
docker compose exec app sh -c 'echo $DATABASE_HOST'
```

### IV. Backing Services
✅ **Treat backing services as attached resources**
- Database connection via `DATABASE_URL` (can swap instances)
- GCS via `GCS_BUCKET` (can switch buckets)
- No hardcoded service endpoints

**Test this**: Swap database without code changes
```bash
# Point to different database
export DATABASE_HOST=postgres-staging
docker compose up -d
```

### V. Build, Release, Run
✅ **Strictly separate build and run stages**
- Build: `docker build` creates immutable image
- Release: Environment variables injected at runtime
- Run: `docker compose up` runs release

**Test this**:
```bash
# Build once
docker build -f Dockerfile.worker -t worker:v1 .

# Run with different configs
docker run -e DATABASE_HOST=prod worker:v1
docker run -e DATABASE_HOST=staging worker:v1
```

### VI. Processes
✅ **Execute app as stateless processes**
- Worker stores nothing in memory between jobs
- All state in PostgreSQL (pg-boss)
- Exports written to volume/GCS, not container

**Test this**: Restart worker mid-job
```bash
docker compose restart worker
# Job should resume from queue, not lose state
```

### VII. Port Binding
✅ **Export services via port binding**
- App binds to `PORT` environment variable
- Worker doesn't need port (background process)

### VIII. Concurrency
✅ **Scale out via process model**
- Multiple worker containers can run concurrently
- Each polls pg-boss independently
- No shared state between workers

**Test this**:
```bash
docker compose up --scale worker=3
# All 3 workers process jobs from same queue
```

### IX. Disposability
✅ **Maximize robustness with fast startup/shutdown**
- Containers start in < 10 seconds
- Graceful shutdown on SIGTERM
- Jobs can resume after worker crash (pg-boss)

### X. Dev/Prod Parity
✅ **Keep dev, staging, prod as similar as possible**
- Same Docker images in all environments
- Same backing services (Postgres, GCS)
- Only environment variables differ

**This is why we use Docker for integration/E2E tests!**

### XI. Logs
✅ **Treat logs as event streams**
- All logs to stdout/stderr
- Docker captures and streams logs
- No log files written to disk

**Test this**:
```bash
docker compose logs -f worker  # Streams to stdout
```

### XII. Admin Processes
✅ **Run admin tasks as one-off processes**
- Database migrations: `pnpm db:setup`
- Manual exports: `pnpm export`
- Same codebase, same environment

## Summary

| Test Type | Tool | Environment | Purpose | Speed |
|-----------|------|-------------|---------|-------|
| Unit | Vitest | Local | Fast feedback | < 1s |
| Integration | Vitest | Docker | Validate containers | ~10s |
| E2E | Playwright | Docker | Full workflows | ~30s |

**Golden Rule**: Use local for development speed, use Docker to validate deployment configuration and 12-Factor compliance.
