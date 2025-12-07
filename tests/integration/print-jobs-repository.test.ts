/**
 * Integration tests for print jobs repository
 *
 * Tests the print job workflow state machine and event logging
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool, query } from '../../src/lib/db/client.js';
import {
	createPrintJob,
	getPrintJob,
	getPrintJobsForPrintableMap,
	startExport,
	completeExport,
	failExport,
	retryExport,
	getPrintJobEvents,
	getJobsReadyForExport,
	getCompletedExports
} from '../../src/lib/db/repositories/print-jobs.js';
import { createUserMap } from '../../src/lib/db/repositories/user-maps.js';
import { createPrintableMap } from '../../src/lib/db/repositories/printable-maps.js';
import type { UserMapData, PrintableMapData } from '../../src/lib/db/schema.js';

describe('Print Jobs Repository', () => {
	let testPrintableMapId: string;

	beforeAll(async () => {
		// Create a test user map and printable map for our tests
		const userMapData: UserMapData = {
			title: 'Test Print Job Workflow',
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
	});

	afterAll(async () => {
		await pool.end();
	});

	test('can create a new print job', async () => {
		const printJob = await createPrintJob(testPrintableMapId);

		expect(printJob.id).toBeDefined();
		expect(printJob.printable_map_id).toBe(testPrintableMapId);
		expect(printJob.state).toBe('pending_export');
		expect(printJob.export_retry_count).toBe(0);
		expect(printJob.export_started_at).toBeNull();
		expect(printJob.export_completed_at).toBeNull();
		expect(printJob.export_file_path).toBeNull();
		expect(printJob.export_error).toBeNull();

		// Check that creation event was logged
		const events = await getPrintJobEvents(printJob.id);
		expect(events).toHaveLength(1);
		expect(events[0].event_type).toBe('created');
		expect(events[0].from_state).toBeNull();
		expect(events[0].to_state).toBe('pending_export');
	});

	test('can get print job by ID', async () => {
		const created = await createPrintJob(testPrintableMapId);
		const retrieved = await getPrintJob(created.id);

		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(created.id);
		expect(retrieved?.state).toBe('pending_export');
	});

	test('returns null for non-existent print job', async () => {
		const result = await getPrintJob('00000000-0000-0000-0000-000000000000');
		expect(result).toBeNull();
	});

	test('can get all print jobs for a printable map', async () => {
		const job1 = await createPrintJob(testPrintableMapId);
		const job2 = await createPrintJob(testPrintableMapId);

		const jobs = await getPrintJobsForPrintableMap(testPrintableMapId);
		expect(jobs).toHaveLength(2);
		expect(jobs.map(j => j.id)).toContain(job1.id);
		expect(jobs.map(j => j.id)).toContain(job2.id);
	});

	test('can transition from pending_export to exporting', async () => {
		const printJob = await createPrintJob(testPrintableMapId);
		const updated = await startExport(printJob.id);

		expect(updated.state).toBe('exporting');
		expect(updated.export_started_at).not.toBeNull();

		// Check event log
		const events = await getPrintJobEvents(printJob.id);
		expect(events).toHaveLength(2);
		expect(events[1].event_type).toBe('started');
		expect(events[1].from_state).toBe('pending_export');
		expect(events[1].to_state).toBe('exporting');
	});

	test('cannot start export from wrong state (except idempotent case)', async () => {
		const printJob = await createPrintJob(testPrintableMapId);
		await startExport(printJob.id);
		await completeExport(printJob.id, '/test.png');

		// Try to start from completed state - should fail (not idempotent)
		await expect(startExport(printJob.id)).rejects.toThrow(
			'Cannot start export from state export_complete'
		);
	});

	test('can transition from exporting to export_complete', async () => {
		const printJob = await createPrintJob(testPrintableMapId);
		await startExport(printJob.id);

		const filePath = '/exports/test-map-123.png';
		const updated = await completeExport(printJob.id, filePath);

		expect(updated.state).toBe('export_complete');
		expect(updated.export_completed_at).not.toBeNull();
		expect(updated.export_file_path).toBe(filePath);

		// Check event log
		const events = await getPrintJobEvents(printJob.id);
		expect(events).toHaveLength(3);
		expect(events[2].event_type).toBe('completed');
		expect(events[2].from_state).toBe('exporting');
		expect(events[2].to_state).toBe('export_complete');
	});

	test('cannot complete export from wrong state', async () => {
		const printJob = await createPrintJob(testPrintableMapId);

		// Try to complete without starting - should fail
		await expect(completeExport(printJob.id, '/test.png')).rejects.toThrow(
			'Cannot complete export from state pending_export'
		);
	});

	test('can transition from exporting to export_failed', async () => {
		const printJob = await createPrintJob(testPrintableMapId);
		await startExport(printJob.id);

		const errorMessage = 'Puppeteer timeout';
		const updated = await failExport(printJob.id, errorMessage);

		expect(updated.state).toBe('export_failed');
		expect(updated.export_error).toBe(errorMessage);
		expect(updated.export_retry_count).toBe(1);

		// Check event log
		const events = await getPrintJobEvents(printJob.id);
		expect(events).toHaveLength(3);
		expect(events[2].event_type).toBe('failed');
		expect(events[2].error_message).toBe(errorMessage);
	});

	test('can retry a failed export', async () => {
		const printJob = await createPrintJob(testPrintableMapId);
		await startExport(printJob.id);
		await failExport(printJob.id, 'First failure');

		const updated = await retryExport(printJob.id);

		expect(updated.state).toBe('exporting');
		expect(updated.export_started_at).not.toBeNull();
		expect(updated.export_error).toBeNull();
		expect(updated.export_retry_count).toBe(1); // Preserved from failure

		// Check event log
		const events = await getPrintJobEvents(printJob.id);
		expect(events).toHaveLength(4);
		expect(events[3].event_type).toBe('retrying');
		expect(events[3].from_state).toBe('export_failed');
		expect(events[3].to_state).toBe('exporting');
	});

	test('can get jobs ready for export', async () => {
		const job1 = await createPrintJob(testPrintableMapId);
		const job2 = await createPrintJob(testPrintableMapId);
		await startExport(job2.id); // This one is no longer pending

		const readyJobs = await getJobsReadyForExport();
		expect(readyJobs).toHaveLength(1);
		expect(readyJobs[0].id).toBe(job1.id);
	});

	test('can get completed exports', async () => {
		const job1 = await createPrintJob(testPrintableMapId);
		await startExport(job1.id);
		await completeExport(job1.id, '/test.png');

		const job2 = await createPrintJob(testPrintableMapId);
		// job2 is still pending

		const completedJobs = await getCompletedExports();
		// Filter to only jobs for this test's printable map
		const testCompletedJobs = completedJobs.filter(j => j.printable_map_id === testPrintableMapId);
		expect(testCompletedJobs).toHaveLength(1);
		expect(testCompletedJobs[0].id).toBe(job1.id);
	});

	test('full workflow: create -> start -> complete', async () => {
		// Create job
		const job = await createPrintJob(testPrintableMapId);
		expect(job.state).toBe('pending_export');

		// Start export
		const started = await startExport(job.id);
		expect(started.state).toBe('exporting');

		// Complete export
		const completed = await completeExport(job.id, '/exports/map-final.png');
		expect(completed.state).toBe('export_complete');
		expect(completed.export_file_path).toBe('/exports/map-final.png');

		// Verify event log tells complete story
		const events = await getPrintJobEvents(job.id);
		expect(events).toHaveLength(3);
		expect(events.map(e => e.event_type)).toEqual(['created', 'started', 'completed']);
	});

	test('full workflow: create -> start -> fail -> retry -> complete', async () => {
		// Create job
		const job = await createPrintJob(testPrintableMapId);

		// Start export
		await startExport(job.id);

		// Fail
		await failExport(job.id, 'Network timeout');

		// Retry
		await retryExport(job.id);

		// Complete on retry
		const completed = await completeExport(job.id, '/exports/map-final.png');
		expect(completed.state).toBe('export_complete');
		expect(completed.export_retry_count).toBe(1);

		// Verify complete event log
		const events = await getPrintJobEvents(job.id);
		expect(events).toHaveLength(5);
		expect(events.map(e => e.event_type)).toEqual([
			'created',
			'started',
			'failed',
			'retrying',
			'completed'
		]);
	});
});
