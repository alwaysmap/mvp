/**
 * Font loading verification for browser and Puppeteer environments.
 * Ensures that all required fonts are loaded before rendering begins.
 */

import type { FontLoadStatus } from './types.js';

/**
 * Required fonts for map rendering.
 * These must match the fonts declared in src/app.css.
 */
export const REQUIRED_FONTS: Array<{ family: string; weight: number; style: string }> = [
	// Cormorant Garamond for titles
	{ family: 'Cormorant Garamond', weight: 400, style: 'normal' }, // Regular
	{ family: 'Cormorant Garamond', weight: 600, style: 'normal' }, // SemiBold
	{ family: 'Cormorant Garamond', weight: 700, style: 'normal' }, // Bold
	{ family: 'Cormorant Garamond', weight: 400, style: 'italic' }, // Italic

	// DM Sans for labels and body text
	{ family: 'DM Sans', weight: 400, style: 'normal' }, // Regular
	{ family: 'DM Sans', weight: 500, style: 'normal' }, // Medium
	{ family: 'DM Sans', weight: 600, style: 'normal' } // SemiBold
];

/**
 * Waits for all required fonts to load in a browser environment.
 *
 * Uses the FontFaceSet API (document.fonts) to verify that fonts are loaded.
 * This is critical for ensuring browser and Puppeteer render identically.
 *
 * @param timeout - Maximum time to wait in milliseconds (default 10000)
 * @returns Promise resolving to array of font load statuses
 * @throws Error if timeout is exceeded before all fonts load
 *
 * @example
 * ```typescript
 * try {
 *   const fonts = await waitForFonts();
 *   console.log('All fonts loaded:', fonts);
 * } catch (error) {
 *   console.error('Font loading failed:', error);
 * }
 * ```
 */
export async function waitForFonts(timeout: number = 10000): Promise<FontLoadStatus[]> {
	// Check if we're in a browser environment
	if (typeof document === 'undefined' || !document.fonts) {
		throw new Error('Font loading is only supported in browser environments');
	}

	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(() => reject(new Error(`Font loading timeout after ${timeout}ms`)), timeout);
	});

	// Explicitly load each font using FontFace API
	const fontLoadPromises = REQUIRED_FONTS.map(async (font) => {
		const fontString = `${font.style} ${font.weight} 16px "${font.family}"`;

		// Try to load the font if it's not already loaded
		if (!document.fonts.check(fontString)) {
			try {
				// Force load by creating a FontFace and adding it
				await document.fonts.load(fontString);
			} catch (error) {
				console.warn(`Failed to explicitly load: ${fontString}`, error);
			}
		}

		return {
			family: font.family,
			weight: font.weight,
			style: font.style,
			loaded: document.fonts.check(fontString)
		};
	});

	// Wait for all fonts to load with timeout
	try {
		const statuses = await Promise.race([
			Promise.all(fontLoadPromises),
			timeoutPromise
		]) as FontLoadStatus[];

		// Check if any fonts failed to load
		const failedFonts = statuses.filter((s) => !s.loaded);
		if (failedFonts.length > 0) {
			const fontList = failedFonts.map((f) => `${f.family} ${f.weight} ${f.style}`).join(', ');
			throw new Error(`Failed to load fonts: ${fontList}`);
		}

		return statuses;
	} catch (error) {
		throw error;
	}
}

/**
 * Verifies fonts are available in a Puppeteer environment.
 *
 * In Puppeteer, we rely on fonts being installed in the system and
 * fc-cache having been run. This function performs the same checks
 * as waitForFonts() but is intended for headless Chrome.
 *
 * @param timeout - Maximum time to wait in milliseconds (default 10000)
 * @returns Promise resolving to array of font load statuses
 */
export async function verifyPuppeteerFonts(timeout: number = 10000): Promise<FontLoadStatus[]> {
	// In Puppeteer, we use the same waitForFonts() logic since it runs in a browser context
	return waitForFonts(timeout);
}

/**
 * Gets the list of all available fonts in the current environment.
 * Useful for debugging font loading issues.
 *
 * @returns Array of available font family names
 */
export function getAvailableFonts(): string[] {
	if (typeof document === 'undefined' || !document.fonts) {
		return [];
	}

	const fonts = new Set<string>();
	for (const font of document.fonts) {
		fonts.add(font.family);
	}

	return Array.from(fonts).sort();
}

/**
 * Creates a visual font test element for debugging.
 * Renders sample text in each required font.
 *
 * @param containerId - DOM element ID to append the test to
 */
export function createFontTest(containerId: string = 'font-test'): void {
	if (typeof document === 'undefined') {
		return;
	}

	const container = document.getElementById(containerId);
	if (!container) {
		console.error(`Container #${containerId} not found`);
		return;
	}

	container.innerHTML = '<h3>Font Loading Test</h3>';

	for (const font of REQUIRED_FONTS) {
		const div = document.createElement('div');
		div.style.fontFamily = `"${font.family}"`;
		div.style.fontWeight = font.weight.toString();
		div.style.fontStyle = font.style;
		div.style.fontSize = '16px';
		div.style.margin = '8px 0';
		div.textContent = `${font.family} ${font.weight} ${font.style} - The quick brown fox jumps over the lazy dog`;

		container.appendChild(div);
	}
}

/**
 * Signal flags for Puppeteer coordination.
 * These are set on window object to communicate with the Puppeteer script.
 */
export function setRenderReady(): void {
	if (typeof window !== 'undefined') {
		(window as any).__RENDER_READY__ = true;
	}
}

export function setRenderError(error: string): void {
	if (typeof window !== 'undefined') {
		(window as any).__RENDER_ERROR__ = error;
	}
}

export function isRenderReady(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	return (window as any).__RENDER_READY__ === true;
}

export function getRenderError(): string | undefined {
	if (typeof window === 'undefined') {
		return undefined;
	}
	return (window as any).__RENDER_ERROR__;
}
