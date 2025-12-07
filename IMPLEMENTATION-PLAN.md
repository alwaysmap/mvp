# AlwaysMap POC Implementation Plan

## Executive Summary

This plan implements the AlwaysMap proof-of-concept based on the detailed specification in `allwaysmap-poc.md`, adapted for the technology stack defined in `CLAUDE.md`:

**Key Technology Adaptations:**
- **Frontend:** SvelteKit 5 (instead of React) with D3.js
- **Backend:** Node.js + TypeScript for API and worker processes
- **Testing:** Playwright for E2E, Vitest for unit/integration tests
- **Infrastructure:** Docker + Docker Compose for dev/test/deploy

**Core Requirements Maintained:**
- 300 DPI PNG output with sRGB color profile
- Exact font fidelity between browser preview and print output
- Non-map SVG elements: title/subtitle box and QR code (https://alwaysmap.com)
- Printful API integration for fulfillment
- Full bleed and safe area handling per Printful specs

---

## Implementation Phases

### Phase 0: Project Bootstrap (Days 1-2)

**Goal:** Set up a working SvelteKit 5 project with all tooling configured.

#### Tasks:
1. Initialize SvelteKit 5 project with TypeScript
2. Configure PNPM workspace
3. Set up Docker development environment
4. Configure Vitest for unit testing
5. Configure Playwright for E2E testing
6. Download and verify required fonts (Cormorant Garamond, DM Sans)
7. Download geographic data (world-atlas TopoJSON)
8. Download sRGB ICC profile

#### Success Criteria:
- `pnpm dev` runs SvelteKit dev server
- `pnpm test` runs Vitest tests
- `pnpm test:e2e` runs Playwright tests
- Docker Compose brings up all services
- All fonts accessible in `static/fonts/`
- Geographic data in `static/data/`

#### File Structure:
```
awm-prototype/
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.worker
├── package.json
├── pnpm-workspace.yaml
├── svelte.config.js
├── vite.config.ts
├── playwright.config.ts
├── static/
│   ├── fonts/
│   │   ├── CormorantGaramond-Regular.ttf
│   │   ├── CormorantGaramond-SemiBold.ttf
│   │   ├── CormorantGaramond-Bold.ttf
│   │   ├── CormorantGaramond-Italic.ttf
│   │   ├── DMSans-Regular.ttf
│   │   ├── DMSans-Medium.ttf
│   │   └── DMSans-SemiBold.ttf
│   └── data/
│       ├── countries-110m.json
│       └── land-110m.json
├── profiles/
│   └── sRGB2014.icc
└── src/
    ├── routes/
    ├── lib/
    └── app.css
```

---

### Phase 1: D3 Map Renderer Core (Days 3-5)

**Goal:** Framework-agnostic D3 rendering function with correct dimensions and font loading.

#### Key Architectural Decision

Following the POC spec, we'll create a **pure TypeScript rendering function** that works identically in both browser (SvelteKit) and server (Puppeteer):

```typescript
// src/lib/map-renderer/index.ts
export function renderMap(
  svgElement: SVGSVGElement,
  definition: MapDefinition,
  geoData: GeoJSON.FeatureCollection,
  dimensions: PrintDimensions
): void;
```

This function:
- Takes a real DOM SVG element (works in both browser and headless Chrome)
- Is deterministic (same inputs = same output)
- Has no framework dependencies
- Uses D3 for all rendering

#### SvelteKit 5 Integration Pattern

Based on research, we'll use Svelte 5 runes for reactive integration:

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { renderMap } from '$lib/map-renderer';
  import type { MapDefinition } from '$lib/map-renderer/types';

  let svgElement: SVGSVGElement;
  let definition = $state<MapDefinition>({
    width: 18,
    height: 24,
    style: 'vintage',
    // ... rest of definition
  });

  // Computed dimensions using $derived
  let dimensions = $derived(
    calculateDimensions({
      width: definition.width,
      height: definition.height
    })
  );

  // Re-render when definition changes using $effect
  $effect(() => {
    if (svgElement && geoData) {
      renderMap(svgElement, definition, geoData, dimensions);
    }
  });

  onMount(async () => {
    // Load geo data
    const response = await fetch('/data/countries-110m.json');
    geoData = await response.json();
  });
</script>

<svg bind:this={svgElement}
     width={dimensions.pixelWidth}
     height={dimensions.pixelHeight}
     viewBox="0 0 {dimensions.viewBoxWidth} {dimensions.viewBoxHeight}">
</svg>
```

#### Tasks:

1. **Create Type Definitions** (`src/lib/map-renderer/types.ts`)
   - `MapDefinition` interface (per POC Appendix A)
   - `PrintDimensions` interface
   - `Location`, `ProjectionConfig` types

2. **Implement Dimension Calculator** (`src/lib/map-renderer/dimensions.ts`)
   - `calculateDimensions()` function
   - Bleed area (0.125" per side)
   - Safe area (0.25" from trim)
   - Conversion to pixels at 300 DPI
   - Conversion to points for SVG viewBox

3. **Create Font Loading System** (`src/lib/map-renderer/fonts.ts`)
   - CSS file with @font-face declarations (local TTF files)
   - `waitForFonts()` async function using `document.fonts.ready`
   - Font verification function

4. **Implement Map Renderer** (`src/lib/map-renderer/index.ts`)
   - `renderMap()` main function
   - Layer rendering (background, graticule, countries, paths, labels)
   - Respect safe area for text placement
   - Use points-based coordinate system

5. **Add Non-Map SVG Elements** (`src/lib/map-renderer/overlays.ts`)
   - Title/subtitle box rendering (D3 text + rect for background)
   - QR code generation and positioning (use library like `qrcode` to generate SVG)
   - Position both elements within safe area
   - QR code links to https://alwaysmap.com
   - **Critical:** These are rendered by same D3 code, ensuring browser/Puppeteer match

6. **Add Projection System** (`src/lib/map-renderer/projections.ts`)
   - D3 projection setup (Natural Earth, Orthographic, Mercator)
   - Serializable projection state (no "auto" values)

7. **Create Style Definitions** (`src/lib/map-renderer/styles.ts`)
   - Vintage color palette
   - Modern color palette
   - Typography settings

8. **Build Preview Component** (`src/routes/+page.svelte`)
   - Interactive map preview at 72 DPI
   - Uses same `renderMap()` function
   - Svelte 5 $state/$derived/$effect for reactivity
   - QR code and title box visible in preview

#### Testing Strategy:

```typescript
// tests/unit/dimensions.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDimensions } from '$lib/map-renderer/dimensions';

describe('calculateDimensions', () => {
  it('calculates correct pixel dimensions for 18x24 poster', () => {
    const dims = calculateDimensions({ width: 18, height: 24 });
    expect(dims.pixelWidth).toBe(5475); // 18.25" × 300 DPI
    expect(dims.pixelHeight).toBe(7275); // 24.25" × 300 DPI
  });

  it('calculates safe area correctly', () => {
    const dims = calculateDimensions({ width: 18, height: 24 });
    // Safe area starts at bleed (0.125") + margin (0.25") = 0.375" = 27 points
    expect(dims.safeArea.x).toBe(27);
    expect(dims.safeArea.y).toBe(27);
  });
});
```

```typescript
// tests/e2e/map-preview.test.ts
import { test, expect } from '@playwright/test';

test('map preview renders with correct fonts', async ({ page }) => {
  await page.goto('/');

  // Wait for fonts to load
  await page.waitForFunction(() => document.fonts.ready);

  // Check font is loaded
  const fontLoaded = await page.evaluate(() => {
    return document.fonts.check('600 16px "Cormorant Garamond"');
  });
  expect(fontLoaded).toBe(true);

  // Verify SVG exists with correct dimensions
  const svg = await page.locator('svg[data-map]');
  await expect(svg).toBeVisible();

  // Verify non-map elements are present
  const titleElement = await page.locator('svg text:has-text("The Kowalski Family")');
  await expect(titleElement).toBeVisible();

  // Verify QR code exists (check for path elements typical of QR codes)
  const qrCode = await page.locator('svg g[data-qr-code]');
  await expect(qrCode).toBeVisible();
});
```

#### Success Criteria:
- Browser renders map with land, countries, graticule
- Title/subtitle box renders in safe area with correct fonts
- QR code (https://alwaysmap.com) renders in corner within safe area
- Fonts load from local TTF files (verified in test)
- SVG has correct viewBox dimensions
- Background extends to canvas edge (bleed)
- Non-map elements (title, QR) positioned inside safe area
- Vitest tests pass for dimension calculations
- Playwright test verifies font loading and non-map element presence

---

### Phase 2: Data Architecture & Two-Route Workflow (Days 6-10)

**Goal:** Separate map data editing from print configuration with persistent storage.

#### Architectural Overview

The system now separates concerns into two distinct routes and data models:

```
User Flow:
1. /edit      → Create/edit migration map data
2. /publish   → Configure print settings for a saved map

Data Models:
┌─────────────────────┐
│   MigrationMap      │  ← Standalone, reusable
│  ----------------   │
│  - id               │
│  - title            │
│  - subtitle         │
│  - people[]         │
│  - projection       │
│  - rotation         │
│  - zoom             │
│  - createdAt        │
│  - updatedAt        │
└─────────────────────┘
         ▲
         │ references (foreign key)
         │
┌─────────────────────┐
│ PrintConfiguration  │  ← Print-specific settings
│  ----------------   │
│  - id               │
│  - migrationMapId   │  ← FK to MigrationMap
│  - pageSize         │
│  - orientation      │
│  - style            │
│  - showBoundary     │
│  - createdAt        │
└─────────────────────┘
```

#### Key Design Principles

1. **Separation of Concerns:**
   - MigrationMap: Geographic data, locations, projection settings
   - PrintConfiguration: Page layout, size, orientation, style

2. **Reusability:**
   - One MigrationMap can have multiple PrintConfigurations
   - Enables future "view online only" without print
   - Users can print same map at different sizes/orientations

3. **Data Integrity:**
   - PrintConfiguration MUST reference a MigrationMap (foreign key)
   - Cannot have orphaned print configs
   - MigrationMap can exist independently

#### Tasks:

##### 1. Database Schema Design (`src/lib/db/schema.ts`)

**Simplified Schema - JSONB for Flexibility:**

Following the principle of iteration speed, we store most data as JSONB. Only the 1:M relationship is explicitly modeled.

**UserMap Table:**
```typescript
export interface UserMap {
  id: string;                    // UUID primary key
  data: {
    // Map content
    title: string;
    subtitle: string;
    people: Person[];

    // View state
    projection: ProjectionType;
    rotation: [number, number, number];
    zoom: number;
    pan: [number, number];
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// These types define the structure within the JSONB data field
export interface Person {
  id: string;
  name: string;
  color?: string;
  locations: Location[];
}

export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'birth' | 'transit' | 'arrival' | 'death';
  date?: string;
}
```

**PrintableMap Table:**
```typescript
export interface PrintableMap {
  id: string;                    // UUID primary key
  userMapId: string;             // FK to user_maps.id (1:M relationship)
  data: {
    // Print settings
    pageSize: PageSize;
    orientation: 'portrait' | 'landscape';
    style: 'vintage' | 'modern';
    showBoundary: boolean;
  };

  // Metadata
  createdAt: Date;
}
```

**SQL Schema (PostgreSQL):**
```sql
-- User Maps table (core map data)
CREATE TABLE user_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Everything stored as JSONB for iteration flexibility
  data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create GIN index for JSONB queries (e.g., searching by title)
CREATE INDEX idx_user_maps_data ON user_maps USING GIN (data);

-- Printable Maps table (1:M with user_maps)
CREATE TABLE printable_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_map_id UUID NOT NULL REFERENCES user_maps(id) ON DELETE CASCADE,

  -- Print config as JSONB
  data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Index for lookups by user_map_id
  INDEX idx_printable_maps_user_map (user_map_id)
);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_maps_updated_at
  BEFORE UPDATE ON user_maps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

**Example Queries:**

```sql
-- Find maps by title (using JSONB query)
SELECT * FROM user_maps
WHERE data->>'title' ILIKE '%family%';

-- Get all printable maps for a user map
SELECT pm.* FROM printable_maps pm
WHERE pm.user_map_id = 'some-uuid';

-- Get printable map with its user map
SELECT
  um.data as map_data,
  pm.data as print_data
FROM printable_maps pm
JOIN user_maps um ON um.id = pm.user_map_id
WHERE pm.id = 'some-uuid';
```

##### 2. Database Client Setup (`src/lib/db/client.ts`)

Using PostgreSQL with `pg` driver (boring, reliable choice):

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
};
```

##### 3. Repository Layer (`src/lib/db/repositories/`)

**UserMap Repository** (`user-maps.ts`):
```typescript
import type { UserMap } from '../schema';
import { db } from '../client';

