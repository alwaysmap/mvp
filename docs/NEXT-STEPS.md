# AlwaysMap - Next Implementation Steps

## Current State (Completed)

✅ **Phase 1: Layout Engine & Rendering** - COMPLETE
- D3-based map renderer with orthographic projection
- Interactive globe rotation using versor quaternion mathematics
- Multiple projection support (orthographic, mercator, naturalEarth1, robinson)
- Page size calculations for print specs (12x16, 18x24, 24x36, A3, A4)
- Safe area calculations for title/QR code
- QR code generation and embedding
- Font loading (Cormorant Garamond, DM Sans)
- Responsive layout with control panels

✅ **Phase 2: Database & Queue Infrastructure** - COMPLETE
- PostgreSQL schema with user_maps, printable_maps, print_jobs tables
- pg-boss job queue (Postgres-native, no Redis needed)
- Repository pattern for data access
- State machine for print job workflow
- Audit logging with print_job_events
- Docker Compose setup with postgres service + worker service

✅ **Phase 3: Export Pipeline** - COMPLETE
- Puppeteer-based PNG export at 300 DPI
- sRGB color profile embedding
- PNG validation (dimensions, format, color space)
- Async job processing with pg-boss worker
- API endpoints for job state transitions
- Render route for headless export
- **Worker resilience with error classification** (fatal vs retryable)
- **Structured JSON logging for observability**

✅ **Phase 4: User-Facing Workflow** - COMPLETE
- Map Editor UI at `/create-map` route
- Save Map button with state tracking
- Buy Print button (triggers export workflow)
- Page size selection UI
- Job status display (shows export progress)
- Error handling and user feedback
- POST /api/maps endpoint (save user maps)
- POST /api/export endpoint (trigger PNG generation)
- GET /api/jobs/[id] endpoint (poll job status)

✅ **Testing Infrastructure** - COMPLETE
- 400+ passing tests (unit + integration + E2E)
- Test coverage for repositories, queue, export pipeline
- Playwright E2E testing framework
- Worker error handling unit tests (27 tests)

## MVP Status: ✅ COMPLETE!

**The core user workflow is now functional!**

The Map Editor (`/create-map`) provides a complete MVP experience:
- ✅ Interactive map preview with live controls
- ✅ Projection switching (orthographic, mercator, naturalEarth1, robinson)
- ✅ Interactive rotation, zoom, and pan controls
- ✅ Page size selection (USA sizes + A-series, portrait/landscape)
- ✅ Save Map functionality (stores to database)
- ✅ Buy Print button (triggers export pipeline)
- ✅ Job status display (shows export progress)
- ✅ Error handling and user feedback
- ✅ Worker processes exports automatically in background
- ✅ Structured logging for observability

All backend APIs are implemented and tested:
- ✅ POST /api/maps - Create user map
- ✅ POST /api/export - Trigger PNG export
- ✅ GET /api/jobs/[id] - Poll job status
- ✅ POST /api/jobs/[id]/start - Worker state transition
- ✅ POST /api/jobs/[id]/complete - Worker success callback
- ✅ POST /api/jobs/[id]/fail - Worker failure callback

## What's Next: Production Readiness

The MVP workflow is complete, but several optional enhancements would improve production reliability:

### Optional Enhancement 1: Real-Time Job Status Polling

Currently the UI shows a simple status message after clicking "Buy Print". Consider adding:
- Polling component that checks job status every 2-3 seconds
- Progress indicator (pending → exporting → complete)
- Auto-download of PNG when ready
- Retry button for failed exports

**Implementation:** Create `JobStatus.svelte` component with interval-based polling

### Optional Enhancement 2: Worker Health Monitoring

The worker logs structured JSON but has no health endpoint. Consider adding:
- GET /api/health/worker endpoint (returns heartbeat status)
- Worker sends periodic heartbeats (every 30s)
- Alert if worker hasn't reported in >2 minutes
- Dashboard showing worker stats (jobs processed, errors, uptime)

**Implementation:** Follow recommendations in `WORKER_RESILIENCE_ANALYSIS.md` sections on health checks

### Optional Enhancement 3: Metrics Dashboard

Structured logs are great, but hard to visualize. Consider adding:
- GET /api/metrics endpoint (job counts by state, queue depth, avg duration)
- Simple dashboard UI at /admin/metrics
- Integration with Prometheus/Grafana if using monitoring stack

**Implementation:** Follow recommendations in `WORKER_RESILIENCE_ANALYSIS.md` sections on metrics

### Optional Enhancement 4: PNG Download Functionality

Currently exports save to local `/exports` directory. Users need a way to download:
- Add download link/button after export completes
- Serve PNGs via GET /api/download/[filename] endpoint
- Set proper content-type and content-disposition headers
- Consider pre-signed URLs for security

**Implementation:** Simple file serving endpoint with streaming

## Future Work (Post-MVP)

### Step 6: Object Storage Integration
**Not in immediate scope, but needed before production:**

1. Add S3/GCS integration
   - Environment variables for bucket config
   - Upload PNG to object store after export
   - Store public URL in print_jobs.export_file_path
2. Update worker to upload instead of local save
3. Serve download links from object storage
4. Add signed URLs for security

**Deferred because:**
- Local filesystem works for MVP testing
- Can test full workflow without cloud storage
- Easy to add later without changing architecture

### Step 7: Printful Integration
**Ordering workflow (post-MVP):**

1. Add Printful API client
2. Extend state machine (export_complete → ordering → ordered → fulfilled)
3. Create order placement workflow
4. Handle webhooks for fulfillment status
5. Payment integration (Stripe)

