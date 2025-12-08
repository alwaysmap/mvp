/**
 * Core type definitions for the framework-agnostic map renderer.
 * All dimensions are in points (pt), where 1 pt = 1/72 inch.
 */

import type { PageLayout } from '../layout/types.js';

/**
 * Projection type for the map.
 * - orthographic: 3D globe view
 * - equirectangular, mercator, naturalEarth1, robinson: flat map projections
 */
export type ProjectionType =
	| 'orthographic'
	| 'equirectangular'
	| 'mercator'
	| 'naturalEarth1'
	| 'robinson';

/**
 * Represents a person's location at a specific point in time.
 */
export interface Location {
	/** ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "JP") */
	countryCode: string;
	/** Longitude in decimal degrees [-180, 180] */
	longitude: number;
	/** Latitude in decimal degrees [-90, 90] */
	latitude: number;
	/** ISO 8601 date string (YYYY-MM-DD) */
	date: string;
}

/**
 * Represents a person and their location history.
 */
export interface Person {
	/** Unique identifier for the person */
	id: string;
	/** Person's name */
	name: string;
	/** Chronologically ordered locations */
	locations: Location[];
	/** Hex color for this person's path on the map (e.g., "#FF5733") */
	color: string;
}

/**
 * Complete definition of a map to be rendered.
 */
export interface MapDefinition {
	/** Title displayed in the title box */
	title: string;
	/** Subtitle displayed in the title box */
	subtitle: string;
	/** Array of people with their location histories */
	people: Person[];
	/** Initial rotation of the globe [lambda, phi, gamma] in degrees */
	rotation?: [number, number, number];
	/** Theme ID (e.g., 'antique-parchment', 'cool-blue'). If not provided, uses default theme. */
	theme?: string;
	/**
	 * Optional page layout configuration.
	 * If not provided, uses default layout with hardcoded positioning (legacy behavior).
	 * If provided, uses layout engine to calculate optimal positioning.
	 */
	layout?: PageLayout;
}

/**
 * Print specifications for a Printful product.
 * All dimensions in points (pt).
 */
export interface PrintSpec {
	/** Product name (e.g., "Premium Poster - 18×24\"") */
	productName: string;
	/** Width at trim line (points) */
	trimWidth: number;
	/** Height at trim line (points) */
	trimHeight: number;
	/** Bleed area extending beyond trim (points) - typically 0.125" = 9pt */
	bleed: number;
	/** Safe area margin from trim edge (points) - typically 0.25" = 18pt */
	safeMargin: number;
	/** Target DPI for raster output */
	dpi: number;
}

/**
 * Calculated dimensions for rendering.
 * All dimensions in points (pt).
 */
export interface Dimensions {
	/** Total canvas width including bleed (points) */
	totalWidth: number;
	/** Total canvas height including bleed (points) */
	totalHeight: number;
	/** Width at trim line (points) */
	trimWidth: number;
	/** Height at trim line (points) */
	trimHeight: number;
	/** Bleed width (points) */
	bleed: number;
	/** Safe area margin from trim (points) */
	safeMargin: number;
	/** Safe area bounds (points from top-left) */
	safeArea: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	/** Pixels for raster output (total including bleed) */
	pixelWidth: number;
	/** Pixels for raster output (total including bleed) */
	pixelHeight: number;
}

/**
 * Font verification result.
 */
export interface FontLoadStatus {
	/** Font family name */
	family: string;
	/** Font weight (e.g., 400, 600, 700) */
	weight: number;
	/** Font style (e.g., "normal", "italic") */
	style: string;
	/** Whether the font loaded successfully */
	loaded: boolean;
}

/**
 * Options for the renderMap function.
 */
export interface RenderOptions {
	/** DOM selector for the SVG element (browser only) */
	selector?: string;
	/** Existing D3 selection (useful for server-side) */
	selection?: any; // d3.Selection type
	/** Whether to enable interactive rotation (browser only) */
	interactive?: boolean;
	/** Background color for the canvas (default: white) */
	backgroundColor?: string;
}

/**
 * Result of the renderMap function.
 */
export interface RenderResult {
	/** Whether rendering completed successfully */
	success: boolean;
	/** Error message if rendering failed */
	error?: string;
	/** Font load statuses */
	fonts?: FontLoadStatus[];
	/** Calculated dimensions */
	dimensions?: Dimensions;
	/** SVG element (browser only) */
	svg?: SVGSVGElement;
}
