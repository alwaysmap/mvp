# Map & Page Layout Design

## Problem Statement

Currently, our system conflates two distinct concepts:

1. **Map Canvas**: The D3-rendered geographic visualization (globe, projection, data)
2. **Print Page**: The physical output with furniture (title, QR code, safe areas, bleed)

We need a clean separation that allows us to:
- Define map content independently of page size
- Maximize map fill within available page area
- Support multiple page sizes and orientations
- Place furniture predictably without affecting map scale
- Generate pixel-perfect print output

## Critical Requirements

### 1. WYSIWYG: What You See Is What You Get

**Browser preview MUST match print output exactly.**

The user experience is a two-step configuration process:

**Step 1: Configure Map Data**
- User adds people, locations, paths
- Adjusts globe rotation interactively
- Sees map content in browser
- **No page context yet** - just the map

**Step 2: Configure Print Layout**
- User selects page size (18×24, A4, etc.)
- Selects orientation (portrait/landscape)
- Enters title and subtitle text
- Browser shows **exact preview** of printable page:
  - Rectangular overlay showing page boundaries
  - Map positioned exactly as it will print (auto-calculated to maximize fill)
  - Furniture (title, QR) positioned automatically by layout engine
  - Page margins, safe areas visualized
- User can adjust:
  - Page size and orientation
  - Map center/rotation (fine-tune)
  - Title and subtitle TEXT content
- **Furniture positions are automatic** - calculated by layout algorithm
- **User cannot manually position furniture** - keeps design clean and professional

**The browser preview at 300 DPI downscaled to screen resolution MUST be pixel-perfect identical to the exported PNG.**

### 2. High-Quality Print Output

**Print must be high-DPI with exact browser reproduction.**

- **DPI**: 300 minimum for all print sizes
- **Color accuracy**: sRGB ICC profile embedded
- **Font rendering**: Identical fonts in browser and Puppeteer
- **No surprises**: User sees EXACTLY what they'll get printed
- **Precision**: Pixel-perfect reproduction, not approximate

**This means:**
- Same D3 rendering code for browser and export
- Same SVG → PNG conversion path
- Same layout calculation
- Puppeteer renders same DOM as user sees
- No "print preview is close enough" - it must be exact

### Current Issue: Massive Wasted Space

Looking at `output.png` (18×24 inch @ 300 DPI = 5475×7275px):

**Visual Analysis:**
```
┌────────────────────────────────────────────┐
│                                            │ ← ~35% wasted space
│                                            │
│                                            │
│                                            │
│         ┌──────────────────┐               │
│         │ Title            │               │
│         │                  │               │
│         │    🌍 Globe      │               │ ← ~30% actual content
│         │                  │               │
│         │              QR  │               │
│         └──────────────────┘               │
│                                            │
│                                            │ ← ~35% wasted space
│                                            │
│                                            │
└────────────────────────────────────────────┘
```

**Actual measurements from output.png:**
- Total page: 5475×7275px (18×24 inches)
- Visible content area: ~1640×2186px (estimated from visual inspection)
- Content fill: **~20-25% of available space**
- Wasted space: **~75-80%**

**Why this is bad:**
1. Customer pays for 18×24 print, gets globe that fits in ~8×11 space
2. Globe is too small to show detail
3. Text is unnecessarily tiny
4. Poor value proposition
5. Looks unprofessional

## Current State Analysis

### What We Have Now

```typescript
// Current approach mixes concerns
const dimensions = calculateDimensions(printSpec); // 5475x7275px for 18x24
renderMap(mapDef, printSpec, { selector: '#map-svg' });
// Map + furniture rendered together at fixed size
```

**Problems:**
- Print spec dictates both page AND map size
- No way to optimize map fill for different orientations
- Furniture is "part of" the map rather than the page
- Cannot reuse same map at different page sizes
- No separation between canvas dimensions and page dimensions

### Current Code Structure

