<script lang="ts">
	/**
	 * Create Map Page - Interactive Map Editor
	 *
	 * Provides a full-featured map editor with:
	 * - Live D3 map preview
	 * - Interactive controls (rotation, zoom, pan)
	 * - Page size selection with boundary overlay
	 * - Real-time state updates
	 */

	import { createMapEditorStore } from '$lib/stores/map-editor.svelte';
	import MapCanvas from '$lib/components/MapCanvas.svelte';
	import RotationControls from '$lib/components/RotationControls.svelte';
	import ZoomControls from '$lib/components/ZoomControls.svelte';
	import PageSizeSelector from '$lib/components/PageSizeSelector.svelte';
	import ProjectionSwitcher from '$lib/components/ProjectionSwitcher.svelte';
	import PanControls from '$lib/components/PanControls.svelte';

	// Create editor store with sample data
	const store = createMapEditorStore({
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
		]
	});
</script>

<svelte:head>
	<title>Create Your Map - AlwaysMap</title>
</svelte:head>

<div class="page-layout">
	<header class="page-header">
		<a href="/" class="back-link">← Back to Home</a>
		<h1>Map Editor</h1>
		<p class="subtitle">Interactive map preview with live controls</p>
	</header>

	<div class="editor-layout">
		<!-- Main map canvas area -->
		<div class="canvas-area">
			<MapCanvas {store} width={1200} height={800} />
		</div>

		<!-- Control panel sidebar -->
		<aside class="control-panel">
			<h2 class="panel-title">Controls</h2>

			<div class="control-section">
				<ProjectionSwitcher {store} />
			</div>

			<div class="control-section">
				<PageSizeSelector {store} />
			</div>

			<div class="control-section">
				<ZoomControls {store} />
			</div>

			<div class="control-section">
				<RotationControls {store} />
			</div>

			<div class="control-section">
				<PanControls {store} />
			</div>

			<!-- Sample data info -->
			<div class="info-section">
				<h3>Sample Data</h3>
				<div class="person-info">
					<span class="person-dot" style="background: #FF6B6B;"></span>
					<span>Alice: NY → London → Tokyo</span>
				</div>
				<div class="person-info">
					<span class="person-dot" style="background: #4ECDC4;"></span>
					<span>Bob: Toronto → Paris → Sydney</span>
				</div>
			</div>
		</aside>
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

	.page-layout {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		width: 100%;
	}

	.page-header {
		background: white;
		border-bottom: 1px solid #e0e0e0;
		padding: 1.5rem 2rem;
		position: relative;
	}

	.back-link {
		color: #667eea;
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s;
		display: inline-block;
		margin-bottom: 1rem;
	}

	.back-link:hover {
		color: #764ba2;
	}

	.page-header h1 {
		font-family: 'Cormorant Garamond', serif;
		font-size: 2rem;
		font-weight: 700;
		margin: 0 0 0.25rem 0;
		color: #1a1a1a;
	}

	.subtitle {
		font-size: 0.95rem;
		color: #666;
		margin: 0;
	}

	.editor-layout {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.canvas-area {
		flex: 1;
		background: white;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		overflow: auto;
	}

	.control-panel {
		width: 360px;
		background: white;
		border-left: 1px solid #e0e0e0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.panel-title {
		font-family: 'Cormorant Garamond', serif;
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0;
		padding: 1.5rem 1.5rem 1rem 1.5rem;
		color: #1a1a1a;
		border-bottom: 2px solid #f0f0f0;
	}

	.control-section {
		padding: 1rem;
		border-bottom: 1px solid #f0f0f0;
	}

	.info-section {
		padding: 1.5rem;
		background: #fafafa;
		border-top: 1px solid #e0e0e0;
		margin-top: auto;
	}

	.info-section h3 {
		font-size: 0.875rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
		color: #333;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.person-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: #555;
		margin-bottom: 0.5rem;
	}

	.person-info:last-child {
		margin-bottom: 0;
	}

	.person-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		display: inline-block;
		flex-shrink: 0;
	}

	/* Responsive layout for smaller screens */
	@media (max-width: 1024px) {
		.editor-layout {
			flex-direction: column;
		}

		.control-panel {
			width: 100%;
			border-left: none;
			border-top: 1px solid #e0e0e0;
			max-height: 50vh;
		}

		.canvas-area {
			min-height: 50vh;
		}
	}
</style>
