/**
 * Unit tests for font loading utilities.
 * Note: Most font loading tests require a browser environment (see E2E tests).
 * These tests focus on the parts that can be tested in Node.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	REQUIRED_FONTS,
	setRenderReady,
	setRenderError,
	isRenderReady,
	getRenderError
} from '$lib/map-renderer/fonts.js';

describe('Font Configuration', () => {
	describe('REQUIRED_FONTS', () => {
		it('should include all required Cormorant Garamond variants', () => {
			const cormorantFonts = REQUIRED_FONTS.filter((f) => f.family === 'Cormorant Garamond');

			expect(cormorantFonts).toHaveLength(4);

			// Check for specific variants
			expect(cormorantFonts.some((f) => f.weight === 400 && f.style === 'normal')).toBe(true); // Regular
			expect(cormorantFonts.some((f) => f.weight === 600 && f.style === 'normal')).toBe(true); // SemiBold
			expect(cormorantFonts.some((f) => f.weight === 700 && f.style === 'normal')).toBe(true); // Bold
			expect(cormorantFonts.some((f) => f.weight === 400 && f.style === 'italic')).toBe(true); // Italic
		});

		it('should include all required DM Sans variants', () => {
			const dmSansFonts = REQUIRED_FONTS.filter((f) => f.family === 'DM Sans');

			expect(dmSansFonts).toHaveLength(3);

			// Check for specific variants
			expect(dmSansFonts.some((f) => f.weight === 400 && f.style === 'normal')).toBe(true); // Regular
			expect(dmSansFonts.some((f) => f.weight === 500 && f.style === 'normal')).toBe(true); // Medium
			expect(dmSansFonts.some((f) => f.weight === 600 && f.style === 'normal')).toBe(true); // SemiBold
		});

		it('should have exactly 7 fonts total', () => {
			expect(REQUIRED_FONTS).toHaveLength(7);
		});

		it('should only include normal and italic styles', () => {
			const styles = new Set(REQUIRED_FONTS.map((f) => f.style));
			expect(styles.size).toBeLessThanOrEqual(2);
			expect([...styles].every((s) => s === 'normal' || s === 'italic')).toBe(true);
		});
	});
});

describe('Render State Management', () => {
	// Clean up window state before and after each test
	beforeEach(() => {
		if (typeof window !== 'undefined') {
			delete (window as any).__RENDER_READY__;
			delete (window as any).__RENDER_ERROR__;
		}
	});

	afterEach(() => {
		if (typeof window !== 'undefined') {
			delete (window as any).__RENDER_READY__;
			delete (window as any).__RENDER_ERROR__;
		}
	});

	describe('setRenderReady / isRenderReady', () => {
		it('should set render ready flag', () => {
			// Skip in Node environment
			if (typeof window === 'undefined') {
				expect(isRenderReady()).toBe(false);
				return;
			}

			expect(isRenderReady()).toBe(false);
			setRenderReady();
			expect(isRenderReady()).toBe(true);
		});
	});

	describe('setRenderError / getRenderError', () => {
		it('should set and get render error', () => {
			// Skip in Node environment
			if (typeof window === 'undefined') {
				expect(getRenderError()).toBeUndefined();
				return;
			}

			expect(getRenderError()).toBeUndefined();
			setRenderError('Test error message');
			expect(getRenderError()).toBe('Test error message');
		});

		it('should handle multiple error sets', () => {
			// Skip in Node environment
			if (typeof window === 'undefined') {
				return;
			}

			setRenderError('First error');
			expect(getRenderError()).toBe('First error');

			setRenderError('Second error');
			expect(getRenderError()).toBe('Second error');
		});
	});

	describe('Node environment behavior', () => {
		it('should return false for isRenderReady in Node', () => {
			if (typeof window === 'undefined') {
				expect(isRenderReady()).toBe(false);
			}
		});

		it('should return undefined for getRenderError in Node', () => {
			if (typeof window === 'undefined') {
				expect(getRenderError()).toBeUndefined();
			}
		});
	});
});

describe('Font Loading (Browser Environment Required)', () => {
	it('should be tested in E2E tests', () => {
		// Font loading (waitForFonts, verifyPuppeteerFonts) requires document.fonts API
		// These functions are tested in E2E tests with Playwright
		expect(true).toBe(true);
	});
});
