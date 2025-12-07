/**
 * Style definitions for map elements.
 * Centralized styling ensures consistency across browser and Puppeteer rendering.
 */

/**
 * Color palette for the map.
 */
export const colors = {
	// Background - antique parchment color for print testing
	// Can be easily changed via CSS or MapDefinition.backgroundColor
	canvasBackground: '#f4ebe1', // Antique parchment/cream
	ocean: '#d4e4e8', // Muted blue-grey for ocean (complements antique theme)

	// Geography
	land: '#e8dfd0', // Warm cream for land
	landStroke: '#c5b8a5', // Taupe stroke
	countryBorder: '#b5a892', // Darker taupe for borders

	// Graticule (latitude/longitude lines)
	graticule: '#d4cbbf', // Subtle warm grey

	// Person path colors (can be overridden by Person.color)
	defaultPaths: ['#c1666b', '#6b9080', '#8b7d6b', '#a67c52', '#7d8597', '#b38867', '#8e7766'],

	// Text - adjusted for antique background
	titleText: '#2b2520',
	subtitleText: '#5a4f47',
	labelText: '#6e6158',
	attributionText: '#9b8f82'
} as const;

/**
 * Typography settings.
 */
export const typography = {
	title: {
		fontFamily: 'Cormorant Garamond',
		fontSize: 28,
		fontWeight: 700,
		color: colors.titleText
	},
	subtitle: {
		fontFamily: 'DM Sans',
		fontSize: 16,
		fontWeight: 400,
		color: colors.subtitleText
	},
	label: {
		fontFamily: 'DM Sans',
		fontSize: 12,
		fontWeight: 500,
		color: colors.labelText
	},
	attribution: {
		fontFamily: 'DM Sans',
		fontSize: 9,
		fontWeight: 400,
		color: colors.attributionText
	}
} as const;

/**
 * Stroke widths for various map elements (in points).
 */
export const strokeWidths = {
	landBorder: 0.5,
	countryBorder: 0.5,
	graticule: 0.25,
	path: 2.5,
	pathOutline: 4
} as const;

/**
 * Spacing and sizing constants (in points).
 */
export const spacing = {
	titleBoxPadding: 20,
	titleBoxWidth: 400,
	titleBoxHeight: 100,
	titleBoxCornerRadius: 4,

	qrCodeSize: 100,
	qrCodePadding: 20,

	overlayPadding: 20
} as const;

/**
 * Animation durations (in milliseconds).
 * Only used in interactive browser mode, not in Puppeteer.
 */
export const animations = {
	rotationDuration: 750,
	pathDrawDuration: 1000,
	fadeInDuration: 300
} as const;

/**
 * Gets a color for a person's path.
 * If the person has a custom color, use that. Otherwise, cycle through default colors.
 *
 * @param personIndex - Index of the person in the people array
 * @param customColor - Custom color override from Person.color
 * @returns Hex color string
 */
export function getPersonColor(personIndex: number, customColor?: string): string {
	if (customColor) {
		return customColor;
	}
	return colors.defaultPaths[personIndex % colors.defaultPaths.length];
}

/**
 * Applies standard styles to land features.
 *
 * @param selection - D3 selection of land path elements
 */
export function styleLand(selection: any): void {
	selection
		.attr('fill', colors.land)
		.attr('stroke', colors.landStroke)
		.attr('stroke-width', strokeWidths.landBorder);
}

/**
 * Applies standard styles to country borders.
 *
 * @param selection - D3 selection of country path elements
 */
export function styleCountries(selection: any): void {
	selection
		.attr('fill', 'none')
		.attr('stroke', colors.countryBorder)
		.attr('stroke-width', strokeWidths.countryBorder);
}

/**
 * Applies standard styles to graticule (lat/lon grid).
 *
 * @param selection - D3 selection of graticule path elements
 */
export function styleGraticule(selection: any): void {
	selection
		.attr('fill', 'none')
		.attr('stroke', colors.graticule)
		.attr('stroke-width', strokeWidths.graticule)
		.attr('stroke-dasharray', '2,2');
}

/**
 * Applies standard styles to a person's migration path.
 *
 * @param selection - D3 selection of path elements
 * @param color - Color for this path
 */
export function stylePath(selection: any, color: string): void {
	selection
		.attr('fill', 'none')
		.attr('stroke', color)
		.attr('stroke-width', strokeWidths.path)
		.attr('stroke-linecap', 'round')
		.attr('stroke-linejoin', 'round');
}

/**
 * Applies outline styles to a person's migration path.
 * This creates a subtle white outline for better contrast.
 *
 * @param selection - D3 selection of path elements
 */
export function stylePathOutline(selection: any): void {
	selection
		.attr('fill', 'none')
		.attr('stroke', '#ffffff')
		.attr('stroke-width', strokeWidths.pathOutline)
		.attr('stroke-linecap', 'round')
		.attr('stroke-linejoin', 'round')
		.attr('opacity', 0.7);
}

/**
 * Applies standard styles to location markers (dots).
 *
 * @param selection - D3 selection of circle elements
 * @param color - Color for this marker
 */
export function styleMarker(selection: any, color: string): void {
	selection
		.attr('r', 4)
		.attr('fill', color)
		.attr('stroke', '#ffffff')
		.attr('stroke-width', 1.5);
}
