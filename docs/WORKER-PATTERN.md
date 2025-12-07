# Worker Architecture Pattern

## Design Principle

**Workers are stateless** - They call APIs, not databases directly.

This allows horizontal scaling: 2+ worker nodes processing jobs in parallel without conflicts.

## Architecture

```
┌─────────────┐
│  SvelteKit  │  ← Single source of truth
│     App     │  ← Manages database state
│   (API)     │  ← Coordinates workers
└──────┬──────┘
       │
       ├─── pg-boss queue (in Postgres)
       │
    ┌──┴───────────────┐
    │                  │
┌───▼────┐      ┌─────▼──┐
│Worker 1│      │Worker 2│  ← Stateless
│        │      │        │  ← Call APIs only
│Puppeteer│     │Puppeteer│ ← Horizontally scalable
└────────┘      └────────┘
```

## Worker → API Flow

### Export Job Example

```typescript
// Worker DOES NOT touch database directly
boss.work('export', async (job) => {
  const { printJobId } = job.data;

  // 1. Tell API we're starting (API updates DB)
  await fetch(`${API_URL}/api/jobs/${printJobId}/start`, {
    method: 'POST'
  });

  try {
    // 2. Do the actual work (Puppeteer)
    const filePath = await exportMapToPNG(...);

    // 3. Tell API we succeeded (API updates DB)
    await fetch(`${API_URL}/api/jobs/${printJobId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ filePath })
    });
  } catch (error) {
    // 4. Tell API we failed (API updates DB)
    await fetch(`${API_URL}/api/jobs/${printJobId}/fail`, {
      method: 'POST',
      body: JSON.stringify({ error: error.message })
    });
    throw error; // pg-boss handles retry
  }
});
```

## API Endpoints (State Management)

### POST /api/jobs/{id}/start
```typescript
export const POST: RequestHandler = async ({ params }) => {
  const { id } = params;

  // Update state in database
  await updatePrintJob(id, {
    state: 'exporting',
    export_started_at: new Date()
  });

  return json({ success: true });
};
```

### POST /api/jobs/{id}/complete
```typescript
export const POST: RequestHandler = async ({ params, request }) => {
  const { id } = params;
  const { filePath } = await request.json();

  // Update state in database
  await updatePrintJob(id, {
    state: 'export_complete',
    export_file_path: filePath,
    export_completed_at: new Date()
  });

  return json({ success: true });
};
```

### POST /api/jobs/{id}/fail
```typescript
export const POST: RequestHandler = async ({ params, request }) => {
  const { id } = params;
  const { error } = await request.json();

  // Update state in database
  await updatePrintJob(id, {
    state: 'export_failed',
    export_error: error,
    export_retry_count: /* increment */
  });

  return json({ success: true });
};
```

## Benefits

### ✅ Horizontal Scaling
- Run 2+ worker containers
- No database connection pooling issues
- No row-level locking conflicts
- Workers don't need DB credentials

### ✅ Clean Separation
- API = Single source of truth for state
- Workers = Compute only (Puppeteer, image processing)
- Database = Only accessed by API

### ✅ Resilience
- Worker crashes don't corrupt DB state
- API can validate state transitions
- Workers can restart without DB migrations

### ✅ Testing
- Test workers with mock API
- Test API without workers
- Clear integration points

## Implementation Strategy

### MVP (Simple)
- Workers call localhost API (`http://app:5173/api`)
- Single worker container for now
- Easy to scale later

### Production (Scaled)
- Workers call internal API endpoint
- Multiple worker containers
- Load balancer in front of API
- Shared Postgres for pg-boss queue

## pg-boss Coordination

pg-boss handles job distribution automatically:

```typescript
// API adds job to queue
await boss.send('export', { printJobId: '...' });

// Worker 1 picks it up (SKIP LOCKED prevents duplicates)
boss.work('export', handler);

// Worker 2 waiting for next job
boss.work('export', handler);
```

**pg-boss guarantees:**
- Only one worker processes each job
- Failed jobs auto-retry
- Dead letter queue for permanent failures

## Configuration

### Worker Environment
```bash
API_URL=http://app:5173  # Internal API endpoint
DATABASE_URL=postgresql://...  # Only for pg-boss queue
```

### Docker Compose
```yaml
worker:
  replicas: 2  # Multiple workers
  environment:
    API_URL: http://app:5173
    DATABASE_URL: postgresql://postgres:postgres@postgres/alwaysmap
```

## Migration Path

### Current (Direct DB Access)
```typescript
// Worker touches DB directly - NOT SCALABLE
const printJob = await getPrintJob(id);
await updatePrintJob(id, { state: 'exporting' });
```

### MVP (API-based)
```typescript
// Worker calls API - SCALABLE
await fetch(`${API_URL}/api/jobs/${id}/start`);
```

### Future (If needed)
- gRPC instead of HTTP (faster)
- Message queue for state updates (Kafka, NATS)
- Worker pools with dedicated coordinators

## Smart Choices for MVP

### ✅ Do Now
- Workers call HTTP API for state updates
- Single worker container (can scale later)
- pg-boss for job queue (already in Postgres)

### ⏳ Defer
- gRPC (HTTP is fine for MVP)
- Complex retry strategies (pg-boss handles it)
- Worker pools (one container works)

### ❌ Avoid
- Direct DB access from workers (locks you in)
- Custom queue implementation (use pg-boss)
- Distributed transactions (unnecessary complexity)

## Decision: Use API Pattern from Day 1

**Why:**
- Same effort as direct DB access
- Enables scaling from day 1
- Better testing
- Doesn't lock us in

**Implementation:**
1. Create API routes for state transitions
2. Workers call these routes
3. API handles all database access
4. Workers only do Puppeteer work

This is the **right pattern** for horizontal scaling, even if we only run 1 worker in MVP.
