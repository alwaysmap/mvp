/**
 * Unit tests for worker error classification and handling.
 *
 * Tests that the worker correctly distinguishes between:
 * - Fatal errors (should NOT retry): 404, 400, 422, validation errors
 * - Retryable errors (should retry): 500, 503, network errors
 */

import { describe, it, expect } from 'vitest';
import {
	isFatalError,
	shouldRetryJob,
	createSuccessLog,
	createFailureLog,
	type JobContext
} from '$lib/queue/error-handling.js';

describe('Worker Error Classification', () => {
	describe('isFatalError', () => {
		describe('Fatal errors (should NOT retry)', () => {
			it('should classify 404 Not Found as fatal', () => {
				const error = new Error('API error: Print job abc123 not found');
				expect(isFatalError(error)).toBe(true);
			});

			it('should classify "not found" message as fatal', () => {
				expect(isFatalError('Job not found in database')).toBe(true);
			});

			it('should classify 400 Bad Request as fatal', () => {
				const error = new Error('API error: Bad Request - invalid data');
				expect(isFatalError(error)).toBe(true);
			});

			it('should classify 422 Unprocessable Entity as fatal', () => {
				const error = new Error('Unprocessable Entity: validation error');
				expect(isFatalError(error)).toBe(true);
			});

			it('should classify validation errors as fatal', () => {
				expect(isFatalError('Validation failed: missing required field')).toBe(true);
			});

			it('should classify invalid page size as fatal', () => {
				expect(isFatalError('Invalid page size: FOO')).toBe(true);
			});

			it('should classify invalid dimensions as fatal', () => {
				expect(isFatalError('Invalid dimensions: -1x20')).toBe(true);
			});

			it('should classify missing print spec as fatal', () => {
				const error = new Error('No print specification found for 999×999 inches');
				expect(isFatalError(error)).toBe(true);
			});
		});

		describe('Retryable errors (should retry)', () => {
			it('should classify 500 Internal Server Error as retryable', () => {
				const error = new Error('Internal Server Error');
				expect(isFatalError(error)).toBe(false);
			});

			it('should classify 503 Service Unavailable as retryable', () => {
				const error = new Error('Service Unavailable');
				expect(isFatalError(error)).toBe(false);
			});

			it('should classify network errors as retryable', () => {
				expect(isFatalError('Network request failed')).toBe(false);
				expect(isFatalError('ECONNREFUSED')).toBe(false);
				expect(isFatalError('ETIMEDOUT')).toBe(false);
			});

			it('should classify database errors as retryable', () => {
				expect(isFatalError('Database connection lost')).toBe(false);
				expect(isFatalError('Connection pool exhausted')).toBe(false);
			});

			it('should classify Puppeteer timeouts as retryable', () => {
				expect(isFatalError('Timeout waiting for page load')).toBe(false);
				expect(isFatalError('Navigation timeout exceeded')).toBe(false);
			});

			it('should classify unknown errors as retryable (safe default)', () => {
				expect(isFatalError('Something went wrong')).toBe(false);
				expect(isFatalError(new Error('Unknown error'))).toBe(false);
			});
		});
	});

	describe('shouldRetryJob', () => {
		it('should not retry fatal errors regardless of attempt count', () => {
			const error = new Error('Print job not found');

			expect(shouldRetryJob(error, 0, 3)).toBe(false);
			expect(shouldRetryJob(error, 1, 3)).toBe(false);
			expect(shouldRetryJob(error, 2, 3)).toBe(false);
		});

		it('should retry retryable errors within attempt limit', () => {
			const error = new Error('Service Unavailable');

			expect(shouldRetryJob(error, 0, 3)).toBe(true);
			expect(shouldRetryJob(error, 1, 3)).toBe(true);
			expect(shouldRetryJob(error, 2, 3)).toBe(true);
		});

		it('should not retry after max attempts reached', () => {
			const error = new Error('Service Unavailable');

			expect(shouldRetryJob(error, 3, 3)).toBe(false);
			expect(shouldRetryJob(error, 4, 3)).toBe(false);
		});

		it('should handle attempt count 0 (first attempt)', () => {
			const retryableError = new Error('Network error');
			const fatalError = new Error('Invalid page size');

			expect(shouldRetryJob(retryableError, 0, 3)).toBe(true);
			expect(shouldRetryJob(fatalError, 0, 3)).toBe(false);
		});
	});

	describe('Error classification edge cases', () => {
		it('should handle case-insensitive matching', () => {
			expect(isFatalError('Job NOT FOUND')).toBe(true);
			expect(isFatalError('job not found')).toBe(true);
			expect(isFatalError('VALIDATION FAILED')).toBe(true);
		});

		it('should handle errors within larger messages', () => {
			const error = new Error(
				'Failed to process job: Print job abc-123 not found in database. Please check if job exists.'
			);
			expect(isFatalError(error)).toBe(true);
		});

		it('should handle Error objects vs string messages', () => {
			const errorObj = new Error('Validation failed');
			const errorStr = 'Validation failed';

			expect(isFatalError(errorObj)).toBe(isFatalError(errorStr));
		});
	});
});

