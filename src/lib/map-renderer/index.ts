/**
 * Framework-agnostic map renderer.
 * Renders a print-ready map with migration paths, title box, and QR code.
 * Works identically in browser (SvelteKit) and server (Puppeteer).
 */

import * as d3 from 'd3';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type {
	MapDefinition,
	PrintSpec,
	RenderOptions,
	RenderResult,
	Dimensions
} from './types.js';
import { calculateDimensions, validateDimensions, PRINT_SPECS } from './dimensions.js';
import { waitForFonts, setRenderReady, setRenderError } from './fonts.js';
import { createProjection, createGeoPath } from './projection.js';
import { renderTitleBox, renderQRCode, renderAttribution } from './overlays.js';
import { createRotationDrag } from './rotation.js';
import {
	styleLand,
	styleCountries,
	styleGraticule,
	stylePath,
	stylePathOutline,
	styleMarker,
	getPersonColor
} from './styles.js';
import { getTheme } from './themes.js';
import { calculateLayout } from '../layout/index.js';
import type { UserMapData } from '../layout/types.js';

/**
 * Main rendering function - framework-agnostic.
 *
 * This function can be called from:
 * 1. Browser (SvelteKit component) for interactive preview
 * 2. Puppeteer for server-side rendering to PNG
 *
 * The function ensures identical output in both environments by:
 * - Using the same D3 code for all rendering
 * - Waiting for fonts to load before rendering
 * - Using points (not pixels) for all dimensions
 * - Rendering all overlays (title, QR) with D3, not framework components
 *
 * @param mapDef - Complete map definition including people and locations
 * @param printSpec - Print specifications (size, DPI, bleed) - defaults to 18x24"
 * @param options - Rendering options (selector, interactive mode, etc.)
 * @returns Render result with success status and any errors
 *
 * @example
 * ```typescript
 * // In browser
 * const result = await renderMap(
 *   { title: 'Our Family', subtitle: '2010-2024', people: [...] },
 *   PRINT_SPECS['18x24'],
 *   { selector: '#map-svg', interactive: true }
 * );
 *
 * // In Puppeteer
 * const result = await renderMap(
 *   mapDefinition,
 *   PRINT_SPECS['18x24'],
 *   { selector: '#map-svg', interactive: false }
 * );
 * ```
 */
