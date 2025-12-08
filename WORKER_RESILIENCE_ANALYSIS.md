# Worker Resilience & Observability Analysis

**Date**: 2025-12-07
**Context**: Investigation triggered by `landscape-export.test.ts` timeout failure
**Root Cause**: Worker retry loop on deleted jobs blocks processing of new jobs

---

## Executive Summary

The worker has a **critical race condition** where jobs deleted from the database (but still in pg-boss queue) cause infinite retry loops, blocking all subsequent job processing. This is exacerbated by poor observability - we cannot easily detect stuck jobs in production.

### Impact
- **Production Risk**: HIGH - Worker can become completely blocked
- **Detection Time**: UNKNOWN - No monitoring/alerting in place
- **Recovery**: Requires manual worker restart

---

## Problems Identified

### 1. **Race Condition: Deleted Jobs Cause Retry Loops**

#### The Flow
```
1. Job created → Stored in DB + Queued in pg-boss
2. Test cleanup deletes DB record
3. pg-boss queue still has the job
4. Worker picks up job → Calls API to start
5. API returns 404 (job deleted)
6. Worker throws error (line 237: pg-boss-worker.ts)
7. pg-boss retries with backoff (60s, 120s, 240s)
8. Steps 4-7 repeat 3 times per job
9. Worker is blocked for ~7 minutes per deleted job
10. New jobs sit in pending_export indefinitely
```

#### Evidence from Logs
```
📋 Processing export job 24446301-3406-45eb-b0d4-4f4d906b603b...
❌ Export failed: API error: Print job 24446301... not found
[pg-boss retries same job]
📋 Processing export job 24446301-3406-45eb-b0d4-4f4d906b603b...  # SAME JOB!
❌ Export failed: API error: Print job 24446301... not found
[repeats indefinitely]
```

#### Code Issue (`src/lib/queue/pg-boss-worker.ts:223-238`)
```typescript
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Export failed: ${errorMessage}`);

    try {
        await callFailAPI(printJobId, errorMessage);  // This ALSO fails with 404!
    } catch (apiError) {
        console.error(`⚠️  Failed to update API with error status:`, apiError);
    }

    // ❌ PROBLEM: Re-throws error for ALL failures, even non-retryable ones
    throw error;  // pg-boss will retry this job
}
```

**Problem**: The worker doesn't distinguish between:
- **Retryable errors**: Network issues, temporary API downtime, resource constraints
- **Non-retryable errors**: Job not found (404), invalid data, validation failures

### 2. **Poor Error Categorization**

All errors are treated as retryable. This wastes resources and blocks the queue.

**Should NOT retry**:
- 404 Not Found - Job was deleted
- 400 Bad Request - Invalid job data
- 422 Unprocessable Entity - Validation failed

**Should retry**:
- 500 Internal Server Error
- 502/503/504 Gateway/Service errors
- Network timeouts
- Database connection issues

### 3. **Zero Observability**

#### What We Don't Know
- How many jobs are in each state (pending/active/completed/failed)?
- Which jobs are stuck retrying?
- Average job processing time?
- Worker health status?
- Queue depth trends?

#### What We Can't Do
- Detect blocked workers automatically
- Alert on unusual retry patterns
- Monitor job age in queue
- Track SLA violations
- Debug production issues without SSH access

### 4. **pg-boss Configuration Issues**

Current config (`src/lib/queue/pg-boss-queue.ts:84-89`):
```typescript
await boss.send('export-map', jobData, {
    retryLimit: 3,          // Will retry 3 times
    retryDelay: 60,         // 60 seconds initial delay
    retryBackoff: true,     // Exponential: 60s, 120s, 240s
    expireInSeconds: 3600   // Job expires after 1 hour
});
```

**Problems**:
- Retry limit too high for non-retryable errors (should be 0 for 404s)
- No way to distinguish error types in retry logic
- 1-hour expiry may be too long for blocked queues
- No dead letter queue for permanently failed jobs

---

## Recommendations

### Immediate Fixes (P0 - Critical)

#### 1. **Classify Errors as Retryable vs Fatal**

**File**: `src/lib/queue/pg-boss-worker.ts`

**Change error handling to**:
```typescript
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Export failed: ${errorMessage}`);

    // Classify error
    const isFatalError =
        errorMessage.includes('not found') ||           // 404
        errorMessage.includes('Bad Request') ||         // 400
        errorMessage.includes('Validation failed') ||   // 422
        errorMessage.includes('Invalid page size');     // Data validation

    // Try to update API (may fail for deleted jobs)
    try {
        await callFailAPI(printJobId, errorMessage);
    } catch (apiError) {
        if (isFatalError) {
            console.warn(`⚠️  Job ${printJobId} not in database (likely deleted), marking complete in queue`);
            return; // Don't throw - let pg-boss mark job as complete
        }
        console.error(`⚠️  Failed to update API with error status:`, apiError);
    }

    // Only retry for transient errors
    if (!isFatalError) {
        throw error; // pg-boss will retry
    }

    // Fatal errors: log and complete without retry
    console.error(`💀 Fatal error - not retrying job ${printJobId}`);
}
```

