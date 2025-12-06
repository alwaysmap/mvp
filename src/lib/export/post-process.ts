/**
 * Post-processing for exported PNGs.
 * Handles ICC profile embedding and image optimization.
 */

import sharp from 'sharp';

/**
 * Embeds sRGB ICC profile into a PNG buffer.
 *
 * This is critical for print quality because:
 * 1. Printful requires sRGB color space for accurate color reproduction
 * 2. ICC profiles ensure consistent color across devices and printers
 * 3. Without a profile, colors may shift during print processing
 *
 * @param pngBuffer - PNG buffer from Puppeteer screenshot
 * @returns PNG buffer with embedded sRGB ICC profile
 */
export async function embedSRGBProfile(pngBuffer: Buffer): Promise<Buffer> {
	console.log('🎨 Embedding sRGB ICC profile...');

	// Use Sharp's built-in sRGB profile
	// Sharp includes srgb, p3, and cmyk profiles built-in
	// See: https://sharp.pixelplumbing.com/api-output#withiccprofile
	const processed = await sharp(pngBuffer)
		.withIccProfile('srgb') // Use built-in sRGB profile
		.png({
			compressionLevel: 9, // Maximum compression (slower but smaller file)
			quality: 100 // Maximum quality
		})
		.toBuffer();

	console.log('✓ sRGB profile embedded');
	console.log('   Output size:', Buffer.byteLength(processed), 'bytes');

	return processed;
}

/**
 * Gets metadata from a PNG buffer.
 * Useful for validation and debugging.
 *
 * @param pngBuffer - PNG buffer to inspect
 * @returns Sharp metadata object
 */
export async function getPNGMetadata(pngBuffer: Buffer): Promise<sharp.Metadata> {
	return await sharp(pngBuffer).metadata();
}

/**
 * Verifies that a PNG buffer has an embedded ICC profile.
 *
 * @param pngBuffer - PNG buffer to check
 * @returns true if ICC profile is present
 */
export async function hasICCProfile(pngBuffer: Buffer): Promise<boolean> {
	const metadata = await getPNGMetadata(pngBuffer);
	return metadata.icc !== undefined;
}

/**
 * Verifies that a PNG buffer is in sRGB color space.
 *
 * @param pngBuffer - PNG buffer to check
 * @returns true if color space is sRGB
 */
export async function isSRGB(pngBuffer: Buffer): Promise<boolean> {
	const metadata = await getPNGMetadata(pngBuffer);
	return metadata.space === 'srgb';
}
