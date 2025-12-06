/**
 * Map-to-Page Layout Engine
 *
 * Calculates optimal positioning of map and furniture on physical page.
 *
 * ## Three-Layer Data Model
 *
 * - **MapStyle**: How the map looks (colors, strokes, visual appearance)
 * - **UserMapData**: What goes on the map (people, locations, paths)
 * - **PageLayout**: How to position map within physical page
 *
 * ## Usage
 *
 * ```typescript
 * import { calculateLayout, DEFAULT_PAGE_SPEC } from '$lib/layout';
 *
 * const layout = calculateLayout(userData, {
 *   page: DEFAULT_PAGE_SPEC,
 *   mapPlacement: { aspectRatio: 1.0, fillStrategy: 'maximize' },
 *   furniture: {
 *     title: { text: 'Our Journey', subtitle: '2010-2024', position: 'top-left', ... },
 *     qrCode: { url: 'https://example.com', position: 'bottom-right', size: 72 }
 *   }
 * });
 *
 * console.log(layout.map.width);  // Map width in points
 * console.log(layout.fillPercentage);  // % of safe area used
 * ```
 */

export {
	calculateLayout,
	calculatePageDimensions,
	calculateSafeArea,
	rectanglesIntersect,
	validateLayout
} from './calculate.js';

export type {
	// Three-layer data model
	MapStyle,
	UserMapData,
	PageLayout,
	// Page specification
	PageSpec,
	PageSize,
	PageOrientation,
	// Map placement
	MapPlacement,
	// Furniture configuration
	TitleConfig,
	QRCodeConfig,
	AttributionConfig,
	FurniturePosition,
	// Layout results
	LayoutResult,
	PageDimensions,
	SafeArea,
	MapDimensions,
	FurniturePositions,
	PositionedFurniture
} from './types.js';

export { DEFAULT_MAP_STYLE, DEFAULT_PAGE_SPEC, DEFAULT_MAP_PLACEMENT } from './types.js';

export type { CompleteMapDefinition, MapMetadata, StoredMapDefinition } from './map-definition.js';

export {
	createNewMapDefinition,
	toStoredDefinition,
	fromStoredDefinition,
	validateMapDefinition,
	EXAMPLE_MAP,
	DATABASE_SCHEMA
} from './map-definition.js';