**Impact**: Prevents retry loops on deleted/invalid jobs

#### 2. **Add Structured Logging with Job Context**

Add at start of `processExportJob`:
```typescript
const jobContext = {
    printJobId,
    printableMapId,
    attemptNumber: job.attemptsMade || 0,
    maxAttempts: job.retryLimit || 3,
    queuedAt: job.createdOn,
    startedAt: new Date().toISOString()
};

console.log(`📋 [JOB_START] ${JSON.stringify(jobContext)}`);
```

Add at end (success/failure):
```typescript
console.log(`✅ [JOB_SUCCESS] ${JSON.stringify({
    ...jobContext,
    durationMs,
    filePath,
    fileSizeMB
})}`);

// Or for failures:
console.error(`❌ [JOB_FAILED] ${JSON.stringify({
    ...jobContext,
    error: errorMessage,
    isFatal: isFatalError,
    willRetry: !isFatalError
})}`);
```

**Impact**: Enables log aggregation and monitoring

### Short-Term Improvements (P1 - High)

#### 3. **Add Metrics Endpoint**

**File**: `src/routes/api/metrics/+server.ts` (NEW)

```typescript
import { json } from '@sveltejs/kit';
import { query } from '$lib/db/client.js';
import { getPgBoss } from '$lib/queue/pg-boss-queue.js';

export async function GET() {
    // Query job states from database
    const jobStats = await query(`
        SELECT
            state,
            COUNT(*) as count,
            MIN(created_at) as oldest_job,
            MAX(created_at) as newest_job,
            AVG(EXTRACT(EPOCH FROM (
                CASE
                    WHEN export_completed_at IS NOT NULL
                    THEN export_completed_at - export_started_at
                END
            ))) as avg_duration_seconds
        FROM print_jobs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY state
    `);

    // Get pg-boss queue stats
    const boss = await getPgBoss();
    const queueStats = await boss.getQueueSize('export-map');

    return json({
        timestamp: new Date().toISOString(),
        database: {
            jobs_by_state: jobStats.rows,
            total_24h: jobStats.rows.reduce((sum, row) => sum + parseInt(row.count), 0)
        },
        queue: {
            pending: queueStats,
            worker_active: true // Could ping worker health endpoint
        }
    });
}
```

**Access**: `curl http://localhost:5173/api/metrics`

**Impact**: Real-time visibility into system state

#### 4. **Add Health Check Endpoint for Worker**

**File**: `src/routes/api/health/worker/+server.ts` (NEW)

```typescript
import { json } from '@sveltejs/kit';

let lastHeartbeat: Date | null = null;
let workerStats = {
    jobsProcessed: 0,
    lastJobAt: null as Date | null,
    errors: 0,
    uptime: process.uptime()
};

// Worker calls this periodically
export async function POST({ request }) {
    const data = await request.json();
    lastHeartbeat = new Date();
    workerStats = { ...workerStats, ...data };
    return json({ status: 'ok' });
}

// Monitoring calls this to check health
export async function GET() {
    const isHealthy = lastHeartbeat &&
        (Date.now() - lastHeartbeat.getTime()) < 60000; // 1 min threshold

    return json({
        healthy: isHealthy,
        lastHeartbeat,
        stats: workerStats
    }, { status: isHealthy ? 200 : 503 });
}
```

Modify worker to report heartbeat every 30s:
```typescript
setInterval(async () => {
    await fetch(`${API_URL}/api/health/worker`, {
        method: 'POST',
        body: JSON.stringify({
            jobsProcessed: processedCount,
            lastJobAt: lastJobTimestamp,
            errors: errorCount,
            uptime: process.uptime()
        })
    });
}, 30000);
```

