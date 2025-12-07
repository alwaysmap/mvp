/**
 * Dimension calculation utilities for print-ready map rendering.
 * Handles bleed areas, safe zones, and DPI conversions.
 */

import type { PrintSpec, Dimensions } from './types.js';

/**
 * Standard print specifications for common print-on-demand poster sizes.
 * Includes USA (inches) and international (A-series) sizes in both portrait and landscape.
 * All dimensions in points (pt), where 1 pt = 1/72 inch.
 *
 * Based on common sizes from Printful and other POD services:
 * - USA: 8×10", 12×16", 18×24", 24×36"
 * - International: A4, A3, A2, A1
 */
export const PRINT_SPECS: Record<string, PrintSpec> = {
	// USA Portrait Sizes
	'8x10': {
		productName: 'Premium Poster - 8×10" (Portrait)',
		trimWidth: 8 * 72, // 576 pt
		trimHeight: 10 * 72, // 720 pt
		bleed: 0.125 * 72, // 9 pt (1/8 inch)
		safeMargin: 0.25 * 72, // 18 pt (1/4 inch)
		dpi: 300
	},
	'12x16': {
		productName: 'Premium Poster - 12×16" (Portrait)',
		trimWidth: 12 * 72, // 864 pt
		trimHeight: 16 * 72, // 1152 pt
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},
	'18x24': {
		productName: 'Premium Poster - 18×24" (Portrait)',
		trimWidth: 18 * 72, // 1296 pt
		trimHeight: 24 * 72, // 1728 pt
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},
	'24x36': {
		productName: 'Premium Poster - 24×36" (Portrait)',
		trimWidth: 24 * 72, // 1728 pt
		trimHeight: 36 * 72, // 2592 pt
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},

	// USA Landscape Sizes
	'10x8': {
		productName: 'Premium Poster - 10×8" (Landscape)',
		trimWidth: 10 * 72, // 720 pt
		trimHeight: 8 * 72, // 576 pt
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},
	'16x12': {
		productName: 'Premium Poster - 16×12" (Landscape)',
		trimWidth: 16 * 72, // 1152 pt
		trimHeight: 12 * 72, // 864 pt
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},
	'24x18': {
		productName: 'Premium Poster - 24×18" (Landscape)',
		trimWidth: 24 * 72, // 1728 pt
		trimHeight: 18 * 72, // 1296 pt
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},
	'36x24': {
		productName: 'Premium Poster - 36×24" (Landscape)',
		trimWidth: 36 * 72, // 2592 pt
		trimHeight: 24 * 72, // 1728 pt
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},

	// International A-Series Portrait
	'A4': {
		productName: 'Premium Poster - A4 (Portrait)',
		trimWidth: 8.27 * 72, // 595.4 pt (210mm)
		trimHeight: 11.69 * 72, // 841.7 pt (297mm)
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},
	'A3': {
		productName: 'Premium Poster - A3 (Portrait)',
		trimWidth: 11.69 * 72, // 841.7 pt (297mm)
		trimHeight: 16.54 * 72, // 1190.9 pt (420mm)
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},
	'A2': {
		productName: 'Premium Poster - A2 (Portrait)',
		trimWidth: 16.54 * 72, // 1190.9 pt (420mm)
		trimHeight: 23.38 * 72, // 1683.4 pt (594mm)
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},
	'A1': {
		productName: 'Premium Poster - A1 (Portrait)',
		trimWidth: 23.38 * 72, // 1683.4 pt (594mm)
		trimHeight: 33.08 * 72, // 2381.8 pt (841mm)
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},

	// International A-Series Landscape
	'A4-landscape': {
		productName: 'Premium Poster - A4 (Landscape)',
		trimWidth: 11.69 * 72, // 841.7 pt (297mm)
		trimHeight: 8.27 * 72, // 595.4 pt (210mm)
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},
	'A3-landscape': {
		productName: 'Premium Poster - A3 (Landscape)',
		trimWidth: 16.54 * 72, // 1190.9 pt (420mm)
		trimHeight: 11.69 * 72, // 841.7 pt (297mm)
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},
	'A2-landscape': {
		productName: 'Premium Poster - A2 (Landscape)',
		trimWidth: 23.38 * 72, // 1683.4 pt (594mm)
		trimHeight: 16.54 * 72, // 1190.9 pt (420mm)
		bleed: 0.125 * 72, // 9 pt
		safeMargin: 0.25 * 72, // 18 pt
		dpi: 300
	},
	'A1-landscape': {
		productName: 'Premium Poster - A1 (Landscape)',
		trimWidth: 33.08 * 72, // 2381.8 pt (841mm)
		trimHeight: 23.38 * 72, // 1683.4 pt (594mm)
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

/**
 * Finds a PrintSpec by exact width and height in inches.
 *
 * This function provides bulletproof page size lookup by using explicit dimensions
 * instead of string parsing. Orientation is automatically determined by comparing
 * width and height (landscape = width > height, portrait = width <= height).
 *
 * @param widthInches - Page width in inches
 * @param heightInches - Page height in inches
 * @returns PrintSpec if found, undefined otherwise
 *
 * @example
 * ```typescript
 * // Portrait 18x24
 * findPrintSpec(18, 24) // → PRINT_SPECS['18x24']
 *
 * // Landscape 24x18 (same paper, rotated)
 * findPrintSpec(24, 18) // → PRINT_SPECS['24x18']
 *
 * // A4 portrait (8.27 x 11.69 inches)
 * findPrintSpec(8.27, 11.69) // → PRINT_SPECS['A4']
 *
 * // A4 landscape (11.69 x 8.27 inches)
 * findPrintSpec(11.69, 8.27) // → PRINT_SPECS['A4-landscape']
 * ```
 */
export function findPrintSpec(widthInches: number, heightInches: number): PrintSpec | undefined {
	const widthPt = Math.round(widthInches * 72);
	const heightPt = Math.round(heightInches * 72);

	// Find spec with matching dimensions (within 1pt tolerance for rounding)
	for (const spec of Object.values(PRINT_SPECS)) {
		const widthMatch = Math.abs(spec.trimWidth - widthPt) <= 1;
		const heightMatch = Math.abs(spec.trimHeight - heightPt) <= 1;

		if (widthMatch && heightMatch) {
			return spec;
		}
	}

	return undefined;
}
