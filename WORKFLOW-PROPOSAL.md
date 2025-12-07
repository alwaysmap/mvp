# Workflow Architecture Proposal

## Problem

Current design conflates **configuration** with **workflow**:
- `printable_maps` stores WHAT to print (size, orientation, projection)
- No tracking of export/order STATUS
- No way to prevent duplicate orders to Printful
- No way for CLI to know what needs exporting vs printing

## Proposed Separation of Concerns

### 1. `printable_maps` - Configuration Only
**Purpose:** Defines WHAT to print (immutable once created)

**Fields:**
- `id` - UUID
- `user_map_id` - FK to user_maps
- `data` - JSONB (pageSize, orientation, projection, etc.)
- `created_at` - Timestamp

**Semantics:**
- Created once
- Never modified (configuration is frozen)
- Can have multiple print jobs over time (e.g., reorders)

### 2. `print_jobs` - Workflow Tracking (NEW)
**Purpose:** Tracks the lifecycle of printing this configuration

**Fields:**
- `id` - UUID (job ID)
- `printable_map_id` - FK to printable_maps (UNIQUE for MVP, can remove later for reprints)
- `state` - Current workflow state
- `export_file_path` - Path to PNG (set when export completes)
- `export_started_at`, `export_completed_at`, `export_error` - Export tracking
- `printful_order_id` - Printful order ID (set when order placed)
- `order_started_at`, `order_completed_at`, `order_error` - Order tracking
- `created_at`, `updated_at`

**State Machine:**
```
pending_export   -> Job created, export not started
exporting        -> Export in progress (BullMQ job active)
export_failed    -> Export failed (can retry)
export_complete  -> PNG ready, file exists
ordering         -> Sending to Printful
order_failed     -> Printful API error (can retry)
ordered          -> Order placed (HAS printful_order_id) - EXACTLY ONCE
fulfilled        -> Printful confirmed delivery
```

### 3. `print_job_events` - Audit Log (NEW)
**Purpose:** Immutable log of all state transitions

**Fields:**
- `id` - Bigserial
- `print_job_id` - FK to print_jobs
- `from_state` - Previous state
- `to_state` - New state
- `metadata` - JSONB (error details, retry count, etc.)
- `occurred_at` - Timestamp

## CLI Commands (Proposed)

### Export Pipeline
```bash
# Find all jobs needing export and queue them
pnpm export:queue

# Query:
SELECT pj.id, pm.id as printable_map_id
FROM print_jobs pj
JOIN printable_maps pm ON pj.printable_map_id = pm.id
WHERE pj.state = 'pending_export'
ORDER BY pj.created_at;
```

### Print Pipeline
```bash
# Find all jobs ready to order and send to Printful
pnpm print:queue

# Query:
SELECT pj.id, pj.export_file_path, pm.id as printable_map_id
FROM print_jobs pj
JOIN printable_maps pm ON pj.printable_map_id = pm.id
WHERE pj.state = 'export_complete'
  AND pj.export_file_path IS NOT NULL
ORDER BY pj.export_completed_at;
```

### Status Check
```bash
# Check status of specific job
pnpm job:status {print_job_id}

# Query:
SELECT state, export_file_path, printful_order_id
FROM print_jobs
WHERE id = ?;
```

## Exactly-Once Guarantee

### Database Constraints
```sql
-- Can only have one print_job per printable_map (for MVP)
UNIQUE (printable_map_id)

-- If state = 'ordered', must have printful_order_id
CHECK (state != 'ordered' OR printful_order_id IS NOT NULL)

-- If state = 'export_complete', must have file_path
CHECK (state NOT IN ('export_complete', 'ordering', 'ordered', 'fulfilled')
       OR export_file_path IS NOT NULL)

-- printful_order_id is globally unique (cannot reuse)
UNIQUE (printful_order_id)
```

### Workflow Logic
```sql
-- When ordering (in transaction):
BEGIN;
  -- Lock row
  SELECT * FROM print_jobs WHERE id = ? FOR UPDATE;

  -- Verify state (must be export_complete)
  IF state != 'export_complete' THEN
    RAISE EXCEPTION 'Job not ready for ordering';
  END IF;

  -- Transition to ordering
  UPDATE print_jobs SET state = 'ordering', order_started_at = NOW()
  WHERE id = ?;

  -- Call Printful API
  -- If success:
  UPDATE print_jobs
  SET state = 'ordered',
      printful_order_id = ?,
      order_completed_at = NOW()
  WHERE id = ?;

  -- If failure:
  UPDATE print_jobs
  SET state = 'order_failed',
      order_error = ?,
      order_retry_count = order_retry_count + 1
  WHERE id = ?;
COMMIT;
```

## At-Least-Once for Exports

```sql
-- Exports can be retried
SELECT id FROM print_jobs
WHERE state = 'export_failed'
  AND export_retry_count < 3;  -- Max retries

-- Transition back to pending_export
UPDATE print_jobs
SET state = 'pending_export',
    export_retry_count = export_retry_count + 1
WHERE id = ?;
```

## API Flow (Updated)

### Current: POST /api/export
```typescript
// Creates printable_map + print_job in one transaction
const printableMap = await createPrintableMap(userMapId, data);
const printJob = await createPrintJob(printableMap.id);
// printJob.state = 'pending_export' automatically

return { printableMapId, printJobId };
```

### Worker picks up job
```typescript
// Update state
await updatePrintJobState(printJobId, 'exporting');

// Export PNG
const filePath = await exportMapToPNG(...);

// On success
await updatePrintJob(printJobId, {
  state: 'export_complete',
  export_file_path: filePath,
  export_completed_at: new Date()
});

// On failure
await updatePrintJob(printJobId, {
  state: 'export_failed',
  export_error: error.message
});
```

## Migration Strategy

### Option A: Add new tables, keep existing
- Add `print_jobs` and `print_job_events` tables
- Existing `printable_maps` unchanged
- Create `print_job` for each `printable_map` retroactively

### Option B: Fresh start (MVP only)
- Drop existing `printable_maps` records
- Add new tables
- CLI creates both `printable_map` and `print_job` together

## Decisions (Approved)

1. **Reprints**: ✅ YES - Remove UNIQUE constraint on `print_job.printable_map_id`
   - Same config can be printed multiple times
   - Each reprint creates new `print_job`

2. **State names**: ✅ APPROVED - `pending_export`, `exporting`, `export_complete`, `ordering`, `ordered`, `fulfilled`

3. **Retry limits**: ✅ CLI logic with exponential backoff
   - CLI handles retry strategy
   - DB tracks retry count for observability
   - Hard fail after reasonable attempts

4. **Payment**: ✅ DEFERRED - Not in MVP scope
   - Focus: Does web → DB → printable PNG work?
   - Payment integration later

5. **Postgres vs Redis**: ✅ POSTGRES ONLY
   - Use Postgres FOR UPDATE locking
   - No Redis distributed locks (unnecessary complexity)
   - Redis only for BullMQ job queue

## Implementation Approach

**Postgres-based saga:**
- Simple (already have Postgres)
- FOR UPDATE provides row-level locking
- ACID transactions for state changes
- Audit log in same database
- Redis only for BullMQ job queue

**Next Steps if Approved:**
1. Write migration `002_add_print_jobs.sql`
2. Write tests for state transitions (FIRST!)
3. Update repositories to use `print_jobs`
4. Update worker to track state
5. Create CLI commands (`pnpm export:queue`, `pnpm print:queue`)
6. Update API to create `print_job` alongside `printable_map`
