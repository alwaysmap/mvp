# AlwaysMap Planning Summary

## What We Accomplished

### 1. Extended IMPLEMENTATION-PLAN.md with Phase 2

**Added:** Comprehensive Phase 2 (Days 6-10) - Data Architecture & Two-Route Workflow

**Key components:**
- PostgreSQL database schema (user_maps, printable_maps)
- Repository layer with TypeScript interfaces
- Two routes: `/edit` (map data) and `/publish` (print config)
- API endpoints for CRUD operations
- Complete E2E testing strategy
- Docker Compose configuration with Postgres

**Architectural decisions:**
- 1:M relationship: 1 UserMap → Many PrintableMaps
- JSONB for all fields (maximum iteration flexibility)
- No user authentication (MVP scope)
- Separation of map content from print configuration

### 2. Created MVP-SCOPE.md

**Purpose:** Define focused MVP scope that proves the export pipeline works

**MVP Goal:** End-to-end validation of map → print-ready PNG workflow

**What's IN:**
- Simple config UI (dropdowns for size/projection/orientation)
- Hardcoded sample data (Alice + Bob)
- Full export pipeline (Puppeteer + sharp + validation)
- Docker infrastructure (app + worker + postgres + redis)
- BullMQ job queue
- Comprehensive testing matrix

**What's OUT:**
- Full editing UI
- User authentication
- Multiple maps management
- Printful integration
- Payment processing

**Why this scope:**
- Validates critical technical risks (font fidelity, pixel-perfect output)
- Proves export pipeline end-to-end
- Enables real Printful test orders
- Foundation for full product

**Timeline:** 10 days across 7 phases

### 3. Created Database Migration

**File:** `migrations/001_initial_schema.sql`

**Schema:**
```sql
-- user_maps: Core map data (everything in JSONB)
CREATE TABLE user_maps (
  id UUID PRIMARY KEY,
  data JSONB,  -- title, subtitle, people, projection, style, etc.
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- printable_maps: Print configs (1:M relationship)
CREATE TABLE printable_maps (
  id UUID PRIMARY KEY,
  user_map_id UUID REFERENCES user_maps(id),  -- FK (only explicit relationship)
  data JSONB,  -- pageSize, orientation, style, showBoundary, etc.
  created_at TIMESTAMPTZ
);
```

**Sample data:** Includes Alice + Bob with 3 locations each (ready for testing)

**Indexes:**
- GIN index on `user_maps.data` for JSONB queries
- B-tree index on `printable_maps.user_map_id` for 1:M lookups

---

## Key Design Decisions

### 1. Maximum JSONB Usage
**Decision:** Store all map/print data in JSONB, only model 1:M relationship explicitly

**Rationale:**
- Rapid iteration without migrations
- Queryable with Postgres JSONB operators
- TypeScript types provide compile-time safety
- Can normalize later if needed

**Trade-offs:**
- Slightly slower queries (mitigated by GIN index)
- Can't use foreign keys to nested data
- **Acceptable for MVP**: Flexibility > query performance at this stage

### 2. Two-Table Architecture
**Decision:** `user_maps` (core map) + `printable_maps` (print configs)

**Rationale:**
- One map can have multiple print configs (18x24 portrait, A3 landscape, etc.)
- Enables "view online only" without print (future feature)
- Clean separation of concerns

**Implementation:**
- Foreign key: `printable_maps.user_map_id` → `user_maps.id`
- Cascade delete: deleting map deletes all print configs

### 3. No User Authentication in MVP
**Decision:** Skip users/auth entirely for MVP

**Rationale:**
- Doesn't validate export pipeline (core risk)
- Can test with hardcoded data
- Can add later without schema changes (user_id in JSONB if needed)

### 4. Docker-First Development
**Decision:** Build with Docker from day 1

**Rationale:**
- Font consistency critical (browser ≠ Docker ≠ production)
- Puppeteer requires controlled environment
- Mirrors production deployment
- Reproducible builds

