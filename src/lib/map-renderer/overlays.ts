/**
 * Overlay rendering for non-map elements (title box, QR code).
 * All overlays are rendered using D3 to ensure browser/Puppeteer consistency.
 */

import type { Selection } from 'd3';
import QRCode from 'qrcode';

/**
 * Renders a title box with title and subtitle text.
 *
 * The title box is positioned in the top-left corner within the safe area.
 * It uses a semi-transparent white background with Cormorant Garamond text.
 *
 * @param svg - D3 selection of the parent SVG element
 * @param title - Main title text
 * @param subtitle - Subtitle text
 * @param safeArea - Safe area boundaries (x, y, width, height in points)
 * @param layoutOverride - Optional layout-calculated position and size (from layout engine)
 *
 * @example
 * ```typescript
 * const svg = d3.select('#map-svg');
 * renderTitleBox(svg, 'Our Family Journey', '2010-2024', {
 *   x: 27, y: 27, width: 1260, height: 1692
 * });
 * ```
 */
export function renderTitleBox(
	svg: Selection<any, any, any, any>,
	title: string,
	subtitle: string,
	safeArea: { x: number; y: number; width: number; height: number },
	layoutOverride?: { x: number; y: number; width: number; height: number }
): void {
	let boxX: number, boxY: number, boxWidth: number, boxHeight: number;

	if (layoutOverride) {
		// Use layout engine calculations for optimal positioning
		boxX = layoutOverride.x;
		boxY = layoutOverride.y;
		boxWidth = layoutOverride.width;
		boxHeight = layoutOverride.height;
	} else {
		// Legacy behavior: top-left corner
		boxX = safeArea.x;
		boxY = safeArea.y;
		boxWidth = 400;
		boxHeight = 100;
	}

	const padding = 20;
	const cornerRadius = 4;

	// Create group for title box
	const g = svg.append('g').attr('class', 'title-box');

	// Background rectangle
	g.append('rect')
		.attr('x', boxX)
		.attr('y', boxY)
		.attr('width', boxWidth)
		.attr('height', boxHeight)
		.attr('rx', cornerRadius)
		.attr('ry', cornerRadius)
		.attr('fill', 'rgba(255, 255, 255, 0.95)')
		.attr('stroke', '#333333')
		.attr('stroke-width', 1);

	// Title text (larger, bold)
	g.append('text')
		.attr('x', boxX + padding)
		.attr('y', boxY + padding + 24) // Baseline position
		.style('font-family', 'Cormorant Garamond')
		.style('font-size', '28px')
		.style('font-weight', '700') // Bold
		.style('fill', '#1a1a1a')
		.text(title);

	// Subtitle text (smaller, regular weight)
	g.append('text')
		.attr('x', boxX + padding)
		.attr('y', boxY + padding + 24 + 32) // Below title
		.style('font-family', 'DM Sans')
		.style('font-size', '16px')
		.style('font-weight', '400') // Regular
		.style('fill', '#4a4a4a')
		.text(subtitle);
}

/**
 * Renders a QR code in the bottom-right corner of the safe area.
 *
 * The QR code links to the AlwaysMap website and is rendered as an SVG path
 * using the qrcode library. This ensures crisp rendering at any resolution.
 *
 * @param svg - D3 selection of the parent SVG element
 * @param url - URL to encode in the QR code (default: https://alwaysmap.com)
 * @param safeArea - Safe area boundaries (x, y, width, height in points)
 * @param size - Size of the QR code in points (default: 100)
 * @param layoutOverride - Optional layout-calculated position and size (from layout engine)
 *
 * @example
 * ```typescript
 * const svg = d3.select('#map-svg');
 * await renderQRCode(svg, 'https://alwaysmap.com', {
 *   x: 27, y: 27, width: 1260, height: 1692
 * }, 100);
 * ```
 */
