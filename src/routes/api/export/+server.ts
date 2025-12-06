/**
 * Export API endpoint.
 * Receives MapDefinition, renders via Puppeteer, and returns PNG with embedded sRGB profile.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { MapDefinition } from '$lib/map-renderer/types.js';
import { PRINT_SPECS } from '$lib/map-renderer/dimensions.js';
import { exportMapToPNG } from '$lib/export/puppeteer.js';
import { embedSRGBProfile } from '$lib/export/post-process.js';
import { validatePNG, validateMapDefinition } from '$lib/export/validate.js';

/**
 * POST /api/export
 *
 * Request body:
 * {
 *   "mapDefinition": MapDefinition,
 *   "printSize": "18x24" | "12x16" | "24x36"
 * }
 *
 * Response:
 * - Success: PNG file download (application/octet-stream)
 * - Error: JSON with error message
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		console.log('📥 Export request received');

		// Parse request body
		const body = await request.json();
		const { mapDefinition, printSize = '18x24' } = body;

		if (!mapDefinition) {
			return json({ error: 'Missing mapDefinition in request body' }, { status: 400 });
		}

		// Validate map definition
		const defValidation = validateMapDefinition(mapDefinition as MapDefinition);
		if (!defValidation.valid) {
			console.error('✗ Invalid map definition:', defValidation.errors);
			return json(
				{
					error: 'Invalid map definition',
					details: defValidation.errors
				},
				{ status: 400 }
			);
		}

		if (defValidation.warnings.length > 0) {
			console.warn('⚠ Map definition warnings:', defValidation.warnings);
		}

		// Get print spec
		const printSpec = PRINT_SPECS[printSize as keyof typeof PRINT_SPECS];
		if (!printSpec) {
			return json(
				{
					error: 'Invalid print size',
					validSizes: Object.keys(PRINT_SPECS)
				},
				{ status: 400 }
			);
		}

		console.log('📐 Print size:', printSize);
		console.log('   Dimensions:', `${printSpec.trimWidth}x${printSpec.trimHeight}pt`);

		// Step 1: Export via Puppeteer
		console.log('🎭 Starting Puppeteer export...');
		const screenshot = await exportMapToPNG(mapDefinition as MapDefinition, printSpec, {
			baseUrl: process.env.RENDER_BASE_URL || 'http://localhost:5173',
			timeout: 300000 // 5 minutes
		});

		// Step 2: Embed sRGB profile
		const processed = await embedSRGBProfile(screenshot);

		// Step 3: Validate output
		const validation = await validatePNG(processed, printSpec);

		if (!validation.valid) {
			console.error('✗ PNG validation failed:', validation.errors);
			return json(
				{
					error: 'PNG validation failed',
					details: validation.errors
				},
				{ status: 500 }
			);
		}

		if (validation.warnings.length > 0) {
			console.warn('⚠ PNG warnings:', validation.warnings);
		}

		console.log('✓ Export successful');
		console.log('   File size:', Buffer.byteLength(processed), 'bytes');

		// Return PNG file as download
		const filename = `map-${Date.now()}.png`;

		return new Response(processed, {
			status: 200,
			headers: {
				'Content-Type': 'image/png',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Content-Length': Buffer.byteLength(processed).toString(),
				'X-Validation-Warnings': validation.warnings.join('; ')
			}
		});
	} catch (error) {
		console.error('✗ Export failed:', error);

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		return json(
			{
				error: 'Export failed',
				message: errorMessage
			},
			{ status: 500 }
		);
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
		description: 'Exports a map definition to a print-ready PNG file',
		requestBody: {
			mapDefinition: {
				type: 'MapDefinition',
				required: true,
				description: 'Complete map definition with title, people, and locations'
			},
			printSize: {
				type: 'string',
				required: false,
				default: '18x24',
				options: Object.keys(PRINT_SPECS),
				description: 'Print size specification'
			}
		},
		response: {
			success: 'PNG file download (image/png)',
			error: 'JSON with error details'
		},
		example: {
			mapDefinition: {
				title: 'Our Family Journey',
				subtitle: '2010-2024',
				people: [
					{
						id: 'alice',
						name: 'Alice',
						color: '#FF6B6B',
						locations: [
							{
								countryCode: 'US',
								longitude: -74.006,
								latitude: 40.7128,
								date: '2010-01-01'
							}
						]
					}
				],
				rotation: [0, 0, 0]
			},
			printSize: '18x24'
		}
	});
};
