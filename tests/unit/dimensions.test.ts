/**
 * Unit tests for dimension calculations.
 */

import { describe, it, expect } from 'vitest';
import {
	calculateDimensions,
	validateDimensions,
	PRINT_SPECS,
	inchesToPoints,
	pointsToInches,
	pointsToPixels,
	pixelsToPoints
} from '$lib/map-renderer/dimensions.js';

describe('Dimension Calculations', () => {
	describe('calculateDimensions', () => {
		it('should calculate correct total dimensions for 18x24" poster', () => {
			const dims = calculateDimensions(PRINT_SPECS['18x24']);

			// 18" = 1296pt, 24" = 1728pt
			expect(dims.trimWidth).toBe(1296);
			expect(dims.trimHeight).toBe(1728);

			// Bleed is 0.125" = 9pt on each side
			expect(dims.bleed).toBe(9);
			expect(dims.totalWidth).toBe(1296 + 2 * 9); // 1314pt
			expect(dims.totalHeight).toBe(1728 + 2 * 9); // 1746pt
		});

		it('should calculate correct safe area for 18x24" poster', () => {
			const dims = calculateDimensions(PRINT_SPECS['18x24']);

			// Safe area starts at bleed (9pt) + safeMargin (18pt) = 27pt
			expect(dims.safeArea.x).toBe(27);
			expect(dims.safeArea.y).toBe(27);

			// Safe area width = trimWidth - 2*safeMargin = 1296 - 36 = 1260pt
			expect(dims.safeArea.width).toBe(1260);
			expect(dims.safeArea.height).toBe(1692);
		});

		it('should calculate correct pixel dimensions at 300 DPI', () => {
			const dims = calculateDimensions(PRINT_SPECS['18x24']);

			// 1314pt / 72 * 300 = 5475px
			expect(dims.pixelWidth).toBe(5475);
			// 1746pt / 72 * 300 = 7275px
			expect(dims.pixelHeight).toBe(7275);
		});

		it('should work for different poster sizes', () => {
			const dims24x36 = calculateDimensions(PRINT_SPECS['24x36']);
			expect(dims24x36.trimWidth).toBe(24 * 72);
			expect(dims24x36.trimHeight).toBe(36 * 72);

			const dims12x16 = calculateDimensions(PRINT_SPECS['12x16']);
			expect(dims12x16.trimWidth).toBe(12 * 72);
			expect(dims12x16.trimHeight).toBe(16 * 72);
		});
	});

	describe('validateDimensions', () => {
		it('should validate correct dimensions', () => {
			const dims = calculateDimensions(PRINT_SPECS['18x24']);
			const result = validateDimensions(dims);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject dimensions with insufficient DPI', () => {
			const dims = calculateDimensions(PRINT_SPECS['18x24']);
			// Manually set pixels too low to simulate low DPI
			dims.pixelWidth = 1000;
			dims.pixelHeight = 1000;

			const result = validateDimensions(dims);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('DPI too low'))).toBe(true);
		});

		it('should reject dimensions with insufficient bleed', () => {
			const dims = calculateDimensions(PRINT_SPECS['18x24']);
			dims.bleed = 5; // Less than minimum 9pt

			const result = validateDimensions(dims);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('Bleed too small'))).toBe(true);
		});

		it('should reject dimensions with insufficient safe margin', () => {
			const dims = calculateDimensions(PRINT_SPECS['18x24']);
			dims.safeMargin = 5; // Less than minimum 9pt

			const result = validateDimensions(dims);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('Safe margin too small'))).toBe(true);
		});

		it('should reject excessively large pixel dimensions', () => {
			const dims = calculateDimensions(PRINT_SPECS['18x24']);
			dims.pixelWidth = 10000;
			dims.pixelHeight = 10000; // 100 megapixels

			const result = validateDimensions(dims);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('Pixel dimensions too large'))).toBe(true);
		});
	});

	describe('Unit Conversion Functions', () => {
		it('should convert inches to points correctly', () => {
			expect(inchesToPoints(1)).toBe(72);
			expect(inchesToPoints(18)).toBe(1296);
			expect(inchesToPoints(0.125)).toBe(9);
		});

		it('should convert points to inches correctly', () => {
			expect(pointsToInches(72)).toBe(1);
			expect(pointsToInches(1296)).toBe(18);
			expect(pointsToInches(9)).toBeCloseTo(0.125);
		});

		it('should convert points to pixels at 300 DPI', () => {
			// 72pt = 1" = 300px at 300 DPI
			expect(pointsToPixels(72, 300)).toBe(300);
			// 1296pt = 18" = 5400px at 300 DPI
			expect(pointsToPixels(1296, 300)).toBe(5400);
		});

		it('should convert pixels to points at 300 DPI', () => {
			// 300px = 1" = 72pt at 300 DPI
			expect(pixelsToPoints(300, 300)).toBe(72);
			// 5400px = 18" = 1296pt at 300 DPI
			expect(pixelsToPoints(5400, 300)).toBe(1296);
		});

		it('should handle different DPI values', () => {
			expect(pointsToPixels(72, 150)).toBe(150); // 1" at 150 DPI
			expect(pointsToPixels(72, 600)).toBe(600); // 1" at 600 DPI

			expect(pixelsToPoints(150, 150)).toBe(72); // 1" at 150 DPI
			expect(pixelsToPoints(600, 600)).toBe(72); // 1" at 600 DPI
		});
	});

	describe('PRINT_SPECS', () => {
		it('should have correct specifications for all sizes', () => {
			// All specs should have 0.125" bleed
			expect(PRINT_SPECS['18x24'].bleed).toBe(9);
			expect(PRINT_SPECS['24x36'].bleed).toBe(9);
			expect(PRINT_SPECS['12x16'].bleed).toBe(9);

			// All specs should have 0.25" safe margin
			expect(PRINT_SPECS['18x24'].safeMargin).toBe(18);
			expect(PRINT_SPECS['24x36'].safeMargin).toBe(18);
			expect(PRINT_SPECS['12x16'].safeMargin).toBe(18);

			// All specs should be 300 DPI
			expect(PRINT_SPECS['18x24'].dpi).toBe(300);
			expect(PRINT_SPECS['24x36'].dpi).toBe(300);
			expect(PRINT_SPECS['12x16'].dpi).toBe(300);
		});
	});
});
