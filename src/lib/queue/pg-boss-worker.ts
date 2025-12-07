/**
 * Export Worker (pg-boss)
 *
 * Worker that processes map export jobs using pg-boss.
 * Calls API endpoints (not database directly) following the worker pattern.
 * Runs in separate container (Dockerfile.worker).
 */

import { PgBoss } from 'pg-boss';
import type { Job } from 'pg-boss';
import { exportMapToPNG } from '$lib/export/puppeteer.js';
import { embedSRGBProfile } from '$lib/export/post-process.js';
import { validatePNG } from '$lib/export/validate.js';
import { findPrintSpec } from '$lib/map-renderer/dimensions.js';
import type { MapDefinition } from '$lib/map-renderer/types.js';
import fs from 'fs';
import path from 'path';

// API URL from environment (worker calls API, not database)
const API_URL = process.env.API_URL || 'http://localhost:5173';
const EXPORT_DIR = process.env.EXPORT_DIR || '/app/exports';
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

/**
 * Job data structure
 */
export interface ExportJobData {
	printJobId: string;
	printableMapId: string;
	userMapData: {
		title: string;
		subtitle?: string;
		people: any[];
		rotation?: [number, number, number];
	};
	printableMapData: {
		widthInches: number;
		heightInches: number;
		paperSizeName?: string;
		projection?: string;
		rotation?: [number, number, number];
		zoom?: number;
		pan?: [number, number];
	};
}

/**
 * Call API to update job state: start
 */
async function callStartAPI(printJobId: string): Promise<void> {
	const response = await fetch(`${API_URL}/api/jobs/${printJobId}/start`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' }
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(`API error: ${errorData.error || response.statusText}`);
	}
}

/**
 * Call API to update job state: complete
 */
async function callCompleteAPI(printJobId: string, filePath: string): Promise<void> {
	const response = await fetch(`${API_URL}/api/jobs/${printJobId}/complete`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ filePath })
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(`API error: ${errorData.error || response.statusText}`);
	}
}

/**
 * Call API to update job state: fail
 */
async function callFailAPI(printJobId: string, error: string): Promise<void> {
	const response = await fetch(`${API_URL}/api/jobs/${printJobId}/fail`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ error })
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(`API error: ${errorData.error || response.statusText}`);
	}
}

/**
 * Process a single export job
 */
