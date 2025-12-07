/**
 * Job Status API
 *
 * GET /api/jobs/{jobId} - Get job status and result
 */

import { json } from '@sveltejs/kit';
import { getPrintJob, getPrintJobEvents } from '$lib/db/repositories/print-jobs.js';
import type { RequestHandler } from './$types';

/**
 * Get job status and result
 */
export const GET: RequestHandler = async ({ params }) => {
	try {
		const { jobId } = params;

		const job = await getPrintJob(jobId);

		if (!job) {
			return json({ error: 'Job not found' }, { status: 404 });
		}

		// Optionally include event history
		const events = await getPrintJobEvents(jobId);

		return json({
			id: job.id,
			printable_map_id: job.printable_map_id,
			state: job.state,
			export_started_at: job.export_started_at,
			export_completed_at: job.export_completed_at,
			export_file_path: job.export_file_path,
			export_error: job.export_error,
			export_retry_count: job.export_retry_count,
			created_at: job.created_at,
			updated_at: job.updated_at,
			events: events.map(e => ({
				event_type: e.event_type,
				from_state: e.from_state,
				to_state: e.to_state,
				created_at: e.created_at
			}))
		});
	} catch (error) {
		console.error('Error getting job status:', error);
		return json({ error: 'Failed to get job status' }, { status: 500 });
	}
};
