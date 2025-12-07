/**
 * Core layout calculation engine.
 *
 * Calculates optimal positioning of map and furniture on physical page
 * to maximize map fill while keeping all elements within safe area.
 *
 * All calculations are pure functions with no DOM dependencies.
 * All dimensions in points (1 pt = 1/72 inch).
 */

import type {
	PageSpec,
	PageLayout,
	UserMapData,
	LayoutResult,
	PageDimensions,
	SafeArea,
	MapDimensions,
	FurniturePositions,
	PositionedFurniture,
	FurniturePosition,
	TitleConfig,
	QRCodeConfig,
	AttributionConfig
} from './types.js';

/**
 * Page size dimensions in inches.
 * Supports USA (inches), International (A-series), in both portrait and landscape.
 */
const PAGE_SIZES: Record<string, { width: number; height: number }> = {
	// USA Portrait
	'8x10': { width: 8, height: 10 },
	'12x16': { width: 12, height: 16 },
	'18x24': { width: 18, height: 24 },
	'24x36': { width: 24, height: 36 },
	// USA Landscape
	'10x8': { width: 10, height: 8 },
	'16x12': { width: 16, height: 12 },
	'24x18': { width: 24, height: 18 },
	'36x24': { width: 36, height: 24 },
	// International Portrait (A-series in inches, converted from mm)
	'A4': { width: 8.27, height: 11.69 }, // 210×297mm
	'A3': { width: 11.69, height: 16.54 }, // 297×420mm
	'A2': { width: 16.54, height: 23.38 }, // 420×594mm
	'A1': { width: 23.38, height: 33.08 }, // 594×841mm
	// International Landscape
	'A4-landscape': { width: 11.69, height: 8.27 },
	'A3-landscape': { width: 16.54, height: 11.69 },
	'A2-landscape': { width: 23.38, height: 16.54 },
	'A1-landscape': { width: 33.08, height: 23.38 }
};

/**
 * Calculates complete page layout.
 *
 * This is the main entry point for the layout engine.
 * Given user data and page configuration, calculates exact positions
 * for map and all furniture elements.
 *
 * @param userData - User map data (people, locations, view)
 * @param pageLayout - Page layout configuration
 * @returns Complete layout with positions in points
 *
 * @example
 * ```typescript
 * const layout = calculateLayout(userData, pageLayout);
 * console.log(layout.map.width);  // Map width in points
 * console.log(layout.fillPercentage);  // % of safe area used by map
 * ```
 */
export function calculateLayout(userData: UserMapData, pageLayout: PageLayout): LayoutResult {
	// Step 1: Calculate page dimensions in points
	const page = calculatePageDimensions(pageLayout.page);

	// Step 2: Calculate safe area (inset from trim line)
	const safeArea = calculateSafeArea(page, pageLayout.page);

	// Step 3: Calculate furniture space requirements
	const furnitureSpace = calculateFurnitureSpace(pageLayout.furniture, safeArea);

	// Step 4: Calculate available space for map
	const availableMapArea = calculateAvailableMapArea(safeArea, furnitureSpace);

	// Step 5: Calculate optimal map dimensions to maximize fill
	const mapDimensions = calculateOptimalMapSize(
		pageLayout.mapPlacement.aspectRatio || 1.0,
		availableMapArea,
		pageLayout.mapPlacement.zoomAdjustment || 1.0
	);

	// Step 6: Center map in available space
	const mapPosition = centerMapInSpace(mapDimensions, safeArea, furnitureSpace);

	// Step 7: Calculate D3 projection scale
	const projectionScale = calculateProjectionScale(
		userData.view.projection,
		mapDimensions.width,
		mapDimensions.height
	);

	// Step 8: Position furniture around map
	const furniture = positionFurniture(pageLayout.furniture, safeArea, mapPosition);

	// Step 9: Calculate fill percentage
	const fillPercentage = calculateFillPercentage(mapPosition, safeArea);

	return {
		page,
		safeArea,
		map: {
			...mapPosition,
			scale: projectionScale,
			center: [mapPosition.x + mapPosition.width / 2, mapPosition.y + mapPosition.height / 2]
		},
		furniture,
		fillPercentage
	};
}

/**
 * Calculates page dimensions in points.
 */
export function calculatePageDimensions(spec: PageSpec): PageDimensions {
	const pageSize = PAGE_SIZES[spec.size];
	if (!pageSize) {
		throw new Error(`Unknown page size: ${spec.size}`);
	}

	// Get base dimensions based on orientation
	let width = pageSize.width;
	let height = pageSize.height;

	if (spec.orientation === 'landscape') {
		[width, height] = [height, width]; // Swap for landscape
	}

	// Convert inches to points (1 inch = 72 points)
	const trimWidth = width * 72;
	const trimHeight = height * 72;

	// Total size includes bleed on all sides
	const totalWidth = trimWidth + 2 * spec.bleed;
	const totalHeight = trimHeight + 2 * spec.bleed;

	// Calculate pixel dimensions
	const pixelWidth = Math.round((totalWidth / 72) * spec.dpi);
	const pixelHeight = Math.round((totalHeight / 72) * spec.dpi);

	return {
		totalWidth,
		totalHeight,
		trimWidth,
		trimHeight,
		bleed: spec.bleed,
		pixels: {
			width: pixelWidth,
			height: pixelHeight
		}
	};
}

