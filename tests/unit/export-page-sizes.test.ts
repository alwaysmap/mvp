/**
 * Unit tests for page size parsing in export functionality.
 * Tests that all PageSize values can be correctly parsed and converted
 * to paper names and orientations for the export API.
 */

import { describe, it, expect } from 'vitest';
import { ALL_STANDARD_SIZES, getDimensionsForOrientation } from '$lib/map-renderer/page-sizes';
import { findPageSize } from '$lib/map-renderer/page-size-utils';
import type { PageSize } from '$lib/layout/types';

/**
 * Parse a PageSize value into paper name and orientation.
 * This mimics the logic in map-editor.svelte.ts triggerExport().
 */
function parsePageSize(pageSize: PageSize): {
	paperSizeName: string;
	orientation: 'portrait' | 'landscape';
} {
	let paperSizeName: string;
	let orientation: 'portrait' | 'landscape';

	// Determine if this is landscape based on format
	if (pageSize.endsWith('-landscape')) {
		orientation = 'landscape';
		paperSizeName = pageSize.replace('-landscape', '');
	} else {
		// For USA sizes, check if dimensions suggest landscape
		const [width, height] = pageSize.split('x').map(Number);
		if (!isNaN(width) && !isNaN(height) && width > height) {
			orientation = 'landscape';
			// Find the portrait version to get the paper name
			paperSizeName = `${height}x${width}`;
		} else if (!isNaN(width) && !isNaN(height)) {
			orientation = 'portrait';
			paperSizeName = pageSize;
		} else {
			// A-series portrait
			orientation = 'portrait';
			paperSizeName = pageSize;
		}
	}

	return { paperSizeName, orientation };
}

// Use the centralized findPageSize helper from page-size-utils
// (No local implementation needed)

