/**
 * Unit tests for layout calculation engine.
 *
 * Tests the core layout calculation functions to ensure:
 * - Deterministic output (same input → same output)
 * - Correct dimension calculations
 * - Proper furniture positioning
 * - Fill percentage maximization
 * - No overlaps or out-of-bounds furniture
 */

import { describe, it, expect } from 'vitest';
import {
	calculateLayout,
	calculatePageDimensions,
	calculateSafeArea,
	rectanglesIntersect,
	validateLayout
} from './calculate.js';
import type { UserMapData, PageLayout } from './types.js';

// ============================================================================
// Test Data
// ============================================================================

const testUserData: UserMapData = {
	people: [
		{
			id: 'test-person',
			name: 'Test Person',
			color: '#FF5733',
			locations: [
				{
					countryCode: 'US',
					longitude: -74.006,
					latitude: 40.7128,
					date: '2020-01-01'
				},
				{
					countryCode: 'GB',
					longitude: -0.1276,
					latitude: 51.5074,
					date: '2021-01-01'
				}
			]
		}
	],
	view: {
		projection: 'orthographic',
		rotation: [0, 0, 0]
	}
};

const testPageLayout: PageLayout = {
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
			text: 'Test Map',
			subtitle: '2020-2024',
			position: 'top-left',
			fontFamily: 'Cormorant Garamond',
			titleFontSize: 36,
			subtitleFontSize: 24
		},
		qrCode: {
			url: 'https://example.com',
			position: 'bottom-right',
			size: 72
		}
	}
};

// ============================================================================
// Page Dimensions Tests
// ============================================================================

describe('calculatePageDimensions', () => {
	it('calculates correct dimensions for 18x24 portrait', () => {
		const dims = calculatePageDimensions({
			size: '18x24',
			orientation: 'portrait',
			dpi: 300,
			bleed: 9,
			safeMargin: 18
		});

		// 18" = 1296pt, 24" = 1728pt
		expect(dims.trimWidth).toBe(1296);
		expect(dims.trimHeight).toBe(1728);

		// Total includes bleed on all sides (9pt × 2 = 18pt)
		expect(dims.totalWidth).toBe(1296 + 18);
		expect(dims.totalHeight).toBe(1728 + 18);

		// Pixels at 300 DPI
		expect(dims.pixels.width).toBe(5475);
		expect(dims.pixels.height).toBe(7275);
	});

	it('calculates correct dimensions for 18x24 landscape', () => {
		const dims = calculatePageDimensions({
			size: '18x24',
			orientation: 'landscape',
			dpi: 300,
			bleed: 9,
			safeMargin: 18
		});

		// Swapped for landscape
		expect(dims.trimWidth).toBe(1728);
		expect(dims.trimHeight).toBe(1296);
	});

	it('calculates correct dimensions for 12x16', () => {
		const dims = calculatePageDimensions({
			size: '12x16',
			orientation: 'portrait',
			dpi: 300,
			bleed: 9,
			safeMargin: 18
		});

		expect(dims.trimWidth).toBe(864);
		expect(dims.trimHeight).toBe(1152);
	});

	it('calculates correct dimensions for 24x36', () => {
		const dims = calculatePageDimensions({
			size: '24x36',
			orientation: 'portrait',
			dpi: 300,
			bleed: 9,
			safeMargin: 18
		});

		expect(dims.trimWidth).toBe(1728);
		expect(dims.trimHeight).toBe(2592);
	});

	it('throws error for unknown page size', () => {
		expect(() =>
			calculatePageDimensions({
				size: 'invalid' as any,
				orientation: 'portrait',
				dpi: 300,
				bleed: 9,
				safeMargin: 18
			})
		).toThrow('Unknown page size');
	});
});

// ============================================================================
// Safe Area Tests
// ============================================================================

