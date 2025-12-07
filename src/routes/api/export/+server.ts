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
import { findPrintSpec } from '$lib/map-renderer/dimensions.js';

/**
 * POST /api/export
 *
 * Request body:
 * {
 *   "userMapId": "uuid",
 *   "widthInches": 18,             // required
 *   "heightInches": 24,            // required
 *   "paperSizeName": "18x24",      // optional display name
 *   "projection": "orthographic",  // optional
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
		if (typeof data.widthInches !== 'number' || typeof data.heightInches !== 'number') {
			return json({ error: 'widthInches and heightInches required as numbers' }, { status: 400 });
		}

		if (data.widthInches <= 0 || data.heightInches <= 0) {
			return json({ error: 'widthInches and heightInches must be positive' }, { status: 400 });
		}

		// Find matching print spec by dimensions
		const printSpec = findPrintSpec(data.widthInches, data.heightInches);
		if (!printSpec) {
			return json({
				error: 'No matching print specification found',
				widthInches: data.widthInches,
				heightInches: data.heightInches,
				message: 'Dimensions must match one of our supported print sizes'
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
			widthInches: {
				type: 'number',
				required: true,
				description: 'Page width in inches (e.g., 18 for portrait 18×24, or 24 for landscape)'
			},
			heightInches: {
				type: 'number',
				required: true,
				description: 'Page height in inches (e.g., 24 for portrait 18×24, or 18 for landscape)'
			},
			paperSizeName: {
				type: 'string',
				required: false,
				description: 'Optional display name (e.g., "18×24", "A4")'
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
			widthInches: 18,
			heightInches: 24,
			paperSizeName: '18×24',
			projection: 'orthographic'
		},
		next: 'Poll /api/jobs/{jobId} for status'
	});
};