export const userMapRepository = {
  async create(data: UserMap['data']): Promise<UserMap> {
    const result = await db.query(
      `INSERT INTO user_maps (data)
       VALUES ($1)
       RETURNING id, data, created_at as "createdAt", updated_at as "updatedAt"`,
      [JSON.stringify(data)]
    );
    return result.rows[0];
  },

  async findById(id: string): Promise<UserMap | null> {
    const result = await db.query(
      `SELECT id, data, created_at as "createdAt", updated_at as "updatedAt"
       FROM user_maps WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async update(id: string, data: UserMap['data']): Promise<UserMap> {
    const result = await db.query(
      `UPDATE user_maps SET data = $2 WHERE id = $1
       RETURNING id, data, created_at as "createdAt", updated_at as "updatedAt"`,
      [id, JSON.stringify(data)]
    );
    return result.rows[0];
  },

  async delete(id: string): Promise<void> {
    await db.query('DELETE FROM user_maps WHERE id = $1', [id]);
  },

  async list(): Promise<UserMap[]> {
    const result = await db.query(
      `SELECT id, data, created_at as "createdAt", updated_at as "updatedAt"
       FROM user_maps ORDER BY updated_at DESC`
    );
    return result.rows;
  },

  // JSONB query example - search by title
  async searchByTitle(query: string): Promise<UserMap[]> {
    const result = await db.query(
      `SELECT id, data, created_at as "createdAt", updated_at as "updatedAt"
       FROM user_maps
       WHERE data->>'title' ILIKE $1
       ORDER BY updated_at DESC`,
      [`%${query}%`]
    );
    return result.rows;
  }
};
```

**PrintableMap Repository** (`printable-maps.ts`):
```typescript
import type { PrintableMap } from '../schema';
import { db } from '../client';

export const printableMapRepository = {
  async create(userMapId: string, data: PrintableMap['data']): Promise<PrintableMap> {
    const result = await db.query(
      `INSERT INTO printable_maps (user_map_id, data)
       VALUES ($1, $2)
       RETURNING id, user_map_id as "userMapId", data, created_at as "createdAt"`,
      [userMapId, JSON.stringify(data)]
    );
    return result.rows[0];
  },

  async findById(id: string): Promise<PrintableMap | null> {
    const result = await db.query(
      `SELECT id, user_map_id as "userMapId", data, created_at as "createdAt"
       FROM printable_maps WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async findByUserMapId(userMapId: string): Promise<PrintableMap[]> {
    const result = await db.query(
      `SELECT id, user_map_id as "userMapId", data, created_at as "createdAt"
       FROM printable_maps
       WHERE user_map_id = $1
       ORDER BY created_at DESC`,
      [userMapId]
    );
    return result.rows;
  },

  async update(id: string, data: PrintableMap['data']): Promise<PrintableMap> {
    const result = await db.query(
      `UPDATE printable_maps SET data = $2 WHERE id = $1
       RETURNING id, user_map_id as "userMapId", data, created_at as "createdAt"`,
      [id, JSON.stringify(data)]
    );
    return result.rows[0];
  },

  async delete(id: string): Promise<void> {
    await db.query('DELETE FROM printable_maps WHERE id = $1', [id]);
  },

  // Helper to get printable map with its user map in one query
  async findWithUserMap(id: string): Promise<{ printableMap: PrintableMap; userMap: UserMap } | null> {
    const result = await db.query(
      `SELECT
         pm.id as pm_id,
         pm.user_map_id,
         pm.data as pm_data,
         pm.created_at as pm_created_at,
         um.id as um_id,
         um.data as um_data,
         um.created_at as um_created_at,
         um.updated_at as um_updated_at
       FROM printable_maps pm
       JOIN user_maps um ON um.id = pm.user_map_id
       WHERE pm.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      printableMap: {
        id: row.pm_id,
        userMapId: row.user_map_id,
        data: row.pm_data,
        createdAt: row.pm_created_at
      },
      userMap: {
        id: row.um_id,
        data: row.um_data,
        createdAt: row.um_created_at,
        updatedAt: row.um_updated_at
      }
    };
  }
};
```

##### 4. Create Simplified MVP Routes

**MVP Priority:** Focus on end-to-end export pipeline with preconfigured data, not full CRUD UI.

**Edit Route** (`src/routes/edit/+page.svelte`) - **Simplified for MVP:**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import MapCanvas from '$lib/components/MapCanvas.svelte';
  import ProjectionSwitcher from '$lib/components/ProjectionSwitcher.svelte';
  import ZoomControls from '$lib/components/ZoomControls.svelte';
  import RotationControls from '$lib/components/RotationControls.svelte';
  import PanControls from '$lib/components/PanControls.svelte';
  import PeopleEditor from '$lib/components/PeopleEditor.svelte';
  import { createMapEditorStore } from '$lib/stores/map-editor.svelte';

  // Extract map ID from query params (for editing existing map)
  const mapId = $page.url.searchParams.get('id');

  const store = createMapEditorStore();
  let saving = $state(false);
  let saveError = $state<string | null>(null);

  onMount(async () => {
    if (mapId) {
      // Load existing map
      const response = await fetch(`/api/maps/${mapId}`);
      if (response.ok) {
        const map = await response.json();
        store.loadState({
          title: map.title,
          subtitle: map.subtitle,
          people: map.people,
          view: {
            projection: map.projection,
            rotation: map.rotation,
            zoom: map.zoom,
            pan: map.pan
          }
        });
      }
    }
  });

  async function handleSave() {
    saving = true;
    saveError = null;

    try {
      const state = store.exportState();

      const response = await fetch(mapId ? `/api/maps/${mapId}` : '/api/maps', {
        method: mapId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: state.title,
          subtitle: state.subtitle,
          people: state.people,
          projection: state.view.projection,
          rotation: state.view.rotation,
          zoom: state.view.zoom,
          pan: state.view.pan
        })
      });

      if (!response.ok) {
        throw new Error('Save failed');
      }

      const result = await response.json();

      // Redirect to publish page with saved map ID
      goto(`/publish?mapId=${result.id}`);
    } catch (err) {
      saveError = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      saving = false;
    }
  }
</script>

<div class="edit-page">
  <header>
    <h1>Edit Migration Map</h1>
    <p class="subtitle">Add locations and people to your map</p>
  </header>

  <div class="editor-layout">
    <!-- Map Canvas -->
    <div class="canvas-container">
      <MapCanvas {store} width={1200} height={800} interactive={true} />
    </div>

    <!-- Control Panel -->
    <aside class="control-panel">
      <div class="panel-section">
        <h3>Map Details</h3>
        <label>
          Title
          <input
            type="text"
            value={store.state.title}
            oninput={(e) => store.setTitle(e.currentTarget.value)}
          />
        </label>
        <label>
          Subtitle
          <input
            type="text"
            value={store.state.subtitle}
            oninput={(e) => store.setSubtitle(e.currentTarget.value)}
          />
        </label>
      </div>

      <div class="panel-section">
        <PeopleEditor {store} />
      </div>

      <div class="panel-section">
        <ProjectionSwitcher {store} />
      </div>

      <div class="panel-section">
        <ZoomControls {store} />
      </div>

      {#if store.state.view.projection === 'orthographic'}
        <div class="panel-section">
          <RotationControls {store} />
        </div>
      {:else}
        <div class="panel-section">
          <PanControls {store} />
        </div>
      {/if}

      <div class="panel-section">
        <button class="save-button" onclick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save & Continue to Print Setup'}
        </button>

        {#if saveError}
          <p class="error">{saveError}</p>
        {/if}
      </div>
    </aside>
  </div>
</div>

<style>
  .edit-page {
    min-height: 100vh;
    background: #fafafa;
  }

  header {
    padding: 2rem;
    background: white;
    border-bottom: 1px solid #e0e0e0;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 600;
  }

  .subtitle {
    margin: 0.5rem 0 0;
    color: #666;
  }

  .editor-layout {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: 1rem;
    padding: 1rem;
    height: calc(100vh - 120px);
  }

  .canvas-container {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    overflow: auto;
  }

  .control-panel {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    overflow-y: auto;
  }

  .panel-section {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .panel-section:last-child {
    border-bottom: none;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #555;
  }

  input[type="text"] {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .save-button {
    width: 100%;
    padding: 0.75rem;
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }

  .save-button:hover:not(:disabled) {
    background: #357abd;
  }

  .save-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error {
    margin-top: 0.5rem;
    color: #d32f2f;
    font-size: 0.875rem;
  }
</style>
```

##### 5. Create Publish Route (`src/routes/publish/+page.svelte`)

**Purpose:** Print configuration - page size, orientation, style

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import MapCanvas from '$lib/components/MapCanvas.svelte';
  import PageSizeSelector from '$lib/components/PageSizeSelector.svelte';
  import { createMapEditorStore } from '$lib/stores/map-editor.svelte';
  import type { MigrationMap } from '$lib/db/schema';

  const mapId = $page.url.searchParams.get('mapId');

  const store = createMapEditorStore();
  let migrationMap = $state<MigrationMap | null>(null);
  let loading = $state(true);
  let exporting = $state(false);
  let exportError = $state<string | null>(null);

  onMount(async () => {
    if (!mapId) {
      window.location.href = '/edit';
      return;
    }

    // Load migration map
    const response = await fetch(`/api/maps/${mapId}`);
    if (response.ok) {
      migrationMap = await response.json();

      // Load map data into store (readonly view state)
      store.loadState({
        title: migrationMap.title,
        subtitle: migrationMap.subtitle,
        people: migrationMap.people,
        view: {
          projection: migrationMap.projection,
          rotation: migrationMap.rotation,
          zoom: migrationMap.zoom,
          pan: migrationMap.pan
        }
      });
    }

    loading = false;
  });

  async function handleExport() {
    if (!migrationMap) return;

    exporting = true;
    exportError = null;

    try {
      // Save print configuration
      const printConfigResponse = await fetch('/api/print-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          migrationMapId: migrationMap.id,
          pageSize: store.state.page.size,
          orientation: store.state.page.size.includes('landscape') ? 'landscape' : 'portrait',
          style: 'vintage', // TODO: make configurable
          showBoundary: store.state.page.showBoundary
        })
      });

      if (!printConfigResponse.ok) {
        throw new Error('Failed to save print configuration');
      }

      const printConfig = await printConfigResponse.json();

      // Trigger export job
      const exportResponse = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printConfigId: printConfig.id
        })
      });

      if (!exportResponse.ok) {
        throw new Error('Export failed');
      }

      const blob = await exportResponse.blob();
      const url = URL.createObjectURL(blob);

      // Download PNG
      const a = document.createElement('a');
      a.href = url;
      a.download = `${migrationMap.title.replace(/\s+/g, '-')}.png`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      exportError = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      exporting = false;
    }
  }
</script>

{#if loading}
  <div class="loading">Loading map...</div>
{:else if !migrationMap}
  <div class="error-page">
    <h1>Map not found</h1>
    <a href="/edit">Create a new map</a>
  </div>
{:else}
  <div class="publish-page">
    <header>
      <h1>Configure Print Settings</h1>
      <p class="subtitle">{migrationMap.title}</p>
    </header>

    <div class="publish-layout">
      <!-- Print Preview -->
      <div class="preview-container">
        <MapCanvas {store} width={1200} height={800} interactive={false} />
      </div>

      <!-- Print Settings Panel -->
      <aside class="settings-panel">
        <div class="panel-section">
          <PageSizeSelector {store} />
        </div>

        <div class="panel-section">
          <h3>Export</h3>
          <button class="export-button" onclick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export for Print (300 DPI PNG)'}
          </button>

          {#if exportError}
            <p class="error">{exportError}</p>
          {/if}
        </div>

        <div class="panel-section">
          <h3>Map Details</h3>
          <dl>
            <dt>Title:</dt>
            <dd>{migrationMap.title}</dd>
            <dt>Subtitle:</dt>
            <dd>{migrationMap.subtitle}</dd>
            <dt>Projection:</dt>
            <dd>{migrationMap.projection}</dd>
            <dt>People:</dt>
            <dd>{migrationMap.people.length}</dd>
          </dl>
          <a href="/edit?id={migrationMap.id}" class="edit-link">Edit Map Data</a>
        </div>
      </aside>
    </div>
  </div>
{/if}

<style>
  /* Similar styling to edit page */
  .publish-page {
    min-height: 100vh;
    background: #fafafa;
  }

  header {
    padding: 2rem;
    background: white;
    border-bottom: 1px solid #e0e0e0;
  }

  .publish-layout {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: 1rem;
    padding: 1rem;
    height: calc(100vh - 120px);
  }

  .preview-container {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    overflow: auto;
  }

  .settings-panel {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    overflow-y: auto;
  }

  .export-button {
    width: 100%;
    padding: 1rem;
    background: #2e7d32;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }

  .export-button:hover:not(:disabled) {
    background: #1b5e20;
  }

  .export-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  dl {
    margin: 0;
    font-size: 0.875rem;
  }

  dt {
    font-weight: 600;
    margin-top: 0.5rem;
  }

  dd {
    margin: 0.25rem 0 0 0;
    color: #666;
  }

  .edit-link {
    display: inline-block;
    margin-top: 1rem;
    color: #4a90e2;
    text-decoration: none;
    font-size: 0.875rem;
  }

  .edit-link:hover {
    text-decoration: underline;
  }
</style>
```

##### 6. API Routes

**Migration Maps API** (`src/routes/api/maps/+server.ts`):
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { migrationMapRepository } from '$lib/db/repositories/migration-maps';

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();

  const map = await migrationMapRepository.create({
    userId: 'temp-user-id', // TODO: Get from auth session
    title: data.title,
    subtitle: data.subtitle,
    people: data.people,
    projection: data.projection,
    rotation: data.rotation,
    zoom: data.zoom,
    pan: data.pan
  });

  return json(map, { status: 201 });
};

export const GET: RequestHandler = async () => {
  // List all maps for user
  const maps = await migrationMapRepository.listByUser('temp-user-id');
  return json(maps);
};
```

**Single Map API** (`src/routes/api/maps/[id]/+server.ts`):
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { migrationMapRepository } from '$lib/db/repositories/migration-maps';

export const GET: RequestHandler = async ({ params }) => {
  const map = await migrationMapRepository.findById(params.id);

  if (!map) {
    return json({ error: 'Not found' }, { status: 404 });
  }

  return json(map);
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const data = await request.json();

  const updated = await migrationMapRepository.update(params.id, {
    title: data.title,
    subtitle: data.subtitle,
    people: data.people,
    projection: data.projection,
    rotation: data.rotation,
    zoom: data.zoom,
    pan: data.pan
  });

  return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
  await migrationMapRepository.delete(params.id);
  return json({ success: true });
};
```

**Print Configurations API** (`src/routes/api/print-configs/+server.ts`):
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { printConfigRepository } from '$lib/db/repositories/print-configurations';

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();

  const config = await printConfigRepository.create({
    migrationMapId: data.migrationMapId,
    pageSize: data.pageSize,
    orientation: data.orientation,
    style: data.style,
    showBoundary: data.showBoundary
  });

  return json(config, { status: 201 });
};
```

##### 7. Update Export Pipeline

**Modified Export API** (`src/routes/api/export/+server.ts`):
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { printConfigRepository } from '$lib/db/repositories/print-configurations';
import { migrationMapRepository } from '$lib/db/repositories/migration-maps';
import { exportForPrintful } from '$lib/export/puppeteer';
import { embedSRGBProfile } from '$lib/export/post-process';
import { validateForPrintful } from '$lib/export/validate';
import type { MapDefinition } from '$lib/map-renderer/types';

export const POST: RequestHandler = async ({ request }) => {
  const { printConfigId } = await request.json();

  // Load print config and migration map
  const printConfig = await printConfigRepository.findById(printConfigId);
  if (!printConfig) {
    return json({ error: 'Print config not found' }, { status: 404 });
  }

  const migrationMap = await migrationMapRepository.findById(printConfig.migrationMapId);
  if (!migrationMap) {
    return json({ error: 'Migration map not found' }, { status: 404 });
  }

  // Build MapDefinition from both models
  const mapDefinition: MapDefinition = {
    width: parsePageSize(printConfig.pageSize).width,
    height: parsePageSize(printConfig.pageSize).height,
    style: printConfig.style,
    title: migrationMap.title,
    subtitle: migrationMap.subtitle,
    people: migrationMap.people,
    projection: {
      type: migrationMap.projection,
      rotation: migrationMap.rotation,
      zoom: migrationMap.zoom,
      pan: migrationMap.pan
    }
  };

  // Export pipeline
  const screenshot = await exportForPrintful(mapDefinition);
  const processed = await embedSRGBProfile(screenshot);
  await validateForPrintful(processed, mapDefinition);

  return new Response(processed, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${migrationMap.title}.png"`
    }
  });
};

function parsePageSize(size: string): { width: number; height: number } {
  // Parse "18x24" or "18x24-landscape"
  const [dimensions] = size.split('-');
  const [w, h] = dimensions.split('x').map(Number);
  const isLandscape = size.includes('landscape');

  return isLandscape ? { width: h, height: w } : { width: w, height: h };
}
```

##### 8. People Editor Component (`src/lib/components/PeopleEditor.svelte`)

```svelte
<script lang="ts">
  import type { MapEditorStore } from '$lib/stores/map-editor.svelte';
  import type { Person, Location } from '$lib/db/schema';

  interface Props {
    store: MapEditorStore;
  }

  let { store }: Props = $props();

  function addPerson() {
    const newPerson: Person = {
      id: crypto.randomUUID(),
      name: 'New Person',
      locations: []
    };
    store.addPerson(newPerson);
  }

  function addLocation(personId: string) {
    const person = store.state.people.find(p => p.id === personId);
    if (!person) return;

    const newLocation: Location = {
      id: crypto.randomUUID(),
      name: 'New Location',
      latitude: 0,
      longitude: 0,
      type: 'transit'
    };

    store.updatePerson(personId, {
      locations: [...person.locations, newLocation]
    });
  }

  function removePerson(id: string) {
    store.removePerson(id);
  }

  function updatePersonName(id: string, name: string) {
    store.updatePerson(id, { name });
  }

  function updateLocation(personId: string, locationId: string, updates: Partial<Location>) {
    const person = store.state.people.find(p => p.id === personId);
    if (!person) return;

    const updatedLocations = person.locations.map(loc =>
      loc.id === locationId ? { ...loc, ...updates } : loc
    );

    store.updatePerson(personId, { locations: updatedLocations });
  }

  function removeLocation(personId: string, locationId: string) {
    const person = store.state.people.find(p => p.id === personId);
    if (!person) return;

    store.updatePerson(personId, {
      locations: person.locations.filter(loc => loc.id !== locationId)
    });
  }
</script>

<div class="people-editor">
  <h3>People & Locations</h3>

  {#each store.state.people as person (person.id)}
    <div class="person-card">
      <div class="person-header">
        <input
          type="text"
          value={person.name}
          oninput={(e) => updatePersonName(person.id, e.currentTarget.value)}
          class="person-name"
        />
        <button onclick={() => removePerson(person.id)} class="remove-btn">×</button>
      </div>

      <div class="locations">
        {#each person.locations as location (location.id)}
          <div class="location-item">
            <input
              type="text"
              value={location.name}
              oninput={(e) => updateLocation(person.id, location.id, { name: e.currentTarget.value })}
              placeholder="Location name"
            />
            <div class="coords">
              <input
                type="number"
                value={location.latitude}
                oninput={(e) => updateLocation(person.id, location.id, { latitude: parseFloat(e.currentTarget.value) })}
                placeholder="Lat"
                step="0.1"
              />
              <input
                type="number"
                value={location.longitude}
                oninput={(e) => updateLocation(person.id, location.id, { longitude: parseFloat(e.currentTarget.value) })}
                placeholder="Lng"
                step="0.1"
              />
            </div>
            <button onclick={() => removeLocation(person.id, location.id)} class="remove-location">×</button>
          </div>
        {/each}

        <button onclick={() => addLocation(person.id)} class="add-location">
          + Add Location
        </button>
      </div>
    </div>
  {/each}

  <button onclick={addPerson} class="add-person">+ Add Person</button>
</div>

<style>
  .people-editor {
    font-family: 'DM Sans', sans-serif;
  }

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .person-card {
    background: #f5f5f5;
    border-radius: 4px;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .person-header {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .person-name {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .location-item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .location-item input[type="text"] {
    grid-column: 1 / -1;
  }

  .coords {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  input[type="number"] {
    padding: 0.375rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .remove-btn,
  .remove-location {
    background: #d32f2f;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
  }

  .add-location,
  .add-person {
    width: 100%;
    padding: 0.5rem;
    background: white;
    border: 1px dashed #4a90e2;
    border-radius: 4px;
    color: #4a90e2;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .add-location:hover,
  .add-person:hover {
    background: #f0f7ff;
  }
</style>
```

#### Testing Strategy:

**Unit Tests** (`tests/unit/repositories.test.ts`):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { migrationMapRepository } from '$lib/db/repositories/migration-maps';
import { printConfigRepository } from '$lib/db/repositories/print-configurations';

describe('MigrationMap Repository', () => {
  it('creates a new migration map', async () => {
    const map = await migrationMapRepository.create({
      userId: 'test-user',
      title: 'Test Map',
      subtitle: 'Test',
      people: [],
      projection: 'orthographic',
      rotation: [0, 0, 0],
      zoom: 1.0,
      pan: [0, 0]
    });

    expect(map.id).toBeDefined();
    expect(map.title).toBe('Test Map');
    expect(map.createdAt).toBeInstanceOf(Date);
  });

  it('updates migration map', async () => {
    const map = await migrationMapRepository.create({ /* ... */ });
    const updated = await migrationMapRepository.update(map.id, {
      title: 'Updated Title'
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.updatedAt).not.toEqual(map.updatedAt);
  });
});

describe('PrintConfiguration Repository', () => {
  it('creates print config with valid map reference', async () => {
    const map = await migrationMapRepository.create({ /* ... */ });
    const printConfig = await printConfigRepository.create({
      migrationMapId: map.id,
      pageSize: '18x24',
      orientation: 'portrait',
      style: 'vintage',
      showBoundary: true
    });

    expect(printConfig.id).toBeDefined();
    expect(printConfig.migrationMapId).toBe(map.id);
  });

  it('fails to create print config with invalid map ID', async () => {
    await expect(
      printConfigRepository.create({
        migrationMapId: 'non-existent-id',
        pageSize: '18x24',
        orientation: 'portrait',
        style: 'vintage',
        showBoundary: true
      })
    ).rejects.toThrow(); // Foreign key violation
  });
});
```

**E2E Tests** (`tests/e2e/two-route-workflow.test.ts`):
```typescript
import { test, expect } from '@playwright/test';

test.describe('Two-Route Workflow', () => {
  test('complete flow from edit to publish', async ({ page }) => {
    // Start at edit page
    await page.goto('/edit');

    // Add title and subtitle
    await page.fill('input[placeholder*="Title"]', 'Our Family Journey');
    await page.fill('input[placeholder*="Subtitle"]', '2010-2024');

    // Add a person
    await page.click('button:has-text("Add Person")');
    await page.fill('.person-name', 'Alice');

    // Add a location
    await page.click('button:has-text("Add Location")');
    await page.fill('input[placeholder="Location name"]', 'New York');
    await page.fill('input[placeholder="Lat"]', '40.7128');
    await page.fill('input[placeholder="Lng"]', '-74.0060');

    // Save and continue
    await page.click('button:has-text("Save & Continue")');

    // Should redirect to publish page
    await expect(page).toHaveURL(/\/publish\?mapId=/);

    // Check map loaded
    await expect(page.locator('h1')).toContainText('Configure Print Settings');
    await expect(page.locator('.subtitle')).toContainText('Our Family Journey');

    // Change page size
    await page.selectOption('#paper-size', 'A3');

    // Export
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export for Print")');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/Our-Family-Journey\.png/);
  });

  test('can edit map from publish page', async ({ page }) => {
    // Create a map first
    await page.goto('/edit');
    await page.fill('input[placeholder*="Title"]', 'Test Map');
    await page.click('button:has-text("Save & Continue")');

    // Should be on publish page
    await expect(page).toHaveURL(/\/publish\?mapId=/);

    // Click edit link
    await page.click('a:has-text("Edit Map Data")');

    // Should return to edit page with map ID
    await expect(page).toHaveURL(/\/edit\?id=/);

    // Map data should be loaded
    await expect(page.locator('input[value="Test Map"]')).toBeVisible();
  });

  test('publish page requires valid map ID', async ({ page }) => {
    // Try to access publish without map ID
    await page.goto('/publish');

    // Should redirect to edit
    await expect(page).toHaveURL('/edit');
  });

  test('print config references migration map', async ({ page }) => {
    // Create map and export
    await page.goto('/edit');
    await page.fill('input[placeholder*="Title"]', 'Reference Test');
    await page.click('button:has-text("Save & Continue")');

    const url = new URL(page.url());
    const mapId = url.searchParams.get('mapId');

    // Export to create print config
    await page.click('button:has-text("Export for Print")');

    // Verify print config exists via API
    const printConfigsResponse = await page.request.get(`/api/print-configs?mapId=${mapId}`);
    const printConfigs = await printConfigsResponse.json();

    expect(printConfigs.length).toBeGreaterThan(0);
    expect(printConfigs[0].migrationMapId).toBe(mapId);
  });
});
```

#### Docker Compose Update:

Add PostgreSQL service:

```yaml
services:
  app:
    # ... existing config
    environment:
      DATABASE_URL: postgres://awm:password@db:5432/awm
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis

  worker:
    # ... existing config
    environment:
      DATABASE_URL: postgres://awm:password@db:5432/awm
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: awm
      POSTGRES_USER: awm
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres-data:
```

#### Success Criteria:

- ✅ PostgreSQL database set up with two tables
- ✅ Foreign key constraint enforced (print config → migration map)
- ✅ `/edit` route allows creating/editing migration maps
- ✅ `/publish` route loads existing map and configures print settings
- ✅ API routes for CRUD operations on both models
- ✅ Export pipeline builds MapDefinition from both models
- ✅ E2E test validates complete flow from edit → save → publish → export
- ✅ Can return to edit from publish page
- ✅ Repository pattern isolates database logic
- ✅ All unit tests pass
- ✅ All E2E tests pass

---

### Phase 3: Interactive Controls & Globe Rotation (Days 11-13)

**Goal:** User can configure map parameters and rotate globe interactively.

#### Tasks:

1. **Implement Versor Rotation** (`src/lib/map-renderer/versor.ts`)
   - Port D3 versor dragging pattern
   - Convert quaternion to Euler angles for serialization
   - Store final rotation in `MapDefinition`

2. **Create Control Panel Component** (`src/lib/components/MapControls.svelte`)
   - Projection selector (Natural Earth, Orthographic, Mercator)
   - Size selector (12×18, 18×24, 24×36)
   - Style toggle (vintage/modern)
   - Title/subtitle inputs
   - Layer toggles (graticule, countries, labels)

3. **Add Location Management** (`src/lib/components/LocationEditor.svelte`)
   - Add/remove locations
   - Lat/lng input with map click
   - Location type (birth, transit, arrival, death)
   - Path drawing between locations

4. **State Management**
   - Use Svelte 5 $state for MapDefinition
   - Bind controls to definition properties
   - Auto-rerender on changes via $effect

#### Testing:

```typescript
// tests/e2e/rotation.test.ts
test('globe rotates and saves rotation state', async ({ page }) => {
  await page.goto('/');

  // Select orthographic projection
  await page.selectOption('[data-testid="projection-select"]', 'orthographic');

  // Simulate drag on map
  const map = await page.locator('svg[data-map]');
  await map.dragTo(map, {
    sourcePosition: { x: 100, y: 100 },
    targetPosition: { x: 200, y: 150 }
  });

  // Check rotation values are stored
  const rotation = await page.evaluate(() => {
    return window.mapDefinition.projection.rotation;
  });
  expect(rotation).toHaveLength(3);
  expect(rotation[0]).not.toBe(0); // Rotation changed
});
```

#### Success Criteria:
- User can select projection type
- Orthographic projection rotates via drag
- Rotation values serialize to numbers (not "auto")
- Controls update MapDefinition reactively
- Map re-renders automatically on changes
- E2E test validates rotation persistence

---

### Phase 3: Export Pipeline - Puppeteer Rendering (Days 9-12)

**Goal:** Server-side rendering produces pixel-perfect PNG matching browser preview.

#### Architecture

```
Browser                      Server
┌─────────────┐             ┌──────────────┐
│ POST /api/  │             │ Receive      │
│ export      │────────────>│ MapDefinition│
│             │   JSON      │ as JSON      │
└─────────────┘             └──────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │ Puppeteer    │
                            │ launches     │
                            │ headless     │
                            │ Chrome       │
                            └──────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │ Navigate to  │
                            │ /render route│
                            │ with data    │
                            └──────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │ SAME CODE    │
                            │ renderMap()  │
                            │ SAME FONTS   │
                            └──────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │ Screenshot   │
                            │ PNG buffer   │
                            └──────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │ sharp:       │
                            │ embed sRGB   │
                            │ profile      │
                            └──────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │ Validate     │
                            │ dimensions   │
                            └──────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │ Return PNG   │
                            │ to client    │
                            └──────────────┘
```

#### Tasks:

1. **Create Render Route** (`src/routes/render/+page.svelte`)
   - SSR disabled (`export const ssr = false`)
   - Reads MapDefinition from URL query parameter
   - Waits for fonts via `document.fonts.ready`
   - Calls `renderMap()` at full 300 DPI resolution
   - Sets `window.__RENDER_READY__` flag when complete

2. **Implement Export API** (`src/routes/api/export/+server.ts`)
   - Receives MapDefinition as POST body
   - Validates definition structure
   - Calls Puppeteer export function
   - Returns PNG buffer with proper headers

3. **Build Puppeteer Exporter** (`src/lib/export/puppeteer.ts`)
   ```typescript
   export async function exportForPrintful(
     definition: MapDefinition
   ): Promise<Buffer> {
     const browser = await puppeteer.launch({
       headless: 'new',
       args: [
         '--font-render-hinting=none',
         '--force-color-profile=srgb',
         '--disable-dev-shm-usage'
       ],
       executablePath: '/usr/bin/chromium' // In Docker
     });

     const page = await browser.newPage();

     const dims = calculateDimensions({
       width: definition.width,
       height: definition.height
     });

     await page.setViewport({
       width: dims.pixelWidth,
       height: dims.pixelHeight,
       deviceScaleFactor: 1
     });

     const data = Buffer.from(JSON.stringify(definition)).toString('base64url');
     await page.goto(`http://localhost:5173/render?data=${data}`, {
       waitUntil: 'networkidle0',
       timeout: 300000
     });

     await page.waitForFunction(
       () => window.__RENDER_READY__ || window.__RENDER_ERROR__,
       { timeout: 300000 }
     );

     const error = await page.evaluate(() => window.__RENDER_ERROR__);
     if (error) throw new Error(error);

     // Extra wait for final paint
     await new Promise(r => setTimeout(r, 2000));

     // Final font verification
     const fontsOk = await page.evaluate(() =>
       document.fonts.check('600 16px "Cormorant Garamond"')
     );
     if (!fontsOk) throw new Error('Font verification failed');

     const screenshot = await page.screenshot({
       type: 'png',
       fullPage: true,
       omitBackground: false
     });

     await browser.close();
     return screenshot;
   }
   ```

4. **Add Post-Processing** (`src/lib/export/post-process.ts`)
   ```typescript
   import sharp from 'sharp';
   import fs from 'fs';

   export async function embedSRGBProfile(
     screenshot: Buffer
   ): Promise<Buffer> {
     const srgbProfile = fs.readFileSync('profiles/sRGB2014.icc');

     return sharp(screenshot)
       .withMetadata({ icc: srgbProfile })
       .png({ compressionLevel: 9 })
       .toBuffer();
   }
   ```

5. **Create Validation** (`src/lib/export/validate.ts`)
   ```typescript
   export async function validateForPrintful(
     buffer: Buffer,
     definition: MapDefinition
   ): Promise<void> {
     const metadata = await sharp(buffer).metadata();
     const dims = calculateDimensions({
       width: definition.width,
       height: definition.height
     });

     const errors: string[] = [];

     if (metadata.width !== dims.pixelWidth) {
       errors.push(`Width: expected ${dims.pixelWidth}, got ${metadata.width}`);
     }
     if (metadata.height !== dims.pixelHeight) {
       errors.push(`Height: expected ${dims.pixelHeight}, got ${metadata.height}`);
     }
     if (metadata.format !== 'png') {
       errors.push(`Format: expected png, got ${metadata.format}`);
     }
     if (metadata.space !== 'srgb') {
       errors.push(`Color space: expected srgb, got ${metadata.space}`);
     }
     if (!metadata.icc) {
       errors.push('Missing ICC profile');
     }

     if (errors.length > 0) {
       throw new Error(`Validation failed:\n${errors.join('\n')}`);
     }
   }
   ```

6. **Docker Configuration** (`Dockerfile.worker`)
   ```dockerfile
   FROM node:20-slim

   # Chrome + dependencies
   RUN apt-get update && apt-get install -yq --no-install-recommends \
       chromium \
       fonts-liberation \
       fonts-noto-core \
       --no-install-recommends \
       && rm -rf /var/lib/apt/lists/*

   # Install custom fonts
   COPY static/fonts/CormorantGaramond-*.ttf /usr/local/share/fonts/
   COPY static/fonts/DMSans-*.ttf /usr/local/share/fonts/

   # Rebuild font cache
   RUN fc-cache -f -v

   # Verify fonts (fail if missing)
   RUN fc-list | grep -q "Cormorant Garamond" || exit 1
   RUN fc-list | grep -q "DM Sans" || exit 1

   # Puppeteer config
   ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

   WORKDIR /app
   COPY package.json pnpm-lock.yaml ./
   RUN npm install -g pnpm && pnpm install --frozen-lockfile

   COPY . .
   RUN pnpm build

   EXPOSE 3000
   CMD ["node", "build"]
   ```

#### Testing Strategy:

**Visual Regression Test:**
```typescript
// tests/e2e/export-fidelity.test.ts
import { test, expect } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

test('exported PNG matches browser preview', async ({ page }) => {
  // Navigate to configurator
  await page.goto('/');
  await page.waitForFunction(() => document.fonts.ready);

  // Take browser screenshot at 300 DPI scale
  const browserScreenshot = await page.screenshot({
    type: 'png',
    fullPage: true
  });

  // Trigger export
  await page.click('[data-testid="export-button"]');

  // Wait for download
  const download = await page.waitForEvent('download');
  const exportedPath = await download.path();
  const exportedScreenshot = fs.readFileSync(exportedPath);

  // Compare with pixelmatch
  const img1 = PNG.sync.read(browserScreenshot);
  const img2 = PNG.sync.read(exportedScreenshot);

  const diff = new PNG({ width: img1.width, height: img1.height });
  const mismatch = pixelmatch(
    img1.data, img2.data, diff.data,
    img1.width, img1.height,
    { threshold: 0.1 }
  );

  const mismatchPercent = (mismatch / (img1.width * img1.height)) * 100;

  // Allow < 0.01% mismatch for anti-aliasing differences
  expect(mismatchPercent).toBeLessThan(0.01);
});
```

**Validation Test:**
```typescript
// tests/unit/validation.test.ts
test('validates correct PNG passes', async () => {
  const definition: MapDefinition = {
    width: 18,
    height: 24,
    // ... rest
  };

  const buffer = await exportForPrintful(definition);
  const processed = await embedSRGBProfile(buffer);

  await expect(
    validateForPrintful(processed, definition)
  ).resolves.toBeUndefined(); // No errors thrown
});

test('validates incorrect dimensions fails', async () => {
  const definition: MapDefinition = { width: 18, height: 24, /* ... */ };

  // Create intentionally wrong buffer
  const wrongBuffer = await sharp({
    create: {
      width: 1000,
      height: 1000,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  }).png().toBuffer();

  await expect(
    validateForPrintful(wrongBuffer, definition)
  ).rejects.toThrow(/Width: expected/);
});
```

#### Success Criteria:
- `/api/export` endpoint receives MapDefinition and returns PNG
- PNG has exact pixel dimensions (5475×7275 for 18×24)
- PNG has embedded sRGB ICC profile
- Visual regression test shows < 0.01% pixel difference
- Font verification passes in headless Chrome
- All validation tests pass

---

### Phase 4: Queue System with BullMQ (Days 13-15)

**Goal:** Reliable background job processing for export and Printful submission.

#### Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ POST /api/orders
       ▼
┌─────────────────┐
│ SvelteKit API   │
│ /api/orders     │
└──────┬──────────┘
       │ Add job to queue
       ▼
┌─────────────────┐         ┌──────────────┐
│  Redis          │◄────────┤  BullMQ      │
│  (Job Queue)    │         │  Worker      │
└─────────────────┘         └──────┬───────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ Render   │  │ Upload   │  │ Submit   │
              │ via      │  │ to S3    │  │ to       │
              │ Puppeteer│  │          │  │ Printful │
              └──────────┘  └──────────┘  └──────────┘
```

#### Tasks:

1. **Set Up BullMQ** (`src/lib/queue/render-queue.ts`)
   ```typescript
   import { Queue, Worker, Job } from 'bullmq';
   import { Redis } from 'ioredis';

   interface RenderJob {
     id: string;
     orderId: string;
     mapDefinition: MapDefinition;
     printful: {
       variantId: number;
       quantity: number;
     };
     shippingAddress: Address;
   }

   const connection = new Redis(process.env.REDIS_URL);

   export const renderQueue = new Queue<RenderJob>('render', {
     connection,
     defaultJobOptions: {
       attempts: 3,
       backoff: {
         type: 'exponential',
         delay: 2000
       },
       timeout: 300000 // 5 minutes
     }
   });
   ```

2. **Create Worker** (`src/lib/queue/worker.ts`)
   ```typescript
   import { Worker } from 'bullmq';
   import { exportForPrintful } from '$lib/export/puppeteer';
   import { embedSRGBProfile } from '$lib/export/post-process';
   import { validateForPrintful } from '$lib/export/validate';
   import { uploadToS3 } from '$lib/storage/s3';
   import { submitToPrintful } from '$lib/printful/client';

   const worker = new Worker<RenderJob>(
     'render',
     async (job: Job<RenderJob>) => {
       const { mapDefinition, printful, shippingAddress } = job.data;

       // Update job progress
       await job.updateProgress(10);

       // Step 1: Render via Puppeteer
       const screenshot = await exportForPrintful(mapDefinition);
       await job.updateProgress(40);

       // Step 2: Embed sRGB profile
       const processed = await embedSRGBProfile(screenshot);
       await job.updateProgress(50);

       // Step 3: Validate
       await validateForPrintful(processed, mapDefinition);
       await job.updateProgress(60);

       // Step 4: Upload to cloud storage
       const fileUrl = await uploadMapFile(processed, job.data.orderId);
       await job.updateProgress(80);

       // Step 5: Submit to Printful
       const printfulOrderId = await submitToPrintful(
         fileUrl,
         printful,
         shippingAddress
       );
       await job.updateProgress(100);

       return {
         fileUrl,
         printfulOrderId,
         dimensions: {
           width: mapDefinition.width,
           height: mapDefinition.height
         }
       };
     },
     {
       connection,
       concurrency: 2 // Process 2 jobs in parallel
     }
   );

   worker.on('completed', (job) => {
     console.log(`Job ${job.id} completed:`, job.returnvalue);
   });

   worker.on('failed', (job, err) => {
     console.error(`Job ${job?.id} failed:`, err);
   });
   ```

3. **Create Order API** (`src/routes/api/orders/+server.ts`)
   ```typescript
   import { json } from '@sveltejs/kit';
   import { renderQueue } from '$lib/queue/render-queue';
   import type { RequestHandler } from './$types';

   export const POST: RequestHandler = async ({ request }) => {
     const body = await request.json();
     const { mapDefinition, printful, shippingAddress } = body;

     // Add job to queue
     const job = await renderQueue.add('render-map', {
       id: crypto.randomUUID(),
       orderId: `order-${Date.now()}`,
       mapDefinition,
       printful,
       shippingAddress
     });

     return json({
       jobId: job.id,
       orderId: job.data.orderId
     });
   };

   export const GET: RequestHandler = async ({ url }) => {
     const jobId = url.searchParams.get('jobId');
     if (!jobId) {
       return json({ error: 'Missing jobId' }, { status: 400 });
     }

     const job = await renderQueue.getJob(jobId);
     if (!job) {
       return json({ error: 'Job not found' }, { status: 404 });
     }

     const state = await job.getState();
     const progress = job.progress;

     return json({
       jobId: job.id,
       state,
       progress,
       result: job.returnvalue
     });
   };
   ```

4. **Implement Storage Abstraction** (`src/lib/storage/interface.ts`)
   ```typescript
   // Storage interface - swap implementations without changing consumers
   export interface FileStorage {
     upload(buffer: Buffer, key: string, contentType: string): Promise<string>;
     getPublicUrl(key: string): string;
   }
   ```

   **Google Cloud Storage Implementation** (`src/lib/storage/gcs.ts`)
   ```typescript
   import { Storage } from '@google-cloud/storage';
   import type { FileStorage } from './interface';

   export class GCSStorage implements FileStorage {
     private storage: Storage;
     private bucketName: string;

     constructor() {
       this.storage = new Storage();
       this.bucketName = process.env.GCS_BUCKET || 'family-maps';
     }

     async upload(
       buffer: Buffer,
       key: string,
       contentType: string
     ): Promise<string> {
       const bucket = this.storage.bucket(this.bucketName);
       const file = bucket.file(key);

       await file.save(buffer, {
         contentType,
         metadata: {
           cacheControl: 'public, max-age=31536000',
         },
       });

       // Make publicly accessible for Printful
       await file.makePublic();

       return this.getPublicUrl(key);
     }

     getPublicUrl(key: string): string {
       return `https://storage.googleapis.com/${this.bucketName}/${key}`;
     }
   }
   ```

   **Factory Pattern** (`src/lib/storage/index.ts`)
   ```typescript
   import type { FileStorage } from './interface';
   import { GCSStorage } from './gcs';

   export function createStorage(): FileStorage {
     // Easy to swap: just change this line
     return new GCSStorage();
   }

   // Convenience wrapper for common use case
   export async function uploadMapFile(
     buffer: Buffer,
     orderId: string
   ): Promise<string> {
     const storage = createStorage();
     const key = `maps/${orderId}.png`;
     return storage.upload(buffer, key, 'image/png');
   }
   ```

5. **Implement Printful Client** (`src/lib/printful/client.ts`)
   ```typescript
   interface Address {
     name: string;
     address1: string;
     city: string;
     state: string;
     country: string;
     postalCode: string;
   }

   export async function submitToPrintful(
     fileUrl: string,
     printful: { variantId: number; quantity: number },
     shippingAddress: Address
   ): Promise<number> {
     const response = await fetch('https://api.printful.com/orders', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({
         recipient: {
           name: shippingAddress.name,
           address1: shippingAddress.address1,
           city: shippingAddress.city,
           state_code: shippingAddress.state,
           country_code: shippingAddress.country,
           zip: shippingAddress.postalCode
         },
         items: [{
           variant_id: printful.variantId,
           quantity: printful.quantity,
           files: [{
             url: fileUrl
           }]
         }],
         confirm: true
       })
     });

     const data = await response.json();

     if (!response.ok) {
       throw new Error(`Printful API error: ${JSON.stringify(data)}`);
     }

     return data.result.id;
   }
   ```

6. **Docker Compose Configuration**
   ```yaml
   version: '3.8'

   services:
     app:
       build: .
       ports:
         - "5173:5173"
       volumes:
         - ./src:/app/src
         - ./static:/app/static
       environment:
         REDIS_URL: redis://redis:6379
         GCS_BUCKET: family-maps
         GOOGLE_APPLICATION_CREDENTIALS: /app/gcp-credentials.json
         PRINTFUL_API_KEY: ${PRINTFUL_API_KEY}
       volumes:
         - ./gcp-credentials.json:/app/gcp-credentials.json:ro
       depends_on:
         - redis

     worker:
       build:
         context: .
         dockerfile: Dockerfile.worker
       environment:
         REDIS_URL: redis://redis:6379
         GCS_BUCKET: family-maps
         GOOGLE_APPLICATION_CREDENTIALS: /app/gcp-credentials.json
         PRINTFUL_API_KEY: ${PRINTFUL_API_KEY}
         RENDER_BASE_URL: http://app:5173
       volumes:
         - ./gcp-credentials.json:/app/gcp-credentials.json:ro
       depends_on:
         - app
         - redis

     redis:
       image: redis:7-alpine
       ports:
         - "6379:6379"
   ```

#### Testing:

```typescript
// tests/integration/queue.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderQueue } from '$lib/queue/render-queue';
import { Redis } from 'ioredis';

describe('Render Queue', () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis(process.env.REDIS_URL);
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('adds job to queue', async () => {
    const job = await renderQueue.add('test-render', {
      id: 'test-1',
      orderId: 'order-1',
      mapDefinition: { /* ... */ },
      printful: { variantId: 123, quantity: 1 },
      shippingAddress: { /* ... */ }
    });

    expect(job.id).toBeDefined();
    expect(job.data.orderId).toBe('order-1');
  });

  it('processes job successfully', async () => {
    const job = await renderQueue.add('test-render', {
      /* ... */
    });

    // Wait for job completion
    const result = await job.waitUntilFinished(queueEvents);

    expect(result.fileUrl).toMatch(/^https:\/\//);
    expect(result.printfulOrderId).toBeGreaterThan(0);
  });
});

// tests/integration/storage.test.ts
import { describe, it, expect } from 'vitest';
import { createStorage, uploadMapFile } from '$lib/storage';

describe('Storage Abstraction', () => {
  it('uploads file and returns public URL', async () => {
    const buffer = Buffer.from('fake-png-data');
    const url = await uploadMapFile(buffer, 'test-order-123');

    expect(url).toMatch(/^https:\/\//);
    expect(url).toContain('test-order-123.png');
  });

  it('uses GCS implementation by default', () => {
    const storage = createStorage();
    expect(storage.constructor.name).toBe('GCSStorage');
  });
});
```

#### Success Criteria:
- Jobs persist in Redis
- Worker processes jobs from queue
- Failed jobs retry with exponential backoff
- PNG uploads to GCS successfully
- Storage abstraction allows easy provider swap
- Printful API accepts order
- Integration test validates full pipeline

---

### Phase 5: End-to-End Testing & Validation (Days 16-17)

**Goal:** Comprehensive test coverage proving system reliability.

#### Test Suites:

1. **Unit Tests (Vitest)**
   - Dimension calculations
   - Projection configurations
   - Font loading utilities
   - Validation logic
   - Color palette utilities

2. **Integration Tests (Vitest)**
   - Queue job lifecycle
   - S3 upload/download
   - Printful API mock calls
   - Export pipeline (mocked Puppeteer)

3. **E2E Tests (Playwright)**
   - Map configurator workflow
   - Font loading verification
   - Globe rotation
   - Export trigger
   - Visual regression (pixelmatch)
   - Job status polling

4. **Docker Tests**
   - Font availability in container
   - Chromium execution
   - Full stack brings up successfully

#### Test Commands:

```json
// package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:docker": "./scripts/test-docker.sh"
  }
}
```

#### Docker Font Test Script:

```bash
#!/bin/bash
# scripts/test-docker.sh