describe('calculateSafeArea', () => {
	it('calculates safe area correctly', () => {
		const page = calculatePageDimensions(testPageLayout.page);
		const safeArea = calculateSafeArea(page, testPageLayout.page);

		// Safe area starts at bleed + safeMargin
		expect(safeArea.x).toBe(9 + 18); // 27
		expect(safeArea.y).toBe(9 + 18); // 27

		// Safe area width/height is trim minus 2× safe margin
		expect(safeArea.width).toBe(1296 - 36); // 1260
		expect(safeArea.height).toBe(1728 - 36); // 1692
	});

	it('safe area is smaller than trim area', () => {
		const page = calculatePageDimensions(testPageLayout.page);
		const safeArea = calculateSafeArea(page, testPageLayout.page);

		expect(safeArea.width).toBeLessThan(page.trimWidth);
		expect(safeArea.height).toBeLessThan(page.trimHeight);
	});
});

// ============================================================================
// Rectangle Intersection Tests
// ============================================================================

describe('rectanglesIntersect', () => {
	it('detects overlapping rectangles', () => {
		const r1 = { x: 0, y: 0, width: 100, height: 100 };
		const r2 = { x: 50, y: 50, width: 100, height: 100 };

		expect(rectanglesIntersect(r1, r2)).toBe(true);
	});

	it('detects non-overlapping rectangles', () => {
		const r1 = { x: 0, y: 0, width: 100, height: 100 };
		const r2 = { x: 200, y: 200, width: 100, height: 100 };

		expect(rectanglesIntersect(r1, r2)).toBe(false);
	});

	it('detects edge-touching rectangles as non-overlapping', () => {
		const r1 = { x: 0, y: 0, width: 100, height: 100 };
		const r2 = { x: 100, y: 0, width: 100, height: 100 };

		expect(rectanglesIntersect(r1, r2)).toBe(false);
	});

	it('detects contained rectangles', () => {
		const r1 = { x: 0, y: 0, width: 200, height: 200 };
		const r2 = { x: 50, y: 50, width: 50, height: 50 };

		expect(rectanglesIntersect(r1, r2)).toBe(true);
	});
});

// ============================================================================
// Complete Layout Tests
// ============================================================================

