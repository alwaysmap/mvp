# AlwaysMap POC - Phase 3 Complete ✓

A proof-of-concept for generating high-quality print-ready maps from browser-based D3 visualizations, with CLI export tool and print-on-demand integration.

## Project Status

**Phase 3: Export Pipeline with CLI Tool Complete** ✅

Print-ready PNG export with self-starting server:
- ✅ CLI export tool with programmatic Vite server management
- ✅ Puppeteer-based headless Chrome rendering
- ✅ Sharp post-processing with sRGB ICC profile embedding
- ✅ PNG validation for print specifications
- ✅ Multiple print size support (12×16, 18×24, 24×36)
- ✅ Sample data included for testing
- ✅ All tests passing (61 unit + 26 E2E)

**Phase 2: Interactive Globe Rotation Complete** ✅

Smooth, natural globe rotation with versor mathematics:
- ✅ Versor quaternion-based drag rotation
- ✅ Framework-agnostic rotation module
- ✅ Interactive mode in map renderer
- ✅ Selective re-rendering (geography only)
- ✅ TypeScript type definitions for versor

**Phase 1: D3 Map Renderer Core Complete** ✅

Framework-agnostic map renderer:
- ✅ Type definitions for maps, people, and locations
- ✅ Dimension calculator with bleed/safe area support
- ✅ Font loading verification for browser/Puppeteer consistency
- ✅ Title box and QR code overlay rendering (D3-based)
- ✅ Orthographic projection setup with rotation support
- ✅ Style definitions for maps and overlays
- ✅ Main renderMap() function with error handling

**Phase 0: Bootstrap Complete** ✅
- SvelteKit 5 with TypeScript
- PNPM package management
- Docker development environment
- Vitest unit testing
- Playwright E2E testing
- Required fonts (Cormorant Garamond, DM Sans)
- Geographic data (world-atlas TopoJSON)
- sRGB ICC color profile

## Quick Start

```bash
# Install dependencies
pnpm install

# (Optional) Set up environment variables for Docker
cp .env.example .env
# Edit .env with your API keys (see docs/ENVIRONMENT-VARIABLES.md)

# Run development server
pnpm dev

# Export map to PNG (no server needed!)
pnpm export --sample output.png

# Run tests (see docs/TESTING-STRATEGY.md for details)
pnpm test              # Unit tests (local, fast)
pnpm test:integration  # Integration tests (Docker)
pnpm test:e2e          # E2E tests (Docker)
pnpm test:all          # All tests (unit + Docker)

# Docker testing (validates Cloud Run deployment)
pnpm docker:up         # Start containers
pnpm docker:logs       # View all logs
pnpm docker:down       # Stop containers

# Build for production
pnpm build
```

## CLI Export Tool

The CLI export tool generates print-ready PNG files without requiring a manually-started dev server. It automatically starts Vite, renders the map via Puppeteer, embeds an sRGB ICC profile, validates the output, and stops the server.

### Basic Usage

```bash
# Export using sample data
pnpm export --sample output.png

# Export from JSON file
pnpm export data/my-map.json output.png

# Specify print size (12x16, 18x24, or 24x36)
pnpm export --sample output.png --size 24x36

# Show help
pnpm export --help
```

### Map Definition Format

Create a JSON file with your map data:

```json
{
  "title": "Our Family Journey",
  "subtitle": "2010-2024",
  "people": [
    {
      "id": "alice",
      "name": "Alice",
      "color": "#FF6B6B",
      "locations": [
        {
          "countryCode": "US",
          "longitude": -74.006,
          "latitude": 40.7128,
          "date": "2010-01-01"
        },
        {
          "countryCode": "GB",
          "longitude": -0.1276,
          "latitude": 51.5074,
          "date": "2015-06-15"
        }
      ]
    }
  ],
  "rotation": [-20, -30, 0]
}
```

See `data/sample-map.json` for a complete example.

### Print Sizes

The tool supports three standard print sizes:

| Size | Dimensions | Pixels @ 300 DPI | Aspect Ratio |
|------|------------|------------------|--------------|
| 12×16 | 864×1152pt | 3675×4875px | 3:4 |
| 18×24 | 1296×1728pt | 5475×7275px | 3:4 |
| 24×36 | 1728×2592pt | 7275×10875px | 2:3 |

All sizes include 0.125" bleed on all sides for professional printing.

### Output Quality

Each export produces a print-ready PNG with:
- ✅ Exact pixel dimensions for chosen print size at 300 DPI
- ✅ Embedded sRGB ICC color profile (required by Printful)
- ✅ Maximum quality PNG compression
- ✅ All fonts loaded and verified before rendering
- ✅ Validated dimensions, color space, and ICC profile