echo "Building worker image..."
docker build -f Dockerfile.worker -t awm-worker .

echo "Testing font installation..."
docker run --rm awm-worker fc-list | grep "Cormorant Garamond"
if [ $? -ne 0 ]; then
  echo "ERROR: Cormorant Garamond not found"
  exit 1
fi

docker run --rm awm-worker fc-list | grep "DM Sans"
if [ $? -ne 0 ]; then
  echo "ERROR: DM Sans not found"
  exit 1
fi

echo "Fonts verified successfully!"
```

#### Success Criteria:
- All unit tests pass
- All integration tests pass
- All E2E tests pass
- Visual regression < 0.01% pixel difference
- Docker font test passes
- Full docker-compose stack starts successfully
- Test coverage > 80%

---

## Technology Stack Summary

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Frontend Framework** | SvelteKit 5 | Per CLAUDE.md requirements, reactive with runes |
| **Visualization** | D3.js v7 | Industry standard for geographic viz |
| **Backend Runtime** | Node.js + TypeScript | Per CLAUDE.md, JavaScript ecosystem consistency |
| **Package Manager** | PNPM | Per CLAUDE.md, efficient dependency management |
| **Headless Browser** | Puppeteer | Chrome rendering for font fidelity |
| **Job Queue** | BullMQ + Redis | Reliable, retries, progress tracking |
| **Image Processing** | Sharp | Fast, native performance, ICC profile support |
| **Storage** | Google Cloud Storage | Per CLAUDE.md, GCP ecosystem, public URLs for Printful |
| **Deployment** | Google Cloud Run | Per CLAUDE.md, containerized hosting |
| **Testing - Unit/Int** | Vitest | Per CLAUDE.md, Vite-native testing |
| **Testing - E2E** | Playwright | Per CLAUDE.md, reliable browser automation |
| **Testing - Visual** | Pixelmatch | Pixel-level comparison for regression |
| **Containerization** | Docker + Compose | Per CLAUDE.md, reproducible environments |
| **Print Fulfillment** | Printful API v2 | POD service with poster support |

---

## Key Design Decisions

### 1. Non-Map SVG Elements via D3 (Not Svelte)

**Decision:** Render title box and QR code using D3 within `renderMap()`, not as Svelte components overlaid on the SVG.

**Rationale:**
- **Critical requirement:** Browser preview must match Puppeteer export pixel-perfectly
- Svelte components wouldn't exist in Puppeteer's `/render` page (it only runs the pure `renderMap()` function)
- D3 can render everything: text, rectangles, and SVG paths (for QR code)
- QR code library (`qrcode`) can generate SVG string, which D3 can insert
- All layout logic stays in one place (TypeScript), not split between Svelte and D3

**Implementation approach:**
```typescript
// src/lib/map-renderer/overlays.ts
import QRCode from 'qrcode';

