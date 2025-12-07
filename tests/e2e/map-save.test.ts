import { test, expect } from '@playwright/test';

test.describe('Map Save Functionality', () => {
	test('should display save button on create-map page', async ({ page }) => {
		await page.goto('/create-map');

		// Wait for page to load
		const saveButton = page.locator('.save-button');
		await expect(saveButton).toBeVisible();
		await expect(saveButton).toHaveText('Save Map');
	});

	test('should save map and show success message', async ({ page }) => {
		await page.goto('/create-map');

		// Click save button
		const saveButton = page.locator('.save-button');
		await saveButton.click();

		// Wait for save to complete
		await expect(saveButton).toHaveText('✓ Saved', { timeout: 5000 });

		// Check for success message
		const successMessage = page.locator('.success-message');
		await expect(successMessage).toBeVisible();
		await expect(successMessage).toContainText('Map saved successfully');

		// Check that map ID is displayed
		const mapIdInfo = page.locator('.map-id-info');
		await expect(mapIdInfo).toBeVisible();
		await expect(mapIdInfo).toContainText('Map ID:');
	});

	test('should enable buy button after save', async ({ page }) => {
		await page.goto('/create-map');

		// Buy button should be disabled initially
		const buyButton = page.locator('.buy-button');
		await expect(buyButton).toBeDisabled();

		// Save the map
		const saveButton = page.locator('.save-button');
		await saveButton.click();
		await expect(saveButton).toHaveText('✓ Saved', { timeout: 5000 });

		// Buy button should now be enabled (but shows "Coming Soon")
		await expect(buyButton).toBeEnabled();
		await expect(buyButton).toContainText('Coming Soon');
	});
});
