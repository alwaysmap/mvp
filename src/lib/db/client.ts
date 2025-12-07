/**
 * PostgreSQL database client
 *
 * Provides connection pooling and query execution.
 * Uses environment variables for configuration.
 */

import { Pool } from 'pg';
import { dev } from '$app/environment';

// Database configuration from environment
const config = {
	host: process.env.DATABASE_HOST || 'localhost',
	port: parseInt(process.env.DATABASE_PORT || '5432'),
	database: process.env.DATABASE_NAME || 'alwaysmap',
	user: process.env.DATABASE_USER || 'postgres',
	password: process.env.DATABASE_PASSWORD || 'postgres',
	max: parseInt(process.env.DATABASE_POOL_SIZE || '10'),
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 2000
};

// Create connection pool
export const pool = new Pool(config);

// Log connection info in development
if (dev) {
	console.log(`📊 Database: ${config.user}@${config.host}:${config.port}/${config.database}`);
}

// Handle pool errors
pool.on('error', (err) => {
	console.error('❌ Unexpected database error:', err);
});

/**
 * Execute a query with parameters.
 * Returns rows and metadata.
 */
export async function query<T = any>(text: string, params?: any[]) {
	const start = Date.now();
	const result = await pool.query<T>(text, params);
	const duration = Date.now() - start;

	if (dev) {
		console.log(`🔍 Query executed in ${duration}ms`, { text, rows: result.rowCount });
	}

	return result;
}

/**
 * Close the database connection pool.
 * Call this when shutting down the application.
 */
export async function close() {
	await pool.end();
}
