/**
 * Utility functions for page size normalization and lookup.
 * Handles variations in page size formats (x vs ×, case differences).
 */

import { ALL_STANDARD_SIZES, type StandardPageSize } from './page-sizes.js';

/**
 * Normalize a page size name for comparison.
 * Handles:
 * - Case differences: "a4" → "A4"
 * - Character variants: "18x24" → "18×24"
 * - Extra whitespace: " 18 x 24 " → "18×24"
 *
 * @param name - Page size name to normalize
 * @returns Normalized name for comparison
 */
export function normalizePageSizeName(name: string): string {
	return name
		.trim() // Remove leading/trailing whitespace
		.replace(/\s+/g, '') // Remove all whitespace
		.replace(/x/gi, '×') // Replace x/X with multiplication sign
		.toUpperCase(); // Uppercase for A-series (A4, A3, etc.)
}

/**
 * Find a standard page size by name, handling format variations.
 * Case-insensitive and handles both 'x' and '×' separators.
 *
 * @param paperSizeName - Name to search for (e.g., "18x24", "A4", "12×16")
 * @returns Standard page size definition, or undefined if not found
 *
 * @example
 * ```typescript
 * findPageSize('18x24');   // ✓ Finds "18×24"
 * findPageSize('18X24');   // ✓ Finds "18×24"
 * findPageSize('18×24');   // ✓ Finds "18×24"
 * findPageSize('a4');      // ✓ Finds "A4"
 * findPageSize('A4');      // ✓ Finds "A4"
 * findPageSize('invalid'); // undefined
 * ```
 */
export function findPageSize(paperSizeName: string): StandardPageSize | undefined {
	const normalizedSearch = normalizePageSizeName(paperSizeName);
	return ALL_STANDARD_SIZES.find((s) => normalizePageSizeName(s.name) === normalizedSearch);
}

/**
 * Check if a page size name is valid.
 *
 * @param paperSizeName - Name to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidPageSize('18x24'); // true
 * isValidPageSize('A4');    // true
 * isValidPageSize('foo');   // false
 * ```
 */
export function isValidPageSize(paperSizeName: string): boolean {
	return findPageSize(paperSizeName) !== undefined;
}
