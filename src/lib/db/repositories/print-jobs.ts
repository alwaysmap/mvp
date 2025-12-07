/**
 * Print jobs repository
 *
 * Manages print job workflow state and events.
 * Follows the worker pattern: API calls these functions, workers call API.
 */

import { randomUUID } from 'crypto';
import { query } from '../client.js';
import type { PrintJob, PrintJobEvent, PrintJobState, PrintJobEventType } from '../schema.js';

/**
 * Create a new print job for a printable map
 */
export async function createPrintJob(printableMapId: string): Promise<PrintJob> {
	const id = randomUUID();
	const now = new Date();

	// Create print job
	const result = await query<PrintJob>(
		`INSERT INTO print_jobs (id, printable_map_id, state, created_at, updated_at)
     VALUES ($1, $2, 'pending_export', $3, $4)
     RETURNING *`,
		[id, printableMapId, now, now]
	);

	const printJob = result.rows[0];

	// Log creation event
	await logPrintJobEvent(id, null, 'pending_export', 'created');

	return printJob;
}

/**
 * Get a print job by ID
 */
export async function getPrintJob(id: string): Promise<PrintJob | null> {
	const result = await query<PrintJob>(`SELECT * FROM print_jobs WHERE id = $1`, [id]);
	return result.rows[0] || null;
}

/**
 * Get all print jobs for a printable map
 */
export async function getPrintJobsForPrintableMap(printableMapId: string): Promise<PrintJob[]> {
	const result = await query<PrintJob>(
		`SELECT * FROM print_jobs WHERE printable_map_id = $1 ORDER BY created_at DESC`,
		[printableMapId]
	);
	return result.rows;
}

/**
 * Update print job state (internal use only - use specific transition functions)
 */
async function updatePrintJobState(
	id: string,
	newState: PrintJobState,
	updates: Partial<PrintJob> = {}
): Promise<PrintJob> {
	const currentJob = await getPrintJob(id);
	if (!currentJob) {
		throw new Error(`Print job ${id} not found`);
	}

	const fields: string[] = ['state = $2'];
	const values: unknown[] = [id, newState];
	let paramIndex = 3;

	// Add additional fields
	for (const [key, value] of Object.entries(updates)) {
		if (key !== 'id' && key !== 'printable_map_id' && key !== 'created_at') {
			fields.push(`${key} = $${paramIndex}`);
			values.push(value);
			paramIndex++;
		}
	}

	const result = await query<PrintJob>(
		`UPDATE print_jobs SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
		values
	);

	return result.rows[0];
}

/**
 * Transition: pending_export -> exporting
 * Called when worker starts processing
 */
export async function startExport(printJobId: string): Promise<PrintJob> {
	const job = await getPrintJob(printJobId);
	if (!job) {
		throw new Error(`Print job ${printJobId} not found`);
	}

	if (job.state !== 'pending_export') {
		throw new Error(`Cannot start export from state ${job.state}`);
	}

	const updatedJob = await updatePrintJobState(printJobId, 'exporting', {
		export_started_at: new Date()
	});

	await logPrintJobEvent(printJobId, 'pending_export', 'exporting', 'started');

	return updatedJob;
}

/**
 * Transition: exporting -> export_complete
 * Called when worker successfully completes export
 */
export async function completeExport(printJobId: string, filePath: string): Promise<PrintJob> {
	const job = await getPrintJob(printJobId);
	if (!job) {
		throw new Error(`Print job ${printJobId} not found`);
	}

	if (job.state !== 'exporting') {
		throw new Error(`Cannot complete export from state ${job.state}`);
	}

	const updatedJob = await updatePrintJobState(printJobId, 'export_complete', {
		export_completed_at: new Date(),
		export_file_path: filePath
	});

	await logPrintJobEvent(printJobId, 'exporting', 'export_complete', 'completed', {
		file_path: filePath
	});

	return updatedJob;
}

/**
 * Transition: exporting -> export_failed
 * Called when worker encounters an error
 */
export async function failExport(printJobId: string, error: string): Promise<PrintJob> {
	const job = await getPrintJob(printJobId);
	if (!job) {
		throw new Error(`Print job ${printJobId} not found`);
	}

	if (job.state !== 'exporting') {
		throw new Error(`Cannot fail export from state ${job.state}`);
	}

	const updatedJob = await updatePrintJobState(printJobId, 'export_failed', {
		export_error: error,
		export_retry_count: job.export_retry_count + 1
	});

	await logPrintJobEvent(printJobId, 'exporting', 'export_failed', 'failed', undefined, error);

	return updatedJob;
}

/**
 * Transition: export_failed -> exporting
 * Called when retrying a failed export
 */
export async function retryExport(printJobId: string): Promise<PrintJob> {
	const job = await getPrintJob(printJobId);
	if (!job) {
		throw new Error(`Print job ${printJobId} not found`);
	}

	if (job.state !== 'export_failed') {
		throw new Error(`Cannot retry export from state ${job.state}`);
	}

	const updatedJob = await updatePrintJobState(printJobId, 'exporting', {
		export_started_at: new Date(),
		export_error: null
	});

	await logPrintJobEvent(printJobId, 'export_failed', 'exporting', 'retrying', {
		retry_count: job.export_retry_count
	});

	return updatedJob;
}

/**
 * Log a print job event (audit trail)
 */
export async function logPrintJobEvent(
	printJobId: string,
	fromState: PrintJobState | null,
	toState: PrintJobState,
	eventType: PrintJobEventType,
	metadata?: Record<string, unknown>,
	errorMessage?: string
): Promise<PrintJobEvent> {
	const id = randomUUID();
	const now = new Date();

	const result = await query<PrintJobEvent>(
		`INSERT INTO print_job_events
     (id, print_job_id, from_state, to_state, event_type, metadata, error_message, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
		[id, printJobId, fromState, toState, eventType, JSON.stringify(metadata || {}), errorMessage || null, now]
	);

	return result.rows[0];
}

/**
 * Get all events for a print job
 */
export async function getPrintJobEvents(printJobId: string): Promise<PrintJobEvent[]> {
	const result = await query<PrintJobEvent>(
		`SELECT * FROM print_job_events WHERE print_job_id = $1 ORDER BY created_at ASC`,
		[printJobId]
	);
	return result.rows;
}

/**
 * Get jobs ready for export (pending_export state)
 */
export async function getJobsReadyForExport(): Promise<PrintJob[]> {
	const result = await query<PrintJob>(
		`SELECT * FROM print_jobs WHERE state = 'pending_export' ORDER BY created_at ASC`
	);
	return result.rows;
}

/**
 * Get jobs that completed export
 */
export async function getCompletedExports(): Promise<PrintJob[]> {
	const result = await query<PrintJob>(
		`SELECT * FROM print_jobs WHERE state = 'export_complete' ORDER BY export_completed_at DESC`
	);
	return result.rows;
}
