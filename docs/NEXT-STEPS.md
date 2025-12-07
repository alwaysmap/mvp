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
- Docker Compose setup with postgres service

✅ **Phase 3: Export Pipeline** - COMPLETE
- Puppeteer-based PNG export at 300 DPI
- sRGB color profile embedding
- PNG validation (dimensions, format, color space)
- Async job processing with pg-boss worker
- API endpoints for job state transitions
- Render route for headless export

✅ **Testing Infrastructure** - COMPLETE
- 260 passing integration tests
- 42 passing E2E tests (10 skipped for future features)
- Test coverage for repositories, queue, export pipeline
- Playwright E2E testing framework

## Current Gap: User-Facing Workflow

**What's missing:** Users can create and preview maps, but cannot save them or trigger the export workflow.

The Map Editor (`/create-map`) currently:
- ✅ Shows interactive map preview
- ✅ Provides controls for projection, rotation, zoom, pan
- ✅ Allows page size selection
- ❌ Cannot save the map configuration to database
- ❌ Cannot trigger export to PNG
- ❌ No workflow for purchasing prints

## Next Steps: Complete the User Workflow

### Step 1: Save Map Configuration
**Goal:** Allow users to save their map configuration to the database

**Implementation:**
1. Add "Save Map" button to Map Editor control panel
2. Create POST `/api/maps` endpoint
   - Accepts UserMapData from editor
   - Creates user_maps record
   - Returns userMapId
3. Update map editor store to track saved state
4. Show "Saved" indicator when map is persisted

**API Contract:**
```typescript
// POST /api/maps
Request: {
  title: string;
  subtitle?: string;
  people: Array<Person>;
  projection?: string;
  rotation?: [number, number, number];
}

Response: {
  userMapId: string;
  message: "Map saved successfully";
}
```

**Files to modify:**
- `src/routes/api/maps/+server.ts` - Create endpoint
- `src/routes/create-map/+page.svelte` - Add Save button
- `src/lib/stores/map-editor.ts` - Track save state
- `tests/e2e/map-workflow.test.ts` - NEW test file

### Step 2: Define Page Layout & Buy
**Goal:** Allow users to configure print specs and trigger export

**Implementation:**
1. Add "Print Options" panel to Map Editor
   - Page size dropdown (12x16, 18x24, 24x36, A3, A4)
   - Orientation toggle (portrait/landscape)
   - Show safe area boundary toggle
2. Add "Buy" button (or "Generate Print" for MVP)
3. Create POST `/api/export` endpoint
   - Accepts userMapId + page layout config
   - Creates printable_maps record
   - Creates print_jobs record (state: pending_export)
   - Publishes job to pg-boss queue
   - Returns printJobId
4. Show job status polling UI
5. Download PNG when export completes

**API Contract:**
```typescript
// POST /api/export (already exists, needs UI integration)
Request: {
  userMapId: string;
  pageSize: '12x16' | '18x24' | '24x36' | 'A3' | 'A4';
  orientation: 'portrait' | 'landscape';
  projection?: string;
  rotation?: [number, number, number];
}

Response: {
  printableMapId: string;
  printJobId: string;
  message: "Export job queued";
}
```

**Files to modify:**
- `src/routes/create-map/+page.svelte` - Add Print Options panel, Buy button
- `src/lib/stores/map-editor.ts` - Track print config
- `src/lib/components/JobStatus.svelte` - NEW component for polling
- `tests/e2e/export-workflow.test.ts` - Update existing tests

### Step 3: Job Status Polling
**Goal:** Show user the progress of their export job

**Implementation:**
1. Create `JobStatus.svelte` component
   - Polls GET `/api/jobs/{jobId}` every 2 seconds
   - Shows current state (pending_export → exporting → export_complete)
   - Shows error message if export_failed
   - Auto-downloads PNG when complete
2. Integrate into Map Editor
   - Show modal/overlay after clicking Buy
   - Display job progress
   - Handle success/failure states

**API Contract:**
```typescript
// GET /api/jobs/{jobId} (already exists)
Response: {
  id: string;
  state: PrintJobState;
  export_file_path: string | null;
  export_error: string | null;
  export_started_at: Date | null;
  export_completed_at: Date | null;
  created_at: Date;
}
```

**Files to create:**
- `src/lib/components/JobStatus.svelte` - Polling UI component
- `tests/e2e/job-status.test.ts` - Test status polling

### Step 4: Ensure pg-boss Worker Running
**Goal:** Verify export worker processes jobs automatically

**Implementation:**
1. Verify `docker-compose.yml` includes worker service
2. Ensure worker starts on `docker-compose up`
3. Add health check for worker
4. Test job processing end-to-end

**Files to check/modify:**
- `docker-compose.yml` - Worker service definition
- `Dockerfile.worker` - Worker container config
- `src/lib/queue/pg-boss-worker.ts` - Worker entrypoint (already exists)

### Step 5: End-to-End Testing
**Goal:** Prove complete workflow works

**Test scenarios:**
1. Create map → Save → Configure print → Buy → Export completes
2. Multiple page sizes work correctly
3. Different projections export correctly
4. Error handling (invalid data, export failures)
5. Retry logic for failed exports

**Files to create/modify:**
- `tests/e2e/complete-workflow.test.ts` - NEW comprehensive test
- `tests/integration/export-job-processing.test.ts` - NEW worker test

## Implementation Order

### Week 1: Save & Buy Workflow
- [ ] Day 1: POST /api/maps endpoint + Save button
- [ ] Day 2: Print Options panel UI
- [ ] Day 3: Buy button + POST /api/export integration
- [ ] Day 4: JobStatus polling component
- [ ] Day 5: E2E tests for save/buy workflow

### Week 2: Export & Download
- [ ] Day 1: Verify worker runs in docker-compose
- [ ] Day 2: PNG download functionality
- [ ] Day 3: Error handling UI
- [ ] Day 4: Complete workflow testing
- [ ] Day 5: Bug fixes and polish

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

## Success Criteria for Next Steps

### Must Have (Blocking for MVP)
1. ✅ User can save a map configuration
2. ✅ User can select page size and orientation
3. ✅ User can click "Buy" to trigger export
4. ✅ Export job processes in background (pg-boss worker)
5. ✅ User sees job status (pending → processing → complete)
6. ✅ PNG downloads automatically when ready
7. ✅ E2E test proves complete workflow

### Should Have (Nice to Have)
- Error messages if export fails
- Retry button for failed exports
- Preview of print boundary in editor
- Multiple simultaneous exports

### Won't Have (Future)
- Object storage upload
- Printful order placement
- Payment processing
- User accounts
- Multi-map management

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

## Getting Started

```bash
# 1. Review this plan
# 2. Start with Step 1: Save Map Configuration
# 3. Implement each step sequentially
# 4. Test thoroughly at each step
# 5. Don't skip ahead to Step 6 (object storage) until Steps 1-5 work
```

**Critical mindset:** We're completing the MVP user workflow. The backend is done, now we need the frontend to wire it all together.
