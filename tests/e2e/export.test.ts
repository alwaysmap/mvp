import { test, expect } from '@playwright/test';
import type { MapDefinition } from '$lib/map-renderer/types';

const sampleMapDefinition: MapDefinition = {
	title: 'Test Family Journey',
	subtitle: '2020-2024',
	people: [
		{
			id: 'test-person',
			name: 'Test Person',
			color: '#FF6B6B',
			locations: [
				{
					countryCode: 'US',
					longitude: -74.006,
					latitude: 40.7128,
					date: '2020-01-01'
				},
				{
					countryCode: 'GB',
					longitude: -0.1276,
					latitude: 51.5074,
					date: '2022-06-15'
				}
			]
		}
	],
	rotation: [0, 0, 0]
};

test.describe('Export Pipeline', () => {
	test('render route loads with encoded map definition', async ({ page }) => {
		// Encode map definition
		const jsonString = JSON.stringify(sampleMapDefinition);
		const base64Data = Buffer.from(jsonString).toString('base64url');

		// Navigate to render route
		await page.goto(`/render?data=${base64Data}`);

		// Wait for render completion (with timeout)
		const renderReady = await page.evaluate(
			() => {
				return new Promise((resolve) => {
					const checkReady = () => {
						if ((window as any).__RENDER_READY__) {
							resolve(true);
						} else if ((window as any).__RENDER_ERROR__) {
							resolve(false);
						} else {
							setTimeout(checkReady, 100);
						}
					};
					checkReady();
				});
			},
			{ timeout: 30000 }
		);

		expect(renderReady).toBe(true);

		// Verify SVG exists
		const svg = page.locator('#map-svg');
		await expect(svg).toBeVisible();

		// Verify render has content
		const hasContent = await page.evaluate(() => {
			const svg = document.querySelector('#map-svg');
			return svg && svg.children.length > 0;
		});

		expect(hasContent).toBe(true);
	});

	test('render route signals error for invalid data', async ({ page }) => {
		// Navigate with invalid data parameter
		await page.goto('/render?data=invalid-base64');

		// Wait a bit for error to be set
		await page.waitForTimeout(1000);

		// Check for error signal
		const hasError = await page.evaluate(() => {
			return (window as any).__RENDER_ERROR__ !== undefined;
		});

		expect(hasError).toBe(true);
	});

	test('render route renders all map elements', async ({ page }) => {
		// Encode map definition
		const jsonString = JSON.stringify(sampleMapDefinition);
		const base64Data = Buffer.from(jsonString).toString('base64url');

		await page.goto(`/render?data=${base64Data}`);

		// Wait for render completion
		await page.waitForFunction(() => (window as any).__RENDER_READY__, { timeout: 30000 });

		const svg = page.locator('#map-svg');

		// Verify all expected elements exist
		await expect(svg.locator('.ocean')).toBeVisible();
		await expect(svg.locator('.land')).toBeVisible();
		await expect(svg.locator('.countries')).toBeVisible();
		await expect(svg.locator('.graticule')).toBeVisible();
		await expect(svg.locator('.migration-paths')).toBeVisible();
		await expect(svg.locator('.title-box')).toBeVisible();
		await expect(svg.locator('.qr-code')).toBeVisible();

		// Verify title text
		const titleText = await svg.locator('.title-box').textContent();
		expect(titleText).toContain('Test Family Journey');
		expect(titleText).toContain('2020-2024');
	});

	test('export API returns documentation on GET', async ({ request }) => {
		const response = await request.get('/api/export');

		expect(response.ok()).toBe(true);
		expect(response.headers()['content-type']).toContain('application/json');

		const data = await response.json();
		expect(data.endpoint).toBe('/api/export');
		expect(data.method).toBe('POST');
		expect(data.requestBody).toBeDefined();
		expect(data.example).toBeDefined();
	});

	test('export API rejects request without map definition', async ({ request }) => {
		const response = await request.post('/api/export', {
			data: {}
		});

		expect(response.ok()).toBe(false);
		expect(response.status()).toBe(400);

		const data = await response.json();
		expect(data.error).toContain('Missing mapDefinition');
	});

	test('export API rejects invalid map definition', async ({ request }) => {
		const invalidMapDef = {
			// Missing required fields
			title: '',
			subtitle: '',
			people: []
		};

		const response = await request.post('/api/export', {
			data: {
				mapDefinition: invalidMapDef
			}
		});

		expect(response.ok()).toBe(false);
		expect(response.status()).toBe(400);

		const data = await response.json();
		expect(data.error).toContain('Invalid map definition');
		expect(data.details).toBeDefined();
		expect(Array.isArray(data.details)).toBe(true);
	});

	test('export API rejects invalid print size', async ({ request }) => {
		const response = await request.post('/api/export', {
			data: {
				mapDefinition: sampleMapDefinition,
				printSize: 'invalid-size'
			}
		});

		expect(response.ok()).toBe(false);
		expect(response.status()).toBe(400);

		const data = await response.json();
		expect(data.error).toContain('Invalid print size');
		expect(data.validSizes).toBeDefined();
	});
});
