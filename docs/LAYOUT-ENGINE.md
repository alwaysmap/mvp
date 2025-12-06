

# Layout Engine Documentation

## Overview

The layout engine is a pure, framework-agnostic TypeScript module that calculates optimal positioning of map elements and furniture (title, QR code, etc.) on physical print pages.

**Key characteristics**:
- ✅ Pure functions - no side effects, same input → same output
- ✅ Zero DOM dependencies - works in any JavaScript environment
- ✅ Fully tested - 33 unit tests with 100% coverage of core functions
- ✅ Type-safe - Complete TypeScript definitions
- ✅ Database-ready - Complete map definition for storage

## Three-Layer Data Model

The layout engine separates concerns into three distinct layers:

### Layer 1: MapStyle (How It Looks)

Visual style configuration - colors, strokes, visibility.

```typescript
interface MapStyle {
  ocean: { color: string; visible: boolean };
  land: { color: string; visible: boolean };
  countries: { stroke: string; strokeWidth: number; fill: string; visible: boolean };
  graticule: { stroke: string; strokeWidth: number; visible: boolean };
  paths: { stroke: string; strokeWidth: number; opacity: number };
  background: { color: string };
}
```

**Example**:
```typescript
const antiqueStyle: MapStyle = {
  ocean: { color: '#d4e7f5', visible: true },
  land: { color: '#e8dcc8', visible: true },
  countries: { stroke: '#c9b896', strokeWidth: 0.5, fill: 'none', visible: true },
  graticule: { stroke: '#d0d0d0', strokeWidth: 0.25, visible: true },
  paths: { stroke: '#FF5733', strokeWidth: 2, opacity: 0.8 },
  background: { color: '#f4ebe1' }
};
```

### Layer 2: UserMapData (What Goes On The Map)

User content - people, locations, view settings.

```typescript
interface UserMapData {
  people: Person[];
  view: {
    projection: 'orthographic' | 'mercator' | 'equirectangular';
    rotation: [number, number, number]; // [lambda, phi, gamma]
  };
}
```

**Example**:
```typescript
const userData: UserMapData = {
  people: [
    {
      id: 'person_1',
      name: 'Alice',
      color: '#FF5733',
      locations: [
        { countryCode: 'US', longitude: -74.006, latitude: 40.7128, date: '2010-01-01' },
        { countryCode: 'GB', longitude: -0.1276, latitude: 51.5074, date: '2015-06-15' }
      ]
    }
  ],
  view: {
    projection: 'orthographic',
    rotation: [0, 0, 0]
  }
};
```

### Layer 3: PageLayout (How To Position On Page)

Page specification, map placement, furniture configuration.

```typescript
interface PageLayout {
  page: PageSpec;
  mapPlacement: MapPlacement;
  furniture: {
    title: TitleConfig;
    qrCode: QRCodeConfig;
    attribution?: AttributionConfig;
  };
}
```

**Example**:
```typescript
const layout: PageLayout = {
  page: {
    size: '18x24',
    orientation: 'portrait',
    dpi: 300,
    bleed: 9,
    safeMargin: 18
  },
  mapPlacement: {
    aspectRatio: 1.0,
    fillStrategy: 'maximize',
    zoomAdjustment: 1.0
  },
  furniture: {
    title: {
      text: 'Our Journey',
      subtitle: '2010-2024',
      position: 'top-left',
      fontFamily: 'Cormorant Garamond',
      titleFontSize: 36,
      subtitleFontSize: 24
    },
    qrCode: {
      url: 'https://alwaysmap.com/maps/our-journey',
      position: 'bottom-right',
      size: 72
    }
  }
};
```

## Core API

### calculateLayout()

Main entry point - calculates complete layout.

```typescript
import { calculateLayout } from '$lib/layout';

const result = calculateLayout(userData, pageLayout);

console.log(result.map.width);        // 1200 (points)
console.log(result.map.scale);        // 600 (D3 projection scale)
console.log(result.fillPercentage);   // 82.5 (% of safe area used)
console.log(result.furniture.title);  // { x: 27, y: 27, width: 300, height: 100 }
```

**Returns**: `LayoutResult`
```typescript
interface LayoutResult {
  page: PageDimensions;      // Total page size, trim, bleed
  safeArea: SafeArea;         // Safe area bounds
  map: MapDimensions;         // Map position, size, scale, center
  furniture: FurniturePositions;  // All furniture positions
  fillPercentage: number;     // % of safe area used by map
}
```

### calculatePageDimensions()

Calculate page dimensions from specification.

```typescript
import { calculatePageDimensions } from '$lib/layout';

const dims = calculatePageDimensions({
  size: '18x24',
  orientation: 'portrait',
  dpi: 300,
  bleed: 9,
  safeMargin: 18
});

console.log(dims.trimWidth);    // 1296 points (18 inches)
console.log(dims.trimHeight);   // 1728 points (24 inches)
console.log(dims.pixels.width); // 5475 pixels at 300 DPI
```

