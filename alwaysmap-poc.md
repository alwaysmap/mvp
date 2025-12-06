# AlwaysMap: D3 to Printful Implementation Plan

## Project Goal

Build a pipeline from interactive D3.js map in browser to print-ready PNG files for Printful fulfillment. Output goes directly to Printful's API—not to end users.

**Optimization Priority:** Accuracy above all else. Render time is irrelevant. Font fidelity and dimensional accuracy are everything.

**Success Criteria for MVP:**
- User configures map in browser with live preview
- Printable map includes some non-map element like a box containing a title and subtitle, and a QR code in the corner for https://alwaysmap.com.
- System produces PNG meeting Printful's exact specifications
- Specific Google Fonts render correctly in output
- Files upload successfully to Printful API

---

## Printful Output Specification

All output must meet these requirements (from Printful's guidelines):

| Requirement | Value | Notes |
|-------------|-------|-------|
| **Resolution** | 300 DPI | No benefit above 300; 150 minimum |
| **Color Profile** | sRGB | Embedded in PNG |
| **File Format** | PNG | Flattened, no transparency needed for posters |
| **Bleed** | Full bleed to edge | Design extends past trim line |
| **Safe Area** | Critical content inside | Text/important elements away from edges |

### Poster Product Dimensions (Examples)

| Product | Trim Size | With Bleed | Pixels @ 300 DPI |
|---------|-----------|------------|------------------|
| 18" × 24" | 18" × 24" | 18.25" × 24.25" | 5475 × 7275 |
| 24" × 36" | 24" × 36" | 24.25" × 36.25" | 7275 × 10875 |
| 12" × 18" | 12" × 18" | 12.25" × 18.25" | 3675 × 5475 |
| 11" × 14" | 11" × 14" | 11.25" × 14.25" | 3375 × 4275 |

**Bleed:** 0.125" on each side (standard print bleed)

**Safe Area:** Keep text and critical elements at least 0.25" from trim edge

---

## Architecture Overview

```
BROWSER                          SERVER                           PRINTFUL
┌──────────────┐                ┌──────────────┐                ┌───────────┐
│ React + D3   │   POST JSON    │ Queue Job    │                │ Printful  │
│ Preview      │ ─────────────▶ │ (BullMQ)     │                │ API       │
│ (72 DPI)     │                └──────┬───────┘                └─────▲─────┘
└──────────────┘                       │                              │
       │                               ▼                              │
       │                        ┌──────────────┐    POST         ┌────┴─────┐
       │                        │ Worker       │ ───────────────▶│ S3 URL   │
       │                        │ (Puppeteer)  │                 └──────────┘
       │                        └──────────────┘
       │                               │
       │    SAME CODE                  │
       │    SAME FONTS                 │
       ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         D3 RENDERER                                      │
│                                                                          │
│  • Framework-agnostic renderMap() function                              │
│  • Google Fonts loaded from local TTF files                             │
│  • Outputs SVG at specified DPI                                         │
│  • Identical output in browser and Puppeteer                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Decision:** Browser and worker run identical D3 code with identical fonts. We serialize `MapDefinition` (data), not SVG. Worker re-renders from scratch using Puppeteer.

---

## Font Handling: The Critical Path

If fonts don't match between browser and export, the product is unusable.

### The Problem

Browser can load Google Fonts from CDN. Puppeteer in Docker cannot—Chrome falls back to system fonts and everything shifts.

### The Solution

**Use local TTF files everywhere.** Same files in browser, same files in Docker.

#### Step 1: Download Google Fonts

Google Fonts are OFL licensed (free to use). Download exact weights needed:

```
public/fonts/
├── CormorantGaramond-Regular.ttf
├── CormorantGaramond-SemiBold.ttf
├── CormorantGaramond-Bold.ttf
├── CormorantGaramond-Italic.ttf
├── DMSans-Regular.ttf
├── DMSans-Medium.ttf
└── DMSans-SemiBold.ttf
```

Source: https://fonts.google.com → Download family → Extract TTF

#### Step 2: Single CSS File for Both Environments

```css
/* src/styles/fonts.css - used by BOTH browser and render page */

@font-face {
  font-family: 'Cormorant Garamond';
  font-style: normal;
  font-weight: 400;
  font-display: block;  /* Block rendering until loaded */
  src: url('/fonts/CormorantGaramond-Regular.ttf') format('truetype');
}

@font-face {
  font-family: 'Cormorant Garamond';
  font-style: normal;
  font-weight: 600;
  font-display: block;
  src: url('/fonts/CormorantGaramond-SemiBold.ttf') format('truetype');
}

@font-face {
  font-family: 'Cormorant Garamond';
  font-style: normal;
  font-weight: 700;
  font-display: block;
  src: url('/fonts/CormorantGaramond-Bold.ttf') format('truetype');
}

@font-face {
  font-family: 'Cormorant Garamond';
  font-style: italic;
  font-weight: 400;
  font-display: block;
  src: url('/fonts/CormorantGaramond-Italic.ttf') format('truetype');
}

@font-face {
  font-family: 'DM Sans';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url('/fonts/DMSans-Regular.ttf') format('truetype');
}

@font-face {
  font-family: 'DM Sans';
  font-style: normal;
  font-weight: 500;
  font-display: block;
  src: url('/fonts/DMSans-Medium.ttf') format('truetype');
}

@font-face {
  font-family: 'DM Sans';
  font-style: normal;
  font-weight: 600;
  font-display: block;
  src: url('/fonts/DMSans-SemiBold.ttf') format('truetype');
}
```

**Critical:** Do NOT use Google Fonts CDN (`@import url('https://fonts.googleapis.com/...')`) anywhere. Local files only.

#### Step 3: Install Fonts in Docker

```dockerfile
# Copy exact same TTF files
COPY public/fonts/*.ttf /usr/local/share/fonts/

# Rebuild font cache
RUN fc-cache -f -v

# Verify fonts (fail build if missing)
RUN fc-list | grep -q "Cormorant Garamond" || (echo "Font missing!" && exit 1)
RUN fc-list | grep -q "DM Sans" || (echo "Font missing!" && exit 1)
```

#### Step 4: Wait for Fonts Before Rendering

In the render page:

```javascript
// Wait for CSS fonts to load
await document.fonts.ready;

// Verify specific fonts loaded
const fontsOk = 
  document.fonts.check('400 16px "Cormorant Garamond"') &&
  document.fonts.check('600 16px "Cormorant Garamond"') &&
  document.fonts.check('700 16px "Cormorant Garamond"') &&
  document.fonts.check('400 16px "DM Sans"') &&
  document.fonts.check('500 16px "DM Sans"');

if (!fontsOk) {
  throw new Error('Required fonts not loaded');
}

// Now safe to render
renderMap(svg, definition, geoData);
```

### Font Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Missing weight | Bold looks smeared (faux-bold) | Install all weights used in CSS |
| CDN in browser, local in Docker | Text shifts position | Use local TTF everywhere |
| `font-display: swap` | Flash of wrong font captured | Use `font-display: block` |
| Variable fonts | Inconsistent rendering | Use static weight TTF files |

---

## Bleed and Safe Area

Printful requires full-bleed designs with safe areas for important content.

```
┌─────────────────────────────────────────────────────────────┐
│                        BLEED AREA                           │
│    (0.125" each side - gets trimmed off)                   │
│                                                             │
│    ┌───────────────────────────────────────────────────┐   │
│    │                   TRIM LINE                        │   │
│    │   ┌───────────────────────────────────────────┐   │   │
│    │   │              SAFE AREA                     │   │   │
│    │   │   (0.25" inside trim - critical content)  │   │   │
│    │   │                                           │   │   │
│    │   │    ┌─────────────────────────────────┐   │   │   │
│    │   │    │                                 │   │   │   │
│    │   │    │         MAP CONTENT             │   │   │   │
│    │   │    │                                 │   │   │   │
│    │   │    └─────────────────────────────────┘   │   │   │
│    │   │                                           │   │   │
│    │   │    Title: "The Kowalski Family"          │   │   │
│    │   │    Subtitle: "Ukraine → America"          │   │   │
│    │   │                                           │   │   │
│    │   └───────────────────────────────────────────┘   │   │
│    │                                                    │   │
│    └───────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Dimension Calculations

```typescript
interface PrintDimensions {
  // Input (trim size in inches)
  trimWidth: number;
  trimHeight: number;
  
  // Constants
  bleed: 0.125;        // Printful standard
  safeMargin: 0.25;    // Keep text inside this
  dpi: 300;            // Printful requirement
}

function calculateDimensions(trim: { width: number; height: number }) {
  const BLEED = 0.125;
  const SAFE_MARGIN = 0.25;
  const DPI = 300;
  const POINTS_PER_INCH = 72;
  
  // Total canvas including bleed
  const canvasWidth = trim.width + (BLEED * 2);
  const canvasHeight = trim.height + (BLEED * 2);
  
  // Pixel dimensions for Printful
  const pixelWidth = Math.round(canvasWidth * DPI);
  const pixelHeight = Math.round(canvasHeight * DPI);
  
  // SVG viewBox in points
  const viewBoxWidth = canvasWidth * POINTS_PER_INCH;
  const viewBoxHeight = canvasHeight * POINTS_PER_INCH;
  
  // Safe area bounds (in points, relative to viewBox origin)
  const safeArea = {
    x: (BLEED + SAFE_MARGIN) * POINTS_PER_INCH,
    y: (BLEED + SAFE_MARGIN) * POINTS_PER_INCH,
    width: (trim.width - SAFE_MARGIN * 2) * POINTS_PER_INCH,
    height: (trim.height - SAFE_MARGIN * 2) * POINTS_PER_INCH,
  };
  
  // Trim line position (in points)
  const trimLine = {
    x: BLEED * POINTS_PER_INCH,
    y: BLEED * POINTS_PER_INCH,
    width: trim.width * POINTS_PER_INCH,
    height: trim.height * POINTS_PER_INCH,
  };
  
  return {
    pixelWidth,
    pixelHeight,
    viewBoxWidth,
    viewBoxHeight,
    safeArea,
    trimLine,
  };
}

// Example: 18" × 24" poster
const dims = calculateDimensions({ width: 18, height: 24 });
// pixelWidth: 5475
// pixelHeight: 7275
// safeArea.x: 27 (points from left edge of canvas)
```

### Layer Positioning Rules

| Element | Positioning Rule |
|---------|------------------|
| Background color | Extends to canvas edge (into bleed) |
| Texture overlay | Extends to canvas edge (into bleed) |
| Map content | Can extend to trim line |
| Decorative border | Drawn ON trim line |
| Title text | Inside safe area |
| Subtitle text | Inside safe area |
| Compass | Inside safe area |
| Location labels | Inside safe area (or clip to it) |

---

## Phase 1: D3 Map Renderer

**Days 1-3 · Goal:** Framework-agnostic renderer with correct dimensions and font loading.

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Coordinate system | Points (1pt = 1/72") | Resolution-independent, PDF-native |
| Font source | Local TTF only | Guarantees browser/Docker match |
| Bleed | Built into canvas | Required by Printful |
| Color space | sRGB | Printful requirement |

### Output Specification

The renderer must produce SVG that, when rasterized:
- Is exactly `pixelWidth × pixelHeight` pixels
- Has sRGB color values
- Has all text rendered in correct fonts
- Has background extending into bleed
- Has critical text inside safe area

### Layer Rendering Order (bottom to top)

1. Background fill (canvas edge)
2. Texture overlay (canvas edge)
3. Ocean/sphere (within map bounds)
4. Graticule
5. Land polygons
6. Country boundaries
7. Migration path
8. Location points
9. Location labels (clipped to safe area)
10. Title block (positioned in safe area)
11. Decorative border (on trim line)
12. Compass (in safe area)

### Validation

- Check pixel dimensions match expected
- Check fonts rendered (not fallback)
- Check title is inside safe area bounds
- Visual diff browser vs Puppeteer < 0.01%

---

## Phase 2: Projection System

**Days 4-6 · Goal:** Interactive projections with serializable state.

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Globe rotation | Versor (quaternion) | Gimbal-lock-free |
| State storage | Explicit numbers | Deterministic reconstruction |
| Auto-fit | Computed once, stored | No recomputation on server |

### Projection State

All projection parameters must be explicit numbers in MapDefinition:

```typescript
projection: {
  type: 'orthographic',
  center: [-42.5, 48.2],      // Computed, then stored
  rotation: [30.0, -15.5, 0], // From versor drag, stored
  scale: 892.4,               // Computed from fitSize, stored
  clipAngle: 90,              // Explicit
}
```

**Never store:** `scale: 'auto'` or `fitTo: 'locations'`. These require recomputation and may differ.

### Versor Implementation

Follow: https://observablehq.com/@d3/versor-dragging

On drag end, convert quaternion to Euler angles and save to MapDefinition. Server reconstructs projection from stored angles.

---

## Phase 3: Export Pipeline

**Days 7-10 · Goal:** PNG output meeting Printful specifications exactly.

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Render engine | Puppeteer | Same Chrome as browser = font match |
| Output format | PNG | Printful requirement |
| Resolution | 300 DPI | Printful requirement |
| Color profile | sRGB embedded | Printful requirement |
| Speed | Irrelevant | Accuracy only |

### Render Page

Dedicated `/render` route for Puppeteer to load:

```typescript
// Key steps in render page

// 1. Parse MapDefinition
const definition = JSON.parse(atob(searchParams.get('data')));

// 2. Wait for fonts
await document.fonts.ready;
const fontsOk = document.fonts.check('600 16px "Cormorant Garamond"');
if (!fontsOk) {
  window.__RENDER_ERROR__ = 'Fonts not loaded';
  return;
}

// 3. Calculate dimensions
const dims = calculateDimensions({ 
  width: definition.width, 
  height: definition.height 
});

// 4. Create SVG at full print resolution
const svg = d3.select(container)
  .append('svg')
  .attr('width', dims.pixelWidth)
  .attr('height', dims.pixelHeight)
  .attr('viewBox', `0 0 ${dims.viewBoxWidth} ${dims.viewBoxHeight}`);

// 5. Render map
renderMap(svg.node(), definition, geoData, dims);

// 6. Signal ready
window.__RENDER_READY__ = true;
```

### Puppeteer Export

```typescript
async function exportForPrintful(definition: MapDefinition): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
    ],
  });
  
  const page = await browser.newPage();
  
  // Calculate exact pixel dimensions
  const dims = calculateDimensions({
    width: definition.width,
    height: definition.height,
  });
  
  // Set viewport to exact output size
  await page.setViewport({
    width: dims.pixelWidth,
    height: dims.pixelHeight,
    deviceScaleFactor: 1,
  });
  
  // Load render page
  const data = encodeURIComponent(btoa(JSON.stringify(definition)));
  await page.goto(`${RENDER_URL}/render?data=${data}`, {
    waitUntil: 'networkidle0',
    timeout: 300000,  // 5 minutes - accuracy over speed
  });
  
  // Wait for render
  await page.waitForFunction(
    () => window.__RENDER_READY__ || window.__RENDER_ERROR__,
    { timeout: 300000 }
  );
  
  // Check for errors
  const error = await page.evaluate(() => window.__RENDER_ERROR__);
  if (error) throw new Error(error);
  
  // Extra wait for final paints
  await new Promise(r => setTimeout(r, 2000));
  
  // Final font verification
  const fontsLoaded = await page.evaluate(() => 
    document.fonts.check('600 16px "Cormorant Garamond"')
  );
  if (!fontsLoaded) throw new Error('Font verification failed');
  
  // Screenshot
  const screenshot = await page.screenshot({
    type: 'png',
    fullPage: true,
    omitBackground: false,
  });
  
  await browser.close();
  
  return screenshot;
}
```

### Post-Processing: sRGB Embedding

Printful requires sRGB color profile. Embed it in the PNG:

```typescript
import sharp from 'sharp';
import fs from 'fs';

async function prepareForPrintful(screenshot: Buffer): Promise<Buffer> {
  // sRGB ICC profile (download from color.org)
  const srgbProfile = fs.readFileSync('profiles/sRGB2014.icc');
  
  return sharp(screenshot)
    .withMetadata({ icc: srgbProfile })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
```

### Output Validation

Before uploading to Printful, validate the file:

```typescript
async function validateForPrintful(
  buffer: Buffer, 
  definition: MapDefinition
): Promise<void> {
  const metadata = await sharp(buffer).metadata();
  
  const dims = calculateDimensions({
    width: definition.width,
    height: definition.height,
  });
  
  const errors: string[] = [];
  
  // Check dimensions
  if (metadata.width !== dims.pixelWidth) {
    errors.push(`Width: expected ${dims.pixelWidth}, got ${metadata.width}`);
  }
  if (metadata.height !== dims.pixelHeight) {
    errors.push(`Height: expected ${dims.pixelHeight}, got ${metadata.height}`);
  }
  
  // Check format
  if (metadata.format !== 'png') {
    errors.push(`Format: expected png, got ${metadata.format}`);
  }
  
  // Check color space
  if (metadata.space !== 'srgb') {
    errors.push(`Color space: expected srgb, got ${metadata.space}`);
  }
  
  // Check has ICC profile
  if (!metadata.icc) {
    errors.push('Missing ICC profile');
  }
  
  // Check minimum file size (not blank/corrupt)
  if (buffer.length < 100000) {
    errors.push(`File too small: ${buffer.length} bytes`);
  }
  
  if (errors.length > 0) {
    throw new Error(`Printful validation failed:\n${errors.join('\n')}`);
  }
}
```

---

## Phase 4: Queue System

**Days 11-13 · Goal:** Reliable job processing with Printful integration.

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Queue | BullMQ + Redis | Reliable, retries, backoff |
| Storage | S3 (public URL for Printful) | Printful fetches from URL |
| Job timeout | 5 minutes | Accuracy over speed |
| Retries | 3 with exponential backoff | Handle transient failures |

### Job Flow

```
Order Created
    │
    ▼
Queue Render Job
    │
    ▼
Worker: Render via Puppeteer
    │
    ▼
Worker: Embed sRGB profile
    │
    ▼
Worker: Validate dimensions
    │
    ▼
Worker: Upload to S3
    │
    ▼
Worker: Submit to Printful API
    │
    ▼
Store Printful Order ID
    │
    ▼
Wait for Printful Webhook (shipping)
```

### Job Payload

```typescript
interface RenderJob {
  id: string;
  orderId: string;
  
  mapDefinition: MapDefinition;
  
  printful: {
    variantId: number;    // Printful product variant
    quantity: number;
  };
  
  status: 'pending' | 'rendering' | 'uploading' | 'submitted' | 'failed';
  
  result?: {
    s3Url: string;
    printfulOrderId: number;
    dimensions: { width: number; height: number };
  };
  
  error?: string;
  attempts: number;
}
```

### Printful API Integration

```typescript
// Submit order to Printful
async function submitToPrintful(
  s3Url: string,
  job: RenderJob,
  shippingAddress: Address
): Promise<number> {
  const response = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: {
        name: shippingAddress.name,
        address1: shippingAddress.line1,
        city: shippingAddress.city,
        state_code: shippingAddress.state,
        country_code: shippingAddress.country,
        zip: shippingAddress.postalCode,
      },
      items: [{
        variant_id: job.printful.variantId,
        quantity: job.printful.quantity,
        files: [{
          url: s3Url,  // Printful fetches from this URL
        }],
      }],
    }),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Printful API error: ${JSON.stringify(data)}`);
  }
  
  return data.result.id;  // Printful order ID
}
```

---

## Phase 5: Docker Development Environment

**Days 14-15 · Goal:** Reproducible local stack.

### Services

```yaml
services:
  app:       # Next.js
  worker:    # Puppeteer render worker  
  redis:     # Job queue
  minio:     # S3-compatible (local dev)
```

### Worker Dockerfile

```dockerfile
FROM node:20-slim

# Chrome + dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-core \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Google Fonts (exact TTF files)
COPY public/fonts/CormorantGaramond-Regular.ttf /usr/local/share/fonts/
COPY public/fonts/CormorantGaramond-SemiBold.ttf /usr/local/share/fonts/
COPY public/fonts/CormorantGaramond-Bold.ttf /usr/local/share/fonts/
COPY public/fonts/CormorantGaramond-Italic.ttf /usr/local/share/fonts/
COPY public/fonts/DMSans-Regular.ttf /usr/local/share/fonts/
COPY public/fonts/DMSans-Medium.ttf /usr/local/share/fonts/
COPY public/fonts/DMSans-SemiBold.ttf /usr/local/share/fonts/

# Rebuild font cache
RUN fc-cache -f -v

# Verify fonts installed (fail build if missing)
RUN fc-list | grep -q "Cormorant Garamond" || exit 1
RUN fc-list | grep -q "DM Sans" || exit 1

# Puppeteer config
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# sRGB ICC profile
COPY profiles/sRGB2014.icc /app/profiles/

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

CMD ["node", "dist/lib/queue/worker.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports: ["3000:3000"]
    volumes:
      - ./src:/app/src
      - ./public:/app/public
    environment:
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_BUCKET: family-maps
      S3_ACCESS_KEY: minioadmin
      S3_SECRET_KEY: minioadmin

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_BUCKET: family-maps
      S3_ACCESS_KEY: minioadmin
      S3_SECRET_KEY: minioadmin
      RENDER_BASE_URL: http://app:3000
      PRINTFUL_API_KEY: ${PRINTFUL_API_KEY}
    deploy:
      resources:
        limits:
          memory: 2G
    depends_on: [app, redis, minio]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
```

---

## Data Sources

### Geographic Data

| File | Source | Size |
|------|--------|------|
| countries-110m.json | world-atlas | ~300KB |
| countries-50m.json | world-atlas | ~1.5MB |
| land-110m.json | world-atlas | ~150KB |

Download from: `https://cdn.jsdelivr.net/npm/world-atlas@2/`

### Fonts

Download from Google Fonts:
- Cormorant Garamond: https://fonts.google.com/specimen/Cormorant+Garamond
- DM Sans: https://fonts.google.com/specimen/DM+Sans

Extract TTF files for each weight.

### ICC Profile

Download sRGB2014.icc from: https://www.color.org/srgbprofiles.xalter

---

## Known Challenges

### 1. Font Mismatch

| Risk | Impact | Mitigation |
|------|--------|------------|
| High | Critical | Local TTF everywhere, verify before render, visual regression CI |

### 2. Wrong Dimensions

| Risk | Impact | Mitigation |
|------|--------|------------|
| Medium | Critical | Calculate once, validate output, fail job if wrong |

### 3. Content in Bleed

| Risk | Impact | Mitigation |
|------|--------|------------|
| Medium | Text cut off | Position title/labels relative to safe area |

### 4. Missing ICC Profile

| Risk | Impact | Mitigation |
|------|--------|------------|
| Low | Color shift | Always embed, validate before upload |

### 5. Printful API Rejection

| Risk | Impact | Mitigation |
|------|--------|------------|
| Low | Delayed order | Validate locally first, DLQ for failures |

---

## MVP Scope

**In Scope:**
- D3 map renderer (vintage + modern styles)
- 3 projections (Natural Earth, Orthographic, Mercator)
- Globe rotation
- 300 DPI PNG with sRGB profile
- Bleed and safe area handling
- Google Fonts (Cormorant Garamond, DM Sans)
- BullMQ job queue
- S3 upload
- Printful API submission

**Out of Scope (Phase 2):**
- User accounts
- Payment processing
- GEDCOM import
- Historical boundaries
- Multiple POD vendors

---

## File Structure

```
family-maps/
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.worker
│
├── public/
│   ├── data/
│   │   ├── countries-110m.json
│   │   └── land-110m.json
│   └── fonts/
│       ├── CormorantGaramond-Regular.ttf
│       ├── CormorantGaramond-SemiBold.ttf
│       ├── CormorantGaramond-Bold.ttf
│       ├── CormorantGaramond-Italic.ttf
│       ├── DMSans-Regular.ttf
│       ├── DMSans-Medium.ttf
│       └── DMSans-SemiBold.ttf
│
├── profiles/
│   └── sRGB2014.icc
│
├── src/
│   ├── app/
│   │   ├── page.tsx              # Configurator UI
│   │   ├── render/page.tsx       # Export target
│   │   └── api/orders/           # Order management
│   │
│   ├── lib/
│   │   ├── map-renderer/
│   │   │   ├── index.ts          # renderMap()
│   │   │   ├── types.ts          # MapDefinition
│   │   │   ├── dimensions.ts     # Bleed/safe area calc
│   │   │   ├── styles.ts         # Color palettes
│   │   │   ├── projections.ts    # D3 projections
│   │   │   └── versor.ts         # Rotation math
│   │   │
│   │   ├── export/
│   │   │   ├── puppeteer.ts      # Screenshot
│   │   │   ├── post-process.ts   # sRGB embedding
│   │   │   └── validate.ts       # Dimension checks
│   │   │
│   │   ├── queue/
│   │   │   ├── render-queue.ts
│   │   │   └── worker.ts
│   │   │
│   │   └── printful/
│   │       └── client.ts         # Printful API
│   │
│   └── styles/
│       └── fonts.css             # @font-face (shared)
│
└── tests/
    └── visual-regression/
        └── font-match.test.ts
```

---

## Daily Milestones

| Day | Milestone | Validation |
|-----|-----------|------------|
| 1 | D3 renders land + countries | SVG in browser |
| 2 | Path + points + labels | Curved line, text visible |
| 3 | Fonts from local TTF | Cormorant Garamond renders |
| 4 | Bleed + safe area | Dimensions correct |
| 5 | Orthographic + rotation | Globe rotates |
| 6 | Presets + auto-fit | "Atlantic Crossing" works |
| 7 | Puppeteer screenshot | PNG file exists |
| 8 | Fonts in Docker | pixelmatch = 0 |
| 9 | sRGB embedding | Profile in metadata |
| 10 | Validation checks | Rejects wrong dimensions |
| 11 | Redis queue | Jobs persist |
| 12 | Worker processes | File in MinIO |
| 13 | Printful API call | Test order submits |
| 14 | docker-compose | Full stack starts |
| 15 | CI visual regression | Fails on font mismatch |

---

## Appendix A: MapDefinition Schema

```typescript
interface MapDefinition {
  // Output (trim size, not including bleed)
  width: number;        // inches
  height: number;       // inches
  
  // Printful-specific (computed from above)
  // bleed: 0.125 (constant)
  // dpi: 300 (constant)
  
  style: 'vintage' | 'modern';
  
  projection: {
    type: 'naturalEarth1' | 'orthographic' | 'mercator';
    center: [number, number];           // [lng, lat]
    rotation: [number, number, number]; // [λ, φ, γ]
    scale: number;
    clipAngle?: number;
  };
  
  layers: {
    graticule: boolean;
    countries: boolean;
    countryLabels: boolean;
  };
  
  locations: Array<{
    id: string;
    name: string;
    coordinates: [number, number];
    year?: number;
    type: 'birth' | 'transit' | 'arrival' | 'death';
  }>;
  
  title: { text: string; visible: boolean };
  subtitle: { text: string; visible: boolean };
  
  showCompass: boolean;
  showBorder: boolean;
  textureOverlay: 'none' | 'parchment';
}
```

---

## Appendix B: Printful Product Variants

Common poster sizes and their Printful variant IDs (verify in Printful catalog):

| Size | Variant ID | Pixel Dimensions |
|------|------------|------------------|
| 12×18" | TBD | 3675 × 5475 |
| 18×24" | TBD | 5475 × 7275 |
| 24×36" | TBD | 7275 × 10875 |

Look up exact variant IDs in Printful dashboard for your selected paper type (matte, glossy, etc.).

---

## Appendix C: Visual Regression Test

```typescript
import puppeteer from 'puppeteer';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';

async function testFontFidelity() {
  const definition: MapDefinition = { /* test definition */ };
  
  // Browser render (local dev)
  const browserPng = await captureFromBrowser(definition);
  
  // Worker render (Docker)
  const workerPng = await captureFromWorker(definition);
  
  // Compare at same resolution
  const img1 = PNG.sync.read(browserPng);
  const img2 = PNG.sync.read(workerPng);
  
  const diff = new PNG({ width: img1.width, height: img1.height });
  const mismatch = pixelmatch(
    img1.data, img2.data, diff.data,
    img1.width, img1.height,
    { threshold: 0.1 }
  );
  
  const mismatchPercent = (mismatch / (img1.width * img1.height)) * 100;
  
  if (mismatchPercent > 0.01) {
    fs.writeFileSync('diff.png', PNG.sync.write(diff));
    throw new Error(`${mismatchPercent.toFixed(3)}% pixel mismatch`);
  }
  
  console.log('Font fidelity: PASS');
}
```

---

## Appendix D: References

**Printful:**
- File preparation: https://www.printful.com/blog/preparing-your-design-file-tips-templates/
- API docs: https://developers.printful.com/docs/
- Product catalog: https://www.printful.com/api#!/Catalog_API/get_products

**Fonts:**
- Google Fonts: https://fonts.google.com/
- Font loading API: https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API

**Color:**
- sRGB profile: https://www.color.org/srgbprofiles.xalter

**D3:**
- Versor dragging: https://observablehq.com/@d3/versor-dragging
- Projections: https://d3js.org/d3-geo/projection
