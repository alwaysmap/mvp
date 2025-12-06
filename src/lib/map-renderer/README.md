# Map Renderer

Framework-agnostic D3-based map renderer for print-ready output.

## Quick Start

```typescript
import { renderMap, PRINT_SPECS } from '$lib/map-renderer';

const mapDef = {
  title: 'Our Family Journey',
  subtitle: '2010-2024',
  people: [/* ... */]
};

await renderMap(mapDef, PRINT_SPECS['18x24'], {
  selector: '#map-svg'
});
```

## Changing Colors

### Method 1: Via RenderOptions (Runtime)

```typescript
await renderMap(mapDef, PRINT_SPECS['18x24'], {
  selector: '#map-svg',
  backgroundColor: '#f4ebe1' // Antique parchment
});
```

### Method 2: Via CSS Variables (Easy Theme Changes)

Import the theme CSS and override variables:

```svelte
<style>
  :global(:root) {
    --map-canvas-bg: #f4ebe1;  /* Antique parchment */
    --map-ocean: #d4e4e8;      /* Muted blue-grey */
    --map-land: #e8dfd0;       /* Warm cream */
  }
</style>
```

### Method 3: Modify styles.ts (Global Default)

Edit `src/lib/map-renderer/styles.ts`:

```typescript
export const colors = {
  canvasBackground: '#f4ebe1', // Change this!
  ocean: '#d4e4e8',
  // ...
};
```

## Current Theme: Antique Print

The default color scheme uses warm, muted tones inspired by antique maps:

- **Canvas**: `#f4ebe1` - Parchment cream
- **Ocean**: `#d4e4e8` - Muted blue-grey
- **Land**: `#e8dfd0` - Warm cream
- **Borders**: Taupe and warm greys
- **Paths**: Muted earth tones

This helps test print color accuracy and gives a classic cartography feel.

## Print Specifications

- **Resolution**: 300 DPI
- **Color Profile**: sRGB
- **Coordinate System**: Points (1pt = 1/72 inch)
- **Bleed**: 0.125" (9pt)
- **Safe Margin**: 0.25" (18pt)

## Available Sizes

- `PRINT_SPECS['12x16']` - 12×16" poster
- `PRINT_SPECS['18x24']` - 18×24" poster
- `PRINT_SPECS['24x36']` - 24×36" poster
