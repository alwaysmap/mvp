# AlwaysMap MVP Architecture

## Overview

Simple, Postgres-only architecture for proving web → database → printable PNG workflow.

## Stack

### Database
- **PostgreSQL 16** - Single source of truth
  - User maps (configuration)
  - Printable maps (what to print)
  - Print jobs (workflow state)
  - Job queue (pg-boss tables)
  - Audit logs

### Job Queue
- **pg-boss** - Postgres-native job queue
  - Replaces BullMQ + Redis
  - Everything in one database
  - Exactly-once delivery via `SKIP LOCKED`
  - Built-in retries and dead letter queue

### Backend
- **SvelteKit 5** - API routes (server-side only)
- **TypeScript** - Type safety
- **Puppeteer** - PNG generation at 300 DPI
- **sharp** - Image post-processing (sRGB embedding)

### Frontend
- **SvelteKit 5** with Svelte runes
- **D3.js** - Map visualization
- Minimal UI for MVP (simple dropdowns)

## Data Model

### Tables

```
user_maps           - WHAT: Map content (people, locations)
  └─ printable_maps - WHAT: Print configuration (size, orientation)
       └─ print_jobs - HOW: Workflow state (export → order)
            └─ print_job_events - AUDIT: State transition log
```

### Separation of Concerns

**user_maps** - Immutable content
- Title, subtitle, people, locations
- Created once, rarely modified

**printable_maps** - Immutable configuration
- Page size, orientation, projection
- Created once per desired output
- Can have multiple print jobs (reprints)

**print_jobs** - Mutable workflow
- Current state in lifecycle
- Export tracking (file path, timestamps, errors)
- Order tracking (Printful ID, timestamps, errors)
- Retry counts

**print_job_events** - Immutable audit log
- Every state transition recorded
- Debugging and compliance

## State Machine

```
pending_export   → Job created
     ↓
exporting        → Worker processing
     ↓               ↓
export_complete  export_failed (retry → pending_export)
     ↓
ordering         → Sending to Printful
     ↓               ↓
ordered          order_failed (retry → ordering)
     ↓
fulfilled        → Terminal state
```

### State Guarantees

**At-least-once for export:**
- Failed exports can retry
- Multiple exports acceptable (file overwrites)
- Worker idempotent

**Exactly-once for ordering:**
- `ordered` state requires `printful_order_id`
- Database constraint prevents duplicates
- Postgres transaction ensures atomicity
- Cannot transition FROM `ordered` except to `fulfilled`

## Job Queue (pg-boss)

### Queue Names
- `export` - Export PNG jobs
- `order` - Printful order jobs (future)

### Job Data
```typescript
{
  printJobId: UUID,      // Reference to print_jobs table
  printableMapId: UUID,  // What to print
  userMapId: UUID        // Map content
}
```

### Worker Pattern
```typescript
boss.work('export', async (job) => {
  const { printJobId } = job.data;

  // 1. Update state to 'exporting'
  await updatePrintJob(printJobId, { state: 'exporting' });

  try {
    // 2. Export PNG
    const filePath = await exportMapToPNG(...);

    // 3. Update state to 'export_complete'
    await updatePrintJob(printJobId, {
      state: 'export_complete',
      export_file_path: filePath,
      export_completed_at: new Date()
    });
  } catch (error) {
    // 4. Update state to 'export_failed'
    await updatePrintJob(printJobId, {
      state: 'export_failed',
      export_error: error.message
    });
    throw error; // pg-boss handles retry
  }
});
```

## CLI Commands

### export:queue
```bash
pnpm export:queue
```
Finds all `print_jobs` with state = `pending_export` and adds them to pg-boss queue.

### print:queue (future)
```bash
pnpm print:queue
```
Finds all `print_jobs` with state = `export_complete` and sends to Printful.

### job:status
```bash
pnpm job:status <print-job-id>
```
Shows current state and history.

## API Routes

### POST /api/maps
Create user map
```json
{
  "title": "Our Journey",
  "subtitle": "2020-2025",
  "people": [...]
}
```

### POST /api/export
Create printable map + print job
```json
{
  "userMapId": "uuid",
  "pageSize": "18x24",
  "orientation": "portrait"
}
```

Returns:
```json
{
  "printableMapId": "uuid",
  "printJobId": "uuid",
  "message": "Export job queued"
}
```

### GET /api/jobs/{jobId}
Check job status
```json
{
  "state": "export_complete",
  "export_file_path": "/app/exports/...",
  "created_at": "...",
  "export_completed_at": "..."
}
```

## Deployment

### Docker Compose (Development)
```yaml
services:
  postgres:  # Database + pg-boss queue
  app:       # SvelteKit + API
  worker:    # pg-boss worker + Puppeteer
```

### Environment Variables
```bash
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=alwaysmap
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres  # Use .env for real passwords
```

No Redis configuration needed!

## Testing Strategy

### Unit Tests
- Repository methods (CRUD)
- State transition validation
- Database constraints

### Integration Tests
- Full job lifecycle (pending → exporting → complete)
- Retry scenarios
- Exactly-once guarantees

### E2E Tests
- Web → DB → PNG workflow
- CLI commands
- State machine transitions

## Migration from BullMQ

### Before (BullMQ + Redis)
```typescript
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

const queue = new Queue('export', { connection: redis });
const worker = new Worker('export', handler, { connection: redis });
```

### After (pg-boss)
```typescript
import PgBoss from 'pg-boss';

const boss = new PgBoss(DATABASE_URL);
await boss.start();
await boss.send('export', jobData);
await boss.work('export', handler);
```

### Changes Required
1. Remove Redis from docker-compose.yml
2. Remove `ioredis` and `bullmq` dependencies
3. Add `pg-boss` dependency
4. Update worker to use pg-boss API
5. Remove `REDIS_HOST` environment variables

## Benefits of This Architecture

### Simplicity
- One database (Postgres)
- One queue library (pg-boss)
- No Redis to manage
- Fewer moving parts

### Reliability
- ACID transactions for state changes
- Exactly-once delivery built-in
- Audit log of all changes
- Row-level locking prevents races

### Developer Experience
- All data in one database (easy to inspect)
- Standard SQL queries for debugging
- TypeScript end-to-end
- Familiar patterns (similar to BullMQ API)

### Operational
- Simpler deployment (one database)
- One connection pool to manage
- Standard Postgres backups cover everything
- No Redis failover to worry about
