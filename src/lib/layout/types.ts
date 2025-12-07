/**
 * Type definitions for the map-to-page layout engine.
 *
 * This module defines the three-layer data model:
 * (a) MapStyle - How the map looks (colors, strokes, visual appearance)
 * (b) UserMapData - What goes on the map (people, locations, paths)
 * (c) PageLayout - How to position map within physical page
 */

import type { Person } from '../map-renderer/types.js';

// ============================================================================
// Layer (a): Map Style - How the Map Looks
// ============================================================================

/**
 * Visual style configuration for map layers.
 * Controls colors, strokes, and visibility of map elements.
 */
export interface MapStyle {
	/** Ocean (sphere background) styling */
	ocean: {
		color: string;
		visible: boolean;
	};
	/** Land masses styling */
	land: {
		color: string;
		visible: boolean;
	};
	/** Country borders styling */
	countries: {
		stroke: string;
		strokeWidth: number;
		fill: string;
		visible: boolean;
	};
	/** Graticule (lat/lon grid) styling */
	graticule: {
		stroke: string;
		strokeWidth: number;
		visible: boolean;
	};
	/** Migration paths styling */
	paths: {
		stroke: string;
		strokeWidth: number;
		opacity: number;
	};
	/** Canvas background color */
	background: {
		color: string;
	};
}

// ============================================================================
// Layer (b): User Data - What Goes on the Map
// ============================================================================

/**
 * User-provided map data: people, locations, and view settings.
 */
export interface UserMapData {
	/** People and their location histories */
	people: Person[];
	/** Map view configuration */
	view: {
		/** Projection type */
		projection: 'orthographic' | 'mercator' | 'equirectangular';
		/** Globe rotation [lambda, phi, gamma] in degrees */
		rotation: [number, number, number];
	};
}

// ============================================================================
// Layer (c): Page Layout - How to Position on Page
// ============================================================================

/**
 * Standard page sizes (Printful and common POD poster sizes).
 * USA portrait: 8x10, 12x16, 18x24, 24x36
 * USA landscape: 10x8, 16x12, 24x18, 36x24
 * International portrait: A4, A3, A2, A1
 * International landscape: A4-landscape, A3-landscape, A2-landscape, A1-landscape
 */
export type PageSize =
	// USA Portrait
	| '8x10'
	| '12x16'
	| '18x24'
	| '24x36'
	// USA Landscape
	| '10x8'
	| '16x12'
	| '24x18'
	| '36x24'
	// International Portrait
	| 'A4'
	| 'A3'
	| 'A2'
	| 'A1'
	// International Landscape
	| 'A4-landscape'
	| 'A3-landscape'
	| 'A2-landscape'
	| 'A1-landscape';

/**
 * Page orientation.
 */
export type PageOrientation = 'portrait' | 'landscape';

/**
 * Furniture position (corners of safe area).
 */
export type FurniturePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Title block configuration.
 */
export interface TitleConfig {
	/** Title text */
	text: string;
	/** Subtitle text */
	subtitle: string;
	/** Position in safe area */
	position: FurniturePosition;
	/** Font family */
	fontFamily: string;
	/** Title font size (points) */
	titleFontSize: number;
	/** Subtitle font size (points) */
	subtitleFontSize: number;
}

/**
 * QR code configuration.
 */
export interface QRCodeConfig {
	/** URL to encode */
	url: string;
	/** Position in safe area */
	position: FurniturePosition;
	/** QR code size (points) */
	size: number;
}

/**
 * Attribution text configuration.
 */
export interface AttributionConfig {
	/** Attribution text */
	text: string;
	/** Position in safe area */
	position: FurniturePosition;
	/** Font family */
	fontFamily: string;
	/** Font size (points) */
	fontSize: number;
}

/**
 * Page specification (physical dimensions).
 */
export interface PageSpec {
	/** Page size preset */
	size: PageSize;
	/** Page orientation */
	orientation: PageOrientation;
	/** Target DPI for raster output */
	dpi: number;
	/** Bleed area (points) - extends beyond trim line */
	bleed: number;
	/** Safe margin (points) - inset from trim line */
	safeMargin: number;
}

/**
 * Map placement strategy.
 */