export async function renderQRCode(
	svg: Selection<any, any, any, any>,
	url: string = 'https://alwaysmap.com',
	safeArea: { x: number; y: number; width: number; height: number },
	size: number = 100,
	layoutOverride?: { x: number; y: number; width: number; height: number }
): Promise<void> {
	// Generate QR code as SVG string
	const qrSvg = await QRCode.toString(url, {
		type: 'svg',
		width: size,
		margin: 1,
		color: {
			dark: '#000000',
			light: '#FFFFFF'
		},
		errorCorrectionLevel: 'M' // Medium error correction
	});

	// Parse the SVG string to extract the SVG element
	const parser = new DOMParser();
	const doc = parser.parseFromString(qrSvg, 'image/svg+xml');
	const svgElement = doc.querySelector('svg');

	if (!svgElement) {
		console.error('Failed to generate QR code SVG');
		return;
	}

	// Get the viewBox to understand the QR code's coordinate system
	const viewBox = svgElement.getAttribute('viewBox');
	const paths = doc.querySelectorAll('path');

	if (paths.length === 0) {
		console.error('QR code SVG has no paths');
		return;
	}

	// Parse viewBox to get original dimensions
	const [vbX, vbY, vbWidth, vbHeight] = viewBox
		? viewBox.split(' ').map(Number)
		: [0, 0, size, size];

	let qrX: number, qrY: number, qrSize: number;

	if (layoutOverride) {
		// Use layout engine calculations for optimal positioning
		qrX = layoutOverride.x;
		qrY = layoutOverride.y;
		qrSize = layoutOverride.width; // Assume square
	} else {
		// Legacy behavior: bottom-right corner with padding
		const padding = 20;
		qrX = safeArea.x + safeArea.width - size - padding;
		qrY = safeArea.y + safeArea.height - size - padding;
		qrSize = size;
	}

	// Create group for QR code
	const g = svg.append('g').attr('class', 'qr-code').attr('transform', `translate(${qrX}, ${qrY})`);

	const padding = 20;

	// White background rectangle
	g.append('rect')
		.attr('x', -padding / 2)
		.attr('y', -padding / 2)
		.attr('width', qrSize + padding)
		.attr('height', qrSize + padding)
		.attr('fill', '#FFFFFF')
		.attr('rx', 4)
		.attr('ry', 4);

	// Create a nested group for the QR code with proper scaling
	const qrGroup = g
		.append('g')
		.attr('transform', `scale(${qrSize / vbWidth})`);

	// Add QR code paths - need to preserve both fill AND stroke attributes
	paths.forEach((path) => {
		const d = path.getAttribute('d');
		const fill = path.getAttribute('fill');
		const stroke = path.getAttribute('stroke');
		const strokeWidth = path.getAttribute('stroke-width');

		if (d) {
			const pathElement = qrGroup.append('path').attr('d', d);

			// Apply fill if present
			if (fill) {
				pathElement.attr('fill', fill);
			}

			// Apply stroke if present
			if (stroke) {
				pathElement.attr('stroke', stroke);
				// QR codes use stroke width of 1 in their coordinate system
				pathElement.attr('stroke-width', strokeWidth || 1);
			}
		}
	});

	// Optional: Add small text label below QR code
	g.append('text')
		.attr('x', qrSize / 2)
		.attr('y', qrSize + padding + 12)
		.style('font-family', 'DM Sans')
		.style('font-size', '10px')
		.style('font-weight', '400')
		.style('fill', '#666666')
		.style('text-anchor', 'middle')
		.text('Scan to visit AlwaysMap');
}

/**
 * Renders attribution text in the bottom-left corner.
 * This is optional but recommended for map data attribution.
 *
 * @param svg - D3 selection of the parent SVG element
 * @param text - Attribution text
 * @param safeArea - Safe area boundaries
 */
export function renderAttribution(
	svg: Selection<any, any, any, any>,
	text: string,
	safeArea: { x: number; y: number; width: number; height: number }
): void {
	const padding = 20;

	svg
		.append('text')
		.attr('x', safeArea.x + padding)
		.attr('y', safeArea.y + safeArea.height - padding)
		.style('font-family', 'DM Sans')
		.style('font-size', '9px')
		.style('font-weight', '400')
		.style('fill', '#999999')
		.text(text);
}
