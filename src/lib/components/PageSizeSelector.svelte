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

	/**
	 * Convert a base size and orientation to the correct PageSize key.
	 * USA sizes: flip dimensions (18x24 → 24x18)
	 * A-series: add suffix (A4 → A4-landscape)
	 */
	function toPageSize(baseSize: string, landscape: boolean): PageSize {
		if (!landscape) {
			return baseSize as PageSize;
		}

		// A-series: add "-landscape" suffix
		if (baseSize.startsWith('A')) {
			return `${baseSize}-landscape` as PageSize;
		}

		// USA sizes: flip dimensions (18x24 → 24x18)
		const [width, height] = baseSize.split('x');
		return `${height}x${width}` as PageSize;
	}

	/**
	 * Extract base size from current page size (reverse of toPageSize).
	 * Examples:
	 * - "18x24" → "18x24"
	 * - "24x18" → "18x24" (flipped back to portrait)
	 * - "A4-landscape" → "A4"
	 */
	function fromPageSize(pageSize: PageSize): { baseSize: string; landscape: boolean } {
		// A-series landscape
		if (pageSize.endsWith('-landscape')) {
			return {
				baseSize: pageSize.replace('-landscape', ''),
				landscape: true
			};
		}

		// USA portrait
		const portraitSizes = ['8x10', '12x16', '18x24', '24x36'];
		if (portraitSizes.includes(pageSize)) {
			return { baseSize: pageSize, landscape: false };
		}

		// USA landscape (24x18 → 18x24)
		const landscapeSizes = ['10x8', '16x12', '24x18', '36x24'];
		if (landscapeSizes.includes(pageSize)) {
			const [width, height] = pageSize.split('x');
			return { baseSize: `${height}x${width}`, landscape: true };
		}

		// A-series portrait
		return { baseSize: pageSize, landscape: false };
	}

	// Derive current base size and orientation from store
	const currentState = $derived(() => fromPageSize(store.state.page.size));
	const currentBaseSize = $derived(() => currentState().baseSize);
	const isLandscape = $derived(currentState().landscape);

	// Update page size when dropdown or orientation changes
	function handleSizeChange(baseSize: string) {
		const newSize = toPageSize(baseSize, isLandscape);
		store.setPageSize(newSize);
	}

	function setOrientation(landscape: boolean) {
		const baseSize = currentBaseSize();
		const newSize = toPageSize(baseSize, landscape);
		store.setPageSize(newSize);
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

	.size-control {
		margin-bottom: 0.75rem;
	}

	.size-control label {
		display: block;
		font-size: 0.75rem;
		font-weight: 500;
		color: #555;
		margin-bottom: 0.375rem;
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
		margin-bottom: 0.75rem;
	}

	.orientation-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 500;
		color: #555;
		margin-bottom: 0.375rem;
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
		padding: 0.5rem 0.625rem;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.75rem;
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
