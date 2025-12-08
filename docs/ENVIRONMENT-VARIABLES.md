# Environment Variable Management

This guide explains how environment variables are injected at runtime without hardcoding secrets in Dockerfiles.

## Key Principle: Dockerfile ENV = Defaults Only

**The ENV lines in Dockerfile are NOT secrets!** They are fallback values for testing/development that get **completely overridden** at runtime.

```dockerfile
# Dockerfile.worker
ENV DATABASE_URL=""                      # ← Gets overridden at runtime
ENV API_URL="http://localhost:5173"      # ← Gets overridden at runtime
ENV RENDER_BASE_URL="http://localhost:5173"
```

Think of these as "if no value is provided, use this" - they're **never** used in production.

## Environment Variable Injection Methods

### 1. Local Development with Docker Compose

**Method A: .env File (Recommended for Secrets)**

Create a `.env` file (never commit to git!):

```bash
# .env (add to .gitignore!)
PRINTFUL_API_KEY=sk_live_abc123xyz
DATABASE_PASSWORD=super-secret-password
GCS_BUCKET=my-production-bucket
```

Then reference in `docker-compose.yml`:

```yaml
services:
  app:
    environment:
      # Injected from .env file at runtime
      PRINTFUL_API_KEY: ${PRINTFUL_API_KEY}
      DATABASE_PASSWORD: ${DATABASE_PASSWORD}
      GCS_BUCKET: ${GCS_BUCKET}
```

**How it works**:
1. Docker Compose reads `.env` file
2. Substitutes `${VARIABLE}` with value from `.env`
3. Injects into container at runtime
4. Dockerfile ENV values are ignored

**Method B: Direct in docker-compose.yml (Non-Secrets)**

For non-sensitive config (hostnames, ports):

```yaml
services:
  app:
    environment:
      DATABASE_HOST: postgres  # ← Not a secret, OK to hardcode
      DATABASE_PORT: 5432
      DATABASE_NAME: alwaysmap
```

**Method C: env_file Directive**

For multiple environment files:

```yaml
services:
  app:
    env_file:
      - .env              # Common vars
      - .env.production   # Environment-specific
```

### 2. Google Cloud Run Deployment

Cloud Run injects environment variables at deployment time using **Cloud Secret Manager**.

#### Step 1: Store Secrets in Secret Manager

```bash
# Store secrets in GCP Secret Manager (one-time setup)
echo -n "sk_live_abc123xyz" | gcloud secrets create printful-api-key \
  --data-file=- \
  --replication-policy=automatic

echo -n "postgresql://user:pass@host:5432/db" | gcloud secrets create database-url \
  --data-file=- \
  --replication-policy=automatic
```

#### Step 2: Deploy with Environment Variables

```bash
gcloud run deploy awm-app \
  --image gcr.io/my-project/awm-app:latest \
  --region us-central1 \
  --set-env-vars="DATABASE_HOST=10.1.2.3,DATABASE_PORT=5432,DATABASE_NAME=alwaysmap" \
  --set-secrets="PRINTFUL_API_KEY=printful-api-key:latest,DATABASE_PASSWORD=db-password:latest"
```

**Or use `service.yaml`**:

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: awm-app
spec:
  template:
    spec:
      containers:
      - image: gcr.io/my-project/awm-app:latest
        env:
          # Non-secret config
          - name: DATABASE_HOST
            value: "10.1.2.3"
          - name: DATABASE_PORT
            value: "5432"
          - name: DATABASE_NAME
            value: "alwaysmap"

          # Secrets from Secret Manager
          - name: PRINTFUL_API_KEY
            valueFrom:
              secretKeyRef:
                name: printful-api-key
                key: latest
          - name: DATABASE_PASSWORD
            valueFrom:
              secretKeyRef:
                name: db-password
                key: latest
```

Deploy with:
```bash
gcloud run services replace service.yaml
```

#### Step 3: Worker Service (Same Pattern)

```bash
gcloud run deploy awm-worker \
  --image gcr.io/my-project/awm-worker:latest \
  --region us-central1 \
  --set-env-vars="API_URL=https://awm-app-xyz.a.run.app,RENDER_BASE_URL=https://awm-app-xyz.a.run.app,EXPORT_DIR=/app/exports" \
  --set-secrets="DATABASE_PASSWORD=db-password:latest"
```

### 3. CI/CD Pipeline (GitHub Actions)

Store secrets in GitHub repository settings, inject during deployment:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Build and push Docker image
        run: |
          docker build -t gcr.io/${{ secrets.GCP_PROJECT_ID }}/awm-app:latest .
          docker push gcr.io/${{ secrets.GCP_PROJECT_ID }}/awm-app:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy awm-app \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/awm-app:latest \
            --region us-central1 \
            --set-env-vars="DATABASE_HOST=${{ secrets.DATABASE_HOST }}" \
            --set-secrets="PRINTFUL_API_KEY=printful-api-key:latest"
```

## Environment Variable Hierarchy

When multiple sources define the same variable, this is the precedence order (highest to lowest):

1. **Cloud Run `--set-env-vars`** (production deployment)
2. **docker-compose.yml `environment:`** (local Docker)
3. **`.env` file** (local development)
4. **Dockerfile ENV** (fallback defaults)

## Security Best Practices

### ✅ DO

