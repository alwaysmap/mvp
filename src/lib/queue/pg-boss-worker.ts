/**
 * Export Worker (pg-boss)
 *
 * Worker that processes map export jobs using pg-boss.
 * Calls API endpoints (not database directly) following the worker pattern.
 * Runs in separate container (Dockerfile.worker).
 */

import PgBoss from 'pg-boss';
import { exportMapToPNG } from '$lib/export/puppeteer.js';
import { embedSRGBProfile } from '$lib/export/post-process.js';
import { validatePNG } from '$lib/export/validate.js';
import { PRINT_SPECS } from '$lib/map-renderer/dimensions.js';
import type { MapDefinition } from '$lib/map-renderer/types.js';
import fs from 'fs';
import path from 'path';

// API URL from environment (worker calls API, not database)
const API_URL = process.env.API_URL || 'http://localhost:5173';
const EXPORT_DIR = process.env.EXPORT_DIR || '/app/exports';

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
		pageSize: '12x16' | '18x24' | '24x36' | 'A3' | 'A4';
		projection?: string;
		rotation?: [number, number, number];
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
async function processExportJob(job: PgBoss.Job<ExportJobData>): Promise<void> {
	const startTime = Date.now();
	const { printJobId, printableMapId, userMapData, printableMapData } = job.data;

	try {
		console.log(`📋 Processing export job ${printJobId} for printable map: ${printableMapId}`);

		// 1. Tell API we're starting (API updates DB)
		await callStartAPI(printJobId);

		// 2. Get print spec
		const printSpec = PRINT_SPECS[printableMapData.pageSize];
		if (!printSpec) {
			throw new Error(`Invalid page size: ${printableMapData.pageSize}`);
		}

		console.log(`📐 Page size: ${printableMapData.pageSize}`);
		console.log(`🗺  Projection: ${printableMapData.projection || 'default'}`);

		// 3. Build MapDefinition from job data
		const mapDefinition: MapDefinition = {
			title: userMapData.title,
			subtitle: userMapData.subtitle,
			people: userMapData.people,
			rotation: printableMapData.rotation || userMapData.rotation || [-20, -30, 0]
		};

		// 4. Render via Puppeteer
		console.log('🎭 Starting Puppeteer export...');
		const renderUrl = process.env.RENDER_BASE_URL || API_URL;
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

		const filename = `${printableMapId}.png`;
		const filePath = path.join(EXPORT_DIR, filename);
		fs.writeFileSync(filePath, processed);

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

	boss.on('error', (error) => {
		console.error('pg-boss error:', error);
	});

	await boss.start();
	console.log('✅ pg-boss started');

	// Register worker for export jobs
	await boss.work('export-map', processExportJob);
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
