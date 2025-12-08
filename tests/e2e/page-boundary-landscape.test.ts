/**
 * E2E test for page boundary display in landscape orientation.
 * This test verifies that the page boundary overlay remains visible
 * when switching from portrait to landscape orientation.
 */

import { test, expect } from '@playwright/test';

test.describe('Page Boundary - Landscape Orientation', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to the map editor
		await page.goto('/create-map');
		await page.waitForLoadState('networkidle');
		// Wait for geographic data to load
		await page.waitForTimeout(1000);
	});

	test('should display page boundary in portrait orientation', async ({ page }) => {
		// Check if boundary checkbox is already checked (default is true)
		const boundaryCheckbox = page.locator('label.toggle-label input[type="checkbox"]');
		const isChecked = await boundaryCheckbox.isChecked();

		// If not checked, click the label to enable it
		if (!isChecked) {
			const boundaryLabel = page.locator('label.toggle-label').filter({ hasText: /show print boundary/i });
			await boundaryLabel.click();
		}

		// Wait for boundary to render
		await page.waitForTimeout(500);

		// Verify boundary elements exist in SVG
		const svg = page.locator('svg.map-canvas');
		const boundaryGroup = svg.locator('g.page-boundary');
		await expect(boundaryGroup).toBeVisible();

		// Verify overlay rect exists
		const overlayRect = boundaryGroup.locator('rect').first();
		await expect(overlayRect).toBeVisible();

		// Verify boundary outline rect exists
		const boundaryRect = boundaryGroup.locator('rect').nth(1);
		await expect(boundaryRect).toBeVisible();
		await expect(boundaryRect).toHaveAttribute('stroke', '#fff');

		// Verify label exists
		const label = boundaryGroup.locator('text');
		await expect(label).toBeVisible();
		await expect(label).toContainText('Print Area');
	});

	test('should display page boundary in landscape orientation', async ({ page }) => {
		// Check if boundary checkbox is already checked (default is true)
		const boundaryCheckbox = page.locator('label.toggle-label input[type="checkbox"]');
		const isChecked = await boundaryCheckbox.isChecked();

		// If not checked, click the label to enable it
		if (!isChecked) {
			const boundaryLabel = page.locator('label.toggle-label').filter({ hasText: /show print boundary/i });
			await boundaryLabel.click();
		}

		// Wait for initial boundary render
		await page.waitForTimeout(500);

		// Switch to landscape orientation
		const landscapeButton = page.locator('button').filter({ hasText: /landscape/i });
		await landscapeButton.click();

		// Wait for re-render
		await page.waitForTimeout(500);

		// Verify boundary elements STILL exist in SVG after switching to landscape
		const svg = page.locator('svg.map-canvas');
		const boundaryGroup = svg.locator('g.page-boundary');
		await expect(boundaryGroup).toBeVisible();

		// Verify overlay rect exists
		const overlayRect = boundaryGroup.locator('rect').first();
		await expect(overlayRect).toBeVisible();

		// Verify boundary outline rect exists
		const boundaryRect = boundaryGroup.locator('rect').nth(1);
		await expect(boundaryRect).toBeVisible();
		await expect(boundaryRect).toHaveAttribute('stroke', '#fff');

		// Verify label exists and shows landscape dimensions
		const label = boundaryGroup.locator('text');
		await expect(label).toBeVisible();
		await expect(label).toContainText('Print Area');
	});

	test('should maintain page boundary when toggling between portrait and landscape', async ({ page }) => {
		// Check if boundary checkbox is already checked (default is true)
		const boundaryCheckbox = page.locator('label.toggle-label input[type="checkbox"]');
		const isChecked = await boundaryCheckbox.isChecked();

		// If not checked, click the label to enable it
		if (!isChecked) {
			const boundaryLabel = page.locator('label.toggle-label').filter({ hasText: /show print boundary/i });
			await boundaryLabel.click();
		}
		await page.waitForTimeout(500);

		const svg = page.locator('svg.map-canvas');
		const boundaryGroup = svg.locator('g.page-boundary');

		// Verify boundary exists in portrait
		await expect(boundaryGroup).toBeVisible();

		// Switch to landscape
		const landscapeButton = page.locator('button').filter({ hasText: /landscape/i });
		await landscapeButton.click();
		await page.waitForTimeout(500);

		// Verify boundary still exists in landscape
		await expect(boundaryGroup).toBeVisible();

		// Switch back to portrait
		const portraitButton = page.locator('button').filter({ hasText: /portrait/i });
		await portraitButton.click();
		await page.waitForTimeout(500);

		// Verify boundary still exists in portrait
		await expect(boundaryGroup).toBeVisible();

		// Switch to landscape again
		await landscapeButton.click();
		await page.waitForTimeout(500);

		// Verify boundary still exists after multiple toggles
		await expect(boundaryGroup).toBeVisible();
	});

	test('should correctly size boundary rect for landscape vs portrait', async ({ page }) => {
		// Check if boundary checkbox is already checked (default is true)
		const boundaryCheckbox = page.locator('label.toggle-label input[type="checkbox"]');
		const isChecked = await boundaryCheckbox.isChecked();

		// If not checked, click the label to enable it
		if (!isChecked) {
			const boundaryLabel = page.locator('label.toggle-label').filter({ hasText: /show print boundary/i });
			await boundaryLabel.click();
		}
		await page.waitForTimeout(500);

		const svg = page.locator('svg.map-canvas');
		const boundaryRect = svg.locator('g.page-boundary rect').nth(1);

		// Get portrait dimensions
		const portraitWidth = await boundaryRect.getAttribute('width');
		const portraitHeight = await boundaryRect.getAttribute('height');

		// Switch to landscape
		const landscapeButton = page.locator('button').filter({ hasText: /landscape/i });
		await landscapeButton.click();
		await page.waitForTimeout(500);

		// Get landscape dimensions
		const landscapeWidth = await boundaryRect.getAttribute('width');
		const landscapeHeight = await boundaryRect.getAttribute('height');

		// Verify dimensions are swapped (landscape should be wider than tall)
		expect(parseFloat(landscapeWidth!)).toBeGreaterThan(parseFloat(landscapeHeight!));
		expect(parseFloat(portraitWidth!)).toBeLessThan(parseFloat(portraitHeight!));

		// Verify landscape width ≈ portrait height (aspect ratio flipped)
		const portraitAspect = parseFloat(portraitWidth!) / parseFloat(portraitHeight!);
		const landscapeAspect = parseFloat(landscapeWidth!) / parseFloat(landscapeHeight!);
		expect(landscapeAspect).toBeCloseTo(1 / portraitAspect, 1);
	});
});
