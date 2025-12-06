/**
 * TypeScript type definitions for the versor package
 * Based on: https://github.com/d3/versor
 */

declare module 'versor' {
	/**
	 * Quaternion represented as [w, x, y, z] where:
	 * - w is the scalar component
	 * - x, y, z are the vector components
	 */
	export type Quaternion = [number, number, number, number];

	/**
	 * Euler angles for geographic rotation [lambda, phi, gamma] where:
	 * - lambda is longitude rotation (yaw)
	 * - phi is latitude rotation (pitch)
	 * - gamma is roll
	 */
	export type Rotation = [number, number, number];

	/**
	 * 3D cartesian coordinates [x, y, z]
	 */
	export type Cartesian = [number, number, number];

	/**
	 * Geographic coordinates [longitude, latitude]
	 */
	export type Geographic = [number, number];

	/**
	 * Creates a versor (unit quaternion) from Euler angles
	 */
	export default function versor(rotation: Rotation): Quaternion;

	export namespace versor {
		/**
		 * Converts geographic coordinates to 3D cartesian vector
		 */
		function cartesian(geographic: Geographic): Cartesian;

		/**
		 * Computes the quaternion representing rotation from v0 to v1
		 */
		function delta(v0: Cartesian, v1: Cartesian): Quaternion;

		/**
		 * Multiplies two quaternions (composes rotations)
		 */
		function multiply(q0: Quaternion, q1: Quaternion): Quaternion;

		/**
		 * Converts quaternion back to Euler angles
		 */
		function rotation(q: Quaternion): Rotation;
	}
}
