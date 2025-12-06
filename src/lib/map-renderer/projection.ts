/**
 * Geographic projection setup for orthographic (globe) view.
 * Handles projection configuration, rotation, and coordinate transformations.
 */

import { geoOrthographic, geoPath, type GeoProjection, type GeoPath } from 'd3-geo';
import type { Dimensions } from './types.js';

/**
 * Creates an orthographic projection centered on the canvas.
 *
 * The orthographic projection shows the Earth as a globe, which is ideal
 * for visualizing global migration patterns. The projection is centered
 * in the trim area (not including bleed).
 *
 * @param dimensions - Calculated dimensions for the print
 * @param rotation - Initial rotation [lambda, phi, gamma] in degrees (default: [0, 0, 0])
 * @param layoutOverride - Optional layout-calculated center and scale (from layout engine)
 * @returns Configured D3 orthographic projection
 *
 * @example
 * ```typescript
 * const projection = createProjection(dimensions, [-20, 40, 0]);
 * const path = geoPath(projection);
 * ```
 */
export function createProjection(
	dimensions: Dimensions,
	rotation: [number, number, number] = [0, 0, 0],
	layoutOverride?: { center: [number, number]; scale: number }
): GeoProjection {
	let centerX: number, centerY: number, scale: number;

	if (layoutOverride) {
		// Use layout engine calculations for optimal positioning
		centerX = layoutOverride.center[0];
		centerY = layoutOverride.center[1];
		scale = layoutOverride.scale;
	} else {
		// Legacy behavior: center in trim area
		centerX = dimensions.bleed + dimensions.trimWidth / 2;
		centerY = dimensions.bleed + dimensions.trimHeight / 2;

		// Scale to fit within the trim area with some padding
		// Use the smaller dimension to ensure the globe fits
		const minDimension = Math.min(dimensions.trimWidth, dimensions.trimHeight);
		scale = (minDimension / 2) * 0.85; // 85% to leave some margin
	}

	return geoOrthographic()
		.scale(scale)
		.translate([centerX, centerY])
		.rotate(rotation)
		.clipAngle(90); // Only show the visible hemisphere
}

/**
 * Creates a geo path generator for the given projection.
 *
 * @param projection - D3 geographic projection
 * @returns D3 geo path generator
 */
export function createGeoPath(projection: GeoProjection): GeoPath {
	return geoPath(projection);
}

/**
 * Converts a rotation from the versor dragging library to D3 rotation format.
 *
 * Versor uses quaternions for smooth, gimbal-lock-free rotation.
 * This function extracts Euler angles for use with D3's rotate().
 *
 * @param quaternion - Versor quaternion [w, x, y, z]
 * @returns D3 rotation [lambda, phi, gamma] in degrees
 */
export function quaternionToRotation(quaternion: [number, number, number, number]): [
	number,
	number,
	number
] {
	const [w, x, y, z] = quaternion;

	// Convert quaternion to Euler angles (ZYX convention)
	// This is a simplified conversion - for production, use a library like versor
	const lambda = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * (180 / Math.PI);
	const phi = Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x)))) * (180 / Math.PI);
	const gamma = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)) * (180 / Math.PI);

	return [lambda, phi, gamma];
}

/**
 * Converts D3 rotation to a quaternion for versor dragging.
 *
 * @param rotation - D3 rotation [lambda, phi, gamma] in degrees
 * @returns Versor quaternion [w, x, y, z]
 */
export function rotationToQuaternion(rotation: [number, number, number]): [
	number,
	number,
	number,
	number
] {
	const [lambda, phi, gamma] = rotation.map((deg) => deg * (Math.PI / 180));

	// Convert Euler angles to quaternion (ZYX convention)
	const cy = Math.cos(lambda / 2);
	const sy = Math.sin(lambda / 2);
	const cp = Math.cos(phi / 2);
	const sp = Math.sin(phi / 2);
	const cr = Math.cos(gamma / 2);
	const sr = Math.sin(gamma / 2);

	const w = cr * cp * cy + sr * sp * sy;
	const x = sr * cp * cy - cr * sp * sy;
	const y = cr * sp * cy + sr * cp * sy;
	const z = cr * cp * sy - sr * sp * cy;

	return [w, x, y, z];
}

/**
 * Calculates the great circle distance between two points.
 *
 * @param point1 - [longitude, latitude] in degrees
 * @param point2 - [longitude, latitude] in degrees
 * @returns Distance in kilometers
 */
export function greatCircleDistance(
	point1: [number, number],
	point2: [number, number]
): number {
	const [lon1, lat1] = point1.map((deg) => deg * (Math.PI / 180));
	const [lon2, lat2] = point2.map((deg) => deg * (Math.PI / 180));

	const R = 6371; // Earth's radius in km

	const dLat = lat2 - lat1;
	const dLon = lon2 - lon1;

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}

/**
 * Calculates the optimal rotation to center a set of locations on the globe.
 *
 * @param locations - Array of [longitude, latitude] pairs
 * @returns Optimal rotation [lambda, phi, gamma]
 */
export function calculateOptimalRotation(locations: Array<[number, number]>): [
	number,
	number,
	number
] {
	if (locations.length === 0) {
		return [0, 0, 0];
	}

	// Calculate the centroid of all locations
	let sumLon = 0;
	let sumLat = 0;

	for (const [lon, lat] of locations) {
		sumLon += lon;
		sumLat += lat;
	}

	const centerLon = sumLon / locations.length;
	const centerLat = sumLat / locations.length;

	// Rotate to center this point
	// For orthographic projection, we want to rotate so the centroid is at (0, 0) in projection space
	return [-centerLon, -centerLat, 0];
}

/**
 * Checks if a point is visible on the current projection.
 *
 * For orthographic projection, only the front hemisphere is visible.
 *
 * @param projection - D3 projection
 * @param point - [longitude, latitude] in degrees
 * @returns true if the point is visible
 */
export function isPointVisible(projection: GeoProjection, point: [number, number]): boolean {
	const projected = projection(point);
	return projected !== null;
}