describe('Structured Logging', () => {

	describe('createSuccessLog', () => {
		it('should create valid success log object', () => {
			const context: JobContext = {
				printJobId: 'job-123',
				printableMapId: 'map-456',
				attemptNumber: 0,
				maxAttempts: 3,
				queuedAt: '2025-12-07T10:00:00Z',
				startedAt: '2025-12-07T10:01:00Z'
			};

			const result = {
				durationMs: 5000,
				filePath: '/exports/job-123.png',
				fileSizeMB: '0.42'
			};

			const log = createSuccessLog(context, result);

			expect(log.status).toBe('success');
			expect(log.printJobId).toBe('job-123');
			expect(log.durationMs).toBe(5000);
			expect(log.filePath).toBe('/exports/job-123.png');
		});

		it('should be JSON serializable', () => {
			const context: JobContext = {
				printJobId: 'job-123',
				printableMapId: 'map-456',
				attemptNumber: 0,
				maxAttempts: 3,
				queuedAt: '2025-12-07T10:00:00Z',
				startedAt: '2025-12-07T10:01:00Z'
			};

			const log = createSuccessLog(context, {
				durationMs: 5000,
				filePath: '/exports/job-123.png',
				fileSizeMB: '0.42'
			});

			const json = JSON.stringify(log);
			const parsed = JSON.parse(json);

			expect(parsed.status).toBe('success');
			expect(parsed.printJobId).toBe('job-123');
		});
	});

	describe('createFailureLog', () => {
		const context: JobContext = {
			printJobId: 'job-123',
			printableMapId: 'map-456',
			attemptNumber: 1,
			maxAttempts: 3,
			queuedAt: '2025-12-07T10:00:00Z',
			startedAt: '2025-12-07T10:01:00Z'
		};

		it('should create failure log for fatal error', () => {
			const error = new Error('Print job not found');
			const log = createFailureLog(context, error, 1000);

			expect(log.status).toBe('failed');
			expect(log.error).toBe('Print job not found');
			expect(log.isFatal).toBe(true);
			expect(log.willRetry).toBe(false);
			expect(log.durationMs).toBe(1000);
		});

		it('should create failure log for retryable error', () => {
			const error = new Error('Service Unavailable');
			const log = createFailureLog(context, error, 2000);

			expect(log.status).toBe('failed');
			expect(log.error).toBe('Service Unavailable');
			expect(log.isFatal).toBe(false);
			expect(log.willRetry).toBe(true);
		});

		it('should handle string errors', () => {
			const log = createFailureLog(context, 'Network timeout', 3000);

			expect(log.error).toBe('Network timeout');
			expect(log.isFatal).toBe(false);
			expect(log.willRetry).toBe(true);
		});

		it('should mark as not retryable when max attempts reached', () => {
			const contextMaxed = { ...context, attemptNumber: 3 }; // Exceeded max
			const error = new Error('Service Unavailable');
			const log = createFailureLog(contextMaxed, error, 1000);

			expect(log.isFatal).toBe(false); // Not fatal error type
			expect(log.willRetry).toBe(false); // But won't retry (max reached)
		});
	});
});
