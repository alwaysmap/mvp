#!/usr/bin/env node
/**
 * Start pg-boss export worker
 *
 * Runs the export worker that processes map export jobs.
 * This script is meant to be run in a separate container/process.
 */

import { createPgBossWorker } from '../src/lib/queue/pg-boss-worker.js';

async function main() {
	console.log('🚀 Starting export worker...');

	try {
		const boss = await createPgBossWorker();

		// Handle graceful shutdown
		const shutdown = async () => {
			console.log('\n⏹  Shutting down worker...');
			await boss.stop();
			console.log('✅ Worker stopped gracefully');
			process.exit(0);
		};

		process.on('SIGTERM', shutdown);
		process.on('SIGINT', shutdown);

		console.log('✅ Worker is running. Press Ctrl+C to stop.');
	} catch (error) {
		console.error('❌ Failed to start worker:', error);
		process.exit(1);
	}
}

main();