---

## File Structure Created

```
awm-prototype/
├── IMPLEMENTATION-PLAN.md      # Full plan (all phases)
├── MVP-SCOPE.md                # Focused MVP scope
├── PLANNING-SUMMARY.md         # This file
└── migrations/
    └── 001_initial_schema.sql  # Database schema + sample data
```

---

## What Hasn't Changed

### Still Using (from CLAUDE.md):
- TypeScript
- SvelteKit 5 with runes
- PNPM
- D3.js for visualization
- Playwright for E2E testing
- Vitest for unit tests
- Docker + Docker Compose
- Google Cloud Platform (future deployment)

### Still Following:
- Boring technology choices
- Test-driven development
- No manual testing (Playwright proves it)
- Rigorous validation

---

## Next Steps

### Immediate (Start MVP):
1. **Review MVP-SCOPE.md** - Confirm this scope makes sense
2. **Set up Docker Compose** - postgres + redis + app + worker
3. **Phase 1: Core Rendering** - D3 map with hardcoded data
4. **Phase 2: Puppeteer Export** - PNG generation pipeline
5. **Iterate through MVP phases** - 10 days to working export

### After MVP Success:
1. Return to IMPLEMENTATION-PLAN.md Phase 2 for full editing UI
2. Add user authentication
3. Integrate Printful API
4. Build payment processing
5. Deploy to GCP

---

## Questions to Answer Before Starting

### Critical:
1. **Do we have access to Printful test account?** (For validating exports)
2. **What's the priority order for page sizes?** (Test matrix is large)
3. **Do we need landscape orientation in MVP?** (Doubles test matrix)
4. **GCP or local deployment for MVP?** (Affects Docker config)

### Nice to Have:
1. Should MVP include job progress polling? (Adds complexity)
2. Download directly or upload to GCS first? (Storage decision)
3. Keep exports in DB or just return to user? (Data retention)

---

## Risk Assessment

### Low Risk (Mitigated):
- ✅ Font fidelity - Docker + local TTF files
- ✅ Color accuracy - sharp + sRGB profile
- ✅ Dimension accuracy - Automated validation
- ✅ Queue reliability - BullMQ + Redis (proven stack)

### Medium Risk (Managed):
- ⚠️ Puppeteer performance - 60s timeout, may need tuning
- ⚠️ JSONB query performance - GIN index helps, can optimize later
- ⚠️ Docker image size - Chromium is large, accepted trade-off

### High Risk (Requires Validation):
- ⚠️ **Visual fidelity between browser and export** - Visual regression tests critical
- ⚠️ **Printful acceptance of outputs** - Need real test orders

**Mitigation:** MVP focuses exactly on these high-risk areas

---

## Success Metrics

### MVP Complete When:
1. ✅ User can select config (size/projection/orientation)
2. ✅ Click export triggers async job
3. ✅ PNG downloads meeting all specs
4. ✅ Visual regression < 0.01% difference
5. ✅ All test matrix configs pass
6. ✅ Docker Compose works reliably
7. ✅ E2E test validates full flow
8. ✅ **Printful accepts test order** (manual validation)

### Long-term Success When:
- Users can create custom maps via editing UI
- Payment processing works
- Printful orders auto-fulfill
- Maps display online (no print)
- Multiple users/maps supported

But **all of that** depends on MVP succeeding first.

---

## Key Takeaways

1. **Focus is everything:** MVP proves export pipeline, nothing else
2. **JSONB for flexibility:** Don't commit to schema prematurely
3. **Docker from day 1:** Font consistency is non-negotiable
4. **Test obsessively:** Visual regression, validation, E2E
5. **Iterate quickly:** 10 days to technical proof, then pivot based on learnings

**The question we're answering:** *Can we generate print-ready maps that meet Printful's requirements?*

Everything else is secondary until we answer that question with a resounding **yes**.
