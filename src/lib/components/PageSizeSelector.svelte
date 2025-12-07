<script lang="ts">
	/**
	 * Page Size Selector Component
	 *
	 * Allows users to select the print page size with a dropdown and orientation toggle.
	 * Reduces clutter compared to grid layout.
	 */

	import type { MapEditorStore } from '$lib/stores/map-editor.svelte';
	import type { PageSize } from '$lib/layout/types';

	interface Props {
		store: MapEditorStore;
	}

	let { store }: Props = $props();

	// Paper size standards (without orientation)
	const paperSizes = [
		{ group: 'USA', sizes: ['8x10', '12x16', '18x24', '24x36'] },
		{ group: 'A-Series', sizes: ['A4', 'A3', 'A2', 'A1'] }
	];

	// Flatten for dropdown
	const allSizes: { value: string; label: string }[] = [];
	paperSizes.forEach((group) => {
		group.sizes.forEach((size) => {
			allSizes.push({ value: size, label: `${size} (${group.group})` });
		});
	});

	// Derive current base size and orientation from store
	const currentBaseSize = $derived(() => {
		const current = store.state.page.size;
		if (current.endsWith('-landscape')) {
			return current.replace('-landscape', '');
		}
		return current;
	});

	const isLandscape = $derived(store.state.page.size.endsWith('-landscape'));

	// Update page size when dropdown or orientation changes
	function handleSizeChange(baseSize: string) {
		const newSize = isLandscape ? `${baseSize}-landscape` : baseSize;
		store.setPageSize(newSize as PageSize);
	}

	function setOrientation(landscape: boolean) {
		const baseSize = currentBaseSize();
		const newSize = landscape ? `${baseSize}-landscape` : baseSize;
		store.setPageSize(newSize as PageSize);
	}
</script>

<div class="page-size-selector">
	<h3>Print Size</h3>

	<div class="size-control">
		<label for="paper-size">Paper Size</label>
		<select
			id="paper-size"
			value={currentBaseSize()}
			onchange={(e) => handleSizeChange(e.currentTarget.value)}
		>
			{#each paperSizes as group}
				<optgroup label={group.group}>
					{#each group.sizes as size}
						<option value={size}>{size}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
	</div>

	<div class="orientation-control">
		<span class="orientation-label">Orientation</span>
		<div class="orientation-buttons">
			<button
				class="orientation-button"
				class:active={!isLandscape}
				onclick={() => setOrientation(false)}
				aria-label="Portrait orientation"
			>
				Portrait
			</button>
			<button
				class="orientation-button"
				class:active={isLandscape}
				onclick={() => setOrientation(true)}
				aria-label="Landscape orientation"
			>
				Landscape
			</button>
		</div>
	</div>

	<label class="toggle-label">
		<input
			type="checkbox"
			checked={store.state.page.showBoundary}
			onchange={() => store.toggleBoundary()}
		/>
		<span>Show Print Boundary</span>
	</label>
</div>

<style>
	.page-size-selector {
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

	.size-control {
		margin-bottom: 1rem;
	}

	.size-control label {
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
		font-size: 0.875rem;
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

	.orientation-control {
		margin-bottom: 1rem;
	}

	.orientation-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #555;
		margin-bottom: 0.5rem;
	}

	.orientation-buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.orientation-button {
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

	.orientation-button:hover {
		border-color: #4a90e2;
		color: #4a90e2;
	}

	.orientation-button.active {
		background: #4a90e2;
		border-color: #4a90e2;
		color: white;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.toggle-label:hover {
		background: #fafafa;
	}

	input[type='checkbox'] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}
</style>