### How It Works

1. **Validation**: Validates map definition against schema
2. **Server Start**: Programmatically starts Vite dev server
3. **HTTP Polling**: Waits for server to be ready (up to 30 attempts)
4. **Render**: Launches Puppeteer, navigates to `/render` route
5. **Font Verification**: Confirms all required fonts loaded
6. **Screenshot**: Captures full-page PNG at exact dimensions
7. **Post-Processing**: Embeds sRGB ICC profile using Sharp
8. **Validation**: Verifies output meets print specifications
9. **Cleanup**: Always stops server, even on error

### Troubleshooting

**Chrome not found**: Install Puppeteer's Chrome browser:
```bash
npx puppeteer browsers install chrome
```

**Port already in use**: The tool uses port 5173 by default but will try other ports if needed.

**Validation warnings**: "Unusual bit depth: uchar" can be safely ignored - this is normal for PNG output.

### Architecture Notes

The CLI tool uses Vite's programmatic API (`createServer()`) to start/stop the dev server automatically. This ensures:
- No need to manually start `pnpm dev` before exporting
- Server always cleaned up, even if export fails
- Robust HTTP polling prevents race conditions
- Development mode rendering (faster than production build)

## Project Structure

```
awm-prototype/
├── src/
│   ├── routes/          # SvelteKit pages
│   │   ├── +page.svelte           # Landing page
│   │   ├── create-map/+page.svelte # Interactive map creator
│   │   ├── render/+page.svelte    # Headless render route (for Puppeteer)
│   │   └── api/export/+server.ts  # Export API endpoint
│   ├── lib/
│   │   ├── map-renderer/  # ✓ Framework-agnostic D3 map renderer
│   │   │   ├── index.ts        # Main renderMap() function
│   │   │   ├── types.ts        # TypeScript type definitions
│   │   │   ├── dimensions.ts   # Print dimension calculations
│   │   │   ├── fonts.ts        # Font loading verification
│   │   │   ├── projection.ts   # Geographic projection setup
│   │   │   ├── rotation.ts     # Versor quaternion rotation
│   │   │   ├── overlays.ts     # Title box & QR code rendering
│   │   │   ├── styles.ts       # Centralized style definitions
│   │   │   └── versor.d.ts     # TypeScript types for versor
│   │   └── export/        # ✓ Export pipeline
│   │       ├── puppeteer.ts    # Headless Chrome rendering
│   │       ├── post-process.ts # ICC profile embedding
│   │       └── validate.ts     # PNG & map validation
│   ├── app.css          # Global styles + font declarations
│   └── app.html         # HTML template
├── scripts/
│   ├── export-map.ts    # ✓ CLI export tool with self-starting server
│   └── download-assets.sh  # Download fonts, geo data, ICC profile
├── data/
│   └── sample-map.json  # ✓ Sample map definition for testing
├── static/
│   ├── fonts/           # Local TTF files (Cormorant Garamond, DM Sans)
│   └── data/            # TopoJSON geographic data
├── profiles/
│   └── sRGB2014.icc     # ICC color profile for print
├── tests/
│   ├── unit/            # ✓ Vitest unit tests (61 tests passing)
│   │   ├── dimensions.test.ts
│   │   ├── fonts.test.ts
│   │   ├── qrcode.test.ts
│   │   ├── rotation.test.ts
│   │   ├── validation.test.ts
│   │   └── example.test.ts
│   └── e2e/             # ✓ Playwright E2E tests (26 tests passing)
│       ├── navigation.test.ts
│       ├── rotation.test.ts
│       ├── responsive.test.ts
│       └── export.test.ts
├── docker-compose.yml       # Multi-container development stack
├── docker-compose.worker.yml  # Standalone worker (separate machine)
├── Dockerfile           # App container
├── Dockerfile.worker    # Puppeteer worker container
└── docs/
    ├── WORKER-DOCKER-SETUP.md      # Docker worker deployment guide
    └── NATIVE-UNITS-REFACTOR.md    # Future refactor spec
```

## Technology Stack

- **Framework:** SvelteKit 5 with Svelte 5 runes
- **Language:** TypeScript
- **Package Manager:** PNPM
- **Visualization:** D3.js v7
- **Export:** Puppeteer (headless Chrome)
- **Image Processing:** Sharp
- **Queue:** BullMQ + Redis
- **Storage:** Google Cloud Storage
- **Deployment:** Google Cloud Run
- **Testing:** Vitest (unit/integration) + Playwright (E2E)

## Required Assets

