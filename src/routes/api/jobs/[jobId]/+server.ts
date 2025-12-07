/**
 * Job Status API
 *
 * GET /api/jobs/{jobId} - Get job status and result
 */

import { json } from '@sveltejs/kit';
import { getJobStatus } from '$lib/queue/export-queue';
import type { RequestHandler } from './$types';

/**
 * Get job status and result
 */
export const GET: RequestHandler = async ({ params }) => {
	try {
		const { jobId } = params;

		const status = await getJobStatus(jobId);

		return json(status);
	} catch (error) {
		console.error('Error getting job status:', error);
		return json({ error: 'Failed to get job status' }, { status: 500 });
	}
};