describe('Export Page Size Parsing', () => {
	describe('USA Portrait Sizes', () => {
		const portraitSizes: PageSize[] = ['8x10', '12x16', '18x24', '24x36'];

		portraitSizes.forEach((size) => {
			it(`should parse ${size} as portrait`, () => {
				const result = parsePageSize(size);
				expect(result.orientation).toBe('portrait');
				expect(result.paperSizeName).toBe(size);

				// Verify it can be found in standard sizes
				const standardSize = findPageSize(result.paperSizeName);
				expect(standardSize).toBeDefined();
				expect(standardSize?.group).toBe('USA');
			});

			it(`should get correct dimensions for ${size} portrait`, () => {
				const { paperSizeName, orientation } = parsePageSize(size);
				const standardSize = findPageSize(paperSizeName);
				expect(standardSize).toBeDefined();

				const dimensions = getDimensionsForOrientation(standardSize!, orientation);
				expect(dimensions.widthInches).toBeLessThan(dimensions.heightInches);
			});
		});
	});

	describe('USA Landscape Sizes', () => {
		const landscapeSizes: PageSize[] = ['10x8', '16x12', '24x18', '36x24'];
		const expectedPortraitNames = ['8x10', '12x16', '18x24', '24x36'];

		landscapeSizes.forEach((size, index) => {
			it(`should parse ${size} as landscape with correct paper name`, () => {
				const result = parsePageSize(size);
				expect(result.orientation).toBe('landscape');
				expect(result.paperSizeName).toBe(expectedPortraitNames[index]);

				// Verify it can be found in standard sizes
				const standardSize = findPageSize(result.paperSizeName);
				expect(standardSize).toBeDefined();
				expect(standardSize?.group).toBe('USA');
			});

			it(`should get correct dimensions for ${size} landscape`, () => {
				const { paperSizeName, orientation } = parsePageSize(size);
				const standardSize = findPageSize(paperSizeName);
				expect(standardSize).toBeDefined();

				const dimensions = getDimensionsForOrientation(standardSize!, orientation);
				expect(dimensions.widthInches).toBeGreaterThan(dimensions.heightInches);
			});
		});
	});

	describe('A-Series Portrait Sizes', () => {
		const portraitSizes: PageSize[] = ['A4', 'A3', 'A2', 'A1'];

		portraitSizes.forEach((size) => {
			it(`should parse ${size} as portrait`, () => {
				const result = parsePageSize(size);
				expect(result.orientation).toBe('portrait');
				expect(result.paperSizeName).toBe(size);

				// Verify it can be found in standard sizes
				const standardSize = findPageSize(result.paperSizeName);
				expect(standardSize).toBeDefined();
				expect(standardSize?.group).toBe('A-Series');
			});

			it(`should get correct dimensions for ${size} portrait`, () => {
				const { paperSizeName, orientation } = parsePageSize(size);
				const standardSize = findPageSize(paperSizeName);
				expect(standardSize).toBeDefined();

				const dimensions = getDimensionsForOrientation(standardSize!, orientation);
				expect(dimensions.widthInches).toBeLessThan(dimensions.heightInches);
			});
		});
	});

	describe('A-Series Landscape Sizes', () => {
		const landscapeSizes: PageSize[] = ['A4-landscape', 'A3-landscape', 'A2-landscape', 'A1-landscape'];
		const expectedPortraitNames = ['A4', 'A3', 'A2', 'A1'];

		landscapeSizes.forEach((size, index) => {
			it(`should parse ${size} with correct paper name`, () => {
				const result = parsePageSize(size);
				expect(result.orientation).toBe('landscape');
				expect(result.paperSizeName).toBe(expectedPortraitNames[index]);

				// Verify it can be found in standard sizes
				const standardSize = findPageSize(result.paperSizeName);
				expect(standardSize).toBeDefined();
				expect(standardSize?.group).toBe('A-Series');
			});

			it(`should get correct dimensions for ${size}`, () => {
				const { paperSizeName, orientation } = parsePageSize(size);
				const standardSize = findPageSize(paperSizeName);
				expect(standardSize).toBeDefined();

				const dimensions = getDimensionsForOrientation(standardSize!, orientation);
				expect(dimensions.widthInches).toBeGreaterThan(dimensions.heightInches);
			});
		});
	});

	describe('Character normalization (x vs ×)', () => {
		it('should match "18x24" with "18×24"', () => {
			const standardSize1 = findPageSize('18x24');
			const standardSize2 = findPageSize('18×24');
			expect(standardSize1).toBeDefined();
			expect(standardSize2).toBeDefined();
			expect(standardSize1).toEqual(standardSize2);
		});

		it('should match "12x16" with "12×16"', () => {
			const standardSize1 = findPageSize('12x16');
			const standardSize2 = findPageSize('12×16');
			expect(standardSize1).toBeDefined();
			expect(standardSize2).toBeDefined();
			expect(standardSize1).toEqual(standardSize2);
		});

		it('should match case-insensitive x variants', () => {
			const standardSize1 = findPageSize('18x24');
			const standardSize2 = findPageSize('18X24');
			expect(standardSize1).toBeDefined();
			expect(standardSize2).toBeDefined();
			expect(standardSize1).toEqual(standardSize2);
		});
	});

	describe('Dimension consistency', () => {
		it('portrait and landscape should have swapped dimensions', () => {
			const portraitSize = findPageSize('18x24');
			expect(portraitSize).toBeDefined();

			const portraitDims = getDimensionsForOrientation(portraitSize!, 'portrait');
			const landscapeDims = getDimensionsForOrientation(portraitSize!, 'landscape');

			expect(portraitDims.widthInches).toBe(landscapeDims.heightInches);
			expect(portraitDims.heightInches).toBe(landscapeDims.widthInches);
		});

		it('all sizes should have positive dimensions', () => {
			ALL_STANDARD_SIZES.forEach((size) => {
				const portraitDims = getDimensionsForOrientation(size, 'portrait');
				const landscapeDims = getDimensionsForOrientation(size, 'landscape');

				expect(portraitDims.widthInches).toBeGreaterThan(0);
				expect(portraitDims.heightInches).toBeGreaterThan(0);
				expect(landscapeDims.widthInches).toBeGreaterThan(0);
				expect(landscapeDims.heightInches).toBeGreaterThan(0);
			});
		});
	});

	describe('Paper size name preservation', () => {
		it('should preserve paper size name in dimensions', () => {
			const size = findPageSize('18x24');
			expect(size).toBeDefined();

			const dims = getDimensionsForOrientation(size!, 'portrait');
			expect(dims.paperSizeName).toBe(size!.name);
		});

		it('should use same paper name for portrait and landscape', () => {
			const size = findPageSize('A4');
			expect(size).toBeDefined();

			const portraitDims = getDimensionsForOrientation(size!, 'portrait');
			const landscapeDims = getDimensionsForOrientation(size!, 'landscape');

			expect(portraitDims.paperSizeName).toBe(landscapeDims.paperSizeName);
		});
	});

	describe('Export API compatibility', () => {
		const allPageSizes: PageSize[] = [
			// USA Portrait
			'8x10', '12x16', '18x24', '24x36',
			// USA Landscape
			'10x8', '16x12', '24x18', '36x24',
			// A-Series Portrait
			'A4', 'A3', 'A2', 'A1',
			// A-Series Landscape
			'A4-landscape', 'A3-landscape', 'A2-landscape', 'A1-landscape'
		];

		allPageSizes.forEach((pageSize) => {
			it(`should successfully process ${pageSize} for export`, () => {
				const { paperSizeName, orientation } = parsePageSize(pageSize);
				const standardSize = findPageSize(paperSizeName);
				expect(standardSize).toBeDefined();

				const dimensions = getDimensionsForOrientation(standardSize!, orientation);
				expect(dimensions).toHaveProperty('widthInches');
				expect(dimensions).toHaveProperty('heightInches');
				expect(dimensions).toHaveProperty('paperSizeName');
				expect(typeof dimensions.widthInches).toBe('number');
				expect(typeof dimensions.heightInches).toBe('number');
			});
		});
	});
});
