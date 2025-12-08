/**
 * Worker Error Handling Utilities
 *
 * Provides error classification and structured logging for the export worker.
 * Prevents retry loops on fatal errors and provides observability.
 */

/**
 * Classify an error as fatal (non-retryable) or retryable.
 *
 * Fatal errors indicate data/logic problems that won't be fixed by retrying:
 * - 404 Not Found - Job was deleted
 * - 400 Bad Request - Invalid request data
 * - 422 Unprocessable Entity - Validation failed
 * - Data validation errors
 *
 * @param error - Error object or message
 * @returns true if error is fatal (don't retry), false if retryable
 */
export function isFatalError(error: Error | string): boolean {
	const message = (typeof error === 'string' ? error : error.message).toLowerCase();

	// API 4xx errors (client errors - not retryable)
	if (message.includes('not found')) return true;
	if (message.includes('bad request')) return true;
	if (message.includes('unprocessable entity')) return true;

	// Validation errors
	if (message.includes('validation failed')) return true;
	if (message.includes('invalid page size')) return true;
	if (message.includes('invalid dimensions')) return true;
	if (message.includes('no print specification found')) return true;

	// All other errors are potentially transient and retryable
	return false;
}

/**
 * Determine if we should retry a job based on error and attempt count.
 *
 * @param error - Error that occurred
 * @param attemptNumber - Current attempt number (0-indexed)
 * @param maxAttempts - Maximum retry attempts (typically 3)
 * @returns true if job should be retried
 */
export function shouldRetryJob(
	error: Error | string,
	attemptNumber: number,
	maxAttempts: number
): boolean {
	// Never retry fatal errors
	if (isFatalError(error)) {
		return false;
	}

	// Don't retry if we've hit max attempts
	if (attemptNumber >= maxAttempts) {
		return false;
	}

	// Otherwise, retry for transient errors
	return true;
}

// Type definitions for structured logging
export interface JobContext {
	printJobId: string;
	printableMapId: string;
	attemptNumber: number;
	maxAttempts: number;
	queuedAt: string | Date;
	startedAt: string | Date;
}

export interface JobSuccessLog extends JobContext {
	status: 'success';
	durationMs: number;
	filePath: string;
	fileSizeMB: string;
}

export interface JobFailureLog extends JobContext {
	status: 'failed';
	error: string;
	isFatal: boolean;
	willRetry: boolean;
	durationMs: number;
}

/**
 * Create structured log object for job success.
 * Output as JSON for log aggregation systems.
 */
export function createSuccessLog(
	context: JobContext,
	result: { durationMs: number; filePath: string; fileSizeMB: string }
): JobSuccessLog {
	return {
		...context,
		status: 'success',
		...result
	};
}

/**
 * Create structured log object for job failure.
 * Output as JSON for log aggregation systems.
 */
export function createFailureLog(
	context: JobContext,
	error: Error | string,
	durationMs: number
): JobFailureLog {
	const isFatal = isFatalError(error);
	const willRetry = shouldRetryJob(error, context.attemptNumber, context.maxAttempts);

	return {
		...context,
		status: 'failed',
		error: typeof error === 'string' ? error : error.message,
		isFatal,
		willRetry,
		durationMs
	};
}
