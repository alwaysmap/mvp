/**
 * Export API - Async version using pg-boss job queue
 *
 * POST /api/export - Create printable map config and trigger export job
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPrintableMap } from '$lib/db/repositories/printable-maps';
import { addExportJob } from '$lib/queue/pg-boss-queue.js';
import type { PrintableMapData } from '$lib/db/schema';
import { PRINT_SPECS } from '$lib/map-renderer/dimensions.js';

/**
 * POST /api/export
 *
 * Request body:
 * {
 *   "userMapId": "uuid",
 *   "pageSize": "18x24",
 *   "orientation": "portrait",
 *   "projection": "orthographic", // optional
 *   "rotation": [0, 0, 0],         // optional
 *   "zoom": 1,                     // optional
 *   "pan": [0, 0]                  // optional
 * }
 *
 * Response:
 * {
 *   "printableMap": PrintableMap,
 *   "jobId": "export-uuid",
 *   "message": "Export job queued"
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { userMapId, ...printableMapData } = body;

		if (!userMapId) {
			return json({ error: 'userMapId required' }, { status: 400 });
		}

		// Validate printable map data
		const data = printableMapData as PrintableMapData;
		if (!data.pageSize || !data.orientation) {
			return json({ error: 'pageSize and orientation required' }, { status: 400 });
		}

		// Validate page size
		if (!PRINT_SPECS[data.pageSize]) {
			return json({
				error: 'Invalid pageSize',
				validSizes: Object.keys(PRINT_SPECS)
			}, { status: 400 });
		}

		// Create printable map configuration
		const printableMap = await createPrintableMap(userMapId, data);

		// Add export job to queue (creates print_job and queues with pg-boss)
		const printJobId = await addExportJob(printableMap.id);

		return json(
			{
				printableMap,
				printJobId,
				message: 'Export job queued'
			},
			{ status: 202 }
		);
	} catch (error) {
		console.error('Error creating export job:', error);
		return json({ error: 'Failed to create export job' }, { status: 500 });
	}
};

/**
 * GET /api/export
 *
 * Returns API documentation
 */
export const GET: RequestHandler = async () => {
	return json({
		endpoint: '/api/export',
		method: 'POST',
		description: 'Creates a printable map configuration and triggers an async export job',
		requestBody: {
			userMapId: {
				type: 'string (UUID)',
				required: true,
				description: 'ID of the user map to export'
			},
			pageSize: {
				type: 'string',
				required: true,
				options: Object.keys(PRINT_SPECS),
				description: 'Print size specification'
			},
			orientation: {
				type: 'string',
				required: true,
				options: ['portrait', 'landscape'],
				description: 'Page orientation'
			},
			projection: {
				type: 'string',
				required: false,
				options: ['orthographic', 'equirectangular', 'mercator', 'naturalEarth1', 'robinson'],
				description: 'Map projection (overrides user map default)'
			}
		},
		response: {
			success: {
				printableMap: 'PrintableMap object',
				printJobId: 'Print job ID for status polling',
				message: 'Export job queued'
			},
			error: 'JSON with error details'
		},
		example: {
			userMapId: 'abc123-...',
			pageSize: '18x24',
			orientation: 'portrait',
			projection: 'orthographic'
		},
		next: 'Poll /api/jobs/{jobId} for status'
	});
};
