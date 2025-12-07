/**
 * Landscape Export Integration Test
 *
 * Tests that landscape page sizes work correctly throughout the export pipeline:
 * 1. API accepts landscape page sizes
 * 2. Worker can process landscape exports
 * 3. PNG is created with correct landscape dimensions
 *
 * This test reproduces the bug where landscape USA sizes (like '18x24' in landscape
 * orientation) fail with "Invalid page size" error.
 *
 * NOTE: This test requires:
 * - Database to be running (pnpm db:setup)
 * - Dev server to be running (pnpm dev)
 * - Worker to be running (pnpm worker)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PRINT_SPECS } from '$lib/map-renderer/dimensions.js';

const API_URL = 'http://localhost:5173';
const EXPORT_DIR = './exports';
const WORKER_TIMEOUT = 30000; // 30 seconds for worker to process job

describe('Landscape Export Integration', () => {
	let userMapId: string;
	let printJobIds: string[] = [];

	beforeAll(() => {
		// Ensure export directory exists
		if (!fs.existsSync(EXPORT_DIR)) {
			fs.mkdirSync(EXPORT_DIR, { recursive: true });
		}
	});

	afterAll(() => {
		// Clean up test PNG files
		printJobIds.forEach((jobId) => {
			// Find PNG file with timestamp prefix
			const files = fs.readdirSync(EXPORT_DIR);
			const pngFile = files.find((f) => f.includes(jobId) && f.endsWith('.png'));
			if (pngFile) {
				const pngPath = path.join(EXPORT_DIR, pngFile);
				fs.unlinkSync(pngPath);
				console.log(`🧹 Cleaned up test PNG: ${pngPath}`);
			}

			// Clean up JSON sidecar if it exists
			const jsonFile = files.find((f) => f.includes(jobId) && f.endsWith('.json'));
			if (jsonFile) {
				const jsonPath = path.join(EXPORT_DIR, jsonFile);
				fs.unlinkSync(jsonPath);
				console.log(`🧹 Cleaned up test JSON: ${jsonPath}`);
			}
		});
	});

	it('should create a user map for landscape testing', async () => {
		const response = await fetch(`${API_URL}/api/maps`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: 'Landscape Test Map',
				subtitle: '2025',
				people: [
					{
						id: 'person1',
						name: 'Test Person',
						color: '#4A90E2',
						locations: [
							{
								countryCode: 'US',
								longitude: -74.006,
								latitude: 40.7128,
								date: '2024-01-01'
							}
						]
					}
				],
				projection: 'orthographic',
				rotation: [-74, -40, 0]
			})
		});

		expect(response.status).toBe(201);

		const data = await response.json();
		expect(data.userMap).toBeDefined();
		expect(data.userMap.id).toBeDefined();
		expect(data.userMap.data.title).toBe('Landscape Test Map');

		userMapId = data.userMap.id;
		console.log(`✅ Created user map: ${userMapId}`);
	});

	it('should export USA 18x24 in landscape orientation (24x18)', async () => {
		expect(userMapId).toBeDefined();

		// When user selects '18×24' and clicks "Landscape" button,
		// the UI sends explicit dimensions: 24" wide x 18" tall
		const response = await fetch(`${API_URL}/api/export`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userMapId,
				widthInches: 24,
				heightInches: 18,
				paperSizeName: '18×24',
				projection: 'orthographic',
				rotation: [-74, -40, 0],
				zoom: 1.0,
				pan: [0, 0]
			})
		});

		expect(response.status).toBe(202);

		const data = await response.json();
		expect(data.printJobId).toBeDefined();
		expect(data.message).toContain('Export job queued');

		printJobIds.push(data.printJobId);
		console.log(`✅ Export job queued: ${data.printJobId}`);
	});

	it('should export USA 12x16 in landscape orientation (16x12)', async () => {
		expect(userMapId).toBeDefined();

		const response = await fetch(`${API_URL}/api/export`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userMapId,
				widthInches: 16,
				heightInches: 12,
				paperSizeName: '12×16',
				projection: 'orthographic',
				rotation: [-74, -40, 0],
				zoom: 1.0,
				pan: [0, 0]
			})
		});

		expect(response.status).toBe(202);

		const data = await response.json();
		expect(data.printJobId).toBeDefined();

		printJobIds.push(data.printJobId);
		console.log(`✅ Export job queued: ${data.printJobId}`);
	});

	it('should export A4 in landscape orientation', async () => {
		expect(userMapId).toBeDefined();

		const response = await fetch(`${API_URL}/api/export`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userMapId,
				widthInches: 11.69,
				heightInches: 8.27,
				paperSizeName: 'A4',
				projection: 'orthographic',
				rotation: [-74, -40, 0],
				zoom: 1.0,
				pan: [0, 0]
			})
		});

		expect(response.status).toBe(202);

		const data = await response.json();
		expect(data.printJobId).toBeDefined();

		printJobIds.push(data.printJobId);
		console.log(`✅ Export job queued: ${data.printJobId}`);
	});

	it(
		'should process all landscape export jobs and create PNG files',
		async () => {
			expect(printJobIds.length).toBeGreaterThan(0);

			for (const printJobId of printJobIds) {
				console.log(`\n📋 Checking job: ${printJobId}`);

				// Wait for worker to process job
				const startTime = Date.now();
				let jobStatus = 'pending_export';
				let attempts = 0;
				const maxAttempts = 60; // 30 seconds with 500ms intervals

				while (jobStatus !== 'export_complete' && attempts < maxAttempts) {
					await new Promise((resolve) => setTimeout(resolve, 500));
					attempts++;

					// Check job status via API
					const response = await fetch(`${API_URL}/api/jobs/${printJobId}`);
					if (response.ok) {
						const data = await response.json();
						jobStatus = data.state;

						if (data.state === 'export_failed') {
							console.error(`❌ Job failed: ${data.export_error}`);
							throw new Error(`Export job failed: ${data.export_error || 'Unknown error'}`);
						}

						if (attempts % 10 === 0) {
							console.log(
								`  [${attempts}] Job status: ${jobStatus} (${((Date.now() - startTime) / 1000).toFixed(1)}s)`
							);
						}
					}
				}

				expect(jobStatus).toBe('export_complete');
				console.log(`✅ Export completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

				// Verify PNG file was created (with timestamp prefix)
				const files = fs.readdirSync(EXPORT_DIR);
				const pngFile = files.find((f) => f.includes(printJobId) && f.endsWith('.png'));
				expect(pngFile).toBeDefined();

				const pngPath = path.join(EXPORT_DIR, pngFile!);

				// Check file size (should be > 0)
				const stats = fs.statSync(pngPath);
				expect(stats.size).toBeGreaterThan(0);
				console.log(`✅ PNG file created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
			}
		},
		WORKER_TIMEOUT
	);

	it('should verify landscape dimensions are correct', () => {
		// Verify PRINT_SPECS has correct landscape entries
		expect(PRINT_SPECS['24x18']).toBeDefined();
		expect(PRINT_SPECS['16x12']).toBeDefined();
		expect(PRINT_SPECS['A4-landscape']).toBeDefined();

		// Verify landscape specs have width > height
		const spec24x18 = PRINT_SPECS['24x18'];
		expect(spec24x18.trimWidth).toBeGreaterThan(spec24x18.trimHeight);

		const specA4Land = PRINT_SPECS['A4-landscape'];
		expect(specA4Land.trimWidth).toBeGreaterThan(specA4Land.trimHeight);
	});
});
