/**
 * Queue Initialization Tests
 *
 * Tests that verify pg-boss queue can actually be initialized and used.
 * These tests catch import errors and configuration issues that other
 * tests might miss.
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getPgBoss, stopPgBoss } from '../../src/lib/queue/pg-boss-queue.js';
import { createUserMap } from '../../src/lib/db/repositories/user-maps.js';
import { createPrintableMap } from '../../src/lib/db/repositories/printable-maps.js';
import { query } from '../../src/lib/db/client.js';
import type { UserMapData, PrintableMapData } from '../../src/lib/db/schema.js';

describe('Queue Initialization', () => {
	let testPrintableMapId: string;

	beforeAll(async () => {
		// Create test data once for all tests
		const userMapData: UserMapData = {
			title: 'Queue Test Map',
			people: [
				{
					id: '1',
					name: 'Test',
					locations: [
						{
							countryCode: 'US',
							longitude: -122.4194,
							latitude: 37.7749,
							date: '2020-01-01'
						}
					]
				}
			]
		};

		const printableMapData: PrintableMapData = {
			pageSize: '12x16',
			orientation: 'landscape'
		};

		const userMap = await createUserMap(userMapData);
		const printableMap = await createPrintableMap(userMap.id, printableMapData);
		testPrintableMapId = printableMap.id;
	});

	beforeEach(async () => {
		// Clean up jobs before each test
		await query('DELETE FROM print_jobs WHERE printable_map_id = $1', [testPrintableMapId]);
	});

	afterAll(async () => {
		await stopPgBoss();
	});

	test('can import and initialize pg-boss queue', async () => {
		// This test catches import errors like wrong default/named exports
		const boss = await getPgBoss();

		expect(boss).toBeDefined();
		expect(typeof boss.send).toBe('function');
		expect(typeof boss.work).toBe('function');
		expect(typeof boss.stop).toBe('function');
	});

	test('singleton pattern returns same instance', async () => {
		const boss1 = await getPgBoss();
		const boss2 = await getPgBoss();

		expect(boss1).toBe(boss2);
	});

	test('can create queue and send a job', async () => {
		const boss = await getPgBoss();

		// pg-boss requires queue to be created first
		await boss.createQueue('test-queue');

		const jobId = await boss.send('test-queue', { test: 'data' });

		expect(jobId).toBeDefined();
		expect(typeof jobId).toBe('string');
	});

	test('addExportJob creates print_job and queues with pg-boss', async () => {
		const { addExportJob } = await import('../../src/lib/queue/pg-boss-queue.js');

		// Add export job using shared test data
		const printJobId = await addExportJob(testPrintableMapId);

		// Verify print_job was created in database
		expect(printJobId).toBeDefined();

		const result = await query('SELECT * FROM print_jobs WHERE id = $1', [printJobId]);
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].state).toBe('pending_export');
		expect(result.rows[0].printable_map_id).toBe(testPrintableMapId);

		// The fact that addExportJob() completed without throwing proves:
		// 1. pg-boss queue was initialized correctly
		// 2. The queue was created
		// 3. The job was sent to pg-boss
		// We don't need to verify the job exists in pg-boss - that's pg-boss's responsibility
	});

	test('can stop pg-boss gracefully', async () => {
		const boss = await getPgBoss();
		await stopPgBoss();

		// After stop, singleton should return a new instance
		const newBoss = await getPgBoss();
		expect(newBoss).toBeDefined();
		expect(newBoss).not.toBe(boss);
	});
});
