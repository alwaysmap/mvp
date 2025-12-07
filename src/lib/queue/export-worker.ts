/**
 * Export Worker
 *
 * BullMQ worker that processes map export jobs.
 * Runs in separate container (Dockerfile.worker).
 */

import { Worker } from 'bullmq';
import { redisConnection, type ExportJobData, type ExportJobResponse } from './client';
import { EXPORT_QUEUE_NAME } from './export-queue';
import { getPrintableMapWithUserMap } from '$lib/db/repositories/printable-maps';
import { exportMapToPNG } from '$lib/export/puppeteer';
import { embedSRGBProfile } from '$lib/export/post-process';
import { validatePNG } from '$lib/export/validate';
import { PRINT_SPECS } from '$lib/map-renderer/dimensions';
import type { MapDefinition } from '$lib/map-renderer/types';
import fs from 'fs';
import path from 'path';

/**
 * Process a single export job
 */
async function processExportJob(
	job: any,
	token?: string
): Promise<ExportJobResponse> {
	const startTime = Date.now();
	const { printableMapId } = job.data as ExportJobData;

	try {
		console.log(`📋 Processing export job for printable map: ${printableMapId}`);
		job.updateProgress(10);

		// Load map data from database
		const mapWithConfig = await getPrintableMapWithUserMap(printableMapId);
		if (!mapWithConfig) {
			throw new Error(`Printable map not found: ${printableMapId}`);
		}

		const { userMap, printableMap } = mapWithConfig;
		const printSpec = PRINT_SPECS[printableMap.data.pageSize];

		if (!printSpec) {
			throw new Error(`Invalid page size: ${printableMap.data.pageSize}`);
		}

		console.log(`📐 Page size: ${printableMap.data.pageSize}`);
		console.log(`🗺  Projection: ${printableMap.data.projection || 'default'}`);
		job.updateProgress(20);

		// Build MapDefinition from database data
		const mapDefinition: MapDefinition = {
			title: userMap.data.title,
			subtitle: userMap.data.subtitle,
			people: userMap.data.people,
			rotation: printableMap.data.rotation || userMap.data.rotation || [-20, -30, 0]
		};

		// Render via Puppeteer
		console.log('🎭 Starting Puppeteer export...');
		job.updateProgress(40);

		const renderUrl = process.env.RENDER_BASE_URL || 'http://localhost:5173';
		const screenshot = await exportMapToPNG(mapDefinition, printSpec, {
			baseUrl: renderUrl,
			timeout: 120000
		});

		job.updateProgress(70);

		// Post-process: embed sRGB profile
		console.log('🎨 Embedding sRGB profile...');
		const processed = await embedSRGBProfile(screenshot);
		job.updateProgress(80);

		// Validate
		console.log('🔍 Validating PNG...');
		const validation = await validatePNG(processed, printSpec);
		if (!validation.valid) {
			throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
		}
		job.updateProgress(90);

		// Save to disk
		const outputDir = process.env.EXPORT_DIR || '/app/exports';
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		const filename = `${printableMapId}.png`;
		const filePath = path.join(outputDir, filename);
		fs.writeFileSync(filePath, processed);

		const durationMs = Date.now() - startTime;
		const fileSizeMB = (Buffer.byteLength(processed) / 1024 / 1024).toFixed(2);

		console.log(`✅ Export completed in ${(durationMs / 1000).toFixed(2)}s`);
		console.log(`   File: ${filePath}`);
		console.log(`   Size: ${fileSizeMB} MB`);
		console.log(`   Dimensions: ${validation.metadata?.width}×${validation.metadata?.height}px`);

		job.updateProgress(100);

		return {
			success: true,
			printableMapId,
			filePath,
			fileSize: Buffer.byteLength(processed),
			dimensions: {
				width: validation.metadata!.width,
				height: validation.metadata!.height
			},
			durationMs
		};
	} catch (error) {
		const durationMs = Date.now() - startTime;
		const errorMessage = error instanceof Error ? error.message : String(error);

		console.error(`❌ Export failed: ${errorMessage}`);

		return {
			success: false,
			printableMapId,
			error: errorMessage,
			durationMs
		};
	}
}

/**
 * Create and start the export worker
 */
export function createExportWorker() {
	const worker = new Worker<ExportJobData, ExportJobResponse>(
		EXPORT_QUEUE_NAME,
		processExportJob,
		{
			connection: redisConnection,
			concurrency: 2, // Process up to 2 jobs concurrently
			limiter: {
				max: 10, // Max 10 jobs
				duration: 60000 // Per 60 seconds
			}
		}
	);

	worker.on('completed', (job) => {
		console.log(`✅ Job ${job.id} completed`);
	});

	worker.on('failed', (job, err) => {
		console.error(`❌ Job ${job?.id} failed:`, err.message);
	});

	worker.on('error', (err) => {
		console.error('Worker error:', err);
	});

	console.log('🔄 Export worker started');

	return worker;
}

// Auto-start worker if this is run as a standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
	createExportWorker();
}
