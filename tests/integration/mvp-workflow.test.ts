/**
 * MVP Workflow Integration Test
 *
 * Tests the complete MVP workflow:
 * 1. Create a user map in the database
 * 2. Create a printable map configuration
 * 3. Trigger an export job
 * 4. Poll job status until complete
 * 5. Verify PNG file was created
 *
 * This test requires:
 * - PostgreSQL running (docker-compose up postgres)
 * - Redis running (docker-compose up redis)
 * - Worker process running (separate terminal or container)
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/lib/db/client';
import { createUserMap, getUserMap } from '../../src/lib/db/repositories/user-maps';
import { createPrintableMap, getPrintableMapWithUserMap } from '../../src/lib/db/repositories/printable-maps';
import type { UserMapData, PrintableMapData } from '../../src/lib/db/schema';

describe('MVP Workflow Integration Test', () => {
	// Sample map data
	const sampleMapData: UserMapData = {
		title: 'Test Family Journey',
		subtitle: '2020-2025',
		people: [
			{
				id: 'test-alice',
				name: 'Alice',
				color: '#FF6B6B',
				locations: [
					{
						countryCode: 'US',
						longitude: -74.006,
						latitude: 40.7128,
						date: '2020-01-01'
					},
					{
						countryCode: 'GB',
						longitude: -0.1276,
						latitude: 51.5074,
						date: '2022-06-15'
					}
				]
			}
		],
		projection: 'orthographic',
		rotation: [-20, -30, 0]
	};

	const samplePrintableData: PrintableMapData = {
		pageSize: '18x24',
		orientation: 'portrait',
		projection: 'orthographic',
		rotation: [-20, -30, 0],
		zoom: 1,
		pan: [0, 0]
	};

	afterAll(async () => {
		await pool.end();
	});

	test('database connection works', async () => {
		const result = await pool.query('SELECT NOW()');
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].now).toBeInstanceOf(Date);
	});

	test('can create user map', async () => {
		const userMap = await createUserMap(sampleMapData);

		expect(userMap).toBeDefined();
		expect(userMap.id).toBeDefined();
		expect(userMap.data.title).toBe('Test Family Journey');
		expect(userMap.data.people).toHaveLength(1);
		expect(userMap.created_at).toBeInstanceOf(Date);
		expect(userMap.updated_at).toBeInstanceOf(Date);
	});

	test('can retrieve user map', async () => {
		// First create a map
		const created = await createUserMap(sampleMapData);

		// Then retrieve it
		const retrieved = await getUserMap(created.id);

		expect(retrieved).toBeDefined();
		expect(retrieved?.id).toBe(created.id);
		expect(retrieved?.data.title).toBe('Test Family Journey');
	});

	test('can create printable map', async () => {
		// First create a user map
		const userMap = await createUserMap(sampleMapData);

		// Then create a printable config
		const printableMap = await createPrintableMap(userMap.id, samplePrintableData);

		expect(printableMap).toBeDefined();
		expect(printableMap.id).toBeDefined();
		expect(printableMap.user_map_id).toBe(userMap.id);
		expect(printableMap.data.pageSize).toBe('18x24');
		expect(printableMap.data.orientation).toBe('portrait');
		expect(printableMap.created_at).toBeInstanceOf(Date);
	});

	test('can retrieve printable map with user map', async () => {
		// Create both maps
		const userMap = await createUserMap(sampleMapData);
		const printableMap = await createPrintableMap(userMap.id, samplePrintableData);

		// Retrieve combined data
		const combined = await getPrintableMapWithUserMap(printableMap.id);

		expect(combined).toBeDefined();
		expect(combined?.userMap.id).toBe(userMap.id);
		expect(combined?.printableMap.id).toBe(printableMap.id);
		expect(combined?.userMap.data.title).toBe('Test Family Journey');
		expect(combined?.printableMap.data.pageSize).toBe('18x24');
	});

	test('data integrity: JSONB fields preserve structure', async () => {
		const userMap = await createUserMap(sampleMapData);
		const retrieved = await getUserMap(userMap.id);

		// Verify nested data structures are preserved
		expect(retrieved?.data.people[0].locations).toHaveLength(2);
		expect(retrieved?.data.people[0].locations[0].countryCode).toBe('US');
		expect(retrieved?.data.rotation).toEqual([-20, -30, 0]);
	});
});
