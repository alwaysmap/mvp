# Native Units Refactor (Future Feature)

**Status**: Planned
**Priority**: Medium
**Estimated Effort**: 2-3 days

## Overview

Refactor the page dimension system to use native units (millimeters for A-series, inches for USA sizes) instead of converting everything to inches at the UI boundary.

## Current State (As of 2025-12-07)

The system currently works as follows:

1. **UI Layer**: Shows user-friendly names ("A4", "18×24", "Portrait", "Landscape")
2. **Internal Format**: Everything converted to inches at the `page-sizes.ts` boundary
3. **Storage**: Database stores `widthInches` and `heightInches` (always in inches)
4. **Export**: Worker converts inches to points (1/72 inch) for Puppeteer

### Example Current Flow

```typescript
// A4 Portrait (native: 210mm × 297mm)
// UI: User selects "A4" + "Portrait"
// page-sizes.ts: Returns { widthInches: 8.27, heightInches: 11.69 }
// API: Stores { widthInches: 8.27, heightInches: 11.69 }
// Worker: Converts to points for Puppeteer
```

## Problems with Current Approach

1. **Loss of Precision**: Converting A-series from mm → inches introduces rounding errors
   - A4: 210mm = 8.267716... inches (stored as 8.27)
   - Reconverting loses original exact mm value

2. **Conceptual Mismatch**: A-series paper is defined in mm, not inches
   - ISO 216 standard defines A4 as exactly 210mm × 297mm
   - Storing as 8.27" × 11.69" is semantically incorrect

3. **Unnecessary Conversion**: Double conversion (mm → inches → points) vs single (mm → points)

## Proposed Future State

### Schema Changes

```typescript
// src/lib/db/schema.ts
export interface PrintableMapData {
  width: number;           // Numeric value in native units
  height: number;          // Numeric value in native units
  units: 'mm' | 'inches';  // Native units for this page size
  paperSizeName?: string;  // Display name only (e.g., 'A4', '18×24')
  // ... other fields
}
```

### Page Size Definitions

```typescript
// src/lib/map-renderer/page-sizes.ts
export const A_SERIES_SIZES: StandardPageSize[] = [
  {
    name: 'A4',
    portraitWidth: 210,    // Exact mm value
    portraitHeight: 297,   // Exact mm value
    units: 'mm',
    group: 'A-Series'
  }
];

export const USA_SIZES: StandardPageSize[] = [
  {
    name: '18×24',
    portraitWidth: 18,     // Inches
    portraitHeight: 24,    // Inches
    units: 'inches',
    group: 'USA'
  }
];
```

### Unit Conversion Library

```typescript
// src/lib/map-renderer/unit-conversion.ts
export function toPoints(value: number, units: 'mm' | 'inches'): number {
  if (units === 'inches') {
    return value * 72;  // 1 inch = 72 points
  }
  return (value / 25.4) * 72;  // mm → inches → points
}
```

### Example Future Flow

```typescript
// A4 Portrait (native: 210mm × 297mm)
// UI: User selects "A4" + "Portrait"
// page-sizes.ts: Returns { width: 210, height: 297, units: 'mm' }
// API: Stores { width: 210, height: 297, units: 'mm' }
// Worker: Uses toPoints(210, 'mm') for exact conversion
```

## Benefits

1. **Precision**: No rounding errors - A4 is exactly 210mm × 297mm
2. **Semantic Correctness**: Paper sizes stored in their ISO-defined units
3. **Single Conversion**: One conversion step (native units → points) instead of two
4. **Clarity**: Code explicitly shows which unit system each size uses

## Implementation Plan

### Phase 1: Core Schema & Types (1 day)

- [ ] Update `PrintableMapData` interface in `src/lib/db/schema.ts`
- [ ] Update `StandardPageSize` interface in `src/lib/map-renderer/page-sizes.ts`
- [ ] Update `USA_SIZES` and `A_SERIES_SIZES` with native units
- [ ] Update `getDimensionsForOrientation()` to return `width`, `height`, `units`
- [ ] Create/update `unit-conversion.ts` with conversion utilities

### Phase 2: Update PRINT_SPECS (0.5 days)

- [ ] Add `units` field to `PrintSpec` type
- [ ] Update all PRINT_SPECS entries with native dimensions
- [ ] Update `findPrintSpec()` to match on `(width, height, units)` tuple
- [ ] Add tolerance for mm comparisons (± 1mm acceptable)

### Phase 3: Update API & Queue (0.5 days)

- [ ] Update `src/routes/api/export/+server.ts` validation
- [ ] Update `src/lib/queue/pg-boss-queue.ts` to pass units
- [ ] Update `ExportJobData` type to include units

### Phase 4: Update Worker & Export (0.5 days)

- [ ] Update `src/lib/queue/pg-boss-worker.ts` to use conversion library
- [ ] Update Puppeteer page size calculation to use `toPoints()`
- [ ] Test export with both mm and inches page sizes

### Phase 5: Update UI Components (0.5 days)

- [ ] Update `src/lib/stores/map-editor.svelte.ts`
- [ ] Update any components that reference dimensions
- [ ] Ensure UI still shows friendly names

### Phase 6: Update Tests (1 day)

- [ ] Update all integration tests to use new schema format
- [ ] Update unit tests for page-sizes.ts
- [ ] Update unit tests for dimensions.ts
- [ ] Add tests for unit-conversion.ts
- [ ] Verify all 276+ tests pass

### Phase 7: Database Migration (if needed)

- [ ] Consider if database migration is needed for existing data
- [ ] Most likely: New schema is forward-compatible (JSONB flexibility)

## Test Coverage Requirements

- [ ] Unit tests for all conversion functions
- [ ] Integration tests for A4 landscape (mm-based)
- [ ] Integration tests for 18×24 landscape (inches-based)
- [ ] Verify exact dimensions in exported PNGs (no rounding errors)
- [ ] Cross-unit-system validation (ensure USA and A-series both work)

## Risks & Considerations

### Risk: Breaking Changes

**Mitigation**: JSONB schema is flexible - old data with `widthInches`/`heightInches` can coexist with new data using `width`/`height`/`units`. Add migration code if needed.

### Risk: Test Brittleness

**Mitigation**: Update tests incrementally, one file at a time. Verify each step before proceeding.

### Risk: Precision Loss in Conversion

**Mitigation**: Use exact conversion factors (25.4 mm/inch, 72 points/inch) and avoid intermediate rounding.

## Success Criteria

- [ ] All 276+ tests passing
- [ ] A4 stored as exactly 210mm × 297mm (not 8.27" × 11.69")
- [ ] USA sizes stored as inches (18" × 24", not 457.2mm × 609.6mm)
- [ ] Export produces identical PNGs to current system
- [ ] No performance degradation
- [ ] Code is more semantically clear

## Related Documentation

- See `CLAUDE.md` for overall project guidelines
- See `MAP-PAGE-LAYOUT-DESIGN.md` for print layout specifications
- See current implementation in `src/lib/map-renderer/page-sizes.ts`

## Notes

This refactor was discussed on 2025-12-07 after successfully fixing the landscape page size bug. The current `widthInches`/`heightInches` approach works correctly (all tests pass) but is less elegant than using native units.

The refactor is not urgent but would improve code quality and semantic correctness. It can be implemented incrementally without breaking existing functionality.
