<script lang="ts">
	/**
	 * MapCanvas Component
	 *
	 * Renders an interactive D3 map that responds to editor state changes.
	 * Shows both the map content and optional page boundary overlay.
	 *
	 * This component:
	 * - Renders geography using D3
	 * - Shows migration paths for people
	 * - Displays page boundary when enabled
	 * - Supports interactive rotation/pan/zoom
	 * - Re-renders when store state changes (reactive to Svelte runes)
	 */

	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { geoRobinson } from 'd3-geo-projection';
	import { feature } from 'topojson-client';
	import type { Topology, GeometryCollection } from 'topojson-specification';
	import type { MapEditorStore } from '$lib/stores/map-editor.svelte';
	import { PRINT_SPECS } from '$lib/map-renderer/dimensions';
	import {
		colors,
		styleLand,
		styleCountries,
		styleGraticule,
		stylePath,
		stylePathOutline,
		styleMarker,
		getPersonColor
	} from '$lib/map-renderer/styles';

	// Props
	interface Props {
		/** Map editor store */
		store: MapEditorStore;
		/** Canvas width in pixels */
		width?: number;
		/** Canvas height in pixels */
		height?: number;
		/** Enable interactive controls */
		interactive?: boolean;
	}

	let {
		store,
		width = 1200,
		height = 800,
		interactive = true
	}: Props = $props();

	// SVG element reference
	let svgElement: SVGSVGElement;

	// Geographic data (loaded once)
	let landData: any = null;
	let countriesData: any = null;

	/**
	 * Load geographic data from static files.
	 */
	async function loadGeographicData() {
		if (landData && countriesData) return;

		const [land, countries] = await Promise.all([
			fetch('/data/land-110m.json').then((r) => r.json()),
			fetch('/data/countries-110m.json').then((r) => r.json())
		]);

		landData = land;
		countriesData = countries;
	}

	/**
	 * Render the complete map based on current store state.
	 */
	function renderMap() {
		if (!svgElement || !landData || !countriesData) return;

		const svg = d3.select(svgElement);
		svg.selectAll('*').remove();

		// Configure SVG
		svg
			.attr('width', width)
			.attr('height', height)
			.attr('viewBox', `0 0 ${width} ${height}`)
			.style('background-color', colors.canvasBackground);

		// Create projection based on current state
		const projection = createProjection();
		const path = d3.geoPath(projection);

		// Render geography
		renderGeography(svg, path);

		// Render migration paths
		if (store.state.people.length > 0) {
			renderMigrationPaths(svg, projection);
		}

		// Render page boundary if enabled
		if (store.state.page.showBoundary) {
			renderPageBoundary(svg);
		}
	}

	/**
	 * Create D3 projection based on current store state.
	 */
	function createProjection() {
		const { projection: projType, rotation, zoom, pan } = store.state.view;

		let projection: d3.GeoProjection;

		if (projType === 'orthographic') {
			projection = d3.geoOrthographic()
				.scale((Math.min(width, height) / 2) * 0.85 * zoom)
				.translate([width / 2 + pan[0], height / 2 + pan[1]])
				.rotate(rotation)
				.clipAngle(90);
		} else if (projType === 'equirectangular') {
			projection = d3.geoEquirectangular()
				.scale((width / (2 * Math.PI)) * zoom)
				.translate([width / 2 + pan[0], height / 2 + pan[1]]);
		} else if (projType === 'mercator') {
			projection = d3.geoMercator()
				.scale((width / (2 * Math.PI)) * zoom)
				.translate([width / 2 + pan[0], height / 2 + pan[1]]);
		} else if (projType === 'naturalEarth1') {
			projection = d3.geoNaturalEarth1()
				.scale((width / (2 * Math.PI)) * zoom * 0.9)
				.translate([width / 2 + pan[0], height / 2 + pan[1]]);
		} else if (projType === 'robinson') {
			projection = geoRobinson()
				.scale((width / (2 * Math.PI)) * zoom * 0.85)
				.translate([width / 2 + pan[0], height / 2 + pan[1]]);
		} else {
			// Default to equirectangular
			projection = d3.geoEquirectangular()
				.scale((width / (2 * Math.PI)) * zoom)
				.translate([width / 2 + pan[0], height / 2 + pan[1]]);
		}

		return projection;
	}

	/**
	 * Render geographic features (land, countries, graticule).
	 */
	function renderGeography(
		svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
		path: d3.GeoPath
	) {
		const graticule = d3.geoGraticule10();

		// Render ocean (background sphere for orthographic)
		if (store.state.view.projection === 'orthographic') {
			svg
				.append('circle')
				.attr('class', 'ocean')
				.attr('cx', width / 2)
				.attr('cy', height / 2)
				.attr('r', (Math.min(width, height) / 2) * 0.85 * store.state.view.zoom)
				.attr('fill', colors.ocean);
		}

		// Render graticule
		svg
			.append('path')
			.datum(graticule)
			.attr('class', 'graticule')
			.attr('d', path)
			.call(styleGraticule);

		// Render land
		const land = feature(landData as Topology, landData.objects.land as GeometryCollection);
		svg.append('path').datum(land).attr('class', 'land').attr('d', path).call(styleLand);

		// Render country borders
		const countries = feature(
			countriesData as Topology,
			countriesData.objects.countries as GeometryCollection
		);
		svg.append('path').datum(countries).attr('class', 'countries').attr('d', path).call(styleCountries);
	}

	/**
	 * Render migration paths for all people.
	 */
	function renderMigrationPaths(
		svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
		projection: d3.GeoProjection
	) {
		const pathsGroup = svg.append('g').attr('class', 'migration-paths');

		store.state.people.forEach((person, personIndex) => {
			const color = getPersonColor(personIndex, person.color);

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
						.attr('d', (d) => {
							const projected = d.map((coord) => projection(coord) || [0, 0]);
							return lineGenerator(projected);
						})
						.call(stylePathOutline);

					// Draw colored path on top
					pathsGroup
						.append('path')
						.datum(lineData)
						.attr('class', `path person-${person.id}`)
						.attr('d', (d) => {
							const projected = d.map((coord) => projection(coord) || [0, 0]);
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

	/**
	 * Render page boundary overlay showing print area.
	 */
	function renderPageBoundary(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
		const spec = PRINT_SPECS[store.state.page.size];
		if (!spec) return;

		// Calculate dimensions
		const pageAspectRatio = spec.trimWidth / spec.trimHeight;
		const canvasAspectRatio = width / height;

		let boundaryWidth: number, boundaryHeight: number;

		if (canvasAspectRatio > pageAspectRatio) {
			// Canvas is wider - fit to height
			boundaryHeight = height * 0.9;
			boundaryWidth = boundaryHeight * pageAspectRatio;
		} else {
			// Canvas is taller - fit to width
			boundaryWidth = width * 0.9;
			boundaryHeight = boundaryWidth / pageAspectRatio;
		}

		const x = (width - boundaryWidth) / 2;
		const y = (height - boundaryHeight) / 2;

		// Create boundary group
		const boundaryGroup = svg.append('g').attr('class', 'page-boundary');

		// Draw semi-transparent overlay outside boundary
		boundaryGroup
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', width)
			.attr('height', height)
			.attr('fill', 'rgba(0, 0, 0, 0.3)')
			.attr('pointer-events', 'none');

		// Cut out the print area
		boundaryGroup
			.append('rect')
			.attr('x', x)
			.attr('y', y)
			.attr('width', boundaryWidth)
			.attr('height', boundaryHeight)
			.attr('fill', 'transparent')
			.attr('stroke', '#fff')
			.attr('stroke-width', 2)
			.attr('stroke-dasharray', '5,5')
			.attr('pointer-events', 'none');

		// Add label
		boundaryGroup
			.append('text')
			.attr('x', x + 10)
			.attr('y', y + 20)
			.attr('fill', '#fff')
			.attr('font-size', '12px')
			.attr('font-family', 'DM Sans')
			.text(`Print Area: ${store.state.page.size}`);
	}

	// Mount: Load data and render
	onMount(async () => {
		await loadGeographicData();
		renderMap();
	});

	// Re-render when store state changes
	$effect(() => {
		// IMPORTANT: Store values in variables to ensure Svelte tracks them
		// Just reading the properties isn't enough - we need to actually use them
		const projection = store.state.view.projection;
		const rotation = store.state.view.rotation;
		const zoom = store.state.view.zoom;
		const pan = store.state.view.pan;
		const pageSize = store.state.page.size;
		const showBoundary = store.state.page.showBoundary;
		const people = store.state.people;

		// Only render if data is loaded
		if (landData && countriesData && svgElement) {
			renderMap();
		}
	});
</script>

<svg bind:this={svgElement} class="map-canvas"></svg>

<style>
	.map-canvas {
		display: block;
		width: 100%;
		height: 100%;
		border: 1px solid #ccc;
	}
</style>
