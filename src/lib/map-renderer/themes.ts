/**
 * Theme definitions for map rendering.
 *
 * Each theme is a complete color palette ensuring consistent rendering
 * in both browser preview and Puppeteer export.
 *
 * CRITICAL: These are the ONLY color definitions used by the renderer.
 * Do not define colors elsewhere to prevent drift between browser and export.
 */

/**
 * Map theme color palette.
 * All colors are hex strings (e.g., "#f4ebe1").
 */
export interface MapTheme {
	/** Theme identifier (stored in database) */
	id: string;
	/** Display name for UI */
	name: string;
	/** Theme description for users */
	description: string;
	/** Color palette */
	colors: {
		// Canvas
		/** Background color for the entire canvas */
		canvasBackground: string;
		/** Ocean/water color */
		ocean: string;

		// Geography
		/** Land/continent fill color */
		land: string;
		/** Land outline stroke color */
		landStroke: string;
		/** Country border color */
		countryBorder: string;
		/** Graticule (lat/lon grid) color */
		graticule: string;

		// Text
		/** Title text color */
		titleText: string;
		/** Subtitle text color */
		subtitleText: string;
		/** Label text color */
		labelText: string;
		/** Attribution text color */
		attributionText: string;

		// Paths
		/** Default path colors (if person doesn't specify custom color) */
		defaultPaths: string[];
	};
}

/**
 * All available themes.
 * Add new themes here - they'll automatically appear in UI.
 *
 * IMPORTANT: The `satisfies` operator ensures compile-time type safety.
 * If you add a new property to MapTheme, TypeScript will error here until
 * ALL themes define that property. This prevents incomplete themes.
 */
export const THEMES = {
	'antique-parchment': {
		id: 'antique-parchment',
		name: 'Antique Parchment',
		description: 'Warm, vintage aesthetic with cream and taupe tones',
		colors: {
			canvasBackground: '#f4ebe1',
			ocean: '#d4e4e8',
			land: '#e8dfd0',
			landStroke: '#c5b8a5',
			countryBorder: '#b5a892',
			graticule: '#d4cbbf',
			titleText: '#2b2520',
			subtitleText: '#5a4f47',
			labelText: '#6e6158',
			attributionText: '#9b8f82',
			defaultPaths: ['#c1666b', '#6b9080', '#8b7d6b', '#a67c52', '#7d8597', '#b38867', '#8e7766']
		}
	},

	'cool-blue': {
		id: 'cool-blue',
		name: 'Cool Blue',
		description: 'Modern ocean-inspired palette with blues and teals',
		colors: {
			canvasBackground: '#f0f4f8',
			ocean: '#a8dadc',
			land: '#e8f1f3',
			landStroke: '#b8cfd4',
			countryBorder: '#8fb9c2',
			graticule: '#d0e3e8',
			titleText: '#1d3557',
			subtitleText: '#457b9d',
			labelText: '#6b8ea3',
			attributionText: '#a8b8c4',
			defaultPaths: ['#e63946', '#f77f00', '#06aed5', '#073b4c', '#118ab2', '#4361ee', '#7209b7']
		}
	},

	'modern-gray': {
		id: 'modern-gray',
		name: 'Modern Gray',
		description: 'Clean, professional monochrome palette',
		colors: {
			canvasBackground: '#ffffff',
			ocean: '#e8eaed',
			land: '#f5f5f5',
			landStroke: '#d1d3d6',
			countryBorder: '#b0b3b8',
			graticule: '#e3e5e8',
			titleText: '#1a1a1a',
			subtitleText: '#4a4a4a',
			labelText: '#6a6a6a',
			attributionText: '#9a9a9a',
			defaultPaths: ['#d32f2f', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#0288d1', '#c2185b']
		}
	},

	'warm-earth': {
		id: 'warm-earth',
		name: 'Warm Earth',
		description: 'Natural earthy tones with browns and greens',
		colors: {
			canvasBackground: '#faf7f2',
			ocean: '#d8e4e3',
			land: '#ede5d8',
			landStroke: '#c9b896',
			countryBorder: '#a89968',
			graticule: '#e0d8c8',
			titleText: '#3d3020',
			subtitleText: '#6b5d3f',
			labelText: '#8a7a5a',
			attributionText: '#b5a888',
			defaultPaths: ['#9c6644', '#6a994e', '#bc6c25', '#606c38', '#bc4749', '#8b7355', '#718355']
		}
	}
} satisfies Record<string, MapTheme>;

/**
 * Default theme if none specified.
 */
export const DEFAULT_THEME_ID = 'antique-parchment';

/**
 * Gets a theme by ID with fallback to default.
 *
 * @param themeId - Theme identifier (optional)
 * @returns MapTheme object
 *
 * @example
 * ```typescript
 * const theme = getTheme('cool-blue');
 * const defaultTheme = getTheme(); // Returns antique-parchment
 * const unknownTheme = getTheme('nonexistent'); // Returns antique-parchment
 * ```
 */
export function getTheme(themeId?: string): MapTheme {
	if (!themeId) {
		return THEMES[DEFAULT_THEME_ID];
	}

	// Cast to Record for dynamic access (runtime lookup)
	const themesRecord = THEMES as Record<string, MapTheme>;
	return themesRecord[themeId] || THEMES[DEFAULT_THEME_ID];
}

/**
 * Gets all available themes (for UI dropdowns).
 *
 * @returns Array of all themes
 *
 * @example
 * ```typescript
 * const themes = getAllThemes();
 * // [{ id: 'antique-parchment', name: 'Antique Parchment', ... }, ...]
 * ```
 */
export function getAllThemes(): MapTheme[] {
	return Object.values(THEMES);
}

/**
 * Checks if a theme ID is valid.
 *
 * @param themeId - Theme identifier to check
 * @returns true if theme exists, false otherwise
 *
 * @example
 * ```typescript
 * isValidTheme('cool-blue'); // true
 * isValidTheme('nonexistent'); // false
 * ```
 */
export function isValidTheme(themeId: string): boolean {
	const themesRecord = THEMES as Record<string, MapTheme>;
	return themeId in themesRecord;
}
