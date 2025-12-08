/**
 * Style application functions for map elements.
 * All style functions accept a theme parameter to ensure consistent theming
 * across browser and Puppeteer rendering.
 */

import type { MapTheme } from './themes.js';

/**
 * Typography settings (theme-independent).
 */
export const typography = {
	title: {
		fontFamily: 'Cormorant Garamond',
		fontSize: 28,
		fontWeight: 700
	},
	subtitle: {
		fontFamily: 'DM Sans',
		fontSize: 16,
		fontWeight: 400
	},
	label: {
		fontFamily: 'DM Sans',
		fontSize: 12,
		fontWeight: 500
	},
	attribution: {
		fontFamily: 'DM Sans',
		fontSize: 9,
		fontWeight: 400
	}
} as const;

/**
 * Stroke widths for various map elements (in points).
 * Theme-independent.
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
 * Theme-independent.
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
 * Theme-independent.
 */
export const animations = {
	rotationDuration: 750,
	pathDrawDuration: 1000,
	fadeInDuration: 300
} as const;

/**
 * Gets a color for a person's path.
 * If the person has a custom color, use that. Otherwise, cycle through theme's default colors.
 *
 * @param personIndex - Index of the person in the people array
 * @param theme - Current theme
 * @param customColor - Custom color override from Person.color
 * @returns Hex color string
 */
export function getPersonColor(personIndex: number, theme: MapTheme, customColor?: string): string {
	if (customColor) {
		return customColor;
	}
	return theme.colors.defaultPaths[personIndex % theme.colors.defaultPaths.length];
}

/**
 * Applies standard styles to land features using theme colors.
 *
 * @param selection - D3 selection of land path elements
 * @param theme - Current theme
 */
export function styleLand(selection: any, theme: MapTheme): void {
	selection
		.attr('fill', theme.colors.land)
		.attr('stroke', theme.colors.landStroke)
		.attr('stroke-width', strokeWidths.landBorder);
}

/**
 * Applies standard styles to country borders using theme colors.
 *
 * @param selection - D3 selection of country path elements
 * @param theme - Current theme
 */
export function styleCountries(selection: any, theme: MapTheme): void {
	selection
		.attr('fill', 'none')
		.attr('stroke', theme.colors.countryBorder)
		.attr('stroke-width', strokeWidths.countryBorder);
}

/**
 * Applies standard styles to graticule (lat/lon grid) using theme colors.
 *
 * @param selection - D3 selection of graticule path elements
 * @param theme - Current theme
 */
export function styleGraticule(selection: any, theme: MapTheme): void {
	selection
		.attr('fill', 'none')
		.attr('stroke', theme.colors.graticule)
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
