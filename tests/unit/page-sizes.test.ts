/**
 * Tests for page size calculations across all supported sizes.
 * Validates that dimensions, bleed, safe areas, and DPI are correct.
 */

import { describe, it, expect } from 'vitest';
import { PRINT_SPECS } from '$lib/map-renderer/dimensions.js';
import { calculateLayout } from '$lib/layout/calculate.js';
import type { UserMapData, PageLayout } from '$lib/layout/types.js';

describe('Page Size Specifications', () => {
	// Test representative sizes from each category
	const sizes = [
		// USA Portrait
		'8x10',
		'12x16',
		'18x24',
		'24x36',
		// USA Landscape
		'10x8',
		'16x12',
		'24x18',
		'36x24',
		// International Portrait
		'A4',
		'A3',
		'A2',
		'A1',
		// International Landscape
		'A4-landscape',
		'A3-landscape',
		'A2-landscape',
		'A1-landscape'
	] as const;

	// Sample user data for testing
	const sampleUserData: UserMapData = {
		people: [
			{
				id: 'test',
				name: 'Test Person',
				color: '#FF0000',
				locations: [
					{ countryCode: 'US', longitude: -74.006, latitude: 40.7128, date: '2020-01-01' },
					{ countryCode: 'GB', longitude: -0.1276, latitude: 51.5074, date: '2021-01-01' }
				]
			}
		],
		view: {
			projection: 'orthographic',
			rotation: [0, 0, 0]
		}
	};

	sizes.forEach((size) => {
		describe(`${size} size`, () => {
			const spec = PRINT_SPECS[size];

			it('should have 300 DPI', () => {
				expect(spec.dpi).toBe(300);
			});

			it('should have 0.125 inch (9pt) bleed', () => {
				expect(spec.bleed).toBe(9); // 0.125 * 72
			});

			it('should have 0.25 inch (18pt) safe margin', () => {
				expect(spec.safeMargin).toBe(18); // 0.25 * 72
			});

			it('should have valid trim dimensions', () => {
				expect(spec.trimWidth).toBeGreaterThan(0);
				expect(spec.trimHeight).toBeGreaterThan(0);
			});

			it('should produce valid pixel dimensions at 300 DPI', () => {
				const actualPixelWidth = Math.round(((spec.trimWidth + 2 * spec.bleed) / 72) * spec.dpi);
				const actualPixelHeight = Math.round(((spec.trimHeight + 2 * spec.bleed) / 72) * spec.dpi);

				expect(actualPixelWidth).toBeGreaterThan(1000); // Reasonable minimum
				expect(actualPixelHeight).toBeGreaterThan(1000);
			});

			it('should calculate layout with furniture in safe area', () => {
				const pageLayout: PageLayout = {
					page: {
						size: size,
						orientation: 'portrait',
						dpi: spec.dpi,
						bleed: spec.bleed,
						safeMargin: spec.safeMargin
					},
					mapPlacement: {
						aspectRatio: 1.0,
						fillStrategy: 'maximize',
						zoomAdjustment: 1.0
					},
					furniture: {
						title: {
							text: 'Test Title',
							subtitle: 'Test Subtitle',
							position: 'top-left',
							fontFamily: 'Cormorant Garamond',
							titleFontSize: 36,
							subtitleFontSize: 24
						},
						qrCode: {
							url: 'https://alwaysmap.com',
							position: 'bottom-right',
							size: 72
						}
					}
				};

				const layout = calculateLayout(sampleUserData, pageLayout);

				// Check that page dimensions are correct
				expect(layout.page.trimWidth).toBe(spec.trimWidth);
				expect(layout.page.trimHeight).toBe(spec.trimHeight);
				expect(layout.page.bleed).toBe(spec.bleed);

				// Check that safe area is correct
				const expectedSafeX = spec.bleed + spec.safeMargin;
				const expectedSafeY = spec.bleed + spec.safeMargin;
				const expectedSafeWidth = spec.trimWidth - 2 * spec.safeMargin;
				const expectedSafeHeight = spec.trimHeight - 2 * spec.safeMargin;

				expect(layout.safeArea.x).toBe(expectedSafeX);
				expect(layout.safeArea.y).toBe(expectedSafeY);
				expect(layout.safeArea.width).toBe(expectedSafeWidth);
				expect(layout.safeArea.height).toBe(expectedSafeHeight);

				// Check that map is within safe area
				expect(layout.map.x).toBeGreaterThanOrEqual(layout.safeArea.x);
				expect(layout.map.y).toBeGreaterThanOrEqual(layout.safeArea.y);
				expect(layout.map.x + layout.map.width).toBeLessThanOrEqual(
					layout.safeArea.x + layout.safeArea.width
				);
				expect(layout.map.y + layout.map.height).toBeLessThanOrEqual(
					layout.safeArea.y + layout.safeArea.height
				);

				// Check that title is within safe area
				expect(layout.furniture.title.x).toBeGreaterThanOrEqual(layout.safeArea.x);
				expect(layout.furniture.title.y).toBeGreaterThanOrEqual(layout.safeArea.y);
				expect(layout.furniture.title.x + layout.furniture.title.width).toBeLessThanOrEqual(
					layout.safeArea.x + layout.safeArea.width
				);
				expect(layout.furniture.title.y + layout.furniture.title.height).toBeLessThanOrEqual(
					layout.safeArea.y + layout.safeArea.height
				);

				// Check that QR code is within safe area
				expect(layout.furniture.qrCode.x).toBeGreaterThanOrEqual(layout.safeArea.x);
				expect(layout.furniture.qrCode.y).toBeGreaterThanOrEqual(layout.safeArea.y);
				expect(layout.furniture.qrCode.x + layout.furniture.qrCode.width).toBeLessThanOrEqual(
					layout.safeArea.x + layout.safeArea.width
				);
				expect(layout.furniture.qrCode.y + layout.furniture.qrCode.height).toBeLessThanOrEqual(
					layout.safeArea.y + layout.safeArea.height
				);

				// Check that fill percentage is reasonable (should be > 50% for good layout)
				expect(layout.fillPercentage).toBeGreaterThan(50);
				expect(layout.fillPercentage).toBeLessThan(100);
			});
		});
	});

	describe('Cross-size consistency', () => {
		it('should have same DPI for all sizes', () => {
			const dpis = sizes.map((size) => PRINT_SPECS[size].dpi);
			expect(new Set(dpis).size).toBe(1); // All same value
			expect(dpis[0]).toBe(300);
		});

		it('should have same bleed for all sizes', () => {
			const bleeds = sizes.map((size) => PRINT_SPECS[size].bleed);
			expect(new Set(bleeds).size).toBe(1); // All same value
			expect(bleeds[0]).toBe(9);
		});

		it('should have same safe margin for all sizes', () => {
			const margins = sizes.map((size) => PRINT_SPECS[size].safeMargin);
			expect(new Set(margins).size).toBe(1); // All same value
			expect(margins[0]).toBe(18);
		});
	});
});
