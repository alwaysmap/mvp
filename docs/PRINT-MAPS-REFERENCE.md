# Print Maps Reference Analysis

Source: https://github.com/mpetroff/print-maps

## Overview

Print Maps is a browser-based tool for generating print-resolution maps using Mapbox GL JS. It addresses the common problem of web maps lacking sufficient resolution for printing.

**Our context**: We're using this as an **informational reference only** - not changing our D3-based approach, but learning from their solutions to similar problems.

## Key Learnings

### 1. DPI Handling via `devicePixelRatio` Hack

**Their approach**:
```javascript
var actualPixelRatio = window.devicePixelRatio;
Object.defineProperty(window, 'devicePixelRatio', {
    get: function() {return dpi / 96}
});
```

**What they do**:
- Override browser's `devicePixelRatio` property
- Makes WebGL render at higher resolution
- Formula: `devicePixelRatio = userDPI / 96`
- Example: 300 DPI → devicePixelRatio = 3.125

**Relevance to us**:
- We use Puppeteer for export (doesn't need this hack)
- Our browser preview is SVG-based (scales cleanly)
- **But**: Good pattern if we ever need canvas-based rendering
- **Insight**: 96 is the web standard pixels-per-inch baseline

### 2. Pixel Conversion Function

**Their approach**:
```javascript
function toPixels(length) {
    var unit = form.unitOptions[0].checked ? 'in' : 'mm';
    var conversionFactor = 96;
    if (unit == 'mm') {
        conversionFactor /= 25.4;
    }
    return conversionFactor * length + 'px';
}
```

**What they do**:
- Convert inches or mm → pixels
- Base conversion: 1 inch = 96 pixels (web standard)
- For mm: 96 / 25.4 = 3.78 pixels per mm
- Returns CSS pixel string (e.g., "768px")

**Relevance to us**:
- **We should use this same conversion!**
- Our `calculateDimensions()` function should follow this pattern
- Standard web DPI is 96, not 72 (print standard)
- Our current code might be using different baseline

**Action**: Verify our dimension calculations use 96 PPI as baseline, then scale to 300 DPI for print.

### 3. Hidden Container for High-Res Rendering

**Their approach**:
```javascript
var hidden = document.createElement('div');
hidden.className = 'hidden-map';
document.body.appendChild(hidden);
var container = document.createElement('div');
container.style.width = toPixels(width);
container.style.height = toPixels(height);
hidden.appendChild(container);
```

**What they do**:
- Create hidden DOM element
- Render high-resolution map in background
- User sees interactive preview map
- Export uses hidden high-res version

**Relevance to us**:
- **Similar to our Puppeteer approach**
- We render separate high-res version via `/render` route
- They do it client-side (WebGL), we do server-side (SVG → PNG)
- **Validates our architecture** - separation of preview from export is good

### 4. Simple User Input Model

**Their form**:
- Width (number)
- Height (number)
- DPI (number)
- Unit (inch/mm radio)
- Format (PNG/PDF radio)
- Lat/Lon/Zoom (coordinates)

**What they do**:
- User directly specifies dimensions in physical units
- No "page size presets" like "18×24"
- Very flexible but requires user to know dimensions
- Validation: width × DPI ≤ max WebGL texture size

**Relevance to us**:
- **We use presets** (better UX for non-experts)
- Could add "custom" option later
- Their validation logic is useful: check if requested pixels exceed limits
- **Action**: Add validation for max dimensions (Puppeteer/Sharp limits)

### 5. WebGL Limitations

**Their constraints**:
- Max texture size: `gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)`
- Locked to Mapbox GL v1.13 (licensing issues)
- Warns users if dimensions × DPI too large

**Relevance to us**:
- **We don't have this constraint** (SVG → PNG, not WebGL)
- Our limits: Puppeteer memory, Sharp memory
- **Action**: Document max practical dimensions in our validation

### 6. No Layout Engine

**What they DON'T do**:
- No furniture (title, QR code, etc.)
- No safe areas or bleed
- No page layout calculation
- Just: map at exact dimensions specified

**Relevance to us**:
- **We need layout engine** (they don't)
- Our use case is different: print-on-demand with furniture
- Their tool is for cartographers who handle layout in separate software
- **Validates our design** - layout engine is necessary for our use case

## Patterns to Adopt

### ✅ Dimension Conversion

Use their pixel conversion pattern:
```typescript
function inchesToPixels(inches: number, dpi: number): number {
  const webPPI = 96; // Standard web pixels-per-inch
  const scaleFactor = dpi / webPPI;
  return Math.round(inches * webPPI * scaleFactor);
}

function mmToPixels(mm: number, dpi: number): number {
  const inches = mm / 25.4;
  return inchesToPixels(inches, dpi);
}
```

### ✅ Validation Pattern

Check if requested dimensions exceed practical limits:
```typescript
function validateDimensions(
  width: number,
  height: number,
  dpi: number
): { valid: boolean; error?: string } {
  const pixels = width * height * (dpi / 96) ** 2;
  const maxPixels = 50_000_000; // ~7000×7000 px

  if (pixels > maxPixels) {
    return {
      valid: false,
      error: `Dimensions too large: ${Math.round(pixels / 1_000_000)}MP exceeds ${maxPixels / 1_000_000}MP limit`
    };
  }

  return { valid: true };
}
```

### ✅ Two-Version Rendering

Maintain separate preview and export versions:
- **Preview**: Interactive, screen resolution
- **Export**: High-res, print DPI
- Never try to make one version serve both purposes

## Patterns to Avoid

### ❌ Client-Side High-Res Rendering

They render high-DPI in browser (WebGL limitations).
We use Puppeteer (better for SVG, no WebGL constraints).

### ❌ Direct Dimension Input

They make users specify exact inches/mm.
We use presets (better UX for general users).

### ❌ `devicePixelRatio` Hacking

Only needed for WebGL/Canvas rendering.
SVG scales without this trick.

## Comparison Table

| Aspect | Print Maps | AlwaysMap (Our Design) |
|--------|------------|------------------------|
| **Rendering** | Mapbox GL (WebGL) | D3 (SVG) |
| **Export** | Client-side canvas→PNG | Server-side Puppeteer→PNG |
| **Input** | Direct dimensions | Preset page sizes |
| **Layout** | None (map only) | Layout engine (map + furniture) |
| **Preview** | Interactive Mapbox map | Interactive D3 map |
| **DPI** | Via devicePixelRatio hack | Puppeteer viewport + CSS scaling |
| **Furniture** | None | Title, QR, future: legend, scale |
| **Use Case** | Cartographers | General users (print-on-demand) |
| **Limits** | WebGL texture size | Puppeteer/Sharp memory |

## Takeaways for Our Implementation

1. **Dimension Calculations** ✅
   - Use 96 PPI as web baseline (not 72)
   - Follow their conversion formulas
   - Verify our `calculateDimensions()` matches this

2. **Validation** ✅
   - Add max dimension checks
   - Prevent memory-exhausting exports
   - Show clear error messages

3. **Architecture Validation** ✅
   - Separate preview from export (confirmed good)
   - Layout engine is necessary (they skip it, we need it)
   - SVG approach is solid (no WebGL constraints)

4. **User Experience** ✅
   - Presets better than direct input (for our audience)
   - But could add "custom size" option later
   - Live preview is essential

5. **Don't Change** ✅
   - Keep D3/SVG approach (no need for WebGL)
   - Keep Puppeteer export (better than client-side)
   - Keep layout engine design (we need it, they don't)

## Action Items

Based on this reference:

1. ✅ Verify dimension calculations use 96 PPI baseline
2. ✅ Add max dimension validation
3. ✅ Keep two-version rendering (preview + export)
4. ✅ Document practical size limits
5. ✅ Consider "custom size" option for advanced users (future)

## Conclusion

Print Maps validates several of our design decisions while providing useful patterns for dimension calculations. Their simpler use case (map only, no layout) confirms we need the layout engine we're designing. Their WebGL constraints don't apply to us, but their dimension math and validation patterns are directly applicable.

**Status**: Reference reviewed, key patterns identified, no changes to core architecture needed.
