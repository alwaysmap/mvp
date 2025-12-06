<script lang="ts">
	import { onMount } from 'svelte';
	import { renderMap, PRINT_SPECS, type MapDefinition } from '$lib/map-renderer';

	let renderStatus = $state('Initializing...');
	let errorMessage = $state('');
	let containerWidth = $state(0);
	let containerHeight = $state(0);
	let mapContainer: HTMLDivElement;

	// Sample map data
	const sampleMap: MapDefinition = {
		title: 'Our Family Journey',
		subtitle: '2010-2024',
		people: [
			{
				id: 'alice',
				name: 'Alice',
				color: '#FF6B6B',
				locations: [
					{
						countryCode: 'US',
						longitude: -74.006,
						latitude: 40.7128,
						date: '2010-01-01'
					},
					{
						countryCode: 'GB',
						longitude: -0.1276,
						latitude: 51.5074,
						date: '2015-06-15'
					},
					{
						countryCode: 'JP',
						longitude: 139.6917,
						latitude: 35.6895,
						date: '2020-03-20'
					}
				]
			},
			{
				id: 'bob',
				name: 'Bob',
				color: '#4ECDC4',
				locations: [
					{
						countryCode: 'CA',
						longitude: -79.3832,
						latitude: 43.6532,
						date: '2012-05-10'
					},
					{
						countryCode: 'FR',
						longitude: 2.3522,
						latitude: 48.8566,
						date: '2016-08-22'
					},
					{
						countryCode: 'AU',
						longitude: 151.2093,
						latitude: -33.8688,
						date: '2021-11-15'
					}
				]
			}
		],
		rotation: [-20, -30, 0]
	};

	async function render() {
		try {
			renderStatus = 'Loading fonts...';

			const result = await renderMap(sampleMap, PRINT_SPECS['18x24'], {
				selector: '#map-svg',
				interactive: false
				// backgroundColor uses default antique parchment color from styles.ts
			});

			if (result.success) {
				renderStatus = 'Render complete!';
				console.log('Map rendered successfully:', result);
			} else {
				renderStatus = 'Render failed';
				errorMessage = result.error || 'Unknown error';
				console.error('Render failed:', result.error);
			}
		} catch (error) {
			renderStatus = 'Error occurred';
			errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error('Exception during render:', error);
		}
	}

	onMount(() => {
		// Get initial container dimensions
		if (mapContainer) {
			containerWidth = mapContainer.clientWidth;
			containerHeight = mapContainer.clientHeight;
		}

		// Render the map
		render();

		// Handle window resize
		const handleResize = () => {
			if (mapContainer) {
				containerWidth = mapContainer.clientWidth;
				containerHeight = mapContainer.clientHeight;
			}
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});
</script>

<svelte:head>
	<title>Create Your Map - AlwaysMap</title>
</svelte:head>

<div class="container">
	<header>
		<a href="/" class="back-link">← Back to Home</a>
		<h1>Create Your Map</h1>
		<p class="subtitle">Sample visualization with the D3 map renderer</p>
	</header>

	<div class="status-bar">
		<span class="status-label">Status:</span>
		<span class="status-value" class:error={errorMessage}>{renderStatus}</span>
		{#if errorMessage}
			<div class="error-message">{errorMessage}</div>
		{/if}
	</div>

	<div class="map-container" bind:this={mapContainer}>
		<svg id="map-svg"></svg>
	</div>

	<div class="info-panel">
		<h2>Render Details</h2>
		<ul>
			<li><strong>Print Size:</strong> 18×24" (Premium Poster)</li>
			<li><strong>Resolution:</strong> 300 DPI (5475×7275 pixels)</li>
			<li><strong>Bleed:</strong> 0.125" (9pt)</li>
			<li><strong>Safe Margin:</strong> 0.25" (18pt)</li>
			<li><strong>Projection:</strong> Orthographic (Globe view)</li>
		</ul>

		<h2>Sample Data</h2>
		<ul>
			<li><strong style="color: #FF6B6B;">●</strong> Alice: New York → London → Tokyo</li>
			<li><strong style="color: #4ECDC4;">●</strong> Bob: Toronto → Paris → Sydney</li>
		</ul>

		<h2>Features Demonstrated</h2>
		<ul>
			<li>✓ Framework-agnostic D3 rendering</li>
			<li>✓ Title box with custom fonts (Cormorant Garamond)</li>
			<li>✓ QR code overlay (bottom-right)</li>
			<li>✓ Geographic projection with rotation</li>
			<li>✓ Migration paths between locations</li>
			<li>✓ Location markers (dots)</li>
			<li>✓ Bleed and safe area calculations</li>
		</ul>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'DM Sans', sans-serif;
		background: #f8f9fa;
		overflow-x: hidden;
	}

	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1rem;
		box-sizing: border-box;
		width: 100%;
	}

	@media (min-width: 768px) {
		.container {
			padding: 2rem;
		}
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
		position: relative;
	}

	.back-link {
		position: absolute;
		left: 0;
		top: 0;
		color: #667eea;
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: #764ba2;
	}

	h1 {
		font-family: 'Cormorant Garamond', serif;
		font-size: 3rem;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		color: #1a1a1a;
	}

	.subtitle {
		font-size: 1.1rem;
		color: #666;
		margin: 0;
	}

	.status-bar {
		background: white;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 2rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.status-label {
		font-weight: 600;
		margin-right: 0.5rem;
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
		font-family: monospace;
		font-size: 0.9rem;
	}

	.map-container {
		background: white;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 2rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 70vh;
		width: 100%;
		box-sizing: border-box;
		overflow: hidden;
	}

	@media (min-width: 768px) {
		.map-container {
			padding: 2rem;
		}
	}

	#map-svg {
		width: 100%;
		height: auto;
		max-width: 100%;
		max-height: 70vh;
		border: 1px solid #e0e0e0;
		box-sizing: border-box;
	}

	.info-panel {
		background: white;
		border-radius: 8px;
		padding: 2rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.info-panel h2 {
		font-family: 'Cormorant Garamond', serif;
		font-size: 1.5rem;
		margin-top: 0;
		margin-bottom: 1rem;
		color: #1a1a1a;
	}

	.info-panel h2:not(:first-child) {
		margin-top: 2rem;
	}

	.info-panel ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.info-panel li {
		padding: 0.5rem 0;
		border-bottom: 1px solid #f0f0f0;
	}

	.info-panel li:last-child {
		border-bottom: none;
	}

	strong {
		font-weight: 600;
	}
</style>
