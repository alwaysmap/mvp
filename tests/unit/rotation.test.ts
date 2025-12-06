import { describe, it, expect } from 'vitest';
import { rotationToObject, isValidRotation } from '$lib/map-renderer/rotation';
import type { Rotation } from 'versor';

describe('Rotation Utilities', () => {
	describe('rotationToObject', () => {
		it('converts rotation array to object', () => {
			const rotation: Rotation = [10, 20, 30];
			const obj = rotationToObject(rotation);

			expect(obj).toEqual({
				lambda: 10,
				phi: 20,
				gamma: 30
			});
		});

		it('handles negative values', () => {
			const rotation: Rotation = [-45, -90, -15];
			const obj = rotationToObject(rotation);

			expect(obj.lambda).toBe(-45);
			expect(obj.phi).toBe(-90);
			expect(obj.gamma).toBe(-15);
		});

		it('handles zero values', () => {
			const rotation: Rotation = [0, 0, 0];
			const obj = rotationToObject(rotation);

			expect(obj.lambda).toBe(0);
			expect(obj.phi).toBe(0);
			expect(obj.gamma).toBe(0);
		});
	});

	describe('isValidRotation', () => {
		it('returns true for valid rotation array', () => {
			const rotation: Rotation = [10, 20, 30];
			expect(isValidRotation(rotation)).toBe(true);
		});

		it('returns true for zero rotation', () => {
			const rotation: Rotation = [0, 0, 0];
			expect(isValidRotation(rotation)).toBe(true);
		});

		it('returns true for negative values', () => {
			const rotation: Rotation = [-45, -90, -15];
			expect(isValidRotation(rotation)).toBe(true);
		});

		it('returns false for array with wrong length', () => {
			expect(isValidRotation([10, 20] as any)).toBe(false);
			expect(isValidRotation([10, 20, 30, 40] as any)).toBe(false);
			expect(isValidRotation([10] as any)).toBe(false);
		});

		it('returns false for array with non-numeric values', () => {
			expect(isValidRotation([10, 'test', 30] as any)).toBe(false);
			expect(isValidRotation([null, 20, 30] as any)).toBe(false);
			expect(isValidRotation([10, undefined, 30] as any)).toBe(false);
		});

		it('returns false for array with Infinity', () => {
			expect(isValidRotation([Infinity, 20, 30])).toBe(false);
			expect(isValidRotation([10, -Infinity, 30])).toBe(false);
		});

		it('returns false for array with NaN', () => {
			expect(isValidRotation([NaN, 20, 30])).toBe(false);
			expect(isValidRotation([10, NaN, 30])).toBe(false);
		});

		it('returns false for non-array values', () => {
			expect(isValidRotation(null as any)).toBe(false);
			expect(isValidRotation(undefined as any)).toBe(false);
			expect(isValidRotation({} as any)).toBe(false);
			expect(isValidRotation('test' as any)).toBe(false);
		});
	});
});
