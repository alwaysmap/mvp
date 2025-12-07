/**
 * Export Queue
 *
 * BullMQ queue for async map export jobs.
 * Used by API endpoints to submit jobs.
 */

import { Queue } from 'bullmq';
import { redisConnection, type ExportJobData } from './client';

// Queue name
export const EXPORT_QUEUE_NAME = 'map-exports';

// Create export queue
export const exportQueue = new Queue<ExportJobData>(EXPORT_QUEUE_NAME, {
	connection: redisConnection,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			type: 'exponential',
			delay: 2000
		},
		removeOnComplete: {
			age: 3600, // Keep completed jobs for 1 hour
			count: 100 // Keep last 100 completed jobs
		},
		removeOnFail: {
			age: 86400 // Keep failed jobs for 24 hours
		}
	}
});

/**
 * Add an export job to the queue
 */
export async function addExportJob(printableMapId: string): Promise<string> {
	const job = await exportQueue.add(
		'export',
		{ printableMapId },
		{
			jobId: `export-${printableMapId}`,
			timeout: 120000 // 2 minute timeout
		}
	);

	return job.id!;
}

/**
 * Get job status and result
 */
export async function getJobStatus(jobId: string) {
	const job = await exportQueue.getJob(jobId);

	if (!job) {
		return { status: 'not_found' as const };
	}

	const state = await job.getState();
	const progress = job.progress;

	if (state === 'completed') {
		return {
			status: 'completed' as const,
			result: job.returnvalue,
			progress: 100
		};
	}

	if (state === 'failed') {
		return {
			status: 'failed' as const,
			error: job.failedReason,
			progress
		};
	}

	return {
		status: state as 'waiting' | 'active' | 'delayed',
		progress
	};
}

/**
 * Clean up old jobs
 */
export async function cleanQueue() {
	await exportQueue.clean(3600, 100, 'completed');
	await exportQueue.clean(86400, 0, 'failed');
}