describe('calculateLayout', () => {
	it('calculates complete layout successfully', () => {
		const layout = calculateLayout(testUserData, testPageLayout);

		expect(layout.page).toBeDefined();
		expect(layout.safeArea).toBeDefined();
		expect(layout.map).toBeDefined();
		expect(layout.furniture).toBeDefined();
		expect(layout.fillPercentage).toBeGreaterThan(0);
	});

	it('produces deterministic output', () => {
		// Run layout calculation 10 times with same input
		const results = Array.from({ length: 10 }, () =>
			calculateLayout(testUserData, testPageLayout)
		);

		// All results should be identical
		for (let i = 1; i < results.length; i++) {
			expect(results[i]).toEqual(results[0]);
		}
	});

	it('map is within safe area', () => {
		const layout = calculateLayout(testUserData, testPageLayout);

		expect(layout.map.x).toBeGreaterThanOrEqual(layout.safeArea.x);
		expect(layout.map.y).toBeGreaterThanOrEqual(layout.safeArea.y);
		expect(layout.map.x + layout.map.width).toBeLessThanOrEqual(
			layout.safeArea.x + layout.safeArea.width
		);
		expect(layout.map.y + layout.map.height).toBeLessThanOrEqual(
			layout.safeArea.y + layout.safeArea.height
		);
	});

	it('title is within safe area', () => {
		const layout = calculateLayout(testUserData, testPageLayout);

		expect(layout.furniture.title.x).toBeGreaterThanOrEqual(layout.safeArea.x);
		expect(layout.furniture.title.y).toBeGreaterThanOrEqual(layout.safeArea.y);
		expect(layout.furniture.title.x + layout.furniture.title.width).toBeLessThanOrEqual(
			layout.safeArea.x + layout.safeArea.width
		);
		expect(layout.furniture.title.y + layout.furniture.title.height).toBeLessThanOrEqual(
			layout.safeArea.y + layout.safeArea.height
		);
	});

	it('qr code is within safe area', () => {
		const layout = calculateLayout(testUserData, testPageLayout);

		expect(layout.furniture.qrCode.x).toBeGreaterThanOrEqual(layout.safeArea.x);
		expect(layout.furniture.qrCode.y).toBeGreaterThanOrEqual(layout.safeArea.y);
		expect(layout.furniture.qrCode.x + layout.furniture.qrCode.width).toBeLessThanOrEqual(
			layout.safeArea.x + layout.safeArea.width
		);
		expect(layout.furniture.qrCode.y + layout.furniture.qrCode.height).toBeLessThanOrEqual(
			layout.safeArea.y + layout.safeArea.height
		);
	});

	it('calculates projection scale correctly', () => {
		const layout = calculateLayout(testUserData, testPageLayout);

		// For orthographic projection, scale should be half of smaller dimension
		const expectedScale = Math.min(layout.map.width, layout.map.height) / 2;
		expect(layout.map.scale).toBe(expectedScale);
	});

	it('calculates projection center correctly', () => {
		const layout = calculateLayout(testUserData, testPageLayout);

		// Center should be at midpoint of map
		const expectedCenterX = layout.map.x + layout.map.width / 2;
		const expectedCenterY = layout.map.y + layout.map.height / 2;

		expect(layout.map.center[0]).toBe(expectedCenterX);
		expect(layout.map.center[1]).toBe(expectedCenterY);
	});

	it('respects zoom adjustment', () => {
		const layout1 = calculateLayout(testUserData, {
			...testPageLayout,
			mapPlacement: { ...testPageLayout.mapPlacement, zoomAdjustment: 1.0 }
		});

		const layout2 = calculateLayout(testUserData, {
			...testPageLayout,
			mapPlacement: { ...testPageLayout.mapPlacement, zoomAdjustment: 0.8 }
		});

		// Map with 0.8 zoom should be smaller
		expect(layout2.map.width).toBeLessThan(layout1.map.width);
		expect(layout2.map.height).toBeLessThan(layout1.map.height);
	});

	it('calculates fill percentage', () => {
		const layout = calculateLayout(testUserData, testPageLayout);

		const mapArea = layout.map.width * layout.map.height;
		const safeAreaTotal = layout.safeArea.width * layout.safeArea.height;
		const expectedFill = (mapArea / safeAreaTotal) * 100;

		expect(layout.fillPercentage).toBeCloseTo(expectedFill, 1);
	});

	it('handles landscape orientation', () => {
		const landscapeLayout: PageLayout = {
			...testPageLayout,
			page: { ...testPageLayout.page, orientation: 'landscape' }
		};

		const layout = calculateLayout(testUserData, landscapeLayout);

		// Page should be landscape
		expect(layout.page.trimWidth).toBeGreaterThan(layout.page.trimHeight);

		// Map should still fit
		expect(layout.map.width).toBeGreaterThan(0);
		expect(layout.map.height).toBeGreaterThan(0);
	});
});

// ============================================================================
// Furniture Positioning Tests
// ============================================================================

