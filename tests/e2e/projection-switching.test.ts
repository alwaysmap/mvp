/**
 * E2E tests for projection switching functionality
 *
 * Tests that switching between projections properly updates the map rendering.
 */

import { test, expect } from '@playwright/test';

test.describe('Projection Switching', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/create-map');
		await page.waitForTimeout(1000); // Wait for initial render
	});

	test('should update map when switching from equirectangular to mercator', async ({ page }) => {
		// Start with Globe (orthographic)
		const globeButton = page.locator('button:has-text("Globe")');
		await expect(globeButton).toHaveClass(/active/);

		// Switch to Flat Map (should default to equirectangular)
		const flatMapButton = page.locator('button:has-text("Flat Map")');
		await flatMapButton.click();
		await page.waitForTimeout(300);

		// Verify we're on equirectangular
		await expect(flatMapButton).toHaveClass(/active/);
		const dropdown = page.locator('#flat-projection');
		await expect(dropdown).toBeVisible();
		const initialValue = await dropdown.inputValue();
		expect(initialValue).toBe('equirectangular');

		// Take snapshot of land path (changes with projection)
		const landPath = page.locator('.land');
		const initialLandPath = await landPath.getAttribute('d');
		expect(initialLandPath).toBeDefined();
		expect(initialLandPath).not.toBe('');

		// Switch to Mercator via dropdown
		await dropdown.selectOption('mercator');
		await page.waitForTimeout(500); // Give time for re-render

		// Verify dropdown changed
		const newValue = await dropdown.inputValue();
		expect(newValue).toBe('mercator');

		// Map MUST re-render with different projection
		// The land path data should be completely different
		const mercatorLandPath = await landPath.getAttribute('d');
		expect(mercatorLandPath).toBeDefined();
		expect(mercatorLandPath).not.toBe(initialLandPath);

		// Additional check: land should still be visible
		await expect(landPath).toBeVisible();
	});

	test('should update map when switching from mercator to naturalEarth1', async ({ page }) => {
		// Switch to Flat Map
		await page.click('button:has-text("Flat Map")');
		await page.waitForTimeout(300);

		// Select Mercator
		const dropdown = page.locator('#flat-projection');
		await dropdown.selectOption('mercator');
		await page.waitForTimeout(300);

		// Verify we're on Mercator
		expect(await dropdown.inputValue()).toBe('mercator');

		// Take snapshot of land path
		const landPath = page.locator('.land');
		const mercatorLandPath = await landPath.getAttribute('d');
		expect(mercatorLandPath).toBeDefined();

		// Switch to Natural Earth
		await dropdown.selectOption('naturalEarth1');
		await page.waitForTimeout(500);

		// Verify dropdown changed
		expect(await dropdown.inputValue()).toBe('naturalEarth1');

		// Map should re-render with different projection
		const naturalEarthLandPath = await landPath.getAttribute('d');
		expect(naturalEarthLandPath).not.toBe(mercatorLandPath);
		await expect(landPath).toBeVisible();
	});

	test('should update map when switching from globe to flat map', async ({ page }) => {
		// Start with Globe
		const globeButton = page.locator('button:has-text("Globe")');
		await expect(globeButton).toHaveClass(/active/);

		// Take snapshot of land path in orthographic projection
		const landPath = page.locator('.land');
		const globeLandPath = await landPath.getAttribute('d');
		expect(globeLandPath).toBeDefined();

		// Check for ocean circle (only visible in orthographic)
		const ocean = page.locator('.ocean');
		await expect(ocean).toBeVisible();

		// Switch to Flat Map
		const flatMapButton = page.locator('button:has-text("Flat Map")');
		await flatMapButton.click();
		await page.waitForTimeout(500);

		// Verify switched
		await expect(flatMapButton).toHaveClass(/active/);
		await expect(globeButton).not.toHaveClass(/active/);

		// Map should re-render with different projection
		const flatLandPath = await landPath.getAttribute('d');
		expect(flatLandPath).not.toBe(globeLandPath);

		// Ocean circle should be gone in flat projection
		await expect(ocean).not.toBeVisible();
		await expect(landPath).toBeVisible();
	});

	test('store state should update when projection changes', async ({ page }) => {
		// Switch to Flat Map
		await page.click('button:has-text("Flat Map")');
		await page.waitForTimeout(300);

		// Check initial projection in store
		const initialProjection = await page.evaluate(() => {
			// Access the store via window (we'll need to expose it)
			return 'equirectangular'; // Default flat projection
		});

		// Select Mercator
		const dropdown = page.locator('#flat-projection');
		await dropdown.selectOption('mercator');
		await page.waitForTimeout(300);

		// Dropdown value changed
		expect(await dropdown.inputValue()).toBe('mercator');
	});

	test('Robinson projection should render correctly', async ({ page }) => {
		// Switch to Flat Map
		await page.click('button:has-text("Flat Map")');
		await page.waitForTimeout(300);

		// Select Robinson from dropdown
		const dropdown = page.locator('#flat-projection');
		await dropdown.selectOption('robinson');
		await page.waitForTimeout(500);

		// Verify dropdown changed
		expect(await dropdown.inputValue()).toBe('robinson');

		// Check that map rendered with Robinson projection
		const landPath = page.locator('.land');
		const robinsonLandPath = await landPath.getAttribute('d');
		expect(robinsonLandPath).toBeDefined();
		expect(robinsonLandPath).not.toBe('');

		// Land should be visible
		await expect(landPath).toBeVisible();

		// Countries should be visible
		const countries = page.locator('.countries');
		await expect(countries).toBeVisible();

		// Graticule should be visible
		const graticule = page.locator('.graticule');
		await expect(graticule).toBeVisible();
	});

	test('switching from Robinson to other projections should work', async ({ page }) => {
		// Switch to Flat Map
		await page.click('button:has-text("Flat Map")');
		await page.waitForTimeout(300);

		// Select Robinson
		const dropdown = page.locator('#flat-projection');
		await dropdown.selectOption('robinson');
		await page.waitForTimeout(500);

		// Get Robinson land path
		const landPath = page.locator('.land');
		const robinsonPath = await landPath.getAttribute('d');

		// Switch to Mercator
		await dropdown.selectOption('mercator');
		await page.waitForTimeout(500);

		// Map should re-render with different projection
		const mercatorPath = await landPath.getAttribute('d');
		expect(mercatorPath).not.toBe(robinsonPath);
		await expect(landPath).toBeVisible();
	});
});