export async function renderMap(
	mapDef: MapDefinition,
	printSpec: PrintSpec = PRINT_SPECS['18x24'],
	options: RenderOptions = {}
): Promise<RenderResult> {
	try {
		// Step 0: Get theme
		const theme = getTheme(mapDef.theme);
		console.log('✓ Theme loaded:', theme.name);

		// Step 1: Wait for fonts to load (browser only)
		let fontStatuses;
		try {
			fontStatuses = await waitForFonts(10000);
			console.log('✓ All fonts loaded:', fontStatuses.length);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Font loading failed';
			console.error('✗ Font loading error:', errorMsg);
			setRenderError(errorMsg);
			return { success: false, error: errorMsg };
		}

		// Step 2: Calculate dimensions
		const dimensions = calculateDimensions(printSpec);
		const validation = validateDimensions(dimensions);

		if (!validation.valid) {
			const errorMsg = `Invalid dimensions: ${validation.errors.join(', ')}`;
			console.error('✗ Dimension validation failed:', errorMsg);
			setRenderError(errorMsg);
			return { success: false, error: errorMsg, dimensions };
		}

		console.log('✓ Dimensions calculated:', {
			totalSize: `${dimensions.totalWidth}x${dimensions.totalHeight}pt`,
			pixels: `${dimensions.pixelWidth}x${dimensions.pixelHeight}px`,
			safeArea: dimensions.safeArea
		});

		// Step 3: Select or create SVG element
		let svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;

		if (options.selection) {
			svg = options.selection;
		} else if (options.selector) {
			const element = d3.select<SVGSVGElement, unknown>(options.selector);
			if (element.empty()) {
				const errorMsg = `SVG element not found: ${options.selector}`;
				console.error('✗', errorMsg);
				setRenderError(errorMsg);
				return { success: false, error: errorMsg, dimensions };
			}
			svg = element;
		} else {
			const errorMsg = 'Either selector or selection must be provided';
			console.error('✗', errorMsg);
			setRenderError(errorMsg);
			return { success: false, error: errorMsg, dimensions };
		}

		// Clear any existing content
		svg.selectAll('*').remove();

		// Step 4: Configure SVG canvas
		svg
			.attr('width', dimensions.totalWidth)
			.attr('height', dimensions.totalHeight)
			.attr('viewBox', `0 0 ${dimensions.totalWidth} ${dimensions.totalHeight}`)
			.style('background-color', options.backgroundColor || theme.colors.canvasBackground);

		// Step 4.5: Calculate layout if provided
		let layoutResult;
		if (mapDef.layout) {
			// Convert MapDefinition to UserMapData for layout engine
			const userData: UserMapData = {
				people: mapDef.people,
				view: {
					projection: 'orthographic',
					rotation: mapDef.rotation || [0, 0, 0]
				}
			};

			layoutResult = calculateLayout(userData, mapDef.layout);
			console.log('✓ Layout calculated:', {
				mapSize: `${layoutResult.map.width.toFixed(0)}×${layoutResult.map.height.toFixed(0)}pt`,
				fill: `${layoutResult.fillPercentage.toFixed(1)}%`,
				scale: layoutResult.map.scale.toFixed(0)
			});
		}

		// Step 5: Create projection and path generator
		const projection = createProjection(
			dimensions,
			mapDef.rotation,
			layoutResult ? { center: layoutResult.map.center, scale: layoutResult.map.scale } : undefined
		);
		const path = createGeoPath(projection);

		console.log('✓ Projection created:', {
			center: projection.translate(),
			scale: projection.scale()
		});

		// Step 6: Load and render geographic data
		let landData: any, countriesData: any;
		try {
			const data = await loadGeographicData();
			landData = data.landData;
			countriesData = data.countriesData;
			renderGeography(svg, path, landData, countriesData, theme);
			console.log('✓ Geography rendered');
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : 'Failed to load geographic data';
			console.error('✗ Geography rendering failed:', errorMsg);
			setRenderError(errorMsg);
			return { success: false, error: errorMsg, dimensions };
		}

		// Step 7: Render migration paths
		renderMigrationPaths(svg, mapDef.people, projection, theme);
		console.log('✓ Migration paths rendered:', mapDef.people.length, 'people');

		// Step 7.5: Enable interactive rotation if requested
		if (options.interactive && typeof projection.rotate === 'function') {
			const drag = createRotationDrag(projection, (rotation) => {
				// Re-render geography and paths on rotation
				svg.selectAll('.ocean, .graticule, .land, .countries, .migration-paths').remove();
				renderGeography(svg, path, landData, countriesData, theme);
				renderMigrationPaths(svg, mapDef.people, projection, theme);
			});

			svg.call(drag as any);
			console.log('✓ Interactive rotation enabled');
		}

		// Step 8: Render title box
		renderTitleBox(
			svg,
			mapDef.title,
			mapDef.subtitle,
			dimensions.safeArea,
			layoutResult?.furniture.title
		);
		console.log('✓ Title box rendered');

		// Step 9: Render QR code
		await renderQRCode(
			svg,
			'https://alwaysmap.com',
			dimensions.safeArea,
			100,
			layoutResult?.furniture.qrCode
		);
		console.log('✓ QR code rendered');

		// Step 10: Render attribution
		renderAttribution(svg, 'Map data © Natural Earth', dimensions.safeArea);
		console.log('✓ Attribution rendered');

		// Step 11: Signal success
		setRenderReady();
		console.log('✓ Render complete');

		return {
			success: true,
			fonts: fontStatuses,
			dimensions,
			svg: svg.node() || undefined
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown rendering error';
		console.error('✗ Render failed:', errorMsg, error);
		setRenderError(errorMsg);
		return { success: false, error: errorMsg };
	}
}

/**
 * Loads geographic data from static files.
 */
async function loadGeographicData(): Promise<{ landData: any; countriesData: any }> {
	const [landData, countriesData] = await Promise.all([
		fetch('/data/land-110m.json').then((r) => {
			if (!r.ok) throw new Error(`Failed to load land data: ${r.statusText}`);
			return r.json();
		}),
		fetch('/data/countries-110m.json').then((r) => {
			if (!r.ok) throw new Error(`Failed to load countries data: ${r.statusText}`);
			return r.json();
		})
	]);

	return { landData, countriesData };
}

/**
 * Renders geographic features (land, countries, graticule).
 */
function renderGeography(
	svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>,
	path: d3.GeoPath,
	landData: any,
	countriesData: any,
	theme: ReturnType<typeof getTheme>
): void {
	// Create graticule (latitude/longitude grid)
	const graticule = d3.geoGraticule10();

	// Render ocean (background circle)
	svg
		.append('circle')
		.attr('class', 'ocean')
		.attr('cx', path.centroid({ type: 'Sphere' })[0])
		.attr('cy', path.centroid({ type: 'Sphere' })[1])
		.attr('r', (path.projection() as any).scale())
		.attr('fill', theme.colors.ocean);

	// Render graticule
	svg
		.append('path')
		.datum(graticule)
		.attr('class', 'graticule')
		.attr('d', path)
		.call(styleGraticule, theme);

	// Render land
	const land = feature(landData as Topology, landData.objects.land as GeometryCollection);
	svg.append('path').datum(land).attr('class', 'land').attr('d', path).call(styleLand, theme);

	// Render country borders
	const countries = feature(
		countriesData as Topology,
		countriesData.objects.countries as GeometryCollection
	);
	svg
		.append('path')
		.datum(countries)
		.attr('class', 'countries')
		.attr('d', path)
		.call(styleCountries, theme);
}

/**
 * Renders migration paths for all people.
 */
function renderMigrationPaths(
	svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>,
	people: MapDefinition['people'],
	projection: d3.GeoProjection,
	theme: ReturnType<typeof getTheme>
): void {
	const pathsGroup = svg.append('g').attr('class', 'migration-paths');

	people.forEach((person, personIndex) => {
		const color = getPersonColor(personIndex, theme, person.color);

		// Create line segments between consecutive locations
		for (let i = 0; i < person.locations.length - 1; i++) {
			const from = person.locations[i];
			const to = person.locations[i + 1];

			const lineData: [number, number][] = [
				[from.longitude, from.latitude],
				[to.longitude, to.latitude]
			];

			const lineGenerator = d3.line().curve(d3.curveCardinal);

			// Check if both points are visible
			const fromVisible = projection([from.longitude, from.latitude]) !== null;
			const toVisible = projection([to.longitude, to.latitude]) !== null;

			if (fromVisible || toVisible) {
				// Draw outline (white) first
				pathsGroup
					.append('path')
					.datum(lineData)
					.attr('class', `path-outline person-${person.id}`)
					.attr('d', (d: [number, number][]) => {
						const projected = d.map(
							(coord: [number, number]) => projection(coord) || ([0, 0] as [number, number])
						) as [number, number][];
						return lineGenerator(projected);
					})
					.call(stylePathOutline);

				// Draw colored path on top
				pathsGroup
					.append('path')
					.datum(lineData)
					.attr('class', `path person-${person.id}`)
					.attr('d', (d: [number, number][]) => {
						const projected = d.map(
							(coord: [number, number]) => projection(coord) || ([0, 0] as [number, number])
						) as [number, number][];
						return lineGenerator(projected);
					})
					.call(stylePath, color);
			}
		}

		// Draw location markers (dots)
		person.locations.forEach((location) => {
			const coords = projection([location.longitude, location.latitude]);
			if (coords) {
				pathsGroup
					.append('circle')
					.attr('class', `marker person-${person.id}`)
					.attr('cx', coords[0])
					.attr('cy', coords[1])
					.call(styleMarker, color);
			}
		});
	});
}

// Re-export commonly used types and constants
export { PRINT_SPECS, calculateDimensions, validateDimensions } from './dimensions.js';
export { waitForFonts, setRenderReady, setRenderError } from './fonts.js';
export type {
	MapDefinition,
	Person,
	Location,
	PrintSpec,
	Dimensions,
	RenderOptions,
	RenderResult
} from './types.js';
