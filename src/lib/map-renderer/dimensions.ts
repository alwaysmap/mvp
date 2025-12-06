/**
 * Dimension calculation utilities for print-ready map rendering.
 * Handles bleed areas, safe zones, and DPI conversions.
 */

import type { PrintSpec, Dimensions } from './types.js';

/**
 * Standard print specifications for common Printful poster sizes.
 * All dimensions in points (pt), where 1 pt = 1/72 inch.
 */
export const PRINT_SPECS: Record<string, PrintSpec> = {
	'18x24': {
		productName: 'Premium Poster - 18×24"',
		trimWidth: 18 * 72, // 1296 pt
		trimHeight: 24 * 72, // 1728 pt
		bleed: 0.125 * 72, // 9 pt (1/8 inch)
		safeMargin: 0.25 * 72, // 18 pt (1/4 inch)
		dpi: 300
	},
	'24x36': {
		productName: 'Premium Poster - 24×36"',
		trimWidth: 24 * 72, // 1728 pt
		trimHeight: 36 * 72, // 2592 pt
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},
	'12x16': {
		productName: 'Premium Poster - 12×16"',
		trimWidth: 12 * 72, // 864 pt
		trimHeight: 16 * 72, // 1152 pt
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	}
};

/**
 * Calculates all dimensions needed for rendering a print-ready map.
 *
 * The coordinate system works as follows:
 * - (0, 0) is the top-left corner of the bleed area
 * - Bleed extends from 0 to spec.bleed on all sides
 * - Trim line is at (bleed, bleed) to (bleed + trimWidth, bleed + trimHeight)
 * - Safe area is inset from trim line by safeMargin
 *
 * @param spec - Print specification defining the target size
 * @returns Complete dimension calculations including pixel sizes
 *
 * @example
 * ```typescript
 * const dims = calculateDimensions(PRINT_SPECS['18x24']);
 * console.log(dims.totalWidth);  // 1314 pt (18.25")
 * console.log(dims.pixelWidth);  // 5475 px at 300 DPI
 * console.log(dims.safeArea);    // {x: 27, y: 27, width: 1260, height: 1692}
 * ```
 */
export function calculateDimensions(spec: PrintSpec): Dimensions {
	// Total canvas size including bleed on all sides
	const totalWidth = spec.trimWidth + 2 * spec.bleed;
	const totalHeight = spec.trimHeight + 2 * spec.bleed;

	// Safe area is inset from trim line by safeMargin
	const safeX = spec.bleed + spec.safeMargin;
	const safeY = spec.bleed + spec.safeMargin;
	const safeWidth = spec.trimWidth - 2 * spec.safeMargin;
	const safeHeight = spec.trimHeight - 2 * spec.safeMargin;

	// Convert points to pixels at target DPI
	// Points are 1/72 inch, so: pixels = (points / 72) * DPI
	const pixelWidth = Math.round((totalWidth / 72) * spec.dpi);
	const pixelHeight = Math.round((totalHeight / 72) * spec.dpi);

	return {
		totalWidth,
		totalHeight,
		trimWidth: spec.trimWidth,
		trimHeight: spec.trimHeight,
		bleed: spec.bleed,
		safeMargin: spec.safeMargin,
		safeArea: {
			x: safeX,
			y: safeY,
			width: safeWidth,
			height: safeHeight
		},
		pixelWidth,
		pixelHeight
	};
}

/**
 * Validates that dimensions meet Printful's requirements.
 *
 * @param dimensions - Calculated dimensions to validate
 * @returns Object with validation result and any error messages
 */
export function validateDimensions(dimensions: Dimensions): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	// Printful requires at least 150 DPI, recommends 300 DPI
	const effectiveDPI = (dimensions.pixelWidth / dimensions.totalWidth) * 72;
	if (effectiveDPI < 150) {
		errors.push(`DPI too low: ${effectiveDPI.toFixed(0)} (minimum 150)`);
	}

	// Bleed should be at least 0.125 inches (9pt)
	if (dimensions.bleed < 9) {
		errors.push(`Bleed too small: ${dimensions.bleed}pt (minimum 9pt)`);
	}

	// Safe margin should be at least 0.125 inches (9pt)
	if (dimensions.safeMargin < 9) {
		errors.push(`Safe margin too small: ${dimensions.safeMargin}pt (minimum 9pt)`);
	}

	// Check for reasonable pixel dimensions (not too large for memory)
	const maxPixels = 50_000_000; // 50 megapixels
	const totalPixels = dimensions.pixelWidth * dimensions.pixelHeight;
	if (totalPixels > maxPixels) {
		errors.push(
			`Pixel dimensions too large: ${totalPixels.toLocaleString()} (max ${maxPixels.toLocaleString()})`
		);
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

/**
 * Converts inches to points.
 * @param inches - Measurement in inches
 * @returns Measurement in points
 */
export function inchesToPoints(inches: number): number {
	return inches * 72;
}

/**
 * Converts points to inches.
 * @param points - Measurement in points
 * @returns Measurement in inches
 */
export function pointsToInches(points: number): number {
	return points / 72;
}

/**
 * Converts points to pixels at a given DPI.
 * @param points - Measurement in points
 * @param dpi - Target DPI (default 300)
 * @returns Measurement in pixels
 */
export function pointsToPixels(points: number, dpi: number = 300): number {
	return Math.round((points / 72) * dpi);
}

/**
 * Converts pixels to points at a given DPI.
 * @param pixels - Measurement in pixels
 * @param dpi - Source DPI (default 300)
 * @returns Measurement in points
 */
export function pixelsToPoints(pixels: number, dpi: number = 300): number {
	return (pixels * 72) / dpi;
}
