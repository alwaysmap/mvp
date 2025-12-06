/**
 * Globe rotation using versor drag
 * Based on: https://observablehq.com/@d3/versor-dragging
 */

import * as d3 from 'd3';
import versor from 'versor';
import type { Quaternion, Rotation, Cartesian } from 'versor';

/**
 * Creates a drag behavior for rotating an orthographic projection
 * using versor quaternion mathematics for smooth, natural rotation.
 *
 * @param projection - D3 geo projection (must support .rotate() and .invert())
 * @param onRotate - Callback fired during rotation with new rotation values
 * @returns D3 drag behavior to attach to SVG element
 */
export function createRotationDrag(
	projection: d3.GeoProjection,
	onRotate?: (rotation: Rotation) => void
): d3.DragBehavior<SVGElement, unknown, unknown> {
	let v0: Cartesian; // Initial cartesian vector
	let q0: Quaternion; // Initial quaternion
	let r0: Rotation; // Initial rotation

	function dragstarted(event: d3.D3DragEvent<SVGElement, unknown, unknown>) {
		// Convert screen coordinates to geographic, then to cartesian
		const coords = projection.invert?.([event.x, event.y]);
		if (!coords) return;

		v0 = versor.cartesian(coords);
		r0 = projection.rotate() as Rotation;
		q0 = versor(r0);
	}

	function dragged(event: d3.D3DragEvent<SVGElement, unknown, unknown>) {
		// Get current point in cartesian coordinates
		const coords = projection.rotate(r0).invert?.([event.x, event.y]);
		if (!coords) return;

		const v1 = versor.cartesian(coords);

		// Compute rotation quaternion from v0 to v1
		const delta = versor.delta(v0, v1);

		// Compose with initial rotation
		const q1 = versor.multiply(q0, delta);

		// Convert back to Euler angles and update projection
		const rotation = versor.rotation(q1);
		projection.rotate(rotation);

		// Notify callback
		if (onRotate) {
			onRotate(rotation);
		}

		// Re-initialize if we're getting close to antipodal point (for stability)
		if (delta[0] < 0.7) {
			v0 = v1;
			r0 = rotation;
			q0 = q1;
		}
	}

	return d3
		.drag<SVGElement, unknown>()
		.on('start', dragstarted)
		.on('drag', dragged);
}

/**
 * Converts rotation array to object for easier access
 */
export function rotationToObject(rotation: Rotation): {
	lambda: number;
	phi: number;
	gamma: number;
} {
	return {
		lambda: rotation[0],
		phi: rotation[1],
		gamma: rotation[2]
	};
}

/**
 * Validates that rotation values are all finite numbers
 */
export function isValidRotation(rotation: Rotation): boolean {
	return (
		Array.isArray(rotation) &&
		rotation.length === 3 &&
		rotation.every((val) => typeof val === 'number' && isFinite(val))
	);
}