### Fonts (✓ Downloaded)
- Cormorant Garamond: Regular, SemiBold, Bold, Italic
- DM Sans: Regular, Medium, SemiBold

All fonts loaded from local TTF files in `static/fonts/` to ensure identical rendering in browser and Puppeteer.

### Geographic Data (✓ Downloaded)
- `countries-110m.json` - Country boundaries (TopoJSON)
- `land-110m.json` - Land masses (TopoJSON)

Source: world-atlas v2 via jsDelivr CDN

### Color Profile (✓ Downloaded)
- `sRGB2014.icc` - Standard RGB color profile

Required by Printful for accurate print color reproduction.

## Map Renderer API

The core `renderMap()` function is framework-agnostic and works in both browser and Puppeteer:

```typescript
import { renderMap, PRINT_SPECS } from '$lib/map-renderer';

const mapDefinition = {
  title: 'Our Family Journey',
  subtitle: '2010-2024',
  people: [
    {
      id: '1',
      name: 'Alice',
      color: '#FF6B6B',
      locations: [
        { countryCode: 'US', longitude: -74.006, latitude: 40.7128, date: '2010-01-01' },
        { countryCode: 'GB', longitude: -0.1276, latitude: 51.5074, date: '2015-06-15' }
      ]
    }
  ]
};

const result = await renderMap(
  mapDefinition,
  PRINT_SPECS['18x24'],
  { selector: '#map-svg', interactive: true }
);

if (result.success) {
  console.log('Map rendered!', result.dimensions);
} else {
  console.error('Render failed:', result.error);
}
```

## Docker Deployment

The project includes Docker setup for running the full stack (app + worker + database):

```bash
# Start all services
docker compose up

# View worker logs
docker compose logs -f worker

# Stop all services
docker compose down
```

### Architecture

- **App Container**: SvelteKit application + API server
- **Worker Container**: Puppeteer export worker with headless Chrome
- **Postgres Container**: PostgreSQL database for pg-boss queue

The worker runs independently and only communicates via:
- API endpoints (job status updates)
- PostgreSQL database (pg-boss queue)
- Shared volume (PNG file exports)

For detailed worker deployment instructions (including running on a separate machine), see [docs/WORKER-DOCKER-SETUP.md](docs/WORKER-DOCKER-SETUP.md).

## Next Steps (Phase 4+)

Future enhancements for production readiness:
1. **Phase 4**: Production infrastructure
   - Docker deployment with Redis queue
   - Google Cloud Storage integration
   - BullMQ job processing
   - Horizontal scaling for export workers
2. **Phase 5**: Printful integration
   - Product catalog API integration
   - Order creation workflow
   - Print file submission
   - Order status tracking

## Documentation

- [Environment Variables](docs/ENVIRONMENT-VARIABLES.md) - **Secrets management & runtime injection**
- [Testing Strategy](docs/TESTING-STRATEGY.md) - **12-Factor App testing & Cloud Run validation**
- [Docker Worker Setup](docs/WORKER-DOCKER-SETUP.md) - Worker deployment guide
- [Implementation Plan](IMPLEMENTATION-PLAN.md) - Complete 5-phase roadmap
- [POC Specification](alwaysmap-poc.md) - Original detailed spec
- [Project Guidelines](CLAUDE.md) - Development standards
- [Native Units Refactor](docs/NATIVE-UNITS-REFACTOR.md) - Future enhancement spec

## Commands Reference

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm preview          # Preview production build

# Export (CLI Tool)
pnpm export --sample output.png              # Export with sample data
pnpm export data/map.json output.png         # Export from JSON file
pnpm export --sample output.png --size 24x36 # Specify print size
pnpm export --help                           # Show help

# Testing (see docs/TESTING-STRATEGY.md)
pnpm test                # Unit tests (local, fast)
pnpm test:watch          # Watch mode for TDD
pnpm test:integration    # Integration tests (requires Docker)
pnpm test:e2e            # E2E tests (requires Docker)
pnpm test:e2e:ui         # E2E with Playwright UI
pnpm test:all            # All tests (unit + Docker)
pnpm test:docker         # Integration + E2E in Docker

# Docker (validates Cloud Run deployment)
pnpm docker:up           # Start all services (app + worker + postgres)
pnpm docker:down         # Stop all services
pnpm docker:logs         # View all container logs
pnpm docker:logs:worker  # View worker logs only
docker compose build     # Rebuild containers
docker compose up --scale worker=3  # Test horizontal scaling

# Assets
./scripts/download-assets.sh  # Re-download all assets
```

## License

Fonts are licensed under Open Font License (OFL).
Geographic data from Natural Earth is public domain.
