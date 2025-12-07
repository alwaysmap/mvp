#!/usr/bin/env node
/**
 * Test database setup
 *
 * Verifies database connection and runs migrations.
 * Run this before running database tests.
 */

import { pool, query } from '../src/lib/db/client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupTestDatabase() {
	console.log('🔍 Testing database connection...');

	try {
		// Test connection
		const result = await query('SELECT NOW()');
		console.log('✅ Database connected:', result.rows[0].now);

		// Check if tables exist
		const tablesResult = await query(`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public'
			ORDER BY table_name
		`);

		if (tablesResult.rows.length === 0) {
			console.log('📋 No tables found. Running migrations...');

			// Read migration file
			const migrationPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
			const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

			// Run migration
			await query(migrationSQL);

			console.log('✅ Migrations completed');
		} else {
			console.log('✅ Tables exist:', tablesResult.rows.map(r => r.table_name).join(', '));
		}

		// Verify tables
		const userMapsCount = await query('SELECT COUNT(*) FROM user_maps');
		const printableMapsCount = await query('SELECT COUNT(*) FROM printable_maps');

		console.log(`📊 user_maps: ${userMapsCount.rows[0].count} records`);
		console.log(`📊 printable_maps: ${printableMapsCount.rows[0].count} records`);

		console.log('✅ Database setup complete');
	} catch (error) {
		console.error('❌ Database setup failed:', error);
		throw error;
	} finally {
		await pool.end();
	}
}

setupTestDatabase();
