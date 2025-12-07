<script lang="ts">
	/**
	 * Rotation Controls Component
	 *
	 * Provides slider controls for rotating the orthographic globe in 3 axes:
	 * - Longitude (rotate left/right)
	 * - Latitude (rotate up/down)
	 * - Roll (tilt clockwise/counter-clockwise)
	 *
	 * Only shown when projection is orthographic.
	 */

	import type { MapEditorStore } from '$lib/stores/map-editor.svelte';

	interface Props {
		store: MapEditorStore;
	}

	let { store }: Props = $props();

	function setLongitude(value: number) {
		const current = store.state.view.rotation;
		store.setRotation([value, current[1], current[2]]);
	}

	function setLatitude(value: number) {
		const current = store.state.view.rotation;
		store.setRotation([current[0], value, current[2]]);
	}

	function setRoll(value: number) {
		const current = store.state.view.rotation;
		store.setRotation([current[0], current[1], value]);
	}

	function resetRotation() {
		store.setRotation([-20, -30, 0]);
	}

	// Only show for orthographic projection
	const isOrthographic = $derived(store.state.view.projection === 'orthographic');
</script>

{#if isOrthographic}
	<div class="rotation-controls">
		<h3>Globe Rotation</h3>

		<div class="control-group">
			<label for="rotation-longitude">
				<span class="axis-label">Longitude</span>
				<span class="value">{store.state.view.rotation[0].toFixed(0)}°</span>
			</label>
			<input
				type="range"
				id="rotation-longitude"
				min="-180"
				max="180"
				step="1"
				value={store.state.view.rotation[0]}
				oninput={(e) => setLongitude(parseFloat(e.currentTarget.value))}
				aria-label="Rotate longitude"
			/>
		</div>

		<div class="control-group">
			<label for="rotation-latitude">
				<span class="axis-label">Latitude</span>
				<span class="value">{store.state.view.rotation[1].toFixed(0)}°</span>
			</label>
			<input
				type="range"
				id="rotation-latitude"
				min="-90"
				max="90"
				step="1"
				value={store.state.view.rotation[1]}
				oninput={(e) => setLatitude(parseFloat(e.currentTarget.value))}
				aria-label="Rotate latitude"
			/>
		</div>

		<div class="control-group">
			<label for="rotation-roll">
				<span class="axis-label">Roll</span>
				<span class="value">{store.state.view.rotation[2].toFixed(0)}°</span>
			</label>
			<input
				type="range"
				id="rotation-roll"
				min="-180"
				max="180"
				step="1"
				value={store.state.view.rotation[2]}
				oninput={(e) => setRoll(parseFloat(e.currentTarget.value))}
				aria-label="Rotate roll"
			/>
		</div>

		<button class="reset-button" onclick={resetRotation}>Reset Rotation</button>
	</div>
{/if}

<style>
	.rotation-controls {
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
