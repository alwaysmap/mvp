<script lang="ts">
	/**
	 * Create Map Page - Interactive Map Editor
	 *
	 * Provides a full-featured map editor with:
	 * - Live D3 map preview
	 * - Interactive controls (rotation, zoom, pan)
	 * - Page size selection with boundary overlay
	 * - Real-time state updates
	 * - Save map functionality
	 * - Export to PNG workflow
	 */

	import { createMapEditorStore } from '$lib/stores/map-editor.svelte';
	import MapCanvas from '$lib/components/MapCanvas.svelte';
	import RotationControls from '$lib/components/RotationControls.svelte';
	import ZoomControls from '$lib/components/ZoomControls.svelte';
	import PageSizeSelector from '$lib/components/PageSizeSelector.svelte';
	import ProjectionSwitcher from '$lib/components/ProjectionSwitcher.svelte';
	import PanControls from '$lib/components/PanControls.svelte';

	let saveError = $state<string | null>(null);
	let saveSuccess = $state(false);
	let exportError = $state<string | null>(null);
	let showJobStatus = $state(false);

	async function handleSave() {
		saveError = null;
		saveSuccess = false;

		try {
			await store.saveMap();
			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 3000);
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Failed to save map';
		}
	}

	async function handleBuyPrint() {
		exportError = null;

		try {
			await store.triggerExport();
			showJobStatus = true;
		} catch (error) {
			exportError = error instanceof Error ? error.message : 'Failed to trigger export';
		}
	}

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

			<!-- Save and Export Actions -->
			<div class="action-section">
				<h3>Actions</h3>

				<button class="save-button" onclick={handleSave} disabled={store.state.isSaving}>
					{#if store.state.isSaving}
						Saving...
					{:else if store.state.isSaved}
						✓ Saved
					{:else}
						Save Map
					{/if}
				</button>

				{#if saveSuccess}
					<div class="success-message">Map saved successfully!</div>
				{/if}

				{#if saveError}
					<div class="error-message">{saveError}</div>
				{/if}

				{#if store.state.userMapId}
					<div class="map-id-info">Map ID: {store.state.userMapId.substring(0, 8)}...</div>
				{/if}

				<button
					class="buy-button"
					onclick={handleBuyPrint}
					disabled={!store.state.isSaved || store.state.isExporting}
					title={!store.state.isSaved ? 'Please save your map first' : 'Generate print-ready PNG'}
				>
					{#if store.state.isExporting}
						Generating PNG...
					{:else if store.state.printJobId}
						✓ Export Started
					{:else}
						Buy Print
					{/if}
				</button>

				{#if exportError}
					<div class="error-message">{exportError}</div>
				{/if}

				{#if showJobStatus && store.state.printJobId}
					<div class="job-status">
						<div class="status-label">Job ID:</div>
						<div class="status-value">{store.state.printJobId.substring(0, 8)}...</div>
						<div class="status-info">Exporting in background...</div>
					</div>
				{/if}
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
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
		padding: 1rem 1rem 0.75rem 1rem;
		color: #1a1a1a;
		border-bottom: 1px solid #f0f0f0;
	}

	.control-section {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f0f0f0;
	}

	.action-section {
		padding: 1rem;
		border-bottom: 2px solid #e0e0e0;
		background: #f8f9fa;
	}

	.action-section h3 {
		font-size: 0.75rem;
		font-weight: 600;
		margin: 0 0 0.75rem 0;
		color: #333;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.save-button,
	.buy-button {
		width: 100%;
		padding: 0.875rem 1.5rem;
		font-size: 1rem;
		font-weight: 500;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		margin-bottom: 0.75rem;
	}

	.save-button {
		background: #4a90e2;
		color: white;
	}

	.save-button:hover:not(:disabled) {
		background: #357abd;
		transform: translateY(-1px);
	}

	.save-button:disabled {
		background: #95c5f3;
		cursor: not-allowed;
	}

	.buy-button {
		background: #22c55e;
		color: white;
	}

	.buy-button:hover:not(:disabled) {
		background: #16a34a;
		transform: translateY(-1px);
	}

	.buy-button:disabled {
		background: #86efac;
		cursor: not-allowed;
		opacity: 0.6;
	}

	.success-message {
		background: #d1fae5;
		color: #065f46;
		padding: 0.75rem;
		border-radius: 4px;
		font-size: 0.875rem;
		margin-bottom: 0.75rem;
		border: 1px solid #a7f3d0;
	}

	.error-message {
		background: #fee2e2;
		color: #991b1b;
		padding: 0.75rem;
		border-radius: 4px;
		font-size: 0.875rem;
		margin-bottom: 0.75rem;
		border: 1px solid #fecaca;
	}

	.map-id-info {
		background: #e0e7ff;
		color: #3730a3;
		padding: 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-family: 'Courier New', monospace;
		margin-bottom: 0.75rem;
		text-align: center;
	}

	.info-section {
		padding: 1rem;
		background: #fafafa;
		border-top: 1px solid #e0e0e0;
		margin-top: auto;
	}

	.info-section h3 {
		font-size: 0.75rem;
		font-weight: 600;
		margin: 0 0 0.75rem 0;
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
