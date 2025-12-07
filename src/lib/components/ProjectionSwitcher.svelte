<script lang="ts">
	/**
	 * Projection Switcher Component
	 *
	 * Two-level projection selection:
	 * 1. Toggle: Globe (orthographic) vs Flat Map
	 * 2. When Flat Map selected, dropdown shows different flat projections
	 */

	import type { MapEditorStore } from '$lib/stores/map-editor.svelte';
	import type { ProjectionType } from '$lib/map-renderer/types';

	interface Props {
		store: MapEditorStore;
	}

	let { store }: Props = $props();

	// Flat map projection options
	const flatProjections: { value: ProjectionType; label: string; description: string }[] = [
		{
			value: 'equirectangular',
			label: 'Equirectangular',
			description: 'Simple rectangular - good for world maps'
		},
		{
			value: 'mercator',
			label: 'Mercator',
			description: 'Web standard - preserves angles'
		},
		{
			value: 'naturalEarth1',
			label: 'Natural Earth',
			description: 'Balanced - good for thematic maps'
		},
		{
			value: 'robinson',
			label: 'Robinson',
			description: 'Rounded - popular for world maps'
		}
	];

	const isGlobe = $derived(store.state.view.projection === 'orthographic');

	function setViewMode(globe: boolean) {
		if (globe) {
			store.setProjection('orthographic');
		} else {
			// Switch to equirectangular if coming from globe
			if (store.state.view.projection === 'orthographic') {
				store.setProjection('equirectangular');
			}
		}
	}

	function handleFlatProjectionChange(projection: ProjectionType) {
		store.setProjection(projection);
	}
</script>

<div class="projection-switcher">
	<h3>Map View</h3>

	<!-- Toggle: Globe vs Flat -->
	<div class="view-toggle">
		<button
			class="toggle-button"
			class:active={isGlobe}
			onclick={() => setViewMode(true)}
			aria-label="Globe view"
		>
			Globe
		</button>
		<button
			class="toggle-button"
			class:active={!isGlobe}
			onclick={() => setViewMode(false)}
			aria-label="Flat map view"
		>
			Flat Map
		</button>
	</div>

	<!-- Flat projection dropdown (only shown for flat maps) -->
	{#if !isGlobe}
		<div class="flat-projection-selector">
			<label for="flat-projection">Projection Type</label>
			<select
				id="flat-projection"
				value={store.state.view.projection}
				onchange={(e) => handleFlatProjectionChange(e.currentTarget.value as ProjectionType)}
			>
				{#each flatProjections as proj}
					<option value={proj.value}>
						{proj.label} - {proj.description}
					</option>
				{/each}
			</select>
		</div>
	{/if}
</div>

<style>
	.projection-switcher {
		padding: 1rem;
		background: #f5f5f5;
		border-radius: 8px;
		font-family: 'DM Sans', sans-serif;
	}

	h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: #333;
	}

	.view-toggle {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.toggle-button {
		padding: 0.625rem;
		background: #fff;
		border: 2px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s;
		color: #555;
	}

	.toggle-button:hover {
		border-color: #4a90e2;
		color: #4a90e2;
	}

	.toggle-button.active {
		background: #4a90e2;
		border-color: #4a90e2;
		color: white;
	}

	.flat-projection-selector {
		margin-top: 1rem;
	}

	.flat-projection-selector label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #555;
		margin-bottom: 0.5rem;
	}

	select {
		width: 100%;
		padding: 0.625rem;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.8125rem;
		font-family: 'DM Sans', sans-serif;
		cursor: pointer;
		transition: border-color 0.2s;
	}

	select:hover {
		border-color: #4a90e2;
	}

	select:focus {
		outline: none;
		border-color: #4a90e2;
		box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
	}
</style>
