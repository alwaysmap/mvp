/**
 * Integration tests for Print Job API endpoints
 *
 * Tests the API routes that workers will call to update job state
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool, query } from '../../src/lib/db/client.js';
import { createUserMap } from '../../src/lib/db/repositories/user-maps.js';
import { createPrintableMap } from '../../src/lib/db/repositories/printable-maps.js';
import { createPrintJob } from '../../src/lib/db/repositories/print-jobs.js';
import type { UserMapData, PrintableMapData } from '../../src/lib/db/schema.js';

// Note: These tests would ideally use SvelteKit's testing utilities
// For now, we're testing the underlying repository functions
// Once we have a test server setup, we can test actual HTTP endpoints

describe('Job API Integration', () => {
	let testPrintableMapId: string;
	let testJobId: string;

	beforeAll(async () => {
		// Create test data
		const userMapData: UserMapData = {
			title: 'API Test Map',
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
			pageSize: '12x16',
			orientation: 'landscape'
		};

		const userMap = await createUserMap(userMapData);
		const printableMap = await createPrintableMap(userMap.id, printableMapData);
		testPrintableMapId = printableMap.id;
	});

	beforeEach(async () => {
		// Clean up only jobs for this test's printable map
		await query('DELETE FROM print_jobs WHERE printable_map_id = $1', [testPrintableMapId]);
		const job = await createPrintJob(testPrintableMapId);
		testJobId = job.id;
	});

	afterAll(async () => {
		await pool.end();
	});

	test('POST /api/jobs/{id}/start transitions job to exporting', async () => {
		// Simulate what the API does
		const { startExport } = await import('../../src/lib/db/repositories/print-jobs.js');

		const job = await startExport(testJobId);

		expect(job.state).toBe('exporting');
		expect(job.export_started_at).not.toBeNull();
	});

	test('POST /api/jobs/{id}/complete transitions job to export_complete', async () => {
		// Start the job first
		const { startExport, completeExport } = await import(
			'../../src/lib/db/repositories/print-jobs.js'
		);
		await startExport(testJobId);

		// Complete it
		const filePath = '/exports/test-map.png';
		const job = await completeExport(testJobId, filePath);

		expect(job.state).toBe('export_complete');
		expect(job.export_completed_at).not.toBeNull();
		expect(job.export_file_path).toBe(filePath);
	});

	test('POST /api/jobs/{id}/fail transitions job to export_failed', async () => {
		// Start the job first
		const { startExport, failExport } = await import(
			'../../src/lib/db/repositories/print-jobs.js'
		);
		await startExport(testJobId);

		// Fail it
		const errorMessage = 'Puppeteer timeout';
		const job = await failExport(testJobId, errorMessage);

		expect(job.state).toBe('export_failed');
		expect(job.export_error).toBe(errorMessage);
		expect(job.export_retry_count).toBe(1);
	});

	test('GET /api/jobs/{id} returns job with events', async () => {
		// Simulate full workflow
		const { startExport, completeExport, getPrintJob, getPrintJobEvents } = await import(
			'../../src/lib/db/repositories/print-jobs.js'
		);

		await startExport(testJobId);
		await completeExport(testJobId, '/test.png');

		// Get job and events
		const job = await getPrintJob(testJobId);
		const events = await getPrintJobEvents(testJobId);

		expect(job).not.toBeNull();
		expect(job?.state).toBe('export_complete');
		expect(events.length).toBeGreaterThan(0);
		expect(events.map(e => e.event_type)).toContain('completed');
	});

	test('API enforces state machine rules', async () => {
		// Simulate attempting invalid state transition
		const { completeExport } = await import('../../src/lib/db/repositories/print-jobs.js');

		// Try to complete without starting - should fail
		await expect(completeExport(testJobId, '/test.png')).rejects.toThrow(
			'Cannot complete export from state pending_export'
		);
	});

	test('full workflow via API calls: create -> start -> complete', async () => {
		const { startExport, completeExport, getPrintJob } = await import(
			'../../src/lib/db/repositories/print-jobs.js'
		);

		// Worker calls /api/jobs/{id}/start
		const started = await startExport(testJobId);
		expect(started.state).toBe('exporting');

		// Worker completes work and calls /api/jobs/{id}/complete
		const completed = await completeExport(testJobId, '/exports/final.png');
		expect(completed.state).toBe('export_complete');

		// Verify final state
		const final = await getPrintJob(testJobId);
		expect(final?.state).toBe('export_complete');
		expect(final?.export_file_path).toBe('/exports/final.png');
	});

	test('full workflow with retry: create -> start -> fail -> retry -> complete', async () => {
		const { startExport, failExport, retryExport, completeExport, getPrintJob } = await import(
			'../../src/lib/db/repositories/print-jobs.js'
		);

		// Worker starts
		await startExport(testJobId);

		// Worker fails
		await failExport(testJobId, 'Network timeout');

		// System retries
		const retried = await retryExport(testJobId);
		expect(retried.state).toBe('exporting');

		// Worker completes on retry
		await completeExport(testJobId, '/exports/final.png');

		// Verify final state includes retry count
		const final = await getPrintJob(testJobId);
		expect(final?.state).toBe('export_complete');
		expect(final?.export_retry_count).toBe(1);
	});
});
