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

		// Run all migrations in order
		const migrationsDir = path.join(__dirname, '../migrations');
		const migrationFiles = fs
			.readdirSync(migrationsDir)
			.filter(f => f.endsWith('.sql'))
			.sort();

		if (tablesResult.rows.length === 0) {
			console.log('📋 No tables found. Running all migrations...');

			for (const file of migrationFiles) {
				console.log(`  Running ${file}...`);
				const migrationPath = path.join(migrationsDir, file);
				const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
				await query(migrationSQL);
			}

			console.log('✅ Migrations completed');
		} else {
			console.log('✅ Tables exist:', tablesResult.rows.map(r => r.table_name).join(', '));

			// Check if we need to run additional migrations
			const tableNames = tablesResult.rows.map(r => r.table_name);
			const hasPrintJobs = tableNames.includes('print_jobs');

			if (!hasPrintJobs && migrationFiles.includes('002_print_jobs.sql')) {
				console.log('📋 Running new migration: 002_print_jobs.sql...');
				const migrationPath = path.join(migrationsDir, '002_print_jobs.sql');
				const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
				await query(migrationSQL);
				console.log('✅ Migration completed');
			}
		}

		// Verify tables
		const userMapsCount = await query('SELECT COUNT(*) FROM user_maps');
		const printableMapsCount = await query('SELECT COUNT(*) FROM printable_maps');

		// Check if print_jobs table exists
		const printJobsExists = await query(`
			SELECT EXISTS (
				SELECT FROM information_schema.tables
				WHERE table_schema = 'public' AND table_name = 'print_jobs'
			)
		`);

		console.log(`📊 user_maps: ${userMapsCount.rows[0].count} records`);
		console.log(`📊 printable_maps: ${printableMapsCount.rows[0].count} records`);

		if (printJobsExists.rows[0].exists) {
			const printJobsCount = await query('SELECT COUNT(*) FROM print_jobs');
			console.log(`📊 print_jobs: ${printJobsCount.rows[0].count} records`);
		}

		console.log('✅ Database setup complete');
	} catch (error) {
		console.error('❌ Database setup failed:', error);
		throw error;
	} finally {
		await pool.end();
	}
}

setupTestDatabase();
