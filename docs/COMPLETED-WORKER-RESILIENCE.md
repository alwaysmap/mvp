# Worker Resilience Implementation - Completed

**Date**: 2025-12-08
**Status**: ✅ Complete

## Overview

Implemented comprehensive error handling and resilience for the export worker to prevent retry loops on fatal errors and provide production-grade observability.

## Problem Statement

The worker had a critical race condition where jobs deleted from the database (but still in pg-boss queue) caused infinite retry loops:

```
1. Job created → Stored in DB + Queued in pg-boss
2. Test cleanup deletes DB record
3. pg-boss queue still has the job
4. Worker picks up job → Calls API to start
5. API returns 404 (job deleted)
6. Worker throws error
7. pg-boss retries with exponential backoff (60s, 120s, 240s)
8. Steps 4-7 repeat indefinitely
9. Worker blocked for ~7 minutes per deleted job
10. New jobs sit in pending_export state
```

## Solution Implemented

### 1. Error Classification Module

**File**: `src/lib/queue/error-handling.ts` (121 lines)

Created utilities to classify errors as fatal (non-retryable) vs retryable:

**Fatal Errors** (don't retry):
- 404 Not Found
- 400 Bad Request
- 422 Unprocessable Entity
- Validation errors
- Invalid page size/dimensions

**Retryable Errors** (retry with backoff):
- 500 Internal Server Error
- 503 Service Unavailable
- Network errors (ECONNREFUSED, ETIMEDOUT)
- Database connection errors
- Puppeteer timeouts

**Key Functions**:
```typescript
export function isFatalError(error: Error | string): boolean
export function shouldRetryJob(error: Error | string, attemptNumber: number, maxAttempts: number): boolean
export function createSuccessLog(context: JobContext, result: JobResult): JobSuccessLog
export function createFailureLog(context: JobContext, error: Error | string, durationMs: number): JobFailureLog
```

### 2. Worker Integration

**File**: `src/lib/queue/pg-boss-worker.ts` (Modified)

Integrated error classification into the worker:

**Job Context Tracking**:
```typescript
const jobContext: JobContext = {
    printJobId,
    printableMapId,
    attemptNumber: job.attemptsMade || 0,
    maxAttempts: job.retryLimit || 3,
    queuedAt: job.createdOn,
    startedAt: new Date().toISOString()
};
```

**Fail-Fast Error Handling**:
```typescript
} catch (error) {
    const failureLog = createFailureLog(jobContext, error, durationMs);
    console.error(`[JOB_FAILED] ${JSON.stringify(failureLog)}`);

    try {
        await callFailAPI(printJobId, errorMessage);
    } catch (apiError) {
        if (failureLog.isFatal) {
            console.warn(`⚠️  Job ${printJobId} not in database (likely deleted), completing without retry`);
            return; // Don't throw - let pg-boss mark as complete
        }
        console.error(`⚠️  Failed to update API:`, apiError);
    }

    // Only retry for transient errors
    if (!failureLog.isFatal) {
        throw error; // pg-boss will retry
    }

    console.error(`💀 Fatal error - job ${printJobId} will not retry`);
}
```

### 3. Structured Logging

Added JSON-formatted logs with full job context for monitoring/alerting:

**Job Start**:
```json
[JOB_START] {
  "printJobId": "abc123...",
  "printableMapId": "def456...",
  "attemptNumber": 0,
  "maxAttempts": 3,
  "queuedAt": "2025-12-08T05:30:00.560Z",
  "startedAt": "2025-12-08T05:30:00.561Z"
}
```

**Job Success**:
```json
[JOB_SUCCESS] {
  "printJobId": "abc123...",
  "status": "success",
  "durationMs": 5785,
  "filePath": "exports/2025-12-08T05-30-06_abc123.png",
  "fileSizeMB": "0.33",
  "attemptNumber": 0
}
```

**Job Failure**:
```json
[JOB_FAILED] {
  "printJobId": "abc123...",
  "status": "failed",
  "error": "API error: Print job abc123 not found",
  "isFatal": true,
  "willRetry": false,
  "durationMs": 4
}
```

### 4. Comprehensive Test Coverage

**File**: `tests/unit/worker-error-handling.test.ts` (248 lines, 27 tests)

Test coverage:
- ✅ Fatal error classification (9 tests)
- ✅ Retryable error classification (7 tests)
- ✅ Retry decision logic (4 tests)
- ✅ Edge cases (3 tests)
- ✅ Structured logging (4 tests)

**All 27 tests passing** ✅

## Results

### Before Implementation

```
❌ Export failed: API error: Print job xxx not found
⚠️  Failed to update API with error status
[pg-boss retries: 60s, 120s, 240s]
[Worker blocked for ~7 minutes per deleted job]
[Integration tests timeout after 30 seconds]
```

### After Implementation

```json
[JOB_FAILED] {"printJobId":"f716d5e6...","isFatal":true,"willRetry":false,"durationMs":4}
❌ Export failed: API error: Print job f716d5e6... not found
⚠️  Job f716d5e6... not in database (likely deleted), completing without retry
[Worker immediately moves to next job - no retry loop!]
```

## Files Modified

1. **New Files**:
   - `src/lib/queue/error-handling.ts` - Error classification utilities
   - `tests/unit/worker-error-handling.test.ts` - Comprehensive test suite
   - `docs/COMPLETED-WORKER-RESILIENCE.md` - This document

2. **Modified Files**:
   - `src/lib/queue/pg-boss-worker.ts` - Integrated error handling
   - `docs/NEXT-STEPS.md` - Updated to reflect completion status

## Benefits

1. **Prevents Retry Loops**: Fatal errors (404, validation) don't retry
2. **Fail-Fast Behavior**: Invalid state detected immediately, no runaway processes
3. **Production Observability**: JSON logs with full context (job ID, attempt #, error classification, duration)
4. **Test Coverage**: 27 passing unit tests prove error classification works correctly
5. **Clear Error Messages**: Structured logs make debugging easy

## Monitoring Recommendations

The worker now outputs structured JSON logs. To leverage them in production:

1. **Log Aggregation**: Ship logs to CloudWatch/Datadog/Splunk
2. **Alerting**: Alert on:
   - High fatal error rate (>10% of jobs)
   - Jobs stuck in pending_export (>5 minutes)
   - Worker not processing jobs (no `[JOB_START]` logs for >2 minutes)
3. **Dashboards**: Visualize:
   - Job success rate over time
   - Average job duration (p50, p95, p99)
   - Fatal vs retryable error breakdown
   - Queue depth trends

## Optional Enhancements

While the core resilience is complete, these enhancements would improve production operations:

1. **Worker Health Endpoint**: GET /api/health/worker with periodic heartbeats
2. **Metrics Dashboard**: GET /api/metrics showing job counts, queue depth, duration stats
3. **Real-Time Job Polling**: UI component that polls job status every 2-3 seconds
4. **PNG Download Endpoint**: Serve exported files via GET /api/download/[filename]

See `WORKER_RESILIENCE_ANALYSIS.md` for detailed recommendations on these enhancements.

## Conclusion

The worker is now production-ready with:
- ✅ Fatal error detection and fail-fast behavior
- ✅ Structured logging for observability
- ✅ Comprehensive test coverage
- ✅ Clear documentation and monitoring guidance

The race condition that caused retry loops is solved, and the worker provides excellent visibility for production monitoring.
