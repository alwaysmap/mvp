/**
 * Tests for map editor state management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMapEditorStore } from '$lib/stores/map-editor.svelte';
import type { Person } from '$lib/map-renderer/types';

describe('Map Editor Store', () => {
	describe('Initialization', () => {
		it('should create store with default state', () => {
			const store = createMapEditorStore();

			expect(store.state.view.projection).toBe('orthographic');
			expect(store.state.view.rotation).toEqual([-20, -30, 0]);
			expect(store.state.view.zoom).toBe(1.0);
			expect(store.state.view.pan).toEqual([0, 0]);
			expect(store.state.page.size).toBe('18x24');
			expect(store.state.page.showBoundary).toBe(true);
			expect(store.state.people).toEqual([]);
			expect(store.state.title).toBe('Our Family Journey');
			expect(store.state.subtitle).toBe('2010-2024');
		});

		it('should create store with custom initial state', () => {
			const store = createMapEditorStore({
				view: { projection: 'mercator', rotation: [0, 0, 0], zoom: 2.0, pan: [10, 20] },
				title: 'Custom Title'
			});

			expect(store.state.view.projection).toBe('mercator');
			expect(store.state.view.zoom).toBe(2.0);
			expect(store.state.title).toBe('Custom Title');
		});
	});

	describe('View Actions', () => {
		let store: ReturnType<typeof createMapEditorStore>;

		beforeEach(() => {
			store = createMapEditorStore();
		});

		it('should set rotation', () => {
			store.setRotation([10, 20, 30]);
			expect(store.state.view.rotation).toEqual([10, 20, 30]);
		});

		it('should rotate by delta', () => {
			store.setRotation([10, 20, 30]);
			store.rotateBy([5, -10, 0]);
			expect(store.state.view.rotation).toEqual([15, 10, 30]);
		});

		it('should set zoom', () => {
			store.setZoom(2.5);
			expect(store.state.view.zoom).toBe(2.5);
		});

		it('should clamp zoom to valid range', () => {
			store.setZoom(0.01); // Too small
			expect(store.state.view.zoom).toBe(0.1);

			store.setZoom(20); // Too large
			expect(store.state.view.zoom).toBe(10);
		});

		it('should zoom by factor', () => {
			store.setZoom(2.0);
			store.zoomBy(1.5);
			expect(store.state.view.zoom).toBe(3.0);
		});

		it('should set pan', () => {
			store.setPan([100, 200]);
			expect(store.state.view.pan).toEqual([100, 200]);
		});

		it('should pan by delta', () => {
			store.setPan([100, 200]);
			store.panBy([50, -50]);
			expect(store.state.view.pan).toEqual([150, 150]);
		});

		it('should set projection', () => {
			store.setProjection('mercator');
			expect(store.state.view.projection).toBe('mercator');
		});

		it('should reset view to defaults', () => {
			store.setRotation([100, 100, 100]);
			store.setZoom(5.0);
			store.setPan([500, 500]);
			store.setProjection('mercator');

			store.resetView();

			expect(store.state.view.rotation).toEqual([-20, -30, 0]);
			expect(store.state.view.zoom).toBe(1.0);
			expect(store.state.view.pan).toEqual([0, 0]);
			expect(store.state.view.projection).toBe('orthographic');
		});
	});

	describe('Page Actions', () => {
		let store: ReturnType<typeof createMapEditorStore>;

		beforeEach(() => {
			store = createMapEditorStore();
		});

		it('should set page size', () => {
			store.setPageSize('A3');
			expect(store.state.page.size).toBe('A3');
		});

		it('should toggle boundary visibility', () => {
			expect(store.state.page.showBoundary).toBe(true);
			store.toggleBoundary();
			expect(store.state.page.showBoundary).toBe(false);
			store.toggleBoundary();
			expect(store.state.page.showBoundary).toBe(true);
		});

		it('should set boundary visibility', () => {
			store.setBoundaryVisible(false);
			expect(store.state.page.showBoundary).toBe(false);
			store.setBoundaryVisible(true);
			expect(store.state.page.showBoundary).toBe(true);
		});
	});

	describe('Map Data Actions', () => {
		let store: ReturnType<typeof createMapEditorStore>;
		const samplePerson: Person = {
			id: 'alice',
			name: 'Alice',
			color: '#FF0000',
			locations: [
				{ countryCode: 'US', longitude: -74.006, latitude: 40.7128, date: '2020-01-01' }
			]
		};

		beforeEach(() => {
			store = createMapEditorStore();
		});

		it('should set people array', () => {
			const people = [samplePerson];
			store.setPeople(people);
			expect(store.state.people).toEqual(people);
		});

		it('should add a person', () => {
			store.addPerson(samplePerson);
			expect(store.state.people).toHaveLength(1);
			expect(store.state.people[0]).toEqual(samplePerson);
		});

		it('should remove a person by ID', () => {
			store.setPeople([samplePerson, { ...samplePerson, id: 'bob', name: 'Bob' }]);
			expect(store.state.people).toHaveLength(2);

			store.removePerson('alice');
			expect(store.state.people).toHaveLength(1);
			expect(store.state.people[0].id).toBe('bob');
		});

		it('should update a person', () => {
			store.addPerson(samplePerson);
			store.updatePerson('alice', { name: 'Alice Smith', color: '#0000FF' });

			expect(store.state.people[0].name).toBe('Alice Smith');
			expect(store.state.people[0].color).toBe('#0000FF');
			expect(store.state.people[0].id).toBe('alice'); // ID unchanged
		});

		it('should not affect other people when updating', () => {
			store.setPeople([
				samplePerson,
				{ ...samplePerson, id: 'bob', name: 'Bob' }
			]);

			store.updatePerson('alice', { name: 'Alice Updated' });

			expect(store.state.people[0].name).toBe('Alice Updated');
			expect(store.state.people[1].name).toBe('Bob');
		});

		it('should set title', () => {
			store.setTitle('New Title');
			expect(store.state.title).toBe('New Title');
		});

		it('should set subtitle', () => {
			store.setSubtitle('New Subtitle');
			expect(store.state.subtitle).toBe('New Subtitle');
		});
	});

	describe('State Management', () => {
		it('should reset all state to defaults', () => {
			const store = createMapEditorStore();

			// Modify state
			store.setRotation([100, 100, 100]);
			store.setPageSize('A3');
			store.setTitle('Custom');
			store.addPerson({
				id: 'test',
				name: 'Test',
				color: '#000000',
				locations: []
			});

			// Reset
			store.reset();

			// Verify all defaults restored
			expect(store.state.view.rotation).toEqual([-20, -30, 0]);
			expect(store.state.page.size).toBe('18x24');
			expect(store.state.title).toBe('Our Family Journey');
			expect(store.state.people).toEqual([]);
		});

		it('should export state', () => {
			const store = createMapEditorStore();
			store.setRotation([10, 20, 30]);
			store.setTitle('Exported');

			const exported = store.exportState();

			expect(exported.view.rotation).toEqual([10, 20, 30]);
			expect(exported.title).toBe('Exported');
		});

		it('should export deep copy of state', () => {
			const store = createMapEditorStore();
			const person = {
				id: 'test',
				name: 'Test',
				color: '#000000',
				locations: []
			};
			store.addPerson(person);

			const exported = store.exportState();

			// Modify exported
			exported.people[0].name = 'Modified';

			// Original should be unchanged
			expect(store.state.people[0].name).toBe('Test');
		});

		it('should load state', () => {
			const store = createMapEditorStore();

			const savedState = {
				view: { projection: 'mercator' as const, rotation: [5, 10, 15] as [number, number, number], zoom: 3.0, pan: [100, 200] as [number, number] },
				page: { size: 'A3' as const, showBoundary: false },
				title: 'Loaded Title',
				people: []
			};

			store.loadState(savedState);

			expect(store.state.view.projection).toBe('mercator');
			expect(store.state.view.rotation).toEqual([5, 10, 15]);
			expect(store.state.page.size).toBe('A3');
			expect(store.state.title).toBe('Loaded Title');
		});

		it('should merge partial state when loading', () => {
			const store = createMapEditorStore();

			store.loadState({
				title: 'Partial Load',
				view: {
					projection: 'orthographic',
					rotation: [-20, -30, 0],
					zoom: 2.0,
					pan: [0, 0]
				}
			});

			// Title should be updated
			expect(store.state.title).toBe('Partial Load');
			// Zoom should be updated
			expect(store.state.view.zoom).toBe(2.0);
			// Other view properties should be defaults
			expect(store.state.view.projection).toBe('orthographic');
			expect(store.state.view.rotation).toEqual([-20, -30, 0]);
		});
	});

	describe('Reactivity', () => {
		it('should update state reference when modified', () => {
			const store = createMapEditorStore();
			const initialRotation = store.state.view.rotation;

			store.setRotation([1, 2, 3]);

			// Reference should change (important for Svelte reactivity)
			expect(store.state.view.rotation).not.toBe(initialRotation);
			expect(store.state.view.rotation).toEqual([1, 2, 3]);
		});

		it('should update people array reference when modified', () => {
			const store = createMapEditorStore();
			const initialPeople = store.state.people;

			store.addPerson({
				id: 'test',
				name: 'Test',
				color: '#000000',
				locations: []
			});

			// Reference should change
			expect(store.state.people).not.toBe(initialPeople);
		});
	});
});
