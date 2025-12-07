/**
 * Fail Export Job API
 *
 * POST /api/jobs/{jobId}/fail - Transition job from exporting to export_failed
 *
 * Called by worker when export fails
 */

import { json } from '@sveltejs/kit';
import { failExport } from '$lib/db/repositories/print-jobs.js';
import type { RequestHandler } from './$types';

/**
 * Fail an export job
 */
export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { jobId } = params;
		const body = await request.json();

		if (!body.error) {
			return json({ success: false, error: 'error message is required' }, { status: 400 });
		}

		const job = await failExport(jobId, body.error);

		return json({
			success: true,
			job: {
				id: job.id,
				state: job.state,
				export_error: job.export_error,
				export_retry_count: job.export_retry_count
			}
		});
	} catch (error) {
		console.error('Error failing export job:', error);
		const message = error instanceof Error ? error.message : 'Failed to update job status';
		return json({ success: false, error: message }, { status: 400 });
	}
};
