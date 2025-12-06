<script lang="ts">
	import { onMount } from 'svelte';
	import { renderMap, PRINT_SPECS, type MapDefinition } from '$lib/map-renderer';

	// This route is specifically designed for Puppeteer screenshot rendering.
	// It receives map definition data via URL query parameter and renders at full 300 DPI.

	let renderStatus = $state('Initializing...');
	let errorMessage = $state('');

	/**
	 * Decodes map definition from URL query parameter
	 */
	function getMapDefinitionFromURL(): MapDefinition | null {
		if (typeof window === 'undefined') return null;

		const params = new URLSearchParams(window.location.search);
		const dataParam = params.get('data');

		if (!dataParam) {
			console.error('Missing "data" query parameter');
			return null;
		}

		try {
			// Data is base64url encoded JSON
			const jsonString = atob(dataParam.replace(/-/g, '+').replace(/_/g, '/'));
			const mapDef = JSON.parse(jsonString);
			return mapDef;
		} catch (error) {
			console.error('Failed to decode map definition:', error);
			return null;
		}
	}

	onMount(async () => {
		try {
			renderStatus = 'Loading map definition...';

			// Get map definition from URL
			const mapDef = getMapDefinitionFromURL();

			if (!mapDef) {
				errorMessage = 'Invalid or missing map definition';
				renderStatus = 'Error';
				(window as any).__RENDER_ERROR__ = errorMessage;
				return;
			}

			renderStatus = 'Loading fonts...';

			// Render at full 300 DPI resolution
			const result = await renderMap(mapDef, PRINT_SPECS['18x24'], {
				selector: '#map-svg',
				interactive: false // No interaction in Puppeteer mode
			});

			if (result.success) {
				renderStatus = 'Render complete!';
				console.log('✓ Puppeteer render successful');

				// Signal to Puppeteer that rendering is complete
				(window as any).__RENDER_READY__ = true;
			} else {
				renderStatus = 'Render failed';
				errorMessage = result.error || 'Unknown error';
				console.error('✗ Puppeteer render failed:', result.error);

				// Signal error to Puppeteer
				(window as any).__RENDER_ERROR__ = errorMessage;
			}
		} catch (error) {
			renderStatus = 'Error occurred';
			errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error('✗ Exception during Puppeteer render:', error);

			// Signal error to Puppeteer
			(window as any).__RENDER_ERROR__ = errorMessage;
		}
	});
</script>

<svelte:head>
	<title>AlwaysMap - Render</title>
</svelte:head>

<div class="render-container">
	<svg id="map-svg"></svg>

	<!-- Status indicator (hidden in screenshot, useful for debugging) -->
	<div class="status-overlay">
		<div class="status-label">Status:</div>
		<div class="status-value" class:error={errorMessage}>{renderStatus}</div>
		{#if errorMessage}
			<div class="error-message">{errorMessage}</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		background: transparent;
	}

	.render-container {
		width: 100vw;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	#map-svg {
		max-width: 100%;
		max-height: 100%;
	}

	/* Status overlay - positioned off-screen for screenshot */
	.status-overlay {
		position: fixed;
		top: -1000px;
		left: -1000px;
		padding: 1rem;
		background: white;
		border: 1px solid #ccc;
		font-family: monospace;
		font-size: 12px;
	}

	.status-label {
		font-weight: bold;
		margin-bottom: 0.5rem;
	}

	.status-value {
		color: #28a745;
	}

	.status-value.error {
		color: #dc3545;
	}

	.error-message {
		margin-top: 0.5rem;
		padding: 0.5rem;
		background: #f8d7da;
		color: #721c24;
		border-radius: 4px;
	}
</style>
