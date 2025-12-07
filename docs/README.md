# AlwaysMap Documentation

## Overview

AlwaysMap MVP: Proving the web → database → print-ready PNG workflow.

## Key Documents

### [ARCHITECTURE.md](./ARCHITECTURE.md)
Complete system architecture with Postgres-only design using pg-boss.

**Read this to understand:**
- Why we chose pg-boss over BullMQ + Redis
- Data model and separation of concerns
- State machine for print jobs
- API routes and CLI commands

### [WORKFLOW-PROPOSAL.md](./WORKFLOW-PROPOSAL.md)
Detailed proposal for print job workflow and exactly-once guarantees.

**Read this to understand:**
- Problem: How to prevent duplicate orders
- Solution: Separate `printable_maps` (config) from `print_jobs` (workflow)
- State machine transitions
- Database constraints for safety

### [MVP-SCOPE.md](./MVP-SCOPE.md)
What's in and out of scope for the MVP.

**Read this to understand:**
- MVP goal: Validate export pipeline
- What we're building (simple config, export, validation)
- What we're NOT building (full editing UI, auth, payment)
- 7 phases to working MVP

### [PLANNING-SUMMARY.md](./PLANNING-SUMMARY.md)
Historical context from initial planning sessions.

## Architecture Summary

### Stack
- **Database:** PostgreSQL 16 (everything in one DB)
- **Job Queue:** pg-boss (Postgres-native, no Redis)
- **Backend:** SvelteKit 5 + TypeScript
- **Export:** Puppeteer (300 DPI PNG) + sharp (sRGB)
- **Frontend:** SvelteKit 5 with Svelte runes + D3.js

### Data Flow
```
1. User creates map configuration
   └─> POST /api/maps → user_maps table

2. User requests export
   └─> POST /api/export → printable_maps + print_jobs
       └─> pg-boss.send('export', jobData)

3. Worker processes job
   └─> pg-boss.work('export', handler)
       └─> Update print_jobs.state = 'exporting'
       └─> Export PNG via Puppeteer
       └─> Update print_jobs.state = 'export_complete'

4. CLI sends to Printful (future)
   └─> pnpm print:queue
       └─> Find jobs where state = 'export_complete'
       └─> Send to Printful API
       └─> Update print_jobs.state = 'ordered'
```

### Key Principles

**Simplicity:** One database (Postgres), no Redis
**Testability:** All logic in testable functions, TDD approach
**Safety:** Exactly-once ordering via database constraints
**Auditability:** All state transitions logged

## Getting Started

See [../TESTING.md](../TESTING.md) for how to run and test the system.

Quick start:
```bash
# Start database
docker-compose up -d postgres

# Setup schema
pnpm db:setup

# Run tests
pnpm test tests/integration/

# Export a map
pnpm export --sample /tmp/test.png
```

## Current Status

### ✅ Complete
- Database schema and repositories (tested)
- Export pipeline CLI (tested)
- Docker setup for Postgres
- Integration tests for database layer

### 🚧 In Progress
- Migration to pg-boss (from BullMQ)
- Print job state machine
- CLI commands for queue management

### ⏳ TODO
- pg-boss worker implementation
- API endpoints integration
- E2E workflow test
- Printful integration

## Questions?

- Architecture decisions: See ARCHITECTURE.md
- Workflow details: See WORKFLOW-PROPOSAL.md
- Testing: See ../TESTING.md
- MVP scope: See MVP-SCOPE.md