export interface MapPlacement {
	/** Desired aspect ratio (width/height) - 1.0 for square, null for flexible */
	aspectRatio: number | null;
	/** Fill strategy - always 'maximize' for now */
	fillStrategy: 'maximize';
	/** User-specified zoom adjustment (0.8 to 1.2) - 1.0 = optimal */
	zoomAdjustment?: number;
	/** User-specified center offset from calculated center (points) */
	centerOffset?: { x: number; y: number };
}

/**
 * Complete page layout configuration.
 * Defines how to arrange map and furniture on physical page.
 */
export interface PageLayout {
	/** Page specification */
	page: PageSpec;
	/** Map placement strategy */
	mapPlacement: MapPlacement;
	/** Furniture configuration */
	furniture: {
		/** Title block */
		title: TitleConfig;
		/** QR code */
		qrCode: QRCodeConfig;
		/** Attribution text (optional) */
		attribution?: AttributionConfig;
	};
}

// ============================================================================
// Layout Calculation Results
// ============================================================================

/**
 * Page dimensions in points.
 */
export interface PageDimensions {
	/** Total width including bleed (points) */
	totalWidth: number;
	/** Total height including bleed (points) */
	totalHeight: number;
	/** Width at trim line (points) */
	trimWidth: number;
	/** Height at trim line (points) */
	trimHeight: number;
	/** Bleed width (points) */
	bleed: number;
	/** Pixel dimensions at target DPI */
	pixels: {
		width: number;
		height: number;
	};
}

/**
 * Safe area bounds (rectangle within trim line).
 */
export interface SafeArea {
	/** X coordinate (points from top-left of canvas) */
	x: number;
	/** Y coordinate (points from top-left of canvas) */
	y: number;
	/** Width (points) */
	width: number;
	/** Height (points) */
	height: number;
}

/**
 * Map dimensions and position.
 */
export interface MapDimensions {
	/** X coordinate (points from top-left of canvas) */
	x: number;
	/** Y coordinate (points from top-left of canvas) */
	y: number;
	/** Width (points) */
	width: number;
	/** Height (points) */
	height: number;
	/** D3 projection scale */
	scale: number;
	/** D3 projection center [x, y] (points) */
	center: [number, number];
}

/**
 * Positioned furniture item.
 */
export interface PositionedFurniture {
	/** X coordinate (points from top-left of canvas) */
	x: number;
	/** Y coordinate (points from top-left of canvas) */
	y: number;
	/** Width (points) */
	width: number;
	/** Height (points) */
	height: number;
}

/**
 * All positioned furniture.
 */
export interface FurniturePositions {
	/** Title block position */
	title: PositionedFurniture;
	/** QR code position */
	qrCode: PositionedFurniture;
	/** Attribution position (if present) */
	attribution?: PositionedFurniture;
}

/**
 * Complete layout calculation result.
 * All coordinates in points from top-left corner of canvas (including bleed).
 */
export interface LayoutResult {
	/** Page dimensions */
	page: PageDimensions;
	/** Safe area bounds */
	safeArea: SafeArea;
	/** Map dimensions and position */
	map: MapDimensions;
	/** Furniture positions */
	furniture: FurniturePositions;
	/** Fill percentage (0-100) - how much of safe area is used by map */
	fillPercentage: number;
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default map style (antique parchment theme).
 */
export const DEFAULT_MAP_STYLE: MapStyle = {
	ocean: {
		color: '#d4e7f5',
		visible: true
	},
	land: {
		color: '#e8dcc8',
		visible: true
	},
	countries: {
		stroke: '#c9b896',
		strokeWidth: 0.5,
		fill: 'none',
		visible: true
	},
	graticule: {
		stroke: '#d0d0d0',
		strokeWidth: 0.25,
		visible: true
	},
	paths: {
		stroke: '#FF5733',
		strokeWidth: 2,
		opacity: 0.8
	},
	background: {
		color: '#f4ebe1'
	}
};

/**
 * Default page specification (18×24" portrait).
 */
export const DEFAULT_PAGE_SPEC: PageSpec = {
	size: '18x24',
	orientation: 'portrait',
	dpi: 300,
	bleed: 0.125 * 72, // 9 points
	safeMargin: 0.25 * 72 // 18 points
};

/**
 * Default map placement (maximize fill, square aspect ratio).
 */
export const DEFAULT_MAP_PLACEMENT: MapPlacement = {
	aspectRatio: 1.0, // Square (globe fits well)
	fillStrategy: 'maximize',
	zoomAdjustment: 1.0
};
