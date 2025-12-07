/**
 * Map Editor State Management
 *
 * Centralized state for the interactive map editor using Svelte 5 runes.
 * This provides a single source of truth for all map editor state.
 *
 * State includes:
 * - View settings (rotation, zoom, projection)
 * - Page configuration (size, orientation)
 * - Map data (people, locations)
 * - UI state (active tool, preview mode)
 */

import type { PageSize } from '$lib/layout/types.js';
import type { Person } from '$lib/map-renderer/types.js';

/**
 * Projection type for the map.
 * - orthographic: 3D globe view
 * - equirectangular, mercator, naturalEarth1, robinson: flat map projections
 */
export type ProjectionType =
	| 'orthographic'
	| 'equirectangular'
	| 'mercator'
	| 'naturalEarth1'
	| 'robinson';

/**
 * View state for the map.
 * Controls how the map is displayed (rotation, zoom, projection).
 */
export interface MapViewState {
	/** Current projection type */
	projection: ProjectionType;

	/** Rotation in degrees [lambda, phi, gamma] for orthographic */
	rotation: [number, number, number];

	/** Zoom level (1.0 = default, >1 = zoomed in, <1 = zoomed out) */
	zoom: number;

	/** Pan offset in pixels [x, y] for non-orthographic projections */
	pan: [number, number];
}

/**
 * Page configuration for print output.
 */
export interface PageConfig {
	/** Page size (e.g., '18x24', 'A3', '24x18') */
	size: PageSize;

	/** Whether to show page boundary overlay */
	showBoundary: boolean;
}

/**
 * Complete editor state.
 */
export interface EditorState {
	/** Map view settings */
	view: MapViewState;

	/** Page configuration */
	page: PageConfig;

	/** People and their locations */
	people: Person[];

	/** Title for the map */
	title: string;

	/** Subtitle for the map */
	subtitle: string;
}

/**
 * Default initial state for the editor.
 */
const DEFAULT_STATE: EditorState = {
	view: {
		projection: 'orthographic',
		rotation: [-20, -30, 0],
		zoom: 1.0,
		pan: [0, 0]
	},
	page: {
		size: '18x24',
		showBoundary: true
	},
	people: [],
	title: 'Our Family Journey',
	subtitle: '2010-2024'
};

/**
 * Creates a map editor store with reactive state.
 *
 * @returns Store with state and actions
 *
 * @example
 * ```svelte
 * <script>
 *   import { createMapEditorStore } from '$lib/stores/map-editor.svelte';
 *
 *   const editor = createMapEditorStore();
 *
 *   // Access state
 *   console.log(editor.state.view.rotation);
 *
 *   // Update state
 *   editor.setRotation([0, -45, 0]);
 *   editor.setPageSize('A3');
 * </script>
 * ```
 */
export function createMapEditorStore(initialState: Partial<EditorState> = {}) {
	// Create reactive state using Svelte 5 runes
	let state = $state<EditorState>({
		...DEFAULT_STATE,
		...initialState,
		view: { ...DEFAULT_STATE.view, ...initialState.view },
		page: { ...DEFAULT_STATE.page, ...initialState.page }
	});

	return {
		// Expose state as readonly getter
		get state() {
			return state;
		},

		// View actions

		/**
		 * Set the map rotation (for orthographic projection).
		 * @param rotation - [lambda, phi, gamma] in degrees
		 */
		setRotation(rotation: [number, number, number]) {
			state.view.rotation = rotation;
		},

		/**
		 * Rotate the map by a delta amount.
		 * @param delta - [deltaLambda, deltaPhi, deltaGamma] in degrees
		 */
		rotateBy(delta: [number, number, number]) {
			state.view.rotation = [
				state.view.rotation[0] + delta[0],
				state.view.rotation[1] + delta[1],
				state.view.rotation[2] + delta[2]
			];
		},

		/**
		 * Set the zoom level.
		 * @param zoom - Zoom level (1.0 = default)
		 */
		setZoom(zoom: number) {
			// Clamp zoom between 0.1 and 10
			state.view.zoom = Math.max(0.1, Math.min(10, zoom));
		},

		/**
		 * Adjust zoom by a factor.
		 * @param factor - Multiplier for zoom (e.g., 1.1 = 10% zoom in)
		 */
		zoomBy(factor: number) {
			this.setZoom(state.view.zoom * factor);
		},

		/**
		 * Set the pan offset (for non-orthographic projections).
		 * @param pan - [x, y] offset in pixels
		 */
		setPan(pan: [number, number]) {
			state.view.pan = pan;
		},

		/**
		 * Pan by a delta amount.
		 * @param delta - [deltaX, deltaY] in pixels
		 */
		panBy(delta: [number, number]) {
			state.view.pan = [
				state.view.pan[0] + delta[0],
				state.view.pan[1] + delta[1]
			];
		},

		/**
		 * Set the projection type.
		 * @param projection - Projection type
		 */
		setProjection(projection: ProjectionType) {
			state.view.projection = projection;
		},

		/**
		 * Reset view to default settings.
		 */
		resetView() {
			state.view = { ...DEFAULT_STATE.view };
		},

		// Page actions

		/**
		 * Set the page size.
		 * @param size - Page size identifier
		 */
		setPageSize(size: PageSize) {
			state.page.size = size;
		},

		/**
		 * Toggle page boundary overlay visibility.
		 */
		toggleBoundary() {
			state.page.showBoundary = !state.page.showBoundary;
		},

		/**
		 * Set page boundary visibility.
		 * @param show - Whether to show boundary
		 */
		setBoundaryVisible(show: boolean) {
			state.page.showBoundary = show;
		},

		// Map data actions

		/**
		 * Set the people array.
		 * @param people - Array of people with locations
		 */
		setPeople(people: Person[]) {
			state.people = people;
		},

		/**
		 * Add a person to the map.
		 * @param person - Person to add
		 */
		addPerson(person: Person) {
			state.people = [...state.people, person];
		},

		/**
		 * Remove a person by ID.
		 * @param id - Person ID
		 */
		removePerson(id: string) {
			state.people = state.people.filter(p => p.id !== id);
		},

		/**
		 * Update a person's data.
		 * @param id - Person ID
		 * @param updates - Partial person data to update
		 */
		updatePerson(id: string, updates: Partial<Person>) {
			state.people = state.people.map(p =>
				p.id === id ? { ...p, ...updates } : p
			);
		},

		/**
		 * Set the map title.
		 * @param title - Title text
		 */
		setTitle(title: string) {
			state.title = title;
		},

		/**
		 * Set the map subtitle.
		 * @param subtitle - Subtitle text
		 */
		setSubtitle(subtitle: string) {
			state.subtitle = subtitle;
		},

		/**
		 * Reset all state to defaults.
		 */
		reset() {
			state = { ...DEFAULT_STATE };
		},

		/**
		 * Load state from a saved configuration.
		 * @param savedState - Complete or partial editor state
		 */
		loadState(savedState: Partial<EditorState>) {
			state = {
				...DEFAULT_STATE,
				...savedState,
				view: { ...DEFAULT_STATE.view, ...savedState.view },
				page: { ...DEFAULT_STATE.page, ...savedState.page }
			};
		},

		/**
		 * Export current state for saving.
		 * @returns Complete editor state
		 */
		exportState(): EditorState {
			return structuredClone(state);
		}
	};
}

/**
 * Type for the map editor store.
 */
export type MapEditorStore = ReturnType<typeof createMapEditorStore>;