describe('furniture positioning', () => {
	it('positions title in top-left corner', () => {
		const layout = calculateLayout(testUserData, {
			...testPageLayout,
			furniture: {
				...testPageLayout.furniture,
				title: { ...testPageLayout.furniture.title, position: 'top-left' }
			}
		});

		// Title should be near top-left of safe area
		expect(layout.furniture.title.x).toBeLessThan(layout.safeArea.x + 100);
		expect(layout.furniture.title.y).toBeLessThan(layout.safeArea.y + 100);
	});

	it('positions title in top-right corner', () => {
		const layout = calculateLayout(testUserData, {
			...testPageLayout,
			furniture: {
				...testPageLayout.furniture,
				title: { ...testPageLayout.furniture.title, position: 'top-right' }
			}
		});

		// Title should be near top-right of safe area
		expect(layout.furniture.title.x + layout.furniture.title.width).toBeGreaterThan(
			layout.safeArea.x + layout.safeArea.width - 100
		);
		expect(layout.furniture.title.y).toBeLessThan(layout.safeArea.y + 100);
	});

	it('positions title in bottom-left corner', () => {
		const layout = calculateLayout(testUserData, {
			...testPageLayout,
			furniture: {
				...testPageLayout.furniture,
				title: { ...testPageLayout.furniture.title, position: 'bottom-left' }
			}
		});

		// Title should be near bottom-left of safe area
		expect(layout.furniture.title.x).toBeLessThan(layout.safeArea.x + 100);
		expect(layout.furniture.title.y + layout.furniture.title.height).toBeGreaterThan(
			layout.safeArea.y + layout.safeArea.height - 100
		);
	});

	it('positions title in bottom-right corner', () => {
		const layout = calculateLayout(testUserData, {
			...testPageLayout,
			furniture: {
				...testPageLayout.furniture,
				title: { ...testPageLayout.furniture.title, position: 'bottom-right' }
			}
		});

		// Title should be near bottom-right of safe area
		expect(layout.furniture.title.x + layout.furniture.title.width).toBeGreaterThan(
			layout.safeArea.x + layout.safeArea.width - 100
		);
		expect(layout.furniture.title.y + layout.furniture.title.height).toBeGreaterThan(
			layout.safeArea.y + layout.safeArea.height - 100
		);
	});

	it('positions QR code correctly', () => {
		const layout = calculateLayout(testUserData, testPageLayout);

		// QR code should be bottom-right (from testPageLayout)
		expect(layout.furniture.qrCode.x + layout.furniture.qrCode.width).toBeGreaterThan(
			layout.safeArea.x + layout.safeArea.width - 100
		);
		expect(layout.furniture.qrCode.y + layout.furniture.qrCode.height).toBeGreaterThan(
			layout.safeArea.y + layout.safeArea.height - 100
		);
	});

	it('QR code has correct size', () => {
		const layout = calculateLayout(testUserData, testPageLayout);

		expect(layout.furniture.qrCode.width).toBe(72);
		expect(layout.furniture.qrCode.height).toBe(72);
	});
});

// ============================================================================
// Layout Validation Tests
// ============================================================================

describe('validateLayout', () => {
	it('validates correct layout', () => {
		const layout = calculateLayout(testUserData, testPageLayout);
		const validation = validateLayout(layout);

		expect(validation.valid).toBe(true);
		expect(validation.errors).toHaveLength(0);
	});

	it('detects map outside safe area', () => {
		const layout = calculateLayout(testUserData, testPageLayout);

		// Manually break the layout
		const brokenLayout = {
			...layout,
			map: {
				...layout.map,
				x: 0, // Outside safe area
				y: 0
			}
		};

		const validation = validateLayout(brokenLayout);
		expect(validation.valid).toBe(false);
		expect(validation.errors).toContain('Map extends outside safe area');
	});

	it('detects title outside safe area', () => {
		const layout = calculateLayout(testUserData, testPageLayout);

		// Manually break the layout
		const brokenLayout = {
			...layout,
			furniture: {
				...layout.furniture,
				title: {
					...layout.furniture.title,
					x: layout.safeArea.x + layout.safeArea.width + 10 // Outside
				}
			}
		};

		const validation = validateLayout(brokenLayout);
		expect(validation.valid).toBe(false);
		expect(validation.errors).toContain('Title extends outside safe area');
	});
});

// ============================================================================
// Edge Cases and Stress Tests
// ============================================================================

describe('edge cases', () => {
	it('handles very long title text', () => {
		const layout = calculateLayout(testUserData, {
			...testPageLayout,
			furniture: {
				...testPageLayout.furniture,
				title: {
					...testPageLayout.furniture.title,
					text: 'This is a very long title that should still be handled correctly without breaking the layout'
				}
			}
		});

		expect(layout.furniture.title.width).toBeGreaterThan(0);
		expect(layout.furniture.title.width).toBeLessThanOrEqual(layout.safeArea.width);
	});

	it('handles small page size', () => {
		const layout = calculateLayout(testUserData, {
			...testPageLayout,
			page: { ...testPageLayout.page, size: '12x16' }
		});

		expect(layout.map.width).toBeGreaterThan(0);
		expect(layout.map.height).toBeGreaterThan(0);
		expect(layout.fillPercentage).toBeGreaterThan(0);
	});

	it('handles large page size', () => {
		const layout = calculateLayout(testUserData, {
			...testPageLayout,
			page: { ...testPageLayout.page, size: '24x36' }
		});

		expect(layout.map.width).toBeGreaterThan(0);
		expect(layout.map.height).toBeGreaterThan(0);
		expect(layout.fillPercentage).toBeGreaterThan(0);
	});
});