- **Store secrets in Secret Manager** (Cloud Run)
- **Use `.env` files locally** (add to `.gitignore`)
- **Use GitHub Secrets** for CI/CD
- **Rotate secrets regularly**
- **Use different secrets per environment** (dev/staging/prod)

### ❌ DON'T

- **Never commit secrets to git** (even in Dockerfiles)
- **Never hardcode API keys in code**
- **Never log secret values** (`console.log(process.env.PRINTFUL_API_KEY)`)
- **Never use production secrets in development**

## Example: Complete Setup

### Local Development

```bash
# 1. Create .env file (one-time)
cat > .env << 'EOF'
PRINTFUL_API_KEY=sk_test_abc123
DATABASE_PASSWORD=dev-password
GCS_BUCKET=dev-bucket
EOF

# 2. Add .env to .gitignore
echo ".env" >> .gitignore

# 3. Start Docker with environment variables
docker compose up -d

# 4. Verify variables are injected
docker compose exec app sh -c 'echo $PRINTFUL_API_KEY'
# Output: sk_test_abc123 (from .env, NOT from Dockerfile!)
```

### Production Deployment

```bash
# 1. Store secrets in GCP Secret Manager (one-time)
echo -n "sk_live_production_key" | gcloud secrets create printful-api-key \
  --data-file=- \
  --replication-policy=automatic

# 2. Deploy with secrets
gcloud run deploy awm-app \
  --image gcr.io/my-project/awm-app:latest \
  --region us-central1 \
  --set-env-vars="DATABASE_HOST=10.1.2.3" \
  --set-secrets="PRINTFUL_API_KEY=printful-api-key:latest"

# 3. Verify (check logs, NOT environment variables directly)
gcloud run services logs read awm-app --region us-central1
```

## Required Environment Variables

### App Container

| Variable | Required | Default | Source | Description |
|----------|----------|---------|--------|-------------|
| `DATABASE_HOST` | Yes | - | Config | PostgreSQL hostname |
| `DATABASE_PORT` | Yes | 5432 | Config | PostgreSQL port |
| `DATABASE_NAME` | Yes | alwaysmap | Config | Database name |
| `DATABASE_USER` | Yes | postgres | Config | Database user |
| `DATABASE_PASSWORD` | Yes | - | **Secret** | Database password |
| `PRINTFUL_API_KEY` | Yes | - | **Secret** | Printful API key |
| `GCS_BUCKET` | Yes | - | Config | Google Cloud Storage bucket |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes | - | Secret/File | Path to GCP service account JSON |

### Worker Container

| Variable | Required | Default | Source | Description |
|----------|----------|---------|--------|-------------|
| `DATABASE_HOST` | Yes | - | Config | PostgreSQL hostname |
| `DATABASE_PORT` | Yes | 5432 | Config | PostgreSQL port |
| `DATABASE_NAME` | Yes | alwaysmap | Config | Database name |
| `DATABASE_USER` | Yes | postgres | Config | Database user |
| `DATABASE_PASSWORD` | Yes | - | **Secret** | Database password |
| `API_URL` | Yes | - | Config | App service URL |
| `RENDER_BASE_URL` | Yes | - | Config | Render service URL (usually same as API_URL) |
| `EXPORT_DIR` | No | /app/exports | Config | Export output directory |

## Testing Environment Variables

### Validate Locally

```bash
# Start containers
docker compose up -d

# Test app can access database
docker compose exec app sh -c 'echo "DATABASE_HOST=$DATABASE_HOST"'

# Test worker can access API
docker compose exec worker sh -c 'curl -v $API_URL'

# Test secrets are NOT logged
docker compose logs app | grep -i "api.*key"  # Should be empty!
```

### Validate in Cloud Run

```bash
# Check environment variables are set (use Cloud Console or logs)
gcloud run services describe awm-app \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"

# Test connectivity (through logs, not direct env var access)
gcloud run services logs read awm-app --region us-central1 --limit 50
```

## Troubleshooting

### "Environment variable not set" errors

**Cause**: Variable not injected at runtime

**Fix**:
```bash
# Check .env file exists and has correct syntax
cat .env

# Verify docker-compose.yml references it
grep PRINTFUL_API_KEY docker-compose.yml

# Restart containers to pick up changes
docker compose down && docker compose up -d
```

### "Using default Dockerfile ENV values"

**Cause**: Runtime injection not working

**Fix**:
```bash
# Verify environment block in docker-compose.yml
docker compose config  # Shows final config with substitutions

# Check container environment
docker compose exec app env | grep DATABASE
```

### "Secrets appearing in logs"

**Cause**: Accidentally logging secret values

**Fix**:
```typescript
// ❌ BAD - Never do this
console.log('API Key:', process.env.PRINTFUL_API_KEY);

// ✅ GOOD - Log without revealing value
console.log('API Key configured:', !!process.env.PRINTFUL_API_KEY);
```

## Summary

| Environment | Secrets Storage | Injection Method | Dockerfile ENV Used? |
|-------------|-----------------|------------------|----------------------|
| **Local Dev** | `.env` file | docker-compose.yml | ❌ No (overridden) |
| **Cloud Run** | Secret Manager | `--set-secrets` | ❌ No (overridden) |
| **CI/CD** | GitHub Secrets | GitHub Actions | ❌ No (overridden) |
| **Manual Container** | Manual `-e` flags | `docker run -e` | ❌ No (overridden) |

**Key Takeaway**: Dockerfile ENV values are **never** used in practice - they're just fallbacks for edge cases. Real values come from runtime injection.