/**
 * Calculates safe area bounds (inset from trim line).
 */
export function calculateSafeArea(page: PageDimensions, spec: PageSpec): SafeArea {
	// Safe area starts at bleed + safeMargin from top-left
	const x = page.bleed + spec.safeMargin;
	const y = page.bleed + spec.safeMargin;

	// Safe area width/height is trim minus 2× safe margin
	const width = page.trimWidth - 2 * spec.safeMargin;
	const height = page.trimHeight - 2 * spec.safeMargin;

	return { x, y, width, height };
}

/**
 * Calculates space required by furniture.
 *
 * IMPORTANT: Furniture is positioned in CORNERS, not center!
 * So it doesn't reduce available map space - it just needs margins.
 * We only need a small margin to keep furniture from touching map.
 */
function calculateFurnitureSpace(
	furniture: PageLayout['furniture'],
	safeArea: SafeArea
): {
	reservedWidth: number;
	reservedHeight: number;
	margin: number;
} {
	const margin = 36; // Small margin between furniture and map

	// Furniture is in corners, so it doesn't reduce the center map space
	// We just need small margins on all sides
	return {
		reservedWidth: margin * 2, // Small margins on left/right
		reservedHeight: margin * 2, // Small margins on top/bottom
		margin
	};
}

/**
 * Calculates available space for map after furniture reservation.
 */
function calculateAvailableMapArea(
	safeArea: SafeArea,
	furnitureSpace: { reservedWidth: number; reservedHeight: number }
): {
	width: number;
	height: number;
} {
	return {
		width: safeArea.width - furnitureSpace.reservedWidth,
		height: safeArea.height - furnitureSpace.reservedHeight
	};
}

/**
 * Calculates optimal map size to maximize fill.
 */
function calculateOptimalMapSize(
	aspectRatio: number,
	availableArea: { width: number; height: number },
	zoomAdjustment: number
): {
	width: number;
	height: number;
} {
	// Calculate dimensions that fit within available area while maintaining aspect ratio
	const widthConstrained = {
		width: availableArea.width,
		height: availableArea.width / aspectRatio
	};

	const heightConstrained = {
		width: availableArea.height * aspectRatio,
		height: availableArea.height
	};

	// Choose the smaller dimensions (fits in both directions)
	let dimensions =
		widthConstrained.height <= availableArea.height ? widthConstrained : heightConstrained;

	// Apply zoom adjustment
	dimensions = {
		width: dimensions.width * zoomAdjustment,
		height: dimensions.height * zoomAdjustment
	};

	return dimensions;
}

/**
 * Centers map in available space.
 */
function centerMapInSpace(
	mapDimensions: { width: number; height: number },
	safeArea: SafeArea,
	furnitureSpace: { margin: number }
): {
	x: number;
	y: number;
	width: number;
	height: number;
} {
	// Center horizontally within safe area
	const x = safeArea.x + (safeArea.width - mapDimensions.width) / 2;

	// Center vertically within safe area
	const y = safeArea.y + (safeArea.height - mapDimensions.height) / 2;

	return {
		x,
		y,
		width: mapDimensions.width,
		height: mapDimensions.height
	};
}

/**
 * Calculates D3 projection scale for orthographic projection.
 *
 * For orthographic (globe) projection, the scale determines the radius
 * of the visible hemisphere. We want the globe to fit within the map area.
 */
function calculateProjectionScale(
	projection: string,
	width: number,
	height: number
): number {
	if (projection === 'orthographic') {
		// For orthographic, scale is radius of the globe
		// We want the globe to fit within the smaller dimension
		return Math.min(width, height) / 2;
	}

	// For other projections, use a different scale calculation
	// (implement as needed)
	return Math.min(width, height) / 2;
}

/**
 * Positions all furniture elements in their corners.
 */
function positionFurniture(
	furniture: PageLayout['furniture'],
	safeArea: SafeArea,
	map: { x: number; y: number; width: number; height: number }
): FurniturePositions {
	const margin = 18; // Standard margin in points

	// Calculate title block position
	const titleSize = calculateTitleSize(furniture.title);
	const titlePos = calculateCornerPosition(
		furniture.title.position,
		titleSize,
		safeArea,
		margin
	);

	// Calculate QR code position
	const qrSize = { width: furniture.qrCode.size, height: furniture.qrCode.size };
	const qrPos = calculateCornerPosition(furniture.qrCode.position, qrSize, safeArea, margin);

	// Calculate attribution position (if present)
	let attrPos: PositionedFurniture | undefined;
	if (furniture.attribution) {
		const attrSize = calculateAttributionSize(furniture.attribution);
		attrPos = calculateCornerPosition(furniture.attribution.position, attrSize, safeArea, margin);
	}

	return {
		title: titlePos,
		qrCode: qrPos,
		attribution: attrPos
	};
}

