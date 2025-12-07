/**
 * Puppeteer-based export for generating print-ready PNG screenshots.
 * This module handles headless Chrome rendering to produce pixel-perfect output.
 */

import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import type { MapDefinition, PrintSpec } from '$lib/map-renderer/types.js';
import { calculateDimensions } from '$lib/map-renderer/dimensions.js';

export interface ExportOptions {
	/** Base URL for the render route (e.g., http://localhost:5173) */
	baseUrl?: string;
	/** Timeout in milliseconds for page load and rendering */
	timeout?: number;
	/** Whether to keep browser open for debugging */
	keepBrowserOpen?: boolean;
}

/**
 * Exports a map definition to a PNG buffer using Puppeteer.
 *
 * This function:
 * 1. Launches headless Chrome with font rendering optimizations
 * 2. Navigates to the /render route with encoded map definition
 * 3. Waits for fonts to load and rendering to complete
 * 4. Verifies fonts are available
 * 5. Takes a full-page screenshot as PNG
 *
 * @param definition - Map definition to render
 * @param printSpec - Print specifications (size, DPI, bleed)
 * @param options - Export options (base URL, timeout, etc.)
 * @returns PNG buffer
 */
export async function exportMapToPNG(
	definition: MapDefinition,
	printSpec: PrintSpec,
	options: ExportOptions = {}
): Promise<Buffer> {
	const {
		baseUrl = 'http://localhost:5173',
		timeout = 300000, // 5 minutes
		keepBrowserOpen = false
	} = options;

	let browser: Browser | null = null;
	let page: Page | null = null;

	try {
		// Calculate dimensions for viewport
		const dimensions = calculateDimensions(printSpec);

		console.log('🚀 Launching Puppeteer...');
		console.log('   Dimensions:', `${dimensions.pixelWidth}x${dimensions.pixelHeight}px`);
		console.log('   DPI:', printSpec.dpi);

		// Launch browser with optimized settings
		browser = await puppeteer.launch({
			headless: true,
			args: [
				'--font-render-hinting=none', // Disable font hinting for print quality
				'--force-color-profile=srgb', // Force sRGB color profile
				'--disable-dev-shm-usage', // Prevent shared memory issues in Docker
				'--no-sandbox', // Required for Docker environments
				'--disable-setuid-sandbox'
			],
			// In production/Docker, Chrome will be at /usr/bin/chromium
			// In development, Puppeteer uses bundled Chrome
			...(process.env.PUPPETEER_EXECUTABLE_PATH && {
				executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
			})
		});

		page = await browser.newPage();

		// Set viewport to exact pixel dimensions
		await page.setViewport({
			width: dimensions.pixelWidth,
			height: dimensions.pixelHeight,
			deviceScaleFactor: 1 // 1:1 pixel mapping
		});

		// Encode map definition as base64url for URL parameter
		const jsonString = JSON.stringify(definition);
		const base64Data = Buffer.from(jsonString).toString('base64url');

		const renderUrl = `${baseUrl}/render?data=${base64Data}`;

		console.log('📄 Loading render page...');

		// Navigate to render page
		await page.goto(renderUrl, {
			waitUntil: 'networkidle0', // Wait until network is idle
			timeout
		});

		console.log('⏳ Waiting for render completion...');

		// Wait for render to complete or error
		await page.waitForFunction(
			() => (window as any).__RENDER_READY__ || (window as any).__RENDER_ERROR__,
			{ timeout }
		);

		// Check for errors
		const renderError = await page.evaluate(() => (window as any).__RENDER_ERROR__);
		if (renderError) {
			throw new Error(`Render failed: ${renderError}`);
		}

		console.log('✓ Render complete');

		// Extra wait for final paint and font settling
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Verify fonts are loaded
		console.log('🔤 Verifying fonts...');
		const fontsOk = await page.evaluate(() => {
			const requiredFonts = [
				{ family: 'Cormorant Garamond', weight: 400, style: 'normal' },
				{ family: 'Cormorant Garamond', weight: 600, style: 'normal' },
				{ family: 'Cormorant Garamond', weight: 700, style: 'normal' },
				{ family: 'DM Sans', weight: 400, style: 'normal' }
			];

			return requiredFonts.every((font) => {
				const fontString = `${font.style} ${font.weight} 16px "${font.family}"`;
				return document.fonts.check(fontString);
			});
		});

		if (!fontsOk) {
			throw new Error('Font verification failed - required fonts not loaded');
		}

		console.log('✓ Fonts verified');

		// Take screenshot
		console.log('📸 Taking screenshot...');
		const screenshot = await page.screenshot({
			type: 'png',
			fullPage: true,
			omitBackground: false // Include background color
		});

		console.log(
			'✓ Screenshot captured:',
			Buffer.byteLength(screenshot as Buffer),
			'bytes'
		);

		return screenshot as Buffer;
	} catch (error) {
		console.error('✗ Export failed:', error);
		throw error;
	} finally {
		// Clean up
		if (page && !keepBrowserOpen) {
			await page.close();
		}
		if (browser && !keepBrowserOpen) {
			await browser.close();
			console.log('🔒 Browser closed');
		}
	}
}
