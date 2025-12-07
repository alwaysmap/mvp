# AlwaysMap MVP Scope

## Core MVP Goal

**Prove the end-to-end export pipeline works**: From map configuration → 300 DPI print-ready PNG

This MVP focuses on **technical validation** rather than user experience. We need to prove we can generate pixel-perfect, print-ready maps before investing in the full editing interface.

---

## What's IN the MVP

### 1. Simple Configuration UI
- Hardcoded sample data (Alice + Bob with 3 locations each)
- Dropdown to select:
  - **Page size**: 18x24, 12x16, 24x36, A3, A4
  - **Projection**: Orthographic (globe) vs Equirectangular (flat)
  - **Orientation**: Portrait vs Landscape
- Single "Export PNG" button

### 2. Data Persistence (Minimal)
**PostgreSQL with 2 tables:**
- `user_maps` - Core map data (JSONB)
- `printable_maps` - Print configs (JSONB), 1:M with user_maps

**Why persist?**
- Export jobs run asynchronously in worker
- Need to reference map data after API call returns
- Proves data model works for future features

### 3. Export Pipeline
**Full workflow:**
1. User clicks "Export PNG"
2. API creates `printable_map` record
3. Job added to Redis queue (BullMQ)
4. Worker picks up job
5. Worker loads user_map + printable_map from Postgres
6. Worker launches Puppeteer (headless Chrome)
7. Renders map at 300 DPI with exact dimensions
8. sharp embeds sRGB ICC profile
9. Validates output (dimensions, format, color space)
10. Returns PNG to user (or uploads to GCS)

### 4. Docker Infrastructure
**Services:**
- `app` - SvelteKit frontend + API
- `worker` - Puppeteer export worker (separate container)
- `postgres` - Data persistence
- `redis` - Job queue

**Why Docker from day 1?**
- Font consistency (same TTF files in all containers)
- Reproducible environments
- Mirrors production deployment

### 5. Testing Different Configurations
**Critical test matrix:**

| Page Size | Orientation | Projection | Expected Output |
|-----------|-------------|------------|-----------------|
| 18x24 | Portrait | Orthographic | 5475x7275px PNG |
| 18x24 | Landscape | Orthographic | 7275x5475px PNG |
| 18x24 | Portrait | Equirectangular | 5475x7275px PNG |
| A3 | Portrait | Orthographic | Custom dimensions |
| 12x16 | Portrait | Mercator | 3675x4875px PNG |

**Validation for each:**
- ✅ Exact pixel dimensions (300 DPI)
- ✅ sRGB ICC profile embedded
- ✅ PNG format
- ✅ Fonts render correctly
- ✅ Map features visible
- ✅ Title/subtitle in safe area
- ✅ QR code in safe area

### 6. Automated Testing
- **E2E test**: Full workflow from button click → PNG download
- **Visual regression**: Compare browser preview vs export
- **Validation tests**: All exports meet Printful specs
- **Docker tests**: Fonts available in worker container

---

## What's OUT of the MVP

### ❌ Full Editing UI
- No location editor
- No person management UI
- No drag-to-add-locations
- No color pickers
- **Why excluded**: Can manually edit DB for testing; UI doesn't prove export works

### ❌ User Authentication
- No login/signup
- No user accounts
- Single hardcoded dataset
- **Why excluded**: Not needed to prove export pipeline

### ❌ Multiple Maps Management
- No "list my maps" view
- No "create new map" flow
- **Why excluded**: Can create via API/DB for testing

### ❌ Printful Integration
- No actual order submission
- No fulfillment webhook
- **Why excluded**: Manual Printful test orders prove this separately

### ❌ Payment Processing
- No Stripe integration
- No checkout flow
- **Why excluded**: Business logic, not technical validation

### ❌ Advanced Features
- No interactive globe rotation in export
- No custom fonts
- No style customization beyond vintage/modern
- **Why excluded**: Prove basics first

---

## MVP Success Criteria

### Must Have (Blocking)
1. ✅ User can select page size + projection + orientation
2. ✅ Click "Export PNG" triggers job
3. ✅ Job processed by worker in < 60 seconds
4. ✅ PNG downloads automatically
5. ✅ PNG passes all validation checks
6. ✅ Visual regression test shows < 0.01% pixel difference
7. ✅ All test configurations (matrix above) work
8. ✅ Docker Compose brings up full stack
9. ✅ Fonts verified in worker container
10. ✅ E2E test proves full workflow

### Should Have (Nice to Have)
- Job progress indicator (via polling)
- Error messages if job fails
- Download multiple configurations in batch
- Preview before export

### Won't Have (Future)
- Real-time preview updates
- Advanced editing
- User accounts
- Printful integration

---

## File Structure (Simplified for MVP)

