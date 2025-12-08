# Worker Docker Setup

This document explains how to run the AWM export worker in Docker on a separate machine, proving complete decoupling from the API server.

## Overview

The AWM worker is designed to run independently from the main application. It only requires:

1. **Network access** to the API server (for job polling and status updates)
2. **Network access** to PostgreSQL database (for pg-boss queue)
3. **Network access** to render server (for Puppeteer to fetch pages)
4. **Storage** for exported PNG files (can be shared filesystem, NFS, or S3)

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   API Server    │         │   Worker (Docker)│
│  (localhost)    │◄────────│   Separate Host  │
│                 │         │                  │
│ - SvelteKit     │         │ - pg-boss client │
│ - /api/export   │         │ - Puppeteer      │
│ - /render       │         │ - PNG export     │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         │      ┌────────────────────┘
         │      │
         ▼      ▼
    ┌─────────────┐         ┌──────────────┐
    │  PostgreSQL │         │   Exports    │
    │  Database   │         │  (Volume)    │
    └─────────────┘         └──────────────┘
```

## Quick Start (Local Testing)

### Prerequisites

- Docker and Docker Compose installed
- AWM API server running on host (`pnpm dev`)
- PostgreSQL running on host (`pnpm db:setup`)

### Run Worker in Docker

```bash
# Build and start the worker container
docker-compose -f docker-compose.worker.yml up --build

# Worker will:
# 1. Connect to PostgreSQL at host.docker.internal:5432
# 2. Poll for export jobs from pg-boss queue
# 3. Call API at host.docker.internal:5173 for status updates
# 4. Render pages via Puppeteer from host.docker.internal:5173/render
# 5. Save PNGs to ./exports (mounted volume)
```

### Verify Worker is Running

```bash
# Check worker logs
docker logs awm-worker --follow

# You should see:
# ✅ pg-boss queue started
# 🔄 Polling for export jobs...
```

### Test Export Job

```bash
# Create a test map and trigger export via API
curl -X POST http://localhost:5173/api/maps \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Docker Worker Test",
    "subtitle": "2025",
    "people": [...],
    "projection": "orthographic"
  }'

# Trigger export (replace {mapId} with response from above)
curl -X POST http://localhost:5173/api/export \
  -H "Content-Type: application/json" \
  -d '{
    "userMapId": "{mapId}",
    "widthInches": 18,
    "heightInches": 24,
    "paperSizeName": "18×24"
  }'

# Worker should pick up the job and process it
# Check ./exports directory for generated PNG
```

## Production Deployment

### Separate Machine Setup

For running the worker on a completely separate machine:

1. **Update docker-compose.worker.yml**:

```yaml
services:
  worker:
    environment:
      # Use actual API server hostname
      - API_URL=https://api.alwaysmap.com
      - RENDER_BASE_URL=https://app.alwaysmap.com

      # Use production database
      - DATABASE_URL=postgresql://user:pass@db.prod.example.com:5432/alwaysmap

      # Use shared storage
      - EXPORT_DIR=/mnt/nfs/exports

    volumes:
      # Mount NFS or other shared storage
      - /mnt/nfs/exports:/app/exports
```

2. **Deploy worker container**:

```bash
# Copy files to worker machine
scp -r Dockerfile.worker docker-compose.worker.yml package.json pnpm-lock.yaml src/ worker-machine:/opt/awm-worker/

# SSH to worker machine
ssh worker-machine

# Start worker
cd /opt/awm-worker
docker-compose -f docker-compose.worker.yml up -d
```

3. **Monitor worker health**:

```bash
# Check worker status
docker ps | grep awm-worker

# View logs
docker logs awm-worker --tail 100 --follow

# Check resource usage
docker stats awm-worker
```

### Resource Limits

Add resource limits to prevent worker from consuming too much:

```yaml
services:
  worker:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

### Shared Storage Options

#### Option 1: NFS Mount

```yaml
volumes:
  - type: bind
    source: /mnt/nfs/exports
    target: /app/exports
```

#### Option 2: S3 (requires code changes)

Modify worker to upload PNGs to S3 instead of local filesystem:

```typescript
// In pg-boss-worker.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-west-2' });

// After PNG generation
const fileBuffer = fs.readFileSync(pngPath);
await s3.send(new PutObjectCommand({
  Bucket: 'awm-exports',
  Key: `${printJobId}.png`,
  Body: fileBuffer,
  ContentType: 'image/png'
}));
```

