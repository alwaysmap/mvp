/**
 * Start Export Job API
 *
 * POST /api/jobs/{jobId}/start - Transition job from pending_export to exporting
 *
 * Called by worker when it begins processing a job
 */

import { json } from '@sveltejs/kit';
import { startExport } from '$lib/db/repositories/print-jobs.js';
import type { RequestHandler } from './$types';

/**
 * Start an export job
 */
export const POST: RequestHandler = async ({ params }) => {
	try {
		const { jobId } = params;

		const job = await startExport(jobId);

		return json({
			success: true,
			job: {
				id: job.id,
				state: job.state,
				export_started_at: job.export_started_at
			}
		});
	} catch (error) {
		console.error('Error starting export job:', error);
		const message = error instanceof Error ? error.message : 'Failed to start export job';
		return json({ success: false, error: message }, { status: 400 });
	}
};
