#!/usr/bin/env node
/**
 * CLI tool for exporting maps to PNG.
 *
 * Usage:
 *   pnpm export <input.json> <output.png>
 *   pnpm export --sample output.png
 *
 * The input JSON file should contain a MapDefinition.
 * This script automatically starts and stops the Vite dev server.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { exportMapToPNG } from '../src/lib/export/puppeteer.js';
import { embedSRGBProfile } from '../src/lib/export/post-process.js';
import { validatePNG, validateMapDefinition } from '../src/lib/export/validate.js';
import { PRINT_SPECS } from '../src/lib/map-renderer/dimensions.js';
import type { MapDefinition } from '../src/lib/map-renderer/types.js';

/**
 * Waits for the HTTP server to be ready by attempting to connect.
 */
async function waitForServer(url: string, maxAttempts = 30): Promise<void> {
	const parsedUrl = new URL(url);

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			await new Promise<void>((resolve, reject) => {
				const req = http.get(url, (res) => {
					resolve();
					res.resume(); // Consume response to free up socket
				});

				req.on('error', reject);
				req.setTimeout(1000, () => {
					req.destroy();
					reject(new Error('Timeout'));
				});
			});

			return; // Server is ready
		} catch (error) {
			// Server not ready yet
			if (attempt === maxAttempts) {
				throw new Error(`Server did not start after ${maxAttempts} attempts`);
			}

			// Wait before next attempt
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
	}
}

/**
 * Starts a Vite dev server programmatically.
 * Returns the server instance and URL.
 */
async function startServer(): Promise<{ server: ViteDevServer; url: string }> {
	console.log('🚀 Starting Vite dev server...');

	// Create dev server
	const server = await createServer({
		server: {
			port: 5173,
			strictPort: false, // Allow different port if 5173 is taken
			host: 'localhost'
		},
		logLevel: 'error' // Suppress verbose output
	});

	// Start listening
	await server.listen();

	// Get the actual URL
	const url = `http://localhost:${server.config.server.port}`;

	// Wait for server to be actually ready
	console.log(`⏳ Waiting for server at ${url}...`);
	await waitForServer(url);

	console.log(`✓ Server ready at ${url}`);

	return { server, url };
}

/**
 * Stops the Vite dev server.
 */
async function stopServer(server: ViteDevServer): Promise<void> {
	console.log('🔒 Shutting down server...');
	await server.close();
	console.log('✓ Server stopped');
}

// Sample map definition
const SAMPLE_MAP: MapDefinition = {
	title: 'Our Family Journey',
	subtitle: '2010-2024',
	people: [
		{
			id: 'alice',
			name: 'Alice',
			color: '#FF6B6B',
			locations: [
				{
					countryCode: 'US',
					longitude: -74.006,
					latitude: 40.7128,
					date: '2010-01-01'
				},
				{
					countryCode: 'GB',
					longitude: -0.1276,
					latitude: 51.5074,
					date: '2015-06-15'
				},
				{
					countryCode: 'JP',
					longitude: 139.6917,
					latitude: 35.6895,
					date: '2020-03-20'
				}
			]
		},
		{
			id: 'bob',
			name: 'Bob',
			color: '#4ECDC4',
			locations: [
				{
					countryCode: 'CA',
					longitude: -79.3832,
					latitude: 43.6532,
					date: '2012-05-10'
				},
				{
					countryCode: 'FR',
					longitude: 2.3522,
					latitude: 48.8566,
					date: '2016-08-22'
				},
				{
					countryCode: 'AU',
					longitude: 151.2093,
					latitude: -33.8688,
					date: '2021-11-15'
				}
			]
		}
	],
	rotation: [-20, -30, 0]
};