#### Option 3: Docker Volume

```yaml
volumes:
  awm-exports:
    driver: local

services:
  worker:
    volumes:
      - awm-exports:/app/exports
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string for pg-boss |
| `API_URL` | Yes | `http://localhost:5173` | Base URL for API server |
| `RENDER_BASE_URL` | Yes | `http://localhost:5173` | Base URL for render server (Puppeteer) |
| `EXPORT_DIR` | No | `/app/exports` | Directory for exported PNGs |
| `NODE_ENV` | No | `production` | Node environment |

## Security Considerations

### Network Security

- **Firewall**: Worker only needs outbound connections to API and database
- **API Authentication**: Consider adding API keys if worker is on untrusted network
- **Database**: Use SSL/TLS for database connections in production

### Secrets Management

Don't hardcode secrets in `docker-compose.yml`. Use:

- **Docker secrets** (swarm mode)
- **Environment file** (`.env` file, not committed to git)
- **Secret management service** (Vault, AWS Secrets Manager)

Example with `.env` file:

```bash
# Create .env file (do not commit)
cat > .env << EOF
DATABASE_URL=postgresql://user:pass@db.example.com:5432/alwaysmap
API_URL=https://api.alwaysmap.com
RENDER_BASE_URL=https://app.alwaysmap.com
EOF

# Reference in docker-compose
services:
  worker:
    env_file:
      - .env
```

## Troubleshooting

### Worker Can't Connect to Database

```bash
# Test database connection from worker container
docker exec -it awm-worker sh
apk add postgresql-client
psql $DATABASE_URL

# If connection fails, check:
# 1. Database is accessible from worker machine
# 2. Firewall allows port 5432
# 3. PostgreSQL pg_hba.conf allows remote connections
```

### Worker Can't Reach API

```bash
# Test API connectivity
docker exec -it awm-worker sh
wget -O- http://host.docker.internal:5173/api/health

# If fails, check:
# 1. API server is running
# 2. API server binds to 0.0.0.0 (not just localhost)
# 3. host.docker.internal resolves correctly
```

### Puppeteer Fails to Launch

```bash
# Check Puppeteer dependencies
docker exec -it awm-worker sh
pnpm exec puppeteer browsers install chrome

# If still fails:
# 1. Check Chrome dependencies are installed (see Dockerfile)
# 2. Try running with --no-sandbox flag (less secure)
# 3. Check /dev/shm has enough space (at least 64MB)
```

### Export Files Not Appearing

```bash
# Check volume mount
docker inspect awm-worker | grep -A 10 Mounts

# Check permissions
docker exec -it awm-worker sh
ls -la /app/exports
touch /app/exports/test.txt

# If permission denied:
# 1. Fix host directory permissions
# 2. Run worker with correct user ID
```

## Performance Tuning

### Concurrent Workers

Run multiple worker containers for parallel processing:

```bash
# Scale workers
docker-compose -f docker-compose.worker.yml up --scale worker=3
```

### Memory Limits

Puppeteer/Chrome can consume significant memory. Monitor and adjust:

```yaml
services:
  worker:
    deploy:
      resources:
        limits:
          memory: 4G  # Increase for large maps
```

### pg-boss Configuration

Adjust job concurrency in worker code:

```typescript
// In pg-boss-worker.ts
await boss.work('export-map', { teamSize: 2, teamConcurrency: 1 }, handler);
// teamSize: number of concurrent jobs per worker
// teamConcurrency: number of concurrent jobs per team
```

## Monitoring

### Health Checks

Built-in Docker healthcheck:

```bash
docker inspect awm-worker | grep -A 5 Health
```

### Logging

Stream logs to external service:

```yaml
services:
  worker:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Metrics

Add Prometheus metrics endpoint to worker for monitoring:

```typescript
// Future enhancement
import prometheus from 'prom-client';

const jobsProcessed = new prometheus.Counter({
  name: 'awm_jobs_processed_total',
  help: 'Total number of export jobs processed'
});
```

## Related Documentation

- See `WORKER-PATTERN.md` for architecture details
- See `Dockerfile.worker` for build configuration
- See `docker-compose.worker.yml` for deployment configuration
