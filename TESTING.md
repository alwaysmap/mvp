# Testing Guide

## Prerequisites

```bash
# Install dependencies
pnpm install

# Start required services
docker-compose up -d postgres redis
```

## Database Tests

**Tests:** Database repositories, JSONB storage, CRUD operations

```bash
# Verify database setup
pnpm db:setup

# Run database integration tests (6 tests)
pnpm test tests/integration/mvp-workflow.test.ts
```

**What's tested:**
- ✅ Database connection
- ✅ Create user map
- ✅ Retrieve user map
- ✅ Create printable map
- ✅ Retrieve printable map with user map
- ✅ JSONB data integrity

## Unit Tests

```bash
# Run all unit tests
pnpm test tests/unit/

# Watch mode
pnpm test:watch
```

## E2E Tests

```bash
# Requires dev server running
pnpm dev

# In another terminal:
pnpm test:e2e
```

## Manual Testing

### Test Export CLI

```bash
# Export sample map (requires dev server)
pnpm export --sample /tmp/test.png

# Verify output
file /tmp/test.png
# Should show: PNG image data, 5475 x 7275, 8-bit colormap
```

### Test Database Operations

```bash
# Start postgres
docker-compose up -d postgres

# Verify connection and schema
pnpm db:setup

# Should output:
# ✅ Database connected
# ✅ Tables exist: printable_maps, user_maps
# ✅ Database setup complete
```

## Test Coverage

| Component | Test Type | Status |
|-----------|-----------|--------|
| Database repositories | Integration | ✅ 6/6 passing |
| Map renderer | Unit | ✅ 32/32 passing |
| Export pipeline | CLI | ✅ Verified |
| Projection switching | E2E | ✅ 6/6 passing |
| Page sizes | Unit | ✅ 5/5 passing |
| API endpoints | Integration | ⏳ TODO |
| Job queue | Integration | ⏳ TODO |
| Full MVP workflow | E2E | ⏳ TODO |

## Troubleshooting

### Database connection failed

```bash
# Check postgres is running
docker-compose ps postgres

# Should show: Up X seconds (healthy)

# If not healthy, check logs
docker-compose logs postgres
```

### Tests fail with "Cannot find module"

```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Port 5432 already in use

```bash
# Stop local postgres
brew services stop postgresql

# Or change port in docker-compose.yml
```
