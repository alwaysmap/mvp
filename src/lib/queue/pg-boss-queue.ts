/**
 * Export Queue (pg-boss)
 *
 * pg-boss queue for async map export jobs.
 * Used by API endpoints to create print jobs and queue them.
 */

import { PgBoss } from 'pg-boss';
import { createPrintJob } from '$lib/db/repositories/print-jobs.js';
import { getPrintableMapWithUserMap } from '$lib/db/repositories/printable-maps.js';
import type { ExportJobData } from './pg-boss-worker.js';

let bossInstance: PgBoss | null = null;

/**
 * Get or create pg-boss instance (singleton)
 */
export async function getPgBoss(): Promise<PgBoss> {
	if (bossInstance) {
		return bossInstance;
	}

	const connectionString =
		process.env.DATABASE_URL ||
		`postgresql://${process.env.DATABASE_USER || 'postgres'}:${process.env.DATABASE_PASSWORD || 'postgres'}@${process.env.DATABASE_HOST || 'localhost'}:${process.env.DATABASE_PORT || '5432'}/${process.env.DATABASE_NAME || 'alwaysmap'}`;

	bossInstance = new PgBoss(connectionString);

	bossInstance.on('error', (error) => {
		console.error('pg-boss error:', error);
	});

	await bossInstance.start();
	console.log('✅ pg-boss queue started');

	return bossInstance;
}

/**
 * Add an export job to the queue
 * Creates print_job record and queues it with pg-boss
 *
 * @param printableMapId - ID of the printable map to export
 * @returns Print job ID (for tracking via API)
 */
export async function addExportJob(printableMapId: string): Promise<string> {
	// 1. Load map data (needed for worker)
	const mapWithConfig = await getPrintableMapWithUserMap(printableMapId);
	if (!mapWithConfig) {
		throw new Error(`Printable map not found: ${printableMapId}`);
	}

	const { userMap, printableMap } = mapWithConfig;

	// 2. Create print job in database (pending_export state)
	const printJob = await createPrintJob(printableMapId);

	// 3. Queue job with pg-boss
	const boss = await getPgBoss();

	// Ensure queue exists (pg-boss requirement)
	await boss.createQueue('export-map');

	const jobData: ExportJobData = {
		printJobId: printJob.id,
		printableMapId: printableMap.id,
		userMapData: {
			title: userMap.data.title,
			subtitle: userMap.data.subtitle,
			people: userMap.data.people,
			rotation: userMap.data.rotation
		},
		printableMapData: {
			widthInches: printableMap.data.widthInches,
			heightInches: printableMap.data.heightInches,
			paperSizeName: printableMap.data.paperSizeName,
			projection: printableMap.data.projection,
			rotation: printableMap.data.rotation,
			zoom: printableMap.data.zoom,
			pan: printableMap.data.pan
		}
	};

	await boss.send('export-map', jobData, {
		retryLimit: 3,
		retryDelay: 60, // 60 seconds
		retryBackoff: true,
		expireInSeconds: 3600 // 1 hour
	});

	return printJob.id;
}

/**
 * Stop pg-boss (cleanup)
 */
export async function stopPgBoss(): Promise<void> {
	if (bossInstance) {
		await bossInstance.stop();
		bossInstance = null;
		console.log('✅ pg-boss queue stopped');
	}
}
