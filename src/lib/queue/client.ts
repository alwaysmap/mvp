/**
 * Redis client configuration for BullMQ
 *
 * Shared Redis connection used by queues and workers.
 */

import { Queue, Worker } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';

// Redis connection configuration from environment
export const redisConnection: ConnectionOptions = {
	host: process.env.REDIS_HOST || 'localhost',
	port: parseInt(process.env.REDIS_PORT || '6379'),
	maxRetriesPerRequest: null // Required for BullMQ
};

/**
 * Job data for map export
 */
export interface ExportJobData {
	printableMapId: string;
}

/**
 * Job result for successful export
 */
export interface ExportJobResult {
	success: true;
	printableMapId: string;
	filePath: string;
	fileSize: number;
	dimensions: {
		width: number;
		height: number;
	};
	durationMs: number;
}

/**
 * Job result for failed export
 */
export interface ExportJobError {
	success: false;
	printableMapId: string;
	error: string;
	durationMs: number;
}

export type ExportJobResponse = ExportJobResult | ExportJobError;
