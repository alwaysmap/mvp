<script lang="ts">
	/**
	 * Zoom Controls Component
	 *
	 * Provides UI controls for adjusting map zoom level.
	 * Works with all projection types.
	 */

	import type { MapEditorStore } from '$lib/stores/map-editor.svelte';

	interface Props {
		store: MapEditorStore;
	}

	let { store }: Props = $props();

	const ZOOM_FACTOR = 1.2;

	function zoomIn() {
		store.zoomBy(ZOOM_FACTOR);
	}

	function zoomOut() {
		store.zoomBy(1 / ZOOM_FACTOR);
	}

	function resetZoom() {
		store.setZoom(1.0);
	}

	const zoomPercentage = $derived(Math.round(store.state.view.zoom * 100));
</script>

<div class="zoom-controls">
	<h3>Zoom</h3>

	<div class="zoom-display">
		<span class="zoom-value">{zoomPercentage}%</span>
	</div>

	<div class="button-group">
		<button onclick={zoomOut} aria-label="Zoom out" disabled={store.state.view.zoom <= 0.1}>
			<span class="icon">−</span>
		</button>
		<button onclick={resetZoom} aria-label="Reset zoom">
			<span class="icon">⊙</span>
		</button>
		<button onclick={zoomIn} aria-label="Zoom in" disabled={store.state.view.zoom >= 10}>
			<span class="icon">+</span>
		</button>
	</div>

	<input
		type="range"
		min="10"
		max="1000"
		step="10"
		value={zoomPercentage}
		oninput={(e) => store.setZoom(parseInt(e.currentTarget.value) / 100)}
		aria-label="Zoom level"
	/>
</div>

<style>
	.zoom-controls {
		padding: 0;
		background: transparent;
		border-radius: 0;
		font-family: 'DM Sans', sans-serif;
	}

	h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #333;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.zoom-display {
		text-align: center;
		margin-bottom: 0.5rem;
	}

	.zoom-value {
		font-size: 1.125rem;
		font-weight: 600;
		color: #4a90e2;
		font-family: monospace;
	}

	.button-group {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	button {
		flex: 1;
		padding: 0.625rem;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	button:hover:not(:disabled) {
		background: #e8e8e8;
		border-color: #999;
	}

	button:active:not(:disabled) {
		transform: scale(0.95);
	}

	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.icon {
		font-size: 1.25rem;
		font-weight: bold;
		display: inline-block;
	}

	input[type='range'] {
		width: 100%;
		height: 6px;
		border-radius: 3px;
		background: #ddd;
		outline: none;
		-webkit-appearance: none;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #4a90e2;
		cursor: pointer;
		transition: all 0.2s;
	}

	input[type='range']::-webkit-slider-thumb:hover {
		background: #357abd;
		transform: scale(1.1);
	}

	input[type='range']::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #4a90e2;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
	}

	input[type='range']::-moz-range-thumb:hover {
		background: #357abd;
		transform: scale(1.1);
	}
</style>