```
awm-prototype/
├── docker-compose.yml          # All services defined
├── Dockerfile                  # App container
├── Dockerfile.worker           # Worker container with Puppeteer
├── migrations/
│   └── 001_initial_schema.sql  # Create tables
│
├── src/
│   ├── routes/
│   │   ├── +page.svelte        # MVP UI: dropdowns + export button
│   │   └── api/
│   │       ├── export/+server.ts    # Trigger export job
│   │       └── jobs/[id]/+server.ts # Poll job status
│   │
│   └── lib/
│       ├── db/
│       │   ├── client.ts
│       │   ├── schema.ts
│       │   └── repositories/
│       │       ├── user-maps.ts
│       │       └── printable-maps.ts
│       │
│       ├── queue/
│       │   ├── render-queue.ts     # BullMQ setup
│       │   └── worker.ts           # Export job processor
│       │
│       ├── export/
│       │   ├── puppeteer.ts        # Headless Chrome rendering
│       │   ├── post-process.ts     # sRGB embedding
│       │   └── validate.ts         # Dimension/format checks
│       │
│       └── map-renderer/
│           ├── index.ts            # D3 rendering (browser + Puppeteer)
│           ├── dimensions.ts
│           ├── projections.ts
│           └── styles.ts
│
└── tests/
    ├── e2e/
    │   ├── export-workflow.test.ts      # Full MVP flow
    │   └── export-configurations.test.ts # Test matrix
    └── unit/
        └── export-validation.test.ts
```

---

## Implementation Order

### Phase 1: Core Rendering (No DB, No Queue)
1. D3 map renderer with hardcoded data
2. Dimension calculations (300 DPI)
3. Browser preview works
4. Font loading verified

**Validation**: Map renders in browser with correct fonts

### Phase 2: Puppeteer Export (No DB, No Queue)
1. Puppeteer screenshot at 300 DPI
2. sharp post-processing (sRGB)
3. Validation checks
4. Direct API endpoint (no queue)

**Validation**: PNG exports meet all specs

### Phase 3: Docker Infrastructure
1. Dockerfile for app
2. Dockerfile.worker for Puppeteer
3. docker-compose.yml with postgres + redis
4. Font installation in worker
5. Migration script

**Validation**: `docker-compose up` brings up stack

### Phase 4: Queue System
1. BullMQ queue setup
2. Worker job processor
3. API endpoints (submit job, poll status)
4. Job persistence in Redis

**Validation**: Jobs process asynchronously

### Phase 5: Data Persistence
1. PostgreSQL tables
2. Repositories
3. Save map before export
4. Load map in worker

**Validation**: Export references persisted data

### Phase 6: MVP UI
1. Simple configuration form
2. Export button
3. Job status polling
4. Download PNG

**Validation**: Non-technical user can export

### Phase 7: Testing & Validation
1. E2E test suite
2. Visual regression tests
3. Test all configurations in matrix
4. Docker font tests

**Validation**: All tests pass, all configs work

---

## Timeline (MVP Only)

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Core Rendering | 2 days | Map in browser |
| Phase 2: Puppeteer Export | 2 days | PNG export works |
| Phase 3: Docker Setup | 1 day | Full stack up |
| Phase 4: Queue System | 1 day | Async jobs |
| Phase 5: Data Persistence | 1 day | DB integration |
| Phase 6: MVP UI | 1 day | User-facing flow |
| Phase 7: Testing | 2 days | All tests pass |

**Total: 10 days**

---

## Why This MVP Scope?

### ✅ Validates Critical Technical Risks
- **Font fidelity**: Hardest problem (browser ≠ Docker)
- **Pixel-perfect output**: Printful will reject wrong dimensions
- **Color accuracy**: sRGB profile embedding

### ✅ Proves Export Pipeline End-to-End
- D3 rendering
- Puppeteer headless Chrome
- Image post-processing
- Validation
- Queue system

### ✅ Enables Real Testing
- Can generate actual test prints via Printful
- Multiple configurations prove robustness
- Visual regression catches rendering bugs

### ✅ Keeps Scope Minimal
- No premature UI polish
- No features that don't validate technical risk
- Fast iteration on core problem

### ✅ Foundation for Full Product
- Data model supports future editing
- Queue system supports future workflows
- Docker setup mirrors production

---

## Post-MVP Roadmap

Once MVP proves export works:

1. **Phase 2a**: Full editing UI (from IMPLEMENTATION-PLAN.md)
2. **Phase 2b**: User authentication
3. **Phase 2c**: Multiple maps management
4. **Phase 3**: Printful integration
5. **Phase 4**: Payment processing
6. **Phase 5**: Advanced features (rotation, styles, etc.)

But **none of this happens** until we prove the export pipeline works.

---

## Getting Started

```bash
# 1. Review this MVP scope
# 2. Confirm alignment with business goals
# 3. Begin Phase 1: Core Rendering
# 4. Iterate based on learnings
```

**Critical mindset**: This is a **technical proof of concept**, not a product launch. We're validating that we can generate print-ready maps that meet Printful's requirements. Everything else is secondary.
