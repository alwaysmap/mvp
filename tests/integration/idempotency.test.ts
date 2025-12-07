/**
 * Idempotency tests for print job API operations
 *
 * Verifies that calling the same API operation multiple times
 * doesn't cause errors or duplicate work.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool, query } from '../../src/lib/db/client.js';
import { createUserMap } from '../../src/lib/db/repositories/user-maps.js';
import { createPrintableMap } from '../../src/lib/db/repositories/printable-maps.js';
import {
	createPrintJob,
	startExport,
	completeExport,
	failExport
} from '../../src/lib/db/repositories/print-jobs.js';
import type { UserMapData, PrintableMapData } from '../../src/lib/db/schema.js';

describe('Print Job API Idempotency', () => {
	let testPrintableMapId: string;
	let testJobId: string;

	beforeAll(async () => {
		const userMapData: UserMapData = {
			title: 'Idempotency Test Map',
			people: [
				{
					id: '1',
					name: 'Test Person',
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
			widthInches: 16,
			heightInches: 12,
			paperSizeName: '12×16'
		};

		const userMap = await createUserMap(userMapData);
		const printableMap = await createPrintableMap(userMap.id, printableMapData);
		testPrintableMapId = printableMap.id;
	});

	beforeEach(async () => {
		await query('DELETE FROM print_jobs WHERE printable_map_id = $1', [testPrintableMapId]);
		const job = await createPrintJob(testPrintableMapId);
		testJobId = job.id;
	});

	afterAll(async () => {
		await pool.end();
	});

	test('calling startExport twice should be idempotent', async () => {
		// First call - should succeed
		const result1 = await startExport(testJobId);
		expect(result1.state).toBe('exporting');
		const firstStartTime = result1.export_started_at;

		// Second call - should also succeed without error (idempotent)
		const result2 = await startExport(testJobId);
		expect(result2.state).toBe('exporting');
		expect(result2.export_started_at).toEqual(firstStartTime);
	});

	test('calling completeExport twice with same filePath should be idempotent', async () => {
		// Start the job
		await startExport(testJobId);

		// First completion - should succeed
		const filePath = '/exports/test-map.png';
		const result1 = await completeExport(testJobId, filePath);
		expect(result1.state).toBe('export_complete');
		expect(result1.export_file_path).toBe(filePath);

		// Second completion with same file - should also succeed (idempotent)
		const result2 = await completeExport(testJobId, filePath);
		expect(result2.state).toBe('export_complete');
		expect(result2.export_file_path).toBe(filePath);
		expect(result2.export_completed_at).toEqual(result1.export_completed_at);
	});

	test('calling completeExport with different filePath should fail', async () => {
		// Start the job
		await startExport(testJobId);

		// First completion
		await completeExport(testJobId, '/exports/test-map-1.png');

		// Second completion with different file - should fail (not idempotent)
		await expect(completeExport(testJobId, '/exports/test-map-2.png')).rejects.toThrow(
			'already completed with different file'
		);
	});

	test('calling failExport twice with same error should be idempotent', async () => {
		// Start the job
		await startExport(testJobId);

		// First failure - should succeed
		const errorMessage = 'Puppeteer timeout';
		const result1 = await failExport(testJobId, errorMessage);
		expect(result1.state).toBe('export_failed');
		expect(result1.export_error).toBe(errorMessage);
		expect(result1.export_retry_count).toBe(1);

		// Second failure with same error - should also succeed (idempotent)
		const result2 = await failExport(testJobId, errorMessage);
		expect(result2.state).toBe('export_failed');
		expect(result2.export_error).toBe(errorMessage);
		// Retry count should NOT increment on idempotent call
		expect(result2.export_retry_count).toBe(1);
	});

	test('calling failExport with different error should update error message', async () => {
		// Start the job
		await startExport(testJobId);

		// First failure
		await failExport(testJobId, 'Network timeout');

		// Second failure with different error - should update
		const result = await failExport(testJobId, 'Out of memory');
		expect(result.state).toBe('export_failed');
		expect(result.export_error).toBe('Out of memory');
		// Retry count should increment when error changes
		expect(result.export_retry_count).toBe(2);
	});

	test('idempotent calls should not create duplicate events', async () => {
		const { getPrintJobEvents } = await import('../../src/lib/db/repositories/print-jobs.js');

		// First start
		await startExport(testJobId);
		const eventsAfterFirst = await getPrintJobEvents(testJobId);
		expect(eventsAfterFirst).toHaveLength(2); // created + started

		// Second start (idempotent)
		await startExport(testJobId);
		const eventsAfterSecond = await getPrintJobEvents(testJobId);
		// Should still be 2 events - no duplicate logged
		expect(eventsAfterSecond).toHaveLength(2);
	});

	test('worker calling start -> complete -> complete should succeed', async () => {
		// Simulate worker workflow
		await startExport(testJobId);
		const filePath = '/exports/final.png';

		// First complete
		await completeExport(testJobId, filePath);

		// Worker retries completion (network glitch, etc.) - should be idempotent
		const result = await completeExport(testJobId, filePath);
		expect(result.state).toBe('export_complete');
		expect(result.export_file_path).toBe(filePath);
	});
});