/**
 * Calculates title block size based on text content.
 * For now uses simple heuristics - can be refined with actual font metrics.
 */
function calculateTitleSize(title: TitleConfig): { width: number; height: number } {
	// Rough estimates based on typical font sizes
	// Title: ~12 chars per inch at 36pt
	// Subtitle: ~15 chars per inch at 24pt

	const titleWidth = Math.max(200, title.text.length * 3);
	const titleHeight = title.titleFontSize * 1.2; // Line height
	const subtitleHeight = title.subtitle ? title.subtitleFontSize * 1.2 : 0;
	const padding = 20;

	return {
		width: Math.min(titleWidth, 400), // Cap at 400pt
		height: titleHeight + subtitleHeight + padding
	};
}

/**
 * Calculates attribution size.
 */
function calculateAttributionSize(attr: AttributionConfig): { width: number; height: number } {
	return {
		width: Math.max(150, attr.text.length * 2),
		height: attr.fontSize * 1.5
	};
}

/**
 * Calculates exact position for furniture in a corner.
 */
function calculateCornerPosition(
	position: FurniturePosition,
	itemSize: { width: number; height: number },
	safeArea: SafeArea,
	margin: number
): PositionedFurniture {
	const { x: safeX, y: safeY, width: safeW, height: safeH } = safeArea;

	switch (position) {
		case 'top-left':
			return {
				x: safeX + margin,
				y: safeY + margin,
				width: itemSize.width,
				height: itemSize.height
			};

		case 'top-right':
			return {
				x: safeX + safeW - itemSize.width - margin,
				y: safeY + margin,
				width: itemSize.width,
				height: itemSize.height
			};

		case 'bottom-left':
			return {
				x: safeX + margin,
				y: safeY + safeH - itemSize.height - margin,
				width: itemSize.width,
				height: itemSize.height
			};

		case 'bottom-right':
			return {
				x: safeX + safeW - itemSize.width - margin,
				y: safeY + safeH - itemSize.height - margin,
				width: itemSize.width,
				height: itemSize.height
			};
	}
}

/**
 * Calculates fill percentage (how much of safe area is used by map).
 */
function calculateFillPercentage(
	map: { width: number; height: number },
	safeArea: SafeArea
): number {
	const mapArea = map.width * map.height;
	const safeAreaTotal = safeArea.width * safeArea.height;
	return (mapArea / safeAreaTotal) * 100;
}

/**
 * Checks if two rectangles intersect (for collision detection).
 */
export function rectanglesIntersect(
	r1: { x: number; y: number; width: number; height: number },
	r2: { x: number; y: number; width: number; height: number }
): boolean {
	return !(
		r1.x + r1.width <= r2.x || // r1 is left of r2 (or touching edge)
		r2.x + r2.width <= r1.x || // r2 is left of r1 (or touching edge)
		r1.y + r1.height <= r2.y || // r1 is above r2 (or touching edge)
		r2.y + r2.height <= r1.y // r2 is above r1 (or touching edge)
	);
}

/**
 * Validates that all furniture is within safe area and doesn't overlap map.
 */
export function validateLayout(layout: LayoutResult): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Check that map is within safe area
	const mapInSafe =
		layout.map.x >= layout.safeArea.x &&
		layout.map.y >= layout.safeArea.y &&
		layout.map.x + layout.map.width <= layout.safeArea.x + layout.safeArea.width &&
		layout.map.y + layout.map.height <= layout.safeArea.y + layout.safeArea.height;

	if (!mapInSafe) {
		errors.push('Map extends outside safe area');
	}

	// Check that title is within safe area
	const titleInSafe =
		layout.furniture.title.x >= layout.safeArea.x &&
		layout.furniture.title.y >= layout.safeArea.y &&
		layout.furniture.title.x + layout.furniture.title.width <=
			layout.safeArea.x + layout.safeArea.width &&
		layout.furniture.title.y + layout.furniture.title.height <=
			layout.safeArea.y + layout.safeArea.height;

	if (!titleInSafe) {
		errors.push('Title extends outside safe area');
	}

	// Check that QR code is within safe area
	const qrInSafe =
		layout.furniture.qrCode.x >= layout.safeArea.x &&
		layout.furniture.qrCode.y >= layout.safeArea.y &&
		layout.furniture.qrCode.x + layout.furniture.qrCode.width <=
			layout.safeArea.x + layout.safeArea.width &&
		layout.furniture.qrCode.y + layout.furniture.qrCode.height <=
			layout.safeArea.y + layout.safeArea.height;

	if (!qrInSafe) {
		errors.push('QR code extends outside safe area');
	}

	// Check for overlaps
	if (rectanglesIntersect(layout.map, layout.furniture.title)) {
		errors.push('Title overlaps with map');
	}

	if (rectanglesIntersect(layout.map, layout.furniture.qrCode)) {
		errors.push('QR code overlaps with map');
	}

	if (rectanglesIntersect(layout.furniture.title, layout.furniture.qrCode)) {
		errors.push('Title overlaps with QR code');
	}

	return {
		valid: errors.length === 0,
		errors
	};
}