**Impact**: Detect worker crashes/hangs within 1 minute

### Medium-Term Enhancements (P2 - Medium)

#### 5. **Implement Dead Letter Queue**

For jobs that fail all retries:
```typescript
await boss.send('export-map-dlq', {
    originalJob: jobData,
    failureReason: errorMessage,
    attempts: job.attemptsMade,
    failedAt: new Date().toISOString()
});
```

Create monitoring dashboard for DLQ jobs.

#### 6. **Add Job Timeout Protection**

```typescript
await boss.work('export-map', {
    teamSize: 1,        // Process 1 job at a time
    teamConcurrency: 1, // 1 concurrent job per worker
    teamRefill: true,
    expireInSeconds: 300 // 5 minute timeout per job
}, async (jobs) => {
    for (const job of jobs) {
        await processExportJob(job);
    }
});
```

#### 7. **Add Prometheus Metrics** (if using monitoring stack)

```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

const jobsProcessed = new Counter({
    name: 'export_jobs_processed_total',
    help: 'Total number of export jobs processed',
    labelNames: ['status'] // 'success', 'failed', 'retried'
});

const jobDuration = new Histogram({
    name: 'export_job_duration_seconds',
    help: 'Export job processing duration',
    buckets: [5, 10, 30, 60, 120, 300] // seconds
});

const queueDepth = new Gauge({
    name: 'export_queue_depth',
    help: 'Number of jobs in queue'
});
```

---

## Testing Improvements

### Fix Integration Test Race Condition

**File**: `tests/integration/landscape-export.test.ts`

**Problem**: Test creates jobs but doesn't ensure worker is running

**Solution**: Add worker lifecycle management to test

```typescript
import { createPgBossWorker } from '$lib/queue/pg-boss-worker.js';

describe('Landscape Export Integration', () => {
    let worker: PgBoss;

    beforeAll(async () => {
        // Start worker for this test suite
        worker = await createPgBossWorker();
    });

    afterAll(async () => {
        // Stop worker cleanly
        if (worker) {
            await worker.stop();
        }
    });

    // ... rest of tests
});
```

**Alternative**: Use test-specific queue name to isolate tests

---

## Production Deployment Checklist

- [ ] Implement fatal error classification
- [ ] Add structured logging (JSON format)
- [ ] Create /api/metrics endpoint
- [ ] Create /api/health/worker endpoint
- [ ] Set up log aggregation (e.g., CloudWatch, Datadog)
- [ ] Configure alerting on:
  - [ ] Worker heartbeat failure (>2 minutes)
  - [ ] Job age in pending_export (>5 minutes)
  - [ ] High retry rate (>20% of jobs)
  - [ ] Queue depth growth (>10 jobs)
- [ ] Test worker restart procedures
- [ ] Document runbook for stuck queues
- [ ] Set up weekly review of DLQ jobs

---

## Monitoring Queries (for Operations)

### Check for Stuck Jobs
```sql
SELECT id, state, created_at,
       AGE(NOW(), created_at) as age,
       export_retry_count
FROM print_jobs
WHERE state = 'pending_export'
  AND created_at < NOW() - INTERVAL '5 minutes'
ORDER BY created_at ASC;
```

### Check Recent Failures
```sql
SELECT id, export_error, export_retry_count,
       created_at, export_started_at
FROM print_jobs
WHERE state = 'export_failed'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### Queue Health Dashboard
```sql
SELECT
    state,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest,
    AVG(export_retry_count) as avg_retries
FROM print_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY state;
```

---

## Summary of Changes

| Priority | Item | Impact | Effort | Status |
|----------|------|--------|--------|--------|
| P0 | Fatal error classification | Prevents queue blocking | 2 hours | Not started |
| P0 | Structured logging | Enables monitoring | 1 hour | Not started |
| P1 | Metrics endpoint | Visibility | 3 hours | Not started |
| P1 | Worker health check | Auto-detection | 2 hours | Not started |
| P2 | Dead letter queue | Failure analysis | 4 hours | Not started |
| P2 | Prometheus metrics | Production monitoring | 6 hours | Not started |

**Estimated Total Effort**: 18 hours (~2-3 days)
**Expected Benefit**: 90% reduction in worker downtime incidents