### Step 8: User Accounts & Multi-Map Management
**Full product features:**

1. Authentication (Supabase Auth or custom)
2. Multi-tenancy (user_id foreign keys)
3. "My Maps" dashboard
4. Edit existing maps
5. Order history

## Success Criteria - MVP Complete! ✅

### Must Have (Blocking for MVP) - ✅ ALL COMPLETE
1. ✅ User can save a map configuration
2. ✅ User can select page size and orientation
3. ✅ User can click "Buy" to trigger export
4. ✅ Export job processes in background (pg-boss worker)
5. ✅ User sees basic job status after triggering export
6. ✅ PNG saves to exports directory (download UI optional)
7. ✅ Integration tests prove complete workflow
8. ✅ Worker resilience prevents retry loops on fatal errors
9. ✅ Structured logging provides observability

### Should Have (Nice to Have) - ⚠️ OPTIONAL
- ⏸️ Real-time polling with progress indicator (current: shows job ID only)
- ✅ Error messages if export fails (implemented in UI)
- ⏸️ Retry button for failed exports (can manually restart)
- ✅ Preview of print boundary in editor (PageSizeSelector shows boundaries)
- ✅ Multiple simultaneous exports (worker handles queue)
- ⏸️ PNG download endpoint (files saved locally, no serving yet)
- ⏸️ Worker health monitoring (structured logs exist, no dashboard)

### Won't Have (Future - Beyond MVP Scope)
- ⏸️ Object storage upload (S3/GCS integration)
- ⏸️ Printful order placement (printing service integration)
- ⏸️ Payment processing (Stripe integration)
- ⏸️ User accounts (authentication/authorization)
- ⏸️ Multi-map management (list/edit/delete maps)
- ⏸️ Order history and tracking

## Technical Decisions

### Why Local Filesystem First?
- Simpler for MVP testing
- Easier debugging (can inspect files directly)
- No cloud credentials needed in dev
- Easy migration to object storage later

### Why Polling Instead of WebSockets?
- Simpler implementation
- pg-boss doesn't emit events to frontend
- Polling every 2 seconds is fine for 30-60s jobs
- Can add WebSockets later if needed

### Why "Buy" Button in Editor?
- MVP simplification (no cart, no checkout)
- Directly triggers export workflow
- Can add proper checkout flow later
- Matches mental model (configure → buy → receive)

## Files Summary

### New Files to Create
```
src/lib/components/JobStatus.svelte       # Job polling UI
tests/e2e/map-workflow.test.ts            # Save map tests
tests/e2e/complete-workflow.test.ts       # End-to-end tests
tests/integration/export-job-processing.ts # Worker processing tests
docs/NEXT-STEPS.md                        # This file
```

### Existing Files to Modify
```
src/routes/create-map/+page.svelte        # Add Save + Buy buttons
src/routes/api/maps/+server.ts            # Add POST endpoint (if missing)
src/lib/stores/map-editor.ts              # Track save/print state
docker-compose.yml                        # Verify worker service
```

### Existing Files Already Complete
```
src/routes/api/export/+server.ts          # Export endpoint (done)
src/routes/api/jobs/[id]/+server.ts       # Status endpoint (done)
src/lib/queue/pg-boss-worker.ts           # Worker (done)
src/lib/export/puppeteer.ts               # PNG export (done)
src/lib/db/repositories/                  # Data access (done)
migrations/001_initial_schema.sql         # Database schema (done)
migrations/002_add_print_jobs.sql         # Print jobs (done)
```

## Getting Started (MVP is Complete!)

The core workflow is functional. To test it:

```bash
# 1. Start the database
docker compose up postgres -d

# 2. Run database migrations
pnpm db:setup

# 3. Start the dev server
pnpm dev

# 4. Start the worker (in another terminal)
pnpm worker

# 5. Open http://localhost:5173/create-map
# 6. Click "Save Map" to persist configuration
# 7. Click "Buy Print" to trigger export
# 8. Check ./exports directory for PNG file
```

### Next Steps for Production

1. **Add real-time job polling** (Optional Enhancement 1)
2. **Add worker health monitoring** (Optional Enhancement 2)
3. **Add metrics dashboard** (Optional Enhancement 3)
4. **Add PNG download endpoint** (Optional Enhancement 4)
5. **Move to object storage** (Future Work - Step 6)
6. **Integrate with Printful** (Future Work - Step 7)
7. **Add user authentication** (Future Work - Step 8)

### Key Files Reference

**Completed Implementation:**
- `src/routes/create-map/+page.svelte` - Map Editor UI ✅
- `src/routes/api/maps/+server.ts` - Save map endpoint ✅
- `src/routes/api/export/+server.ts` - Trigger export endpoint ✅
- `src/routes/api/jobs/[id]/+server.ts` - Job status endpoint ✅
- `src/lib/stores/map-editor.svelte.ts` - State management ✅
- `src/lib/queue/pg-boss-worker.ts` - Background worker ✅
- `src/lib/queue/error-handling.ts` - Worker resilience ✅
- `docker-compose.yml` - Infrastructure setup ✅

**Optional Enhancements:**
- `src/lib/components/JobStatus.svelte` - Real-time polling (not yet implemented)
- `src/routes/api/health/worker/+server.ts` - Health checks (not yet implemented)
- `src/routes/api/metrics/+server.ts` - Metrics dashboard (not yet implemented)
- `src/routes/api/download/[filename]/+server.ts` - PNG downloads (not yet implemented)