```
src/lib/map-renderer/
├── dimensions.ts    # PRINT_SPECS with fixed pixel dimensions
├── index.ts         # renderMap() - renders map + furniture together
├── overlays.ts      # Title box, QR code (currently "on" the map)
└── projection.ts    # Orthographic projection setup
```

## Proposed Design: Map-First, Layout-Second

### Core Concepts

#### 1. Map Canvas (Geographic Content)
- **What**: D3 projection + geography + user data (paths, points)
- **Size**: Defined by aspect ratio and scale, NOT page size
- **Concerns**: Projection type, rotation, zoom level, data rendering
- **Output**: SVG group containing only geographic content

#### 2. Page Layout (Print Output)
- **What**: Physical page with bleed, safe areas, furniture placement
- **Size**: Defined by print specification (18x24, A4, etc.)
- **Concerns**: Orientation, margins, furniture positioning, map placement
- **Output**: SVG document with map canvas + furniture positioned

#### 3. Layout Engine (The Bridge)
- **What**: Calculates optimal map size to fill available page area
- **Input**: Map aspect ratio, page size, orientation, margins
- **Output**: Map dimensions, position, furniture coordinates
- **Pure Function**: Deterministic, testable, no side effects

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Page Layout                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Bleed Area (0.125" all sides)                     │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ Trim Area (final page size)                 │  │  │
│  │  │  ┌───────────────────────────────────────┐  │  │  │
│  │  │  │ Safe Area (content safety zone)       │  │  │  │
│  │  │  │                                        │  │  │  │
│  │  │  │  ┌──────────────────────────────┐     │  │  │  │
│  │  │  │  │                              │     │  │  │  │
│  │  │  │  │      Map Canvas              │     │  │  │  │
│  │  │  │  │   (maximized to fill)        │     │  │  │  │
│  │  │  │  │                              │     │  │  │  │
│  │  │  │  └──────────────────────────────┘     │  │  │  │
│  │  │  │                                        │  │  │  │
│  │  │  │  ┌──────────────┐  ┌──┐               │  │  │  │
│  │  │  │  │ Title Block  │  │QR│               │  │  │  │
│  │  │  │  └──────────────┘  └──┘               │  │  │  │
│  │  │  └───────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Data Model

### 1. Map Definition (Geographic Content)

```typescript
interface MapDefinition {
  // Data to visualize
  people: Person[];

  // Map view configuration
  projection: {
    type: 'orthographic' | 'mercator' | 'equirectangular';
    rotation: [number, number, number]; // [λ, φ, γ]
    scale?: number; // Optional scale factor
    center?: [number, number]; // Optional center point
  };

  // Visual styling
  style?: {
    oceanColor?: string;
    landColor?: string;
    countryStroke?: string;
    // ... other style properties
  };

  // Canvas aspect ratio (independent of page)
  aspectRatio?: number; // e.g., 1.0 for square, 1.333 for 4:3
}
```

**Key change**: Map definition doesn't care about page size, only aspect ratio.

### 2. Page Specification (Print Output)

```typescript
interface PageSpec {
  // Page size (standard sizes)
  size: PageSize;

  // Orientation
  orientation: 'portrait' | 'landscape';

  // Print requirements
  dpi: number; // 300 for print
  bleed: number; // 0.125 inches standard
  safeMargin: number; // 0.25 inches from trim

  // Color profile
  colorProfile: 'srgb' | 'cmyk';
}

type PageSize =
  | '12x16'   // US poster
  | '18x24'   // US poster
  | '24x36'   // US poster
  | 'letter'  // US 8.5x11
  | 'legal'   // US 8.5x14
  | 'tabloid' // US 11x17
  | 'a4'      // 210x297mm
  | 'a3'      // 297x420mm
  | 'a2';     // 420x594mm

const PAGE_SIZES: Record<PageSize, { width: number; height: number }> = {
  '12x16': { width: 12, height: 16 },
  '18x24': { width: 18, height: 24 },
  '24x36': { width: 24, height: 36 },
  'letter': { width: 8.5, height: 11 },
  'legal': { width: 8.5, height: 14 },
  'tabloid': { width: 11, height: 17 },
  'a4': { width: 8.27, height: 11.69 },
  'a3': { width: 11.69, height: 16.54 },
  'a2': { width: 16.54, height: 23.39 }
};
```

### 3. Furniture Definition (Page Decorations)

```typescript
// Allowed furniture positions (UX constraint)
type FurniturePosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

interface FurnitureConfig {
  // Title block
  title?: {
    text: string;
    subtitle?: string;
    position: FurniturePosition; // User chooses from 4 options
  };

  // QR code
  qrCode?: {
    url: string;
    position: FurniturePosition; // User chooses from 4 options
  };

  // Legend (future)
  legend?: {
    items: LegendItem[];
    position: 'left' | 'right'; // User chooses side
  };

  // Scale bar (future)
  scaleBar?: {
    units: 'km' | 'miles';
    position: 'bottom-left' | 'bottom-right'; // User chooses corner
  };
}

// UX Approach:
// - User selects from constrained options (e.g., dropdown with 4 corners)
// - Layout engine translates choice → exact pixel coordinates
// - Ensures professional results, prevents collisions
// - Gives user control without overwhelming them
```

### 4. Layout Result (Computed Positions)

```typescript
interface LayoutResult {
  // Page dimensions in pixels at target DPI
  page: {
    width: number;
    height: number;
    dpi: number;
  };

  // Map canvas dimensions and position
  map: {
    width: number;  // Pixels
    height: number; // Pixels
    x: number;      // Position in page
    y: number;      // Position in page
    scale: number;  // D3 projection scale
  };

  // Safe area boundaries
  safeArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Furniture positions (computed)
  furniture: {
    title?: { x: number; y: number; width: number; height: number };
    qrCode?: { x: number; y: number; size: number };
    // ... other furniture
  };
}
```

## Layout Algorithm

### Core Function: `calculateLayout()`

```typescript
function calculateLayout(
  mapDef: MapDefinition,
  pageSpec: PageSpec,
  furniture: FurnitureConfig
): LayoutResult {
  // 1. Calculate page dimensions in pixels
  const pageDimensions = calculatePageDimensions(pageSpec);

  // 2. Calculate safe area (subtract bleed + margins)
  const safeArea = calculateSafeArea(pageDimensions, pageSpec);

  // 3. Calculate furniture space requirements
  const furnitureSpace = calculateFurnitureSpace(furniture, safeArea);

  // 4. Calculate available space for map
  const availableMapArea = {
    width: safeArea.width - furnitureSpace.reservedWidth,
    height: safeArea.height - furnitureSpace.reservedHeight
  };

  // 5. Calculate optimal map dimensions to maximize fill
  const mapDimensions = calculateOptimalMapSize(
    mapDef.aspectRatio || 1.0,
    availableMapArea
  );

  // 6. Center map in available space
  const mapPosition = centerMapInSpace(mapDimensions, safeArea, furnitureSpace);

  // 7. Calculate D3 projection scale
  const projectionScale = calculateProjectionScale(
    mapDef.projection.type,
    mapDimensions
  );

  // 8. Position furniture around map
  const furniturePositions = positionFurniture(
    furniture,
    safeArea,
    mapDimensions,
    mapPosition
  );

  return {
    page: pageDimensions,
    map: { ...mapDimensions, ...mapPosition, scale: projectionScale },
    safeArea,
    furniture: furniturePositions
  };
}
```

### Helper: `calculateOptimalMapSize()`

```typescript
function calculateOptimalMapSize(
  mapAspectRatio: number, // width / height
  availableSpace: { width: number; height: number }
): { width: number; height: number } {
  const availableAspect = availableSpace.width / availableSpace.height;

  let width: number;
  let height: number;

  if (mapAspectRatio > availableAspect) {
    // Map is wider than available space - constrain by width
    width = availableSpace.width;
    height = width / mapAspectRatio;
  } else {
    // Map is taller than available space - constrain by height
    height = availableSpace.height;
    width = height * mapAspectRatio;
  }

  return { width, height };
}
```

### Helper: `calculateProjectionScale()`

```typescript
function calculateProjectionScale(
  projectionType: string,
  mapDimensions: { width: number; height: number }
): number {
  // For orthographic projection (hemisphere view)
  if (projectionType === 'orthographic') {
    // Scale is approximately min(width, height) / 2
    // This makes the globe fit within the canvas
    return Math.min(mapDimensions.width, mapDimensions.height) / 2;
  }

  // For mercator and other projections
  // Different calculation based on projection properties
  // ... (to be implemented per projection type)

  return mapDimensions.width / (2 * Math.PI); // Default mercator
}
```

### Helper: `positionFurniture()`

```typescript
function positionFurniture(
  furniture: FurnitureConfig,
  safeArea: { x: number; y: number; width: number; height: number },
  mapDimensions: { width: number; height: number },
  mapPosition: { x: number; y: number }
): FurniturePositions {
  const positions: FurniturePositions = {};
  const margin = 20; // pixels from safe area edge

  // Calculate title block position
  if (furniture.title) {
    const titleSize = measureTitleBlock(furniture.title); // Get actual text dimensions

    positions.title = calculateCornerPosition(
      furniture.title.position,
      titleSize,
      safeArea,
      margin
    );
  }

  // Calculate QR code position
  if (furniture.qrCode) {
    const qrSize = { width: 100, height: 100 }; // Standard QR size in pixels

    positions.qrCode = calculateCornerPosition(
      furniture.qrCode.position,
      qrSize,
      safeArea,
      margin
    );
  }

  // Validate no collisions between furniture items
  validateFurnitureCollisions(positions);

  return positions;
}

/**
 * Translates semantic position (top-left, etc.) to exact pixel coordinates
 */
function calculateCornerPosition(
  position: FurniturePosition,
  itemSize: { width: number; height: number },
  safeArea: { x: number; y: number; width: number; height: number },
  margin: number
): { x: number; y: number; width: number; height: number } {
  const { x: safeX, y: safeY, width: safeW, height: safeH } = safeArea;

  switch (position) {
    case 'top-left':
      return {
        x: safeX + margin,
        y: safeY + margin,
        width: itemSize.width,
        height: itemSize.height
      };

    case 'top-right':
      return {
        x: safeX + safeW - itemSize.width - margin,
        y: safeY + margin,
        width: itemSize.width,
        height: itemSize.height
      };

    case 'bottom-left':
      return {
        x: safeX + margin,
        y: safeY + safeH - itemSize.height - margin,
        width: itemSize.width,
        height: itemSize.height
      };

    case 'bottom-right':
      return {
        x: safeX + safeW - itemSize.width - margin,
        y: safeY + safeH - itemSize.height - margin,
        width: itemSize.width,
        height: itemSize.height
      };
  }
}

/**
 * Ensures furniture items don't overlap
 */
function validateFurnitureCollisions(positions: FurniturePositions): void {
  // Check if title and QR code overlap
  if (positions.title && positions.qrCode) {
    const overlap = checkRectOverlap(positions.title, positions.qrCode);
    if (overlap) {
      throw new Error(
        'Furniture collision: title and QR code overlap. ' +
        'Choose different positions.'
      );
    }
  }

  // Future: Check other furniture items
}

/**
 * Checks if two rectangles overlap
 */
function checkRectOverlap(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  );
}
```

## Rendering Pipeline

### Step 1: Layout Calculation (Pure Function)

```typescript
const layout = calculateLayout(mapDefinition, pageSpec, furnitureConfig);
```

### Step 2: Render Map Canvas (D3, Framework-Agnostic)

```typescript
function renderMapCanvas(
  mapDef: MapDefinition,
  dimensions: { width: number; height: number; scale: number },
  container: SVGGElement
): void {
  // Create projection with calculated scale
  const projection = d3.geoOrthographic()
    .scale(dimensions.scale)
    .translate([dimensions.width / 2, dimensions.height / 2])
    .rotate(mapDef.projection.rotation);

  const path = d3.geoPath().projection(projection);

  // Render geography
  // ... (existing map rendering code)

  // Render user data (paths, points)
  // ... (existing overlay rendering code)
}
```

### Step 3: Compose Page Layout (SVG Assembly)

```typescript
function composePage(
  mapCanvas: SVGGElement,
  layout: LayoutResult,
  furniture: FurnitureConfig
): SVGSVGElement {
  // Create page-level SVG
  const svg = createSVG(layout.page.width, layout.page.height);

  // Position map canvas
  const mapGroup = svg.append('g')
    .attr('transform', `translate(${layout.map.x}, ${layout.map.y})`);
  mapGroup.node().appendChild(mapCanvas);

  // Render furniture at calculated positions
  if (furniture.title && layout.furniture.title) {
    renderTitleBlock(svg, furniture.title, layout.furniture.title);
  }

  if (furniture.qrCode && layout.furniture.qrCode) {
    renderQRCode(svg, furniture.qrCode, layout.furniture.qrCode);
  }

  return svg.node();
}
```

## User Workflow: Two-Step Configuration

### Step 1: Map Configuration Page (`/create-map`)

**User Interface:**
```
┌─────────────────────────────────────────────────────────┐
│ AlwaysMap - Create Your Map                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Add Person] [Remove Person]                          │
│                                                         │
│  People:                                                │
│  • Alice - 3 locations                                  │
│  • Bob - 2 locations                                    │
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │         Interactive Globe                       │    │
│  │     (drag to rotate, shows data)                │    │
│  │                                                 │    │
│  │              🌍                                 │    │
│  │                                                 │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  [← Back]              [Continue to Print Preview →]   │
└─────────────────────────────────────────────────────────┘
```

**At this stage:**
- User configures ONLY the map data
- Interactive rotation to find best view
- No page size/orientation decisions yet
- Map fills available browser space

### Step 2: Print Layout Page (`/configure-print`)

**User Interface:**
```
┌─────────────────────────────────────────────────────────┐
│ AlwaysMap - Configure Print                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Page Size: [18×24 ▼]  Orientation: [Portrait ▼]      │
│                                                         │
│  Title: [Our Family Journey_____________]              │
│  Subtitle: [2010-2024___________________]              │
│  Title Position: [Top Left ▼]  (options: Top Left,     │
│                                  Top Right, Bottom      │
│                                  Left, Bottom Right)    │
│                                                         │
│  QR Code Position: [Top Right ▼]                       │
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │ ┌──────────────────────────────────────────┐   │    │
│  │ │ Bleed (0.125")                           │   │    │ ← Page boundary overlay
│  │ │  ┌────────────────────────────────────┐  │   │    │
│  │ │  │ Safe Area                          │  │   │    │
│  │ │  │ Title: Our Family Journey          │  │   │    │
│  │ │  │                              [QR]  │  │   │    │
│  │ │  │  ┌──────────────────────────┐     │  │   │    │
│  │ │  │  │                          │     │  │   │    │
│  │ │  │  │    Globe (centered)      │     │  │   │    │ ← Exact print preview
│  │ │  │  │         🌍               │     │  │   │    │
│  │ │  │  │                          │     │  │   │    │
│  │ │  │  └──────────────────────────┘     │  │   │    │
│  │ │  │                                    │  │   │    │
│  │ │  └────────────────────────────────────┘  │   │    │
│  │ └──────────────────────────────────────────┘   │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  Fine-tune rotation: [Rotate Left] [Rotate Right]      │
│                                                         │
│  [← Back to Map]        [Export to PNG →]              │
└─────────────────────────────────────────────────────────┘
```

**At this stage:**
- User sees EXACT print preview in browser
- Page boundaries visualized with overlays
- User controls:
  - Page size → preview updates instantly
  - Orientation → preview updates instantly
  - Title/subtitle TEXT → preview updates
  - **Title position** (4 corner options) → preview updates
  - **QR code position** (4 corner options) → preview updates
  - Map rotation (fine-tune) → preview updates
- Layout engine translates choices to exact pixel coordinates
- Validates no furniture collisions (shows error if overlap)
- **What they see IS what they'll get**

**Key Implementation Detail:**
The preview renders the SAME SVG at print DPI (300), then scales it down to fit the browser viewport. This ensures pixel-perfect accuracy.

```typescript
// Render at print DPI
const printDimensions = calculatePageDimensions({ size: '18x24', dpi: 300 });
// → 5475×7275px

// Display at screen resolution (scale down)
const screenScale = Math.min(
  viewportWidth / printDimensions.width,
  viewportHeight / printDimensions.height
);

// SVG transform for display
svg.style.transform = `scale(${screenScale})`;
svg.style.transformOrigin = 'top left';
```

### Step 3: Export (Backend/Puppeteer)

When user clicks "Export to PNG":

1. POST map definition + page spec + furniture to `/api/export`
2. Server/Puppeteer navigates to `/render` with encoded data
3. Renders SAME layout calculation, SAME SVG
4. Takes screenshot at 300 DPI
5. Returns identical PNG to what user previewed

## Example Code Usage

### Browser: Print Preview Page

```typescript
// User's map data from Step 1
const mapDefinition: MapDefinition = {
  people: [...],
  projection: {
    type: 'orthographic',
    rotation: [-20, -30, 0]
  },
  aspectRatio: 1.0
};

// User's print choices from Step 2
const pageSpec: PageSpec = {
  size: '18x24',
  orientation: 'portrait',
  dpi: 300,
  bleed: 0.125,
  safeMargin: 0.25,
  colorProfile: 'srgb'
};

// User's text from Step 2
const furniture: FurnitureConfig = {
  title: {
    text: 'Our Family Journey',
    subtitle: '2010-2024',
    position: 'top-left'
  },
  qrCode: {
    url: 'https://alwaysmap.com/map/abc123',
    position: 'top-right',
    size: 1.0
  }
};

// Calculate layout (same in browser and Puppeteer)
const layout = calculateLayout(mapDefinition, pageSpec, furniture);

// Render at print DPI
const svg = renderPrintPreview(mapDefinition, pageSpec, furniture, layout);
// → SVG at 5475×7275px

// Scale down for display
const scale = calculateDisplayScale(layout.page, viewportSize);
svg.style.transform = `scale(${scale})`;

// Render page boundary overlays
renderPageOverlay(svg, layout, scale);
```

### Puppeteer: Export to PNG

```typescript
// Same inputs from user (passed via URL parameters)
const { mapDefinition, pageSpec, furniture } = decodeFromURL();

// Same layout calculation (pure function)
const layout = calculateLayout(mapDefinition, pageSpec, furniture);

// Same rendering code
const svg = renderPrintPreview(mapDefinition, pageSpec, furniture, layout);

// Set viewport to exact print dimensions
await page.setViewport({
  width: layout.page.width,  // 5475px
  height: layout.page.height, // 7275px
  deviceScaleFactor: 1
});

// Take screenshot (pixel-perfect)
const screenshot = await page.screenshot({ type: 'png', fullPage: true });

// Embed ICC profile
const final = await embedSRGBProfile(screenshot);
```

## Benefits of This Design

### 1. Separation of Concerns
- Map is defined independently of page
- Layout is a pure calculation
- Rendering is composable

### 2. Reusability
- Same map can be rendered at different page sizes
- Same layout engine for all page types
- Furniture is configuration, not code

### 3. Testability
- `calculateLayout()` is a pure function
- Map rendering has no side effects
- Easy to test all edge cases

### 4. Flexibility
- Add new page sizes without changing map code
- Support landscape/portrait dynamically
- Easy to add new furniture types

### 5. D3-Native
- Uses D3's projection system correctly
- Scale is calculated per projection type
- Follows D3 conventions for SVG composition

## Migration Path

### Phase 1: Extract Layout Calculation
1. Create `src/lib/layout/` directory
2. Implement `calculateLayout()` as pure function
3. Write comprehensive unit tests
4. Keep existing renderer working

### Phase 2: Refactor Map Renderer
1. Split `renderMap()` into `renderMapCanvas()` + `composePage()`
2. Update to use layout calculations
3. Update tests to match new API

### Phase 3: Update CLI Tool
1. Modify export pipeline to use new layout system
2. Update validation to check layout results
3. Test all page sizes and orientations

### Phase 4: Add New Features
1. Support landscape orientation
2. Add letter, A4, A3 page sizes
3. Implement legend and scale bar furniture

## Expected Result: Optimized Layout

After implementing this design, the same 18×24 page should look like:

```
┌────────────────────────────────────────────┐
│ Title: Our Family Journey    ┌──┐         │ ← Safe margin
│ 2010-2024                     │QR│         │
│                               └──┘         │
│ ┌──────────────────────────────────────┐  │
│ │                                      │  │
│ │                                      │  │
│ │                                      │  │
│ │                                      │  │
│ │                                      │  │
│ │           🌍 Large Globe             │  │ ← ~85% content fill
│ │        (maximized to fill)           │  │
│ │                                      │  │
│ │                                      │  │
│ │                                      │  │
│ │                                      │  │
│ │                                      │  │
│ └──────────────────────────────────────┘  │
│                                            │ ← Safe margin
└────────────────────────────────────────────┘
```

**Target measurements:**
- Total page: 5475×7275px (18×24 inches)
- Safe area (0.25" margins): 5325×7125px
- Furniture space: Title top (~150px), QR code top-right (~150px)
- Available for map: ~5325×6900px
- Globe size (1:1 aspect): ~5325×5325px (optimized to width)
- **Content fill: ~80-85% of page**

**Improvements:**
- Globe is **3.2× larger** (diameter goes from ~1640px to ~5325px)
- Much more geographic detail visible
- Better use of expensive print area
- Professional appearance
- Justifies the 18×24 price point

## Open Questions

1. **Default Aspect Ratios**: Should orthographic projection default to 1:1? What about other projections?
   - **Answer**: Yes, 1:1 for orthographic (globe is circular). Other projections vary.

2. **Furniture Collision**: How do we handle when furniture + map don't fit? Shrink map? Move furniture? Fail validation?
   - **Proposed**: Reserve fixed space for furniture (e.g., 200px top for title+QR), shrink map to fit remaining space.

3. **Margins**: Should furniture margins be configurable or fixed? What's the minimum safe distance from map?
   - **Proposed**: Fixed safe margins (0.25" from trim), configurable furniture spacing (default 20px between elements).

4. **Responsive**: Should we support dynamic resizing, or is print-only sufficient for POC?
   - **Answer**: Print-only for POC. Interactive view can stay as-is.

5. **Multi-Map Layouts**: Future feature - multiple maps on one page (e.g., inset map)?
   - **Answer**: Out of scope for POC, but architecture should support it.

## Next Steps

1. Review this design document
2. Answer open questions
3. Create implementation plan
4. Start with Phase 1 (layout calculation)
5. Write tests before implementation

---

**Goal**: Clean separation between map (what we visualize) and page (how we print it), with a pure functional layout engine that maximizes map content within available space.
