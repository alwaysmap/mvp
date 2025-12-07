#!/usr/bin/env node
/**
 * Database teardown script
 *
 * Drops all tables in reverse migration order.
 * This ensures clean teardown respecting foreign key dependencies.
 */

import { pool, query } from '../src/lib/db/client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function teardownDatabase() {
	console.log('🧹 Tearing down database...');

	try {
		// Get all migrations in reverse order
		const migrationsDir = path.join(__dirname, '../migrations');
		const migrationFiles = fs
			.readdirSync(migrationsDir)
			.filter((f) => f.endsWith('.sql'))
			.sort()
			.reverse(); // Reverse order for teardown

		console.log(`📋 Found ${migrationFiles.length} migrations to reverse`);

		// Check which tables exist
		const tablesResult = await query(`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public'
			ORDER BY table_name
		`);

		if (tablesResult.rows.length === 0) {
			console.log('✅ No tables found - database already clean');
			return;
		}

		console.log(`📊 Current tables: ${tablesResult.rows.map((r) => r.table_name).join(', ')}`);

		// Drop tables in dependency order (reverse of creation)
		// This matches the reverse order of migrations
		const tableNames = tablesResult.rows.map((r) => r.table_name);

		// Drop pg-boss tables first (if they exist)
		const pgBossTables = tableNames.filter((name) => name.startsWith('pgboss'));
		if (pgBossTables.length > 0) {
			console.log('🔄 Dropping pg-boss tables...');
			for (const tableName of pgBossTables) {
				await query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
				console.log(`  ✓ Dropped ${tableName}`);
			}
		}

		// Drop application tables in reverse dependency order
		const dropOrder = [
			'print_job_events', // Most dependent
			'print_jobs',
			'printable_maps',
			'user_maps' // Least dependent
		];

		console.log('🗑️  Dropping application tables...');
		for (const tableName of dropOrder) {
			if (tableNames.includes(tableName)) {
				await query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
				console.log(`  ✓ Dropped ${tableName}`);
			}
		}

		// Verify all tables are gone
		const remainingTables = await query(`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public'
			ORDER BY table_name
		`);

		if (remainingTables.rows.length === 0) {
			console.log('✅ Database teardown complete - all tables dropped');
		} else {
			console.log(
				`⚠️  Warning: Some tables remain: ${remainingTables.rows.map((r) => r.table_name).join(', ')}`
			);
		}
	} catch (error) {
		console.error('❌ Database teardown failed:', error);
		throw error;
	} finally {
		await pool.end();
	}
}

teardownDatabase();
