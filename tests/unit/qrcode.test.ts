/**
 * Unit tests for QR code generation.
 * Tests the qrcode library directly to ensure it generates valid SVG.
 */

import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';

describe('QR Code Generation', () => {
	it('should generate valid SVG with paths', async () => {
		const url = 'https://alwaysmap.com';
		const qrSvg = await QRCode.toString(url, {
			type: 'svg',
			width: 100,
			margin: 1,
			color: {
				dark: '#000000',
				light: '#FFFFFF'
			},
			errorCorrectionLevel: 'M'
		});

		// Should be a string
		expect(typeof qrSvg).toBe('string');

		// Should contain SVG tag
		expect(qrSvg).toContain('<svg');
		expect(qrSvg).toContain('</svg>');

		// Should have viewBox
		expect(qrSvg).toContain('viewBox');

		// Should have path elements
		expect(qrSvg).toContain('<path');

		console.log('QR SVG length:', qrSvg.length);
		console.log('QR SVG preview:', qrSvg.substring(0, 500));
	});

	it('should parse QR code SVG and extract viewBox', async () => {
		const qrSvg = await QRCode.toString('https://alwaysmap.com', {
			type: 'svg',
			width: 100,
			margin: 1
		});

		// Parse using DOMParser (only works in browser-like environment)
		// In Node/Vitest, we'll use string parsing
		const viewBoxMatch = qrSvg.match(/viewBox="([^"]+)"/);
		expect(viewBoxMatch).toBeTruthy();

		if (viewBoxMatch) {
			const viewBox = viewBoxMatch[1];
			const [x, y, width, height] = viewBox.split(' ').map(Number);

			expect(x).toBeGreaterThanOrEqual(0);
			expect(y).toBeGreaterThanOrEqual(0);
			expect(width).toBeGreaterThan(0);
			expect(height).toBeGreaterThan(0);

			console.log('ViewBox:', { x, y, width, height });
		}
	});

	it('should have multiple path elements in QR code', async () => {
		const qrSvg = await QRCode.toString('https://alwaysmap.com', {
			type: 'svg',
			width: 100,
			margin: 1
		});

		// Count path elements
		const pathMatches = qrSvg.match(/<path/g);
		expect(pathMatches).toBeTruthy();

		if (pathMatches) {
			const pathCount = pathMatches.length;
			console.log('Number of paths in QR code:', pathCount);

			// QR code should have at least one path
			expect(pathCount).toBeGreaterThan(0);
		}
	});

	it('should generate different QR codes for different URLs', async () => {
		const qr1 = await QRCode.toString('https://alwaysmap.com', { type: 'svg' });
		const qr2 = await QRCode.toString('https://example.com', { type: 'svg' });

		// Different URLs should generate different QR codes
		expect(qr1).not.toBe(qr2);
	});
});