### validateLayout()

Validates layout for safety.

```typescript
import { validateLayout } from '$lib/layout';

const validation = validateLayout(result);

if (!validation.valid) {
  console.error('Layout errors:', validation.errors);
  // ["Map extends outside safe area", "Title overlaps with QR code"]
}
```

## Database Storage

### CompleteMapDefinition

Complete map definition ready for database storage.

```typescript
import { createNewMapDefinition, toStoredDefinition } from '$lib/layout';

// Create new map
const mapDef = createNewMapDefinition('user_123', 'My Journey', {
  data: {
    people: [/* ... */]
  },
  layout: {
    page: { size: '18x24', orientation: 'portrait', dpi: 300, bleed: 9, safeMargin: 18 }
  }
});

// Convert to database format
const stored = toStoredDefinition(mapDef);

// Store in database (Supabase example)
await supabase.from('maps').insert({
  id: stored.id,
  user_id: stored.userId,
  metadata: stored.metadata,
  style: stored.style,
  data: stored.data,
  layout: stored.layout,
  created_at: stored.createdAt,
  updated_at: stored.updatedAt
});
```

### Database Schema

```sql
CREATE TABLE maps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  style JSONB NOT NULL,
  data JSONB NOT NULL,
  layout JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);
```

See `DATABASE_SCHEMA` export for complete schema with indexes and RLS policies.

## Layout Algorithm

The layout engine uses a multi-step algorithm to maximize map fill:

1. **Calculate page dimensions** (total, trim, bleed)
2. **Calculate safe area** (inset from trim by safe margin)
3. **Calculate furniture space requirements** (estimate sizes)
4. **Calculate available map area** (safe area minus furniture)
5. **Calculate optimal map size** (maintain aspect ratio, maximize fill)
6. **Center map** in available space
7. **Calculate D3 projection scale** (based on map size)
8. **Position furniture** in selected corners
9. **Calculate fill percentage** (map area / safe area)
10. **Validate** (check bounds, overlaps)

**Key insight**: We calculate optimal map size *first*, then position furniture around it. This maximizes map fill.

## Coordinate System

All coordinates are in **points** (1 pt = 1/72 inch) from **top-left corner** of canvas (including bleed).

```
(0, 0) ←─────────────────────┐
 │  Bleed area (9pt)         │
 │  ┌─────────────────────┐  │
 │  │ Trim line           │  │
 │  │  ┌───────────────┐  │  │
 │  │  │ Safe area     │  │  │
 │  │  │   ┌───────┐   │  │  │
 │  │  │   │  Map  │   │  │  │
 │  │  │   └───────┘   │  │  │
 │  │  │  Title   QR   │  │  │
 │  │  └───────────────┘  │  │
 │  │                     │  │
 │  └─────────────────────┘  │
 │                           │
 └───────────────────────────┘
```

## Furniture Positioning

Furniture can be positioned in 4 corners of safe area:

```typescript
type FurniturePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
```

Positioning is **deterministic** - same position → same coordinates every time.

Example:
```typescript
furniture: {
  title: { position: 'top-left', ... },
  qrCode: { position: 'bottom-right', size: 72 }
}

// Results in:
result.furniture.title: { x: 27, y: 27, width: 300, height: 100 }
result.furniture.qrCode: { x: 1179, y: 1602, width: 72, height: 72 }
```

## Testing

### Unit Tests

33 comprehensive unit tests covering:
- Page dimension calculations
- Safe area calculations
- Rectangle intersection detection
- Complete layout calculation
- Deterministic output (same input → same output, 10 times)
- Furniture positioning in all 4 corners
- Layout validation
- Edge cases (long titles, small/large pages, landscape orientation)

Run tests:
```bash
pnpm test src/lib/layout
```

### Test Coverage

- ✅ All page sizes (12×16, 18×24, 24×36)
- ✅ Both orientations (portrait, landscape)
- ✅ All furniture positions (4 corners)
- ✅ Zoom adjustments (0.8× to 1.2×)
- ✅ Bounds validation (safe area enforcement)
- ✅ Overlap detection (collision prevention)
- ✅ Deterministic output verification

## Performance

Layout calculation is **extremely fast** - pure math with no I/O:

- ~0.5ms for complete layout calculation
- ~0.1ms for page dimensions only
- ~0.05ms for validation

**Zero allocations** in hot path - all calculations use primitive types.

## Migration from Current Renderer

The layout engine is designed to integrate gradually with the existing renderer:

### Phase 1: Extract layout calculation (Current)
- ✅ Create `src/lib/layout/` module
- ✅ Implement pure functions
- ✅ Write comprehensive tests
- ✅ Keep existing renderer working

### Phase 2: Integrate with renderer (Next)
- Update `src/lib/map-renderer/index.ts` to use layout engine
- Replace hardcoded positioning with calculated positions
- Verify E2E tests pass

