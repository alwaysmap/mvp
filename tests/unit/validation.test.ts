import { describe, it, expect } from 'vitest';
import { validateMapDefinition } from '$lib/export/validate';
import type { MapDefinition } from '$lib/map-renderer/types';

describe('Map Definition Validation', () => {
	const validMapDefinition: MapDefinition = {
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
					}
				]
			}
		],
		rotation: [0, 0, 0]
	};

	describe('Valid Map Definitions', () => {
		it('validates a complete map definition', () => {
			const result = validateMapDefinition(validMapDefinition);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('validates map without rotation', () => {
			const mapDef = { ...validMapDefinition };
			delete mapDef.rotation;

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(true);
		});

		it('validates map with multiple people', () => {
			const mapDef: MapDefinition = {
				...validMapDefinition,
				people: [
					...validMapDefinition.people,
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
							}
						]
					}
				]
			};

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(true);
		});
	});

	describe('Invalid Titles', () => {
		it('rejects missing title', () => {
			const mapDef = { ...validMapDefinition, title: '' };
			const result = validateMapDefinition(mapDef);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Title is required');
		});

		it('rejects whitespace-only title', () => {
			const mapDef = { ...validMapDefinition, title: '   ' };
			const result = validateMapDefinition(mapDef);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Title is required');
		});
	});

	describe('Invalid Subtitles', () => {
		it('rejects missing subtitle', () => {
			const mapDef = { ...validMapDefinition, subtitle: '' };
			const result = validateMapDefinition(mapDef);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Subtitle is required');
		});
	});

	describe('Invalid People Array', () => {
		it('rejects missing people array', () => {
			const mapDef = { ...validMapDefinition } as any;
			delete mapDef.people;

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain('People array is required');
		});

		it('warns about empty people array', () => {
			const mapDef = { ...validMapDefinition, people: [] };
			const result = validateMapDefinition(mapDef);

			expect(result.valid).toBe(true);
			expect(result.warnings).toContain('No people defined - map will be empty');
		});
	});

	describe('Invalid Person Data', () => {
		it('rejects person without ID', () => {
			const mapDef: MapDefinition = {
				...validMapDefinition,
				people: [
					{
						id: '',
						name: 'Alice',
						color: '#FF6B6B',
						locations: []
					}
				]
			};

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('ID is required'))).toBe(true);
		});

		it('rejects person without name', () => {
			const mapDef: MapDefinition = {
				...validMapDefinition,
				people: [
					{
						id: 'alice',
						name: '',
						color: '#FF6B6B',
						locations: []
					}
				]
			};

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('Name is required'))).toBe(true);
		});

		it('rejects invalid hex color', () => {
			const mapDef: MapDefinition = {
				...validMapDefinition,
				people: [
					{
						id: 'alice',
						name: 'Alice',
						color: 'red', // Invalid - not hex
						locations: []
					}
				]
			};

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('Invalid hex color'))).toBe(true);
		});

		it('rejects short hex color', () => {
			const mapDef: MapDefinition = {
				...validMapDefinition,
				people: [
					{
						id: 'alice',
						name: 'Alice',
						color: '#F00', // Invalid - short form
						locations: []
					}
				]
			};

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('Invalid hex color'))).toBe(true);
		});

		it('warns about person with no locations', () => {
			const mapDef: MapDefinition = {
				...validMapDefinition,
				people: [
					{
						id: 'alice',
						name: 'Alice',
						color: '#FF6B6B',
						locations: []
					}
				]
			};

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('No locations defined'))).toBe(true);
		});
	});

	describe('Invalid Location Data', () => {
		it('rejects invalid longitude (too high)', () => {
			const mapDef: MapDefinition = {
				...validMapDefinition,
				people: [
					{
						id: 'alice',
						name: 'Alice',
						color: '#FF6B6B',
						locations: [
							{
								countryCode: 'US',
								longitude: 200, // Invalid
								latitude: 40,
								date: '2010-01-01'
							}
						]
					}
				]
			};

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('Invalid longitude'))).toBe(true);
		});

		it('rejects invalid longitude (too low)', () => {
			const mapDef: MapDefinition = {
				...validMapDefinition,
				people: [
					{
						id: 'alice',
						name: 'Alice',
						color: '#FF6B6B',
						locations: [
							{
								countryCode: 'US',
								longitude: -200, // Invalid
								latitude: 40,
								date: '2010-01-01'
							}
						]
					}
				]
			};

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('Invalid longitude'))).toBe(true);
		});

		it('rejects invalid latitude (too high)', () => {
			const mapDef: MapDefinition = {
				...validMapDefinition,
				people: [
					{
						id: 'alice',
						name: 'Alice',
						color: '#FF6B6B',
						locations: [
							{
								countryCode: 'US',
								longitude: -74,
								latitude: 100, // Invalid
								date: '2010-01-01'
							}
						]
					}
				]
			};

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('Invalid latitude'))).toBe(true);
		});

		it('rejects invalid date format', () => {
			const mapDef: MapDefinition = {
				...validMapDefinition,
				people: [
					{
						id: 'alice',
						name: 'Alice',
						color: '#FF6B6B',
						locations: [
							{
								countryCode: 'US',
								longitude: -74,
								latitude: 40,
								date: '01/01/2010' // Invalid format
							}
						]
					}
				]
			};

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('Invalid date'))).toBe(true);
		});
	});

	describe('Invalid Rotation', () => {
		it('rejects rotation with wrong length', () => {
			const mapDef = {
				...validMapDefinition,
				rotation: [0, 0] as any
			};

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('array of 3 numbers'))).toBe(true);
		});

		it('rejects rotation with non-numeric values', () => {
			const mapDef = {
				...validMapDefinition,
				rotation: [0, 'test', 0] as any
			};

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('finite numbers'))).toBe(true);
		});

		it('rejects rotation with Infinity', () => {
			const mapDef = {
				...validMapDefinition,
				rotation: [0, Infinity, 0]
			};

			const result = validateMapDefinition(mapDef);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('finite numbers'))).toBe(true);
		});
	});
});