async function main() {
	const args = process.argv.slice(2);

	// Show help
	if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
		console.log(`
AlwaysMap Export Tool

Usage:
  pnpm export <input.json> <output.png> [--size 18x24]
  pnpm export --sample <output.png> [--size 18x24]

Arguments:
  input.json    Path to JSON file containing MapDefinition
  output.png    Path where PNG file will be saved
  --sample      Use built-in sample map instead of reading input file
  --size        Print size: 12x16, 18x24, 24x36 (default: 18x24)

Examples:
  pnpm export data/my-map.json output/map.png
  pnpm export --sample test.png
  pnpm export --sample test.png --size 24x36

Note: The dev server must be running (pnpm dev) for export to work.
		`);
		process.exit(0);
	}

	let mapDefinition: MapDefinition;
	let outputPath: string;
	let printSize = '18x24';

	// Parse arguments
	const useSample = args.includes('--sample');
	const sizeIndex = args.indexOf('--size');

	if (sizeIndex !== -1 && args[sizeIndex + 1]) {
		printSize = args[sizeIndex + 1];
	}

	if (useSample) {
		// Use sample map
		mapDefinition = SAMPLE_MAP;
		outputPath = args.find((arg) => !arg.startsWith('--') && arg !== args[sizeIndex + 1]) || 'output.png';
		console.log('📋 Using sample map definition');
	} else {
		// Read from file
		const inputPath = args[0];
		outputPath = args[1];

		if (!inputPath || !outputPath) {
			console.error('❌ Error: Missing arguments');
			console.error('Usage: pnpm export <input.json> <output.png>');
			process.exit(1);
		}

		if (!fs.existsSync(inputPath)) {
			console.error(`❌ Error: Input file not found: ${inputPath}`);
			process.exit(1);
		}

		console.log(`📄 Reading map definition from: ${inputPath}`);

		try {
			const fileContent = fs.readFileSync(inputPath, 'utf-8');
			mapDefinition = JSON.parse(fileContent);
		} catch (error) {
			console.error('❌ Error: Failed to parse JSON file');
			console.error(error instanceof Error ? error.message : error);
			process.exit(1);
		}
	}

	// Validate print size
	const printSpec = PRINT_SPECS[printSize as keyof typeof PRINT_SPECS];
	if (!printSpec) {
		console.error(`❌ Error: Invalid print size: ${printSize}`);
		console.error(`Valid sizes: ${Object.keys(PRINT_SPECS).join(', ')}`);
		process.exit(1);
	}

	console.log(`📐 Print size: ${printSize}`);
	console.log(`   Dimensions: ${printSpec.trimWidth}×${printSpec.trimHeight}pt`);
	console.log(`   Pixels: ${Math.round((printSpec.trimWidth + 2 * printSpec.bleed) * printSpec.dpi / 72)}×${Math.round((printSpec.trimHeight + 2 * printSpec.bleed) * printSpec.dpi / 72)}px`);

	// Validate map definition
	console.log('🔍 Validating map definition...');
	const validation = validateMapDefinition(mapDefinition);

	if (!validation.valid) {
		console.error('❌ Validation failed:');
		validation.errors.forEach((error) => console.error(`   - ${error}`));
		process.exit(1);
	}

	if (validation.warnings.length > 0) {
		console.warn('⚠️  Warnings:');
		validation.warnings.forEach((warning) => console.warn(`   - ${warning}`));
	}

	console.log('✓ Map definition valid');

	// Start server and export
	console.log('');
	let server: ViteDevServer | null = null;

	try {
		const startTime = Date.now();

		// Step 1: Start server
		const serverInfo = await startServer();
		server = serverInfo.server;

		// Step 2: Render via Puppeteer
		console.log('');
		console.log('🎭 Starting export...');
		const screenshot = await exportMapToPNG(mapDefinition, printSpec, {
			baseUrl: serverInfo.url,
			timeout: 300000
		});

		// Step 3: Embed sRGB profile
		const processed = await embedSRGBProfile(screenshot);

		// Step 4: Validate output
		const pngValidation = await validatePNG(processed, printSpec);

		if (!pngValidation.valid) {
			console.error('❌ PNG validation failed:');
			pngValidation.errors.forEach((error) => console.error(`   - ${error}`));
			process.exit(1);
		}

		if (pngValidation.warnings.length > 0) {
			console.warn('⚠️  PNG warnings:');
			pngValidation.warnings.forEach((warning) => console.warn(`   - ${warning}`));
		}

		// Step 5: Write to file
		const outputDir = path.dirname(outputPath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		fs.writeFileSync(outputPath, processed);

		const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
		const fileSizeMB = (Buffer.byteLength(processed) / 1024 / 1024).toFixed(2);

		console.log('');
		console.log('✅ Export successful!');
		console.log(`   Output: ${path.resolve(outputPath)}`);
		console.log(`   Size: ${fileSizeMB} MB`);
		console.log(`   Time: ${elapsed}s`);

		if (pngValidation.metadata) {
			console.log('');
			console.log('📊 Metadata:');
			console.log(`   Format: ${pngValidation.metadata.format}`);
			console.log(`   Dimensions: ${pngValidation.metadata.width}×${pngValidation.metadata.height}px`);
			console.log(`   Color space: ${pngValidation.metadata.space}`);
			console.log(`   Bit depth: ${pngValidation.metadata.depth}`);
			console.log(`   Channels: ${pngValidation.metadata.channels}`);
			console.log(`   ICC profile: ${pngValidation.metadata.icc ? 'embedded' : 'missing'}`);
		}
	} catch (error) {
		console.error('');
		console.error('❌ Export failed:');
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	} finally {
		// Always stop the server
		if (server) {
			await stopServer(server);
		}
	}
}

main();
