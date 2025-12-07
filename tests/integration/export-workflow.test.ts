/**
 * End-to-End Export Workflow Integration Test
 *
 * Tests the complete workflow:
 * 1. Create user map via POST /api/maps
 * 2. Trigger export via POST /api/export
 * 3. Verify job was queued
 * 4. Wait for worker to process job
 * 5. Verify PNG was created
 *
 * NOTE: This test requires:
 * - Database to be running (pnpm db:setup)
 * - Dev server to be running (pnpm dev)
 * - Worker to be running (pnpm worker)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:5173';
const EXPORT_DIR = './exports';
const WORKER_TIMEOUT = 30000; // 30 seconds for worker to process job

describe('Export Workflow Integration', () => {
	let userMapId: string;
	let printJobId: string;

	beforeAll(() => {
		// Ensure export directory exists
		if (!fs.existsSync(EXPORT_DIR)) {
			fs.mkdirSync(EXPORT_DIR, { recursive: true });
		}
	});

	it('should create a user map', async () => {
		const response = await fetch(`${API_URL}/api/maps`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: 'Integration Test Map',
				subtitle: '2024-2025',
				people: [
					{
						id: 'person1',
						name: 'Test Person',
						color: '#FF6B6B',
						locations: [
							{
								countryCode: 'US',
								longitude: -74.006,
								latitude: 40.7128,
								date: '2024-01-01'
							},
							{
								countryCode: 'GB',
								longitude: -0.1276,
								latitude: 51.5074,
								date: '2024-06-15'
							}
						]
					}
				],
				projection: 'orthographic',
				rotation: [-20, -30, 0]
			})
		});

		expect(response.status).toBe(201);

		const data = await response.json();
		expect(data.userMap).toBeDefined();
		expect(data.userMap.id).toBeDefined();
		expect(data.userMap.data.title).toBe('Integration Test Map');

		userMapId = data.userMap.id;
		console.log(`✅ Created user map: ${userMapId}`);
	});

	it('should trigger export and create print job', async () => {
		expect(userMapId).toBeDefined();

		const response = await fetch(`${API_URL}/api/export`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userMapId,
				widthInches: 18,
				heightInches: 24,
				paperSizeName: '18×24',
				projection: 'orthographic',
				rotation: [-20, -30, 0],
				zoom: 1.0,
				pan: [0, 0]
			})
		});

		expect(response.status).toBe(202);

		const data = await response.json();
		expect(data.printJobId).toBeDefined();
		expect(data.printableMap).toBeDefined();
		expect(data.message).toContain('Export job queued');

		printJobId = data.printJobId;
		console.log(`✅ Export job queued: ${printJobId}`);
	});

	it(
		'should process export job and create PNG file',
		async () => {
			expect(printJobId).toBeDefined();

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
						throw new Error(`Export job failed: ${data.export_error || 'Unknown error'}`);
					}

					console.log(
						`  [${attempts}] Job status: ${jobStatus} (${((Date.now() - startTime) / 1000).toFixed(1)}s)`
					);
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
		},
		WORKER_TIMEOUT
	);

	afterAll(() => {
		// Clean up test PNG file
		if (printJobId) {
			const pngPath = path.join(EXPORT_DIR, `${printJobId}.png`);
			if (fs.existsSync(pngPath)) {
				fs.unlinkSync(pngPath);
				console.log(`🧹 Cleaned up test PNG: ${pngPath}`);
			}
		}
	});
});
