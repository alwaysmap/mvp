/**
 * Standard page sizes for user-friendly selection.
 *
 * These definitions make it easy for the UI to show users familiar paper size names
 * and orientations, while internally converting to bulletproof width/height values.
 */

export interface StandardPageSize {
	/** Display name (e.g., "18×24", "A4", "US Letter") */
	name: string;
	/** Width in portrait orientation (inches) */
	portraitWidthInches: number;
	/** Height in portrait orientation (inches) */
	portraitHeightInches: number;
	/** Group/category for organization (e.g., "USA", "A-Series") */
	group: string;
}

/**
 * Standard USA poster sizes
 */
export const USA_SIZES: StandardPageSize[] = [
	{
		name: '8×10',
		portraitWidthInches: 8,
		portraitHeightInches: 10,
		group: 'USA'
	},
	{
		name: '12×16',
		portraitWidthInches: 12,
		portraitHeightInches: 16,
		group: 'USA'
	},
	{
		name: '18×24',
		portraitWidthInches: 18,
		portraitHeightInches: 24,
		group: 'USA'
	},
	{
		name: '24×36',
		portraitWidthInches: 24,
		portraitHeightInches: 36,
		group: 'USA'
	}
];

/**
 * Standard A-series paper sizes (ISO 216)
 */
export const A_SERIES_SIZES: StandardPageSize[] = [
	{
		name: 'A4',
		portraitWidthInches: 8.27, // 210mm
		portraitHeightInches: 11.69, // 297mm
		group: 'A-Series'
	},
	{
		name: 'A3',
		portraitWidthInches: 11.69, // 297mm
		portraitHeightInches: 16.54, // 420mm
		group: 'A-Series'
	},
	{
		name: 'A2',
		portraitWidthInches: 16.54, // 420mm
		portraitHeightInches: 23.38, // 594mm
		group: 'A-Series'
	},
	{
		name: 'A1',
		portraitWidthInches: 23.38, // 594mm
		portraitHeightInches: 33.08, // 841mm
		group: 'A-Series'
	}
];

/**
 * All standard page sizes
 */
export const ALL_STANDARD_SIZES: StandardPageSize[] = [...USA_SIZES, ...A_SERIES_SIZES];

/**
 * Converts a standard page size and orientation to explicit dimensions.
 *
 * @param pageSize - Standard page size definition
 * @param orientation - 'portrait' or 'landscape'
 * @returns Object with widthInches and heightInches
 *
 * @example
 * ```typescript
 * const size18x24 = USA_SIZES.find(s => s.name === '18×24');
 * const portrait = getDimensionsForOrientation(size18x24, 'portrait');
 * // → { widthInches: 18, heightInches: 24, paperSizeName: '18×24' }
 *
 * const landscape = getDimensionsForOrientation(size18x24, 'landscape');
 * // → { widthInches: 24, heightInches: 18, paperSizeName: '18×24' }
 * ```
 */
export function getDimensionsForOrientation(
	pageSize: StandardPageSize,
	orientation: 'portrait' | 'landscape'
): {
	widthInches: number;
	heightInches: number;
	paperSizeName: string;
} {
	if (orientation === 'landscape') {
		return {
			widthInches: pageSize.portraitHeightInches,
			heightInches: pageSize.portraitWidthInches,
			paperSizeName: pageSize.name
		};
	}

	return {
		widthInches: pageSize.portraitWidthInches,
		heightInches: pageSize.portraitHeightInches,
		paperSizeName: pageSize.name
	};
}