async function processExportJob(job: Job<ExportJobData>): Promise<void> {
	const startTime = Date.now();
	const { printJobId, printableMapId, userMapData, printableMapData } = job.data;

	try {
		console.log(`📋 Processing export job ${printJobId} for printable map: ${printableMapId}`);

		// 1. Tell API we're starting (API updates DB)
		await callStartAPI(printJobId);

		// 2. Get print spec by dimensions
		const printSpec = findPrintSpec(printableMapData.widthInches, printableMapData.heightInches);
		if (!printSpec) {
			throw new Error(
				`No print specification found for ${printableMapData.widthInches}×${printableMapData.heightInches} inches`
			);
		}

		const orientation = printableMapData.widthInches > printableMapData.heightInches ? 'landscape' : 'portrait';
		console.log(`📐 Page: ${printableMapData.widthInches}×${printableMapData.heightInches}" (${orientation})`);
		if (printableMapData.paperSizeName) {
			console.log(`   Size name: ${printableMapData.paperSizeName}`);
		}
		console.log(`🗺  Projection: ${printableMapData.projection || 'default'}`);

		// 3. Build MapDefinition from job data
		const mapDefinition: MapDefinition = {
			title: userMapData.title || 'Untitled Map',
			subtitle: userMapData.subtitle || '',
			people: userMapData.people,
			rotation: printableMapData.rotation || userMapData.rotation || [-20, -30, 0]
		};

		// 4. Render via Puppeteer
		console.log('🎭 Starting Puppeteer export...');
		const renderUrl = process.env.RENDER_BASE_URL || API_URL;

		if (DEBUG_MODE) {
			console.log('🐛 DEBUG MODE ENABLED - will save metadata JSON sidecar');
		}

		const screenshot = await exportMapToPNG(mapDefinition, printSpec, {
			baseUrl: renderUrl,
			timeout: 120000
		});

		// 5. Post-process: embed sRGB profile
		console.log('🎨 Embedding sRGB profile...');
		const processed = await embedSRGBProfile(screenshot);

		// 6. Validate
		console.log('🔍 Validating PNG...');
		const validation = await validatePNG(processed, printSpec);
		if (!validation.valid) {
			throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
		}

		// 7. Save to disk
		if (!fs.existsSync(EXPORT_DIR)) {
			fs.mkdirSync(EXPORT_DIR, { recursive: true });
		}

		// Create ISO timestamp for filename (YYYY-MM-DDTHH-mm-ss)
		const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
		const filename = `${timestamp}_${printJobId}.png`;
		const filePath = path.join(EXPORT_DIR, filename);
		fs.writeFileSync(filePath, processed);

		// 8. Save debug metadata if enabled
		if (DEBUG_MODE) {
			const metadataFilename = `${timestamp}_${printJobId}.json`;
			const metadataPath = path.join(EXPORT_DIR, metadataFilename);

			const metadata = {
				printJobId,
				printableMapId,
				exportedAt: new Date().toISOString(),
				pageDimensions: {
					widthInches: printableMapData.widthInches,
					heightInches: printableMapData.heightInches,
					orientation,
					paperSizeName: printableMapData.paperSizeName || 'Custom'
				},
				printSpec: {
					productName: printSpec.productName,
					trimWidthPt: printSpec.trimWidth,
					trimHeightPt: printSpec.trimHeight,
					dpi: printSpec.dpi,
					bleedPt: printSpec.bleed,
					pixelWidth: validation.metadata?.width,
					pixelHeight: validation.metadata?.height
				},
				mapDefinition: {
					title: mapDefinition.title,
					subtitle: mapDefinition.subtitle,
					projection: printableMapData.projection || 'orthographic',
					rotation: mapDefinition.rotation,
					zoom: printableMapData.zoom || 1.0,
					pan: printableMapData.pan || [0, 0],
					peopleCount: mapDefinition.people.length,
					locationsCount: mapDefinition.people.reduce(
						(sum, p) => sum + (p.locations?.length || 0),
						0
					)
				},
				file: {
					path: filePath,
					sizeBytes: Buffer.byteLength(processed),
					sizeMB: (Buffer.byteLength(processed) / 1024 / 1024).toFixed(2)
				}
			};

			fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
			console.log(`🐛 Debug metadata saved: ${metadataPath}`);
		}

		const durationMs = Date.now() - startTime;
		const fileSizeMB = (Buffer.byteLength(processed) / 1024 / 1024).toFixed(2);

		console.log(`✅ Export completed in ${(durationMs / 1000).toFixed(2)}s`);
		console.log(`   File: ${filePath}`);
		console.log(`   Size: ${fileSizeMB} MB`);
		console.log(`   Dimensions: ${validation.metadata?.width}×${validation.metadata?.height}px`);

		// 8. Tell API we succeeded (API updates DB)
		await callCompleteAPI(printJobId, filePath);
	} catch (error) {
		const durationMs = Date.now() - startTime;
		const errorMessage = error instanceof Error ? error.message : String(error);

		console.error(`❌ Export failed: ${errorMessage}`);

		// 9. Tell API we failed (API updates DB)
		try {
			await callFailAPI(printJobId, errorMessage);
		} catch (apiError) {
			console.error(`⚠️  Failed to update API with error status:`, apiError);
		}

		// Re-throw so pg-boss can handle retry
		throw error;
	}
}

/**
 * Create and start the pg-boss export worker
 */
export async function createPgBossWorker() {
	// Get database connection from environment
	const connectionString =
		process.env.DATABASE_URL ||
		`postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`;

	const boss = new PgBoss(connectionString);

	boss.on('error', (error: Error) => {
		console.error('pg-boss error:', error);
	});

	await boss.start();
	console.log('✅ pg-boss started');

	// Register worker for export jobs
	await boss.work('export-map', async (jobs: Job<ExportJobData>[]) => {
		for (const job of jobs) {
			await processExportJob(job);
		}
	});
	console.log('🔄 Export worker registered and listening for jobs');

	return boss;
}

// Auto-start worker if this is run as a standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
	createPgBossWorker().catch((error) => {
		console.error('Failed to start worker:', error);
		process.exit(1);
	});

	// Handle graceful shutdown
	process.on('SIGTERM', async () => {
		console.log('SIGTERM received, shutting down gracefully...');
		process.exit(0);
	});
}