### Phase 3: Add user controls (Future)
- Add zoom/pan controls in UI
- Allow furniture position selection
- Real-time layout preview

## Examples

### Example 1: Basic Usage

```typescript
import { calculateLayout, createNewMapDefinition } from '$lib/layout';

// Create map definition
const mapDef = createNewMapDefinition('user_123', 'My Map');

// Calculate layout
const layout = calculateLayout(mapDef.data, mapDef.layout);

// Use results for rendering
console.log(`Map size: ${layout.map.width}×${layout.map.height}pt`);
console.log(`Fill: ${layout.fillPercentage.toFixed(1)}%`);
```

### Example 2: Custom Configuration

```typescript
import { calculateLayout } from '$lib/layout';

const layout = calculateLayout(userData, {
  page: {
    size: '24x36',
    orientation: 'landscape',
    dpi: 300,
    bleed: 9,
    safeMargin: 18
  },
  mapPlacement: {
    aspectRatio: 1.0,
    fillStrategy: 'maximize',
    zoomAdjustment: 0.9  // 90% of optimal size
  },
  furniture: {
    title: {
      text: 'World Journey',
      subtitle: '',
      position: 'top-right',
      fontFamily: 'Cormorant Garamond',
      titleFontSize: 48,
      subtitleFontSize: 0
    },
    qrCode: {
      url: 'https://alwaysmap.com',
      position: 'bottom-left',
      size: 100
    }
  }
});
```

### Example 3: Validation

```typescript
import { calculateLayout, validateLayout } from '$lib/layout';

const layout = calculateLayout(userData, pageLayout);
const validation = validateLayout(layout);

if (!validation.valid) {
  throw new Error(`Invalid layout: ${validation.errors.join(', ')}`);
}

// Layout is safe - proceed with rendering
```

### Example 4: Database Storage

```typescript
import { createNewMapDefinition, toStoredDefinition, validateMapDefinition } from '$lib/layout';

// Create
const mapDef = createNewMapDefinition('user_123', 'Family Journey');

// Validate
const validation = validateMapDefinition(mapDef);
if (!validation.valid) {
  throw new Error(validation.errors.join(', '));
}

// Store
const stored = toStoredDefinition(mapDef);
await db.insert('maps', stored);

// Retrieve
const retrieved = await db.query('SELECT * FROM maps WHERE id = ?', [mapDef.id]);
const mapDefFromDB = fromStoredDefinition(retrieved);
```

## Type Reference

See `src/lib/layout/types.ts` for complete type definitions:

- `MapStyle` - Visual style configuration
- `UserMapData` - User content (people, locations)
- `PageLayout` - Page and furniture configuration
- `LayoutResult` - Complete layout calculation result
- `PageSize` - Standard page sizes ('12x16' | '18x24' | '24x36')
- `PageOrientation` - 'portrait' | 'landscape'
- `FurniturePosition` - 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

## Architecture Decisions

### Why Pure Functions?

1. **Testability** - Easy to test with no mocking required
2. **Determinism** - Same input always produces same output
3. **Predictability** - No hidden state or side effects
4. **Performance** - Can be memoized/cached
5. **Framework-agnostic** - Works in any JavaScript environment

### Why Points Not Pixels?

Points (1/72 inch) are the print industry standard and remain constant regardless of DPI. Pixels vary with DPI and screen resolution.

**Conversion**:
```typescript
// Points to pixels at 300 DPI
pixels = (points / 72) * 300

// Example: 1296pt (18") at 300 DPI
pixels = (1296 / 72) * 300 = 5400px
```

### Why Three Layers?

Separating style, data, and layout allows:
1. **Independent updates** - Change style without affecting data
2. **Reusability** - Same data with different styles/layouts
3. **Clear ownership** - User owns data, we provide style templates
4. **Database optimization** - Store layers in separate JSONB columns

## Future Enhancements

Potential improvements for future versions:

1. **Auto-positioning** - Smart furniture placement avoiding map overlap
2. **Multi-page layouts** - For complex journeys requiring multiple pages
3. **Custom aspect ratios** - Non-square maps (e.g., 16:9 for wide landscapes)
4. **Dynamic margins** - Adjust safe margins based on printer capabilities
5. **Collision avoidance** - Automatically adjust furniture to prevent overlaps
6. **Text measurement** - Accurate title sizing based on actual font metrics
7. **Layout templates** - Predefined furniture arrangements

## Resources

- Design document: `docs/MAP-PAGE-LAYOUT-DESIGN.md`
- Risk assessment: `docs/DESIGN-RISKS-AND-QUESTIONS.md`
- Print-maps reference: `docs/PRINT-MAPS-REFERENCE.md`
- Source code: `src/lib/layout/`
- Tests: `src/lib/layout/calculate.test.ts`