export async function renderTitleBox(
  svg: d3.Selection,
  title: string,
  subtitle: string,
  safeArea: SafeArea
) {
  // D3 renders background rectangle + text
  const g = svg.append('g').attr('class', 'title-box');

  g.append('rect')
    .attr('x', safeArea.x)
    .attr('y', safeArea.y)
    .attr('width', 400) // points
    .attr('height', 80)
    .attr('fill', 'rgba(255,255,255,0.9)');

  g.append('text')
    .attr('x', safeArea.x + 20)
    .attr('y', safeArea.y + 40)
    .style('font-family', 'Cormorant Garamond')
    .style('font-size', '24px')
    .text(title);
}

export async function renderQRCode(
  svg: d3.Selection,
  url: string,
  safeArea: SafeArea
) {
  // Generate QR code as SVG string
  const qrSvg = await QRCode.toString(url, { type: 'svg' });

  // Position in bottom-right corner of safe area
  const g = svg.append('g')
    .attr('class', 'qr-code')
    .attr('data-qr-code', 'true')
    .attr('transform', `translate(${safeArea.x + safeArea.width - 100}, ${safeArea.y + safeArea.height - 100})`);

  // Insert QR SVG as child
  g.html(qrSvg);
}
```

This way, Svelte sees the final SVG output in the browser, and Puppeteer sees the exact same thing because it runs the same D3 code.

### 2. SvelteKit Over React

**Decision:** Use SvelteKit 5 instead of React as specified in POC.

**Rationale:**
- CLAUDE.md explicitly requires SvelteKit 5
- Svelte 5 runes ($state, $derived, $effect) provide clean reactivity
- Research shows excellent D3 integration patterns
- Lighter bundle size, better performance

**Impact on POC:**
- All React references replaced with SvelteKit equivalents
- Same architecture (framework-agnostic renderMap function)
- Better type safety with TypeScript + Svelte

### 2. Framework-Agnostic Renderer

**Decision:** Pure TypeScript renderMap() function, no framework dependencies.

**Rationale:**
- Same code runs in browser (SvelteKit) and server (Puppeteer)
- Guarantees pixel-perfect match
- Testable in isolation
- Reusable across frameworks if needed

**Implementation:**
```typescript
// Works in both environments
renderMap(svgElement, definition, geoData, dimensions);
```

### 3. Local Fonts Only

**Decision:** Bundle TTF files, never use Google Fonts CDN.

**Rationale:**
- Docker containers can't access CDN reliably
- Identical font files = identical rendering
- Eliminates network as failure point
- Satisfies POC's "accuracy above all" priority

### 4. Storage Abstraction Layer

**Decision:** Create `FileStorage` interface with GCS implementation, hide provider details.

**Rationale:**
- GCP ecosystem consistency per CLAUDE.md (Cloud Run, Cloud Storage)
- Interface allows swapping providers without changing consumer code
- "Just host containerized stuff" philosophy extends to storage
- URL-based submission to Printful (their recommended approach)
- Files remain accessible for debugging

### 5. BullMQ for Queue

**Decision:** BullMQ + Redis for job queue.

**Rationale:**
- Reliable with retries and backoff
- Progress tracking for UX
- Persistence survives crashes
- Standard Node.js ecosystem choice
- Works seamlessly with Cloud Run (containerized workers)

---

## Risk Mitigation

| Risk | Impact | Mitigation Strategy |
|------|--------|---------------------|
| **Font mismatch browser/Docker** | Critical | Visual regression tests, font verification in both environments, fail builds if fonts missing |
| **Wrong output dimensions** | Critical | Validation tests, fail job if PNG dimensions incorrect, automated dimension calculation |
| **Text in bleed area** | High | Safe area calculations tested, position text relative to safe area, visual review |
| **ICC profile missing** | Medium | Always embed via Sharp, validation check, fail if missing |
| **Printful API rejection** | Medium | Pre-validate locally, handle API errors, retry with backoff |
| **Puppeteer timeout** | Medium | 5-minute timeout, progress logging, retry on failure |
| **GCS upload failure** | Low | Retry logic, validate upload success, storage abstraction allows fallback |

---

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Start dev server with hot reload
pnpm dev

# Run tests in watch mode
pnpm test:watch

# Run E2E tests with UI
pnpm test:e2e:ui
```

