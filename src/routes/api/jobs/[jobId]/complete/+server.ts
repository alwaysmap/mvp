/**
 * Complete Export Job API
 *
 * POST /api/jobs/{jobId}/complete - Transition job from exporting to export_complete
 *
 * Called by worker when export succeeds
 */

import { json } from '@sveltejs/kit';
import { completeExport } from '$lib/db/repositories/print-jobs.js';
import type { RequestHandler } from './$types';

/**
 * Complete an export job
 */
export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { jobId } = params;
		const body = await request.json();

		if (!body.filePath) {
			return json({ success: false, error: 'filePath is required' }, { status: 400 });
		}

		const job = await completeExport(jobId, body.filePath);

		return json({
			success: true,
			job: {
				id: job.id,
				state: job.state,
				export_completed_at: job.export_completed_at,
				export_file_path: job.export_file_path
			}
		});
	} catch (error) {
		console.error('Error completing export job:', error);
		const message = error instanceof Error ? error.message : 'Failed to complete export job';
		return json({ success: false, error: message }, { status: 400 });
	}
};
