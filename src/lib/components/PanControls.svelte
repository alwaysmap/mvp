<script lang="ts">
	/**
	 * Pan Controls Component
	 *
	 * Provides pan/translate controls for non-orthographic projections.
	 * Uses sliders for X and Y axis panning.
	 * Only shown when projection is equirectangular or mercator.
	 */

	import type { MapEditorStore } from '$lib/stores/map-editor.svelte';

	interface Props {
		store: MapEditorStore;
	}

	let { store }: Props = $props();

	function setPanX(value: number) {
		const current = store.state.view.pan;
		store.setPan([value, current[1]]);
	}

	function setPanY(value: number) {
		const current = store.state.view.pan;
		store.setPan([current[0], value]);
	}

	function resetPan() {
		store.setPan([0, 0]);
	}

	// Only show for non-orthographic projections
	const isNonOrthographic = $derived(store.state.view.projection !== 'orthographic');
</script>

{#if isNonOrthographic}
	<div class="pan-controls">
		<h3>Pan Map</h3>

		<div class="control-group">
			<label for="pan-x">
				<span class="axis-label">Horizontal</span>
				<span class="value">{store.state.view.pan[0].toFixed(0)}px</span>
			</label>
			<input
				type="range"
				id="pan-x"
				min="-1000"
				max="1000"
				step="10"
				value={store.state.view.pan[0]}
				oninput={(e) => setPanX(parseFloat(e.currentTarget.value))}
				aria-label="Pan horizontally"
			/>
		</div>

		<div class="control-group">
			<label for="pan-y">
				<span class="axis-label">Vertical</span>
				<span class="value">{store.state.view.pan[1].toFixed(0)}px</span>
			</label>
			<input
				type="range"
				id="pan-y"
				min="-1000"
				max="1000"
				step="10"
				value={store.state.view.pan[1]}
				oninput={(e) => setPanY(parseFloat(e.currentTarget.value))}
				aria-label="Pan vertically"
			/>
		</div>

		<button class="reset-button" onclick={resetPan}>Reset Pan</button>
	</div>
{/if}

<style>
	.pan-controls {
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

	.control-group {
		margin-bottom: 0.75rem;
	}

	.control-group:last-of-type {
		margin-bottom: 0.375rem;
	}

	label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.375rem;
		font-size: 0.75rem;
	}

	.axis-label {
		font-weight: 500;
		color: #555;
	}

	.value {
		font-family: monospace;
		color: #4a90e2;
		font-size: 0.75rem;
		font-weight: 600;
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

	.reset-button {
		width: 100%;
		margin-top: 0.75rem;
		padding: 0.5rem;
		background: #4a90e2;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.reset-button:hover {
		background: #357abd;
	}

	.reset-button:active {
		transform: scale(0.98);
	}
</style>
