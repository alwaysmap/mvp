/**
 * Type declarations for versor module
 * Versor is a library for quaternion-based rotation
 */

declare module 'versor' {
	export type Rotation = [number, number, number];
	export type Quaternion = [number, number, number, number];
	export type Cartesian = [number, number, number];

	interface VersorFn {
		(rotation: Rotation): Quaternion;
		cartesian(coords: [number, number]): Cartesian;
		delta(v0: Cartesian, v1: Cartesian): Quaternion;
		multiply(q0: Quaternion, q1: Quaternion): Quaternion;
		rotation(q: Quaternion): Rotation;
	}

	const versor: VersorFn;
	export default versor;
}
