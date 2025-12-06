# AlwaysMap POC - Phase 1 Complete ✓

A proof-of-concept for generating high-quality print-ready maps from browser-based D3 visualizations, integrated with Printful's print-on-demand API.

## Project Status

**Phase 1: D3 Map Renderer Core Complete** ✅

The framework-agnostic map renderer is implemented and tested:
- ✅ Type definitions for maps, people, and locations
- ✅ Dimension calculator with bleed/safe area support
- ✅ Font loading verification for browser/Puppeteer consistency
- ✅ Title box and QR code overlay rendering (D3-based)
- ✅ Orthographic projection setup with rotation support
- ✅ Style definitions for maps and overlays
- ✅ Main renderMap() function with error handling
- ✅ Comprehensive unit tests (26 tests passing)

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

# Run development server
pnpm dev

# Run tests
pnpm test          # Unit tests (Vitest)
pnpm test:e2e      # E2E tests (Playwright)

# Build for production
pnpm build
```

## Project Structure

```
awm-prototype/
├── src/
│   ├── routes/          # SvelteKit pages
│   ├── lib/
│   │   └── map-renderer/  # ✓ Framework-agnostic D3 map renderer
│   │       ├── index.ts        # Main renderMap() function
│   │       ├── types.ts        # TypeScript type definitions
│   │       ├── dimensions.ts   # Print dimension calculations
│   │       ├── fonts.ts        # Font loading verification
│   │       ├── projection.ts   # Geographic projection setup
│   │       ├── overlays.ts     # Title box & QR code rendering
│   │       └── styles.ts       # Centralized style definitions
│   ├── app.css          # Global styles + font declarations
│   └── app.html         # HTML template
├── static/
│   ├── fonts/           # Local TTF files (Cormorant Garamond, DM Sans)
│   └── data/            # TopoJSON geographic data
├── profiles/
│   └── sRGB2014.icc     # ICC color profile for print
├── tests/
│   ├── unit/            # ✓ Vitest unit tests (26 tests passing)
│   │   ├── dimensions.test.ts
│   │   ├── fonts.test.ts
│   │   └── example.test.ts
│   ├── integration/     # Integration tests (Phase 2+)
│   └── e2e/             # Playwright E2E tests (Phase 2+)
├── scripts/
│   └── download-assets.sh  # Download fonts, geo data, ICC profile
├── docker-compose.yml   # Multi-container development stack
├── Dockerfile           # App container
└── Dockerfile.worker    # Puppeteer worker container
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

## Next Steps (Phase 2)

Implement interactive controls and globe rotation:
1. Integrate versor dragging for smooth globe rotation
2. Create Svelte component wrapper around renderMap()
3. Add interactive controls (zoom, reset view)
4. Implement path animation on load
5. Add responsive canvas sizing

## Documentation

- [Implementation Plan](IMPLEMENTATION-PLAN.md) - Complete 5-phase roadmap
- [POC Specification](alwaysmap-poc.md) - Original detailed spec
- [Project Guidelines](CLAUDE.md) - Development standards

## Commands Reference

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm preview          # Preview production build

# Testing
pnpm test             # Run all unit tests
pnpm test:watch       # Watch mode for unit tests
pnpm test:e2e         # Run E2E tests
pnpm test:e2e:ui      # E2E tests with UI

# Docker
docker-compose up     # Start all services
docker-compose build  # Rebuild containers

# Assets
./scripts/download-assets.sh  # Re-download all assets
```

## License

Fonts are licensed under Open Font License (OFL).
Geographic data from Natural Earth is public domain.
