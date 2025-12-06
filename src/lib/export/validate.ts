/**
 * Validation for exported PNG files.
 * Ensures output meets Printful specifications.
 */

import sharp from 'sharp';
import type { MapDefinition, PrintSpec } from '$lib/map-renderer/types.js';
import { calculateDimensions } from '$lib/map-renderer/dimensions.js';

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
	metadata?: sharp.Metadata;
}

/**
 * Validates a PNG buffer against print specifications.
 *
 * Checks:
 * - Exact pixel dimensions match print spec
 * - Format is PNG
 * - Color space is sRGB
 * - ICC profile is embedded
 * - Bit depth is appropriate (8 or 16)
 *
 * @param pngBuffer - PNG buffer to validate
 * @param printSpec - Print specifications to validate against
 * @returns Validation result with errors and warnings
 */
export async function validatePNG(
	pngBuffer: Buffer,
	printSpec: PrintSpec
): Promise<ValidationResult> {
	const errors: string[] = [];
	const warnings: string[] = [];

	try {
		// Get image metadata
		const metadata = await sharp(pngBuffer).metadata();
		const dimensions = calculateDimensions(printSpec);

		console.log('🔍 Validating PNG...');
		console.log('   Expected:', `${dimensions.pixelWidth}x${dimensions.pixelHeight}px`);
		console.log('   Actual:', `${metadata.width}x${metadata.height}px`);
		console.log('   Format:', metadata.format);
		console.log('   Color space:', metadata.space);
		console.log('   ICC profile:', metadata.icc ? 'present' : 'missing');
		console.log('   Bit depth:', metadata.depth);

		// Validate dimensions
		if (metadata.width !== dimensions.pixelWidth) {
			errors.push(
				`Width mismatch: expected ${dimensions.pixelWidth}px, got ${metadata.width}px`
			);
		}

		if (metadata.height !== dimensions.pixelHeight) {
			errors.push(
				`Height mismatch: expected ${dimensions.pixelHeight}px, got ${metadata.height}px`
			);
		}

		// Validate format
		if (metadata.format !== 'png') {
			errors.push(`Format must be PNG, got: ${metadata.format}`);
		}

		// Validate color space
		if (metadata.space !== 'srgb') {
			errors.push(`Color space must be sRGB, got: ${metadata.space}`);
		}

		// Validate ICC profile
		if (!metadata.icc) {
			errors.push('Missing ICC profile');
		}

		// Check bit depth (8-bit is standard, 16-bit is acceptable)
		if (metadata.depth && metadata.depth !== 8 && metadata.depth !== 16) {
			warnings.push(`Unusual bit depth: ${metadata.depth} (expected 8 or 16)`);
		}

		// Check channels (PNG should have 3 for RGB or 4 for RGBA)
		if (metadata.channels && metadata.channels !== 3 && metadata.channels !== 4) {
			warnings.push(`Unusual channel count: ${metadata.channels} (expected 3 or 4)`);
		}

		const valid = errors.length === 0;

		if (valid) {
			console.log('✓ Validation passed');
		} else {
			console.log('✗ Validation failed:', errors.length, 'errors');
			errors.forEach((error) => console.log('   -', error));
		}

		if (warnings.length > 0) {
			console.log('⚠ Warnings:', warnings.length);
			warnings.forEach((warning) => console.log('   -', warning));
		}

		return {
			valid,
			errors,
			warnings,
			metadata
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown validation error';
		return {
			valid: false,
			errors: [`Failed to validate PNG: ${errorMsg}`],
			warnings: []
		};
	}
}

/**
 * Validates that a map definition is complete and valid.
 *
 * @param definition - Map definition to validate
 * @returns Validation result
 */
export function validateMapDefinition(definition: MapDefinition): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check required fields
	if (!definition.title || definition.title.trim() === '') {
		errors.push('Title is required');
	}

	if (!definition.subtitle || definition.subtitle.trim() === '') {
		errors.push('Subtitle is required');
	}

	if (!definition.people || !Array.isArray(definition.people)) {
		errors.push('People array is required');
	} else {
		// Validate people
		if (definition.people.length === 0) {
			warnings.push('No people defined - map will be empty');
		}

		definition.people.forEach((person, index) => {
			if (!person.id || person.id.trim() === '') {
				errors.push(`Person ${index}: ID is required`);
			}

			if (!person.name || person.name.trim() === '') {
				errors.push(`Person ${index}: Name is required`);
			}

			if (!person.color || !/^#[0-9A-Fa-f]{6}$/.test(person.color)) {
				errors.push(`Person ${index}: Invalid hex color (must be #RRGGBB format)`);
			}

			if (!person.locations || !Array.isArray(person.locations)) {
				errors.push(`Person ${index}: Locations array is required`);
			} else {
				if (person.locations.length === 0) {
					warnings.push(`Person ${index} (${person.name}): No locations defined`);
				}

				person.locations.forEach((location, locIndex) => {
					if (typeof location.longitude !== 'number' || location.longitude < -180 || location.longitude > 180) {
						errors.push(`Person ${index}, location ${locIndex}: Invalid longitude`);
					}

					if (typeof location.latitude !== 'number' || location.latitude < -90 || location.latitude > 90) {
						errors.push(`Person ${index}, location ${locIndex}: Invalid latitude`);
					}

					if (!location.date || !/^\d{4}-\d{2}-\d{2}$/.test(location.date)) {
						errors.push(`Person ${index}, location ${locIndex}: Invalid date (must be YYYY-MM-DD)`);
					}
				});
			}
		});
	}

	// Validate rotation if present
	if (definition.rotation) {
		if (!Array.isArray(definition.rotation) || definition.rotation.length !== 3) {
			errors.push('Rotation must be an array of 3 numbers [lambda, phi, gamma]');
		} else {
			if (definition.rotation.some((val) => typeof val !== 'number' || !isFinite(val))) {
				errors.push('Rotation values must be finite numbers');
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings
	};
}