### Docker Development

```bash
# Start full stack
docker-compose up

# Rebuild after changes
docker-compose up --build

# View logs
docker-compose logs -f worker

# Test fonts in Docker
./scripts/test-docker.sh
```

### Testing Workflow

```bash
# Run all tests
pnpm test        # Unit/integration
pnpm test:e2e    # E2E
pnpm test:docker # Docker fonts

# Pre-commit checks
pnpm test && pnpm test:e2e && pnpm test:docker
```

---

## Success Metrics (MVP)

1. **Functional Requirements:**
   - ✅ User configures map in browser
   - ✅ Live preview at 72 DPI with title box and QR code
   - ✅ Export produces 300 DPI PNG with all non-map elements
   - ✅ PNG meets all Printful specs
   - ✅ Fonts render correctly in output
   - ✅ QR code (https://alwaysmap.com) renders correctly in browser and export
   - ✅ File uploads to Printful successfully

2. **Quality Requirements:**
   - ✅ Visual regression < 0.01% pixel difference
   - ✅ All validation checks pass
   - ✅ Test coverage > 80%
   - ✅ E2E tests prove full workflow

3. **Technical Requirements:**
   - ✅ Docker stack starts without errors
   - ✅ Fonts verified in containers
   - ✅ Queue processes jobs reliably
   - ✅ No manual testing required (Playwright proves it)

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 0: Bootstrap | Days 1-2 | Working SvelteKit project with Docker |
| Phase 1: Renderer | Days 3-5 | D3 map renders with correct fonts/dimensions |
| Phase 2: Controls | Days 6-8 | Interactive configurator with rotation |
| Phase 3: Export | Days 9-12 | Puppeteer pipeline with validation |
| Phase 4: Queue | Days 13-15 | Background jobs + Printful integration |
| Phase 5: Testing | Days 16-17 | Full test coverage, visual regression |

**Total Duration:** 17 days

---

## Next Steps

1. **Review & Approval:** Review this plan, clarify any questions
2. **Environment Setup:** Create Printful test account, AWS credentials, etc.
3. **Phase 0 Kickoff:** Initialize SvelteKit project, configure tooling
4. **Iterative Development:** Execute phases sequentially, test continuously
5. **Deploy & Validate:** Final E2E testing in production-like environment

---

## Appendix: File Tree

```
awm-prototype/
├── .dockerignore
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.worker
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── svelte.config.js
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── CLAUDE.md
├── allwaysmap-poc.md
├── IMPLEMENTATION-PLAN.md
│
├── static/
│   ├── fonts/
│   │   ├── CormorantGaramond-Regular.ttf
│   │   ├── CormorantGaramond-SemiBold.ttf
│   │   ├── CormorantGaramond-Bold.ttf
│   │   ├── CormorantGaramond-Italic.ttf
│   │   ├── DMSans-Regular.ttf
│   │   ├── DMSans-Medium.ttf
│   │   └── DMSans-SemiBold.ttf
│   └── data/
│       ├── countries-110m.json
│       └── land-110m.json
│
├── profiles/
│   └── sRGB2014.icc
│
├── scripts/
│   └── test-docker.sh
│
├── src/
│   ├── app.d.ts
│   ├── app.css
│   │
│   ├── routes/
│   │   ├── +page.svelte              # Main configurator
│   │   ├── +layout.svelte
│   │   ├── render/
│   │   │   └── +page.svelte          # Puppeteer render target
│   │   └── api/
│   │       ├── export/
│   │       │   └── +server.ts        # Export endpoint
│   │       └── orders/
│   │           └── +server.ts        # Order management
│   │
│   └── lib/
│       ├── map-renderer/
│       │   ├── index.ts              # Main renderMap() function
│       │   ├── types.ts              # MapDefinition, etc.
│       │   ├── dimensions.ts         # Bleed/safe area calculations
│       │   ├── projections.ts        # D3 projection setup
│       │   ├── overlays.ts           # Title box and QR code rendering
│       │   ├── styles.ts             # Color palettes
│       │   ├── fonts.ts              # Font loading/verification
│       │   └── versor.ts             # Globe rotation math
│       │
│       ├── components/
│       │   ├── MapControls.svelte    # Control panel
│       │   └── LocationEditor.svelte # Location management
│       │
│       ├── export/
│       │   ├── puppeteer.ts          # Headless Chrome screenshot
│       │   ├── post-process.ts       # sRGB embedding
│       │   └── validate.ts           # Dimension/format checks
│       │
│       ├── queue/
│       │   ├── render-queue.ts       # BullMQ queue setup
│       │   └── worker.ts             # Job processor
│       │
│       ├── storage/
│       │   ├── interface.ts          # FileStorage interface
│       │   ├── gcs.ts                # Google Cloud Storage impl
│       │   └── index.ts              # Factory and convenience functions
│       │
│       └── printful/
│           └── client.ts             # Printful API client
│
└── tests/
    ├── unit/
    │   ├── dimensions.test.ts
    │   ├── projections.test.ts
    │   ├── overlays.test.ts          # QR code and title box tests
    │   ├── validation.test.ts
    │   └── styles.test.ts
    │
    ├── integration/
    │   ├── queue.test.ts
    │   ├── s3.test.ts
    │   └── export-pipeline.test.ts
    │
    └── e2e/
        ├── map-preview.test.ts
        ├── rotation.test.ts
        ├── export-fidelity.test.ts
        └── full-workflow.test.ts
```

---

## Conclusion

This implementation plan adapts the comprehensive POC specification to AlwaysMap's technology requirements while maintaining all critical quality standards:

- **300 DPI print output** with exact Printful specifications
- **Font fidelity** through local TTF files in both browser and Docker
- **Framework-agnostic rendering** for pixel-perfect consistency
- **Comprehensive testing** with Vitest and Playwright (no manual testing)
- **Docker-based workflow** for reproducible environments
- **SvelteKit 5** with modern runes for reactive UI

The plan prioritizes **accuracy over speed** as specified, with extensive validation, visual regression testing, and rigorous error handling. Each phase has clear success criteria and testable deliverables.
