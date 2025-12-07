import { test, expect } from '@playwright/test';

test.describe('Responsive Layout', () => {
	test('page should not have horizontal scroll on desktop', async ({ page }) => {
		// Set desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/create-map');

		// Wait for render
		const svg = page.locator('.map-canvas');
		await expect(svg).toBeVisible({ timeout: 10000 });

		// Check for horizontal scroll
		const hasHorizontalScroll = await page.evaluate(() => {
			return document.documentElement.scrollWidth > document.documentElement.clientWidth;
		});

		expect(hasHorizontalScroll).toBe(false);
	});

	test('page should not have horizontal scroll on mobile', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/create-map');

		// Wait for render
		const svg = page.locator('.map-canvas');
		await expect(svg).toBeVisible({ timeout: 10000 });

		// Check for horizontal scroll
		const hasHorizontalScroll = await page.evaluate(() => {
			return document.documentElement.scrollWidth > document.documentElement.clientWidth;
		});

		expect(hasHorizontalScroll).toBe(false);
	});

	test('page should not have horizontal scroll on tablet', async ({ page }) => {
		// Set tablet viewport
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto('/create-map');

		// Wait for render
		const svg = page.locator('.map-canvas');
		await expect(svg).toBeVisible({ timeout: 10000 });

		// Check for horizontal scroll
		const hasHorizontalScroll = await page.evaluate(() => {
			return document.documentElement.scrollWidth > document.documentElement.clientWidth;
		});

		expect(hasHorizontalScroll).toBe(false);
	});

	test('map container should fit within viewport', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/create-map');

		// Wait for render
		const svg = page.locator('.map-canvas');
		await expect(svg).toBeVisible({ timeout: 10000 });

		// Get canvas area dimensions
		const canvasArea = page.locator('.canvas-area');
		const bbox = await canvasArea.boundingBox();

		expect(bbox).toBeTruthy();
		if (bbox) {
			// Container should not extend beyond viewport width
			expect(bbox.x + bbox.width).toBeLessThanOrEqual(1280);
		}
	});
});
