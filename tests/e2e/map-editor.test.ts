/**
 * E2E tests for the map editor page
 * Tests interactive controls, state management, and component integration
 */

import { test, expect } from '@playwright/test';

test.describe('Map Editor Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/create-map');
	});

	test('should load the map editor page', async ({ page }) => {
		// Check page title
		await expect(page).toHaveTitle(/Create Your Map/);

		// Check header elements
		await expect(page.locator('h1')).toContainText('Map Editor');
		await expect(page.locator('.subtitle')).toContainText('Interactive map preview');

		// Check back link
		const backLink = page.locator('.back-link');
		await expect(backLink).toBeVisible();
		await expect(backLink).toHaveAttribute('href', '/');
	});

	test('should render map canvas with SVG', async ({ page }) => {
		// Wait for map canvas to render and load geographic data
		const svg = page.locator('.map-canvas');
		await expect(svg).toBeVisible();

		// Wait for geographic data to load (land and countries)
		await page.waitForTimeout(1000);

		// Check SVG has content (geographic features like land and countries)
		const landPath = svg.locator('.land');
		await expect(landPath).toBeVisible();

		const countriesPath = svg.locator('.countries');
		await expect(countriesPath).toBeVisible();
	});

	test('should display all control panels', async ({ page }) => {
		// Check panel title
		await expect(page.locator('.panel-title')).toContainText('Controls');

		// Check page size selector with dropdown
		await expect(page.locator('text=Print Size')).toBeVisible();
		await expect(page.locator('#paper-size')).toBeVisible();
		await expect(page.locator('text=Orientation')).toBeVisible();
		await expect(page.locator('text=Portrait')).toBeVisible();
		await expect(page.locator('text=Landscape')).toBeVisible();

		// Check zoom controls
		await expect(page.locator('text=Zoom')).toBeVisible();
		await expect(page.locator('[aria-label="Zoom in"]')).toBeVisible();
		await expect(page.locator('[aria-label="Zoom out"]')).toBeVisible();
		await expect(page.locator('[aria-label="Reset zoom"]')).toBeVisible();

		// Check rotation controls with sliders (should be visible for orthographic projection)
		await expect(page.locator('text=Globe Rotation')).toBeVisible();
		await expect(page.locator('text=Longitude')).toBeVisible();
		await expect(page.locator('text=Latitude')).toBeVisible();
		await expect(page.locator('text=Roll')).toBeVisible();
		await expect(page.locator('#rotation-longitude')).toBeVisible();
		await expect(page.locator('#rotation-latitude')).toBeVisible();
		await expect(page.locator('#rotation-roll')).toBeVisible();
	});

	test('should display sample data info', async ({ page }) => {
		await expect(page.locator('text=Sample Data')).toBeVisible();
		await expect(page.locator('text=Alice: NY → London → Tokyo')).toBeVisible();
		await expect(page.locator('text=Bob: Toronto → Paris → Sydney')).toBeVisible();
	});

	test('should show print boundary toggle', async ({ page }) => {
		const boundaryToggle = page.locator('text=Show Print Boundary');
		await expect(boundaryToggle).toBeVisible();

		// Checkbox should be checked by default
		const checkbox = page.locator('input[type="checkbox"]');
		await expect(checkbox).toBeChecked();
	});

	test('should change page size when dropdown changed', async ({ page }) => {
		// Wait for initial render
		await page.waitForTimeout(500);

		// Change paper size to A3
		const sizeDropdown = page.locator('#paper-size');
		await expect(sizeDropdown).toBeVisible();
		await sizeDropdown.selectOption('A3');

		// Wait for re-render
		await page.waitForTimeout(300);

		// Verify A3 is selected
		const selectedValue = await sizeDropdown.inputValue();
		expect(selectedValue).toBe('A3');
	});

	test('should update zoom when controls used', async ({ page }) => {
		// Wait for initial render
		await page.waitForTimeout(500);

		// Get initial zoom value
		const zoomDisplay = page.locator('.zoom-value');
		const initialZoom = await zoomDisplay.textContent();
		expect(initialZoom).toContain('100%');

		// Click zoom in button
		const zoomInButton = page.locator('[aria-label="Zoom in"]');
		await zoomInButton.click();

		// Wait for update
		await page.waitForTimeout(200);

		// Verify zoom increased
		const newZoom = await zoomDisplay.textContent();
		expect(newZoom).not.toBe(initialZoom);
	});

	test('should update rotation when sliders used', async ({ page }) => {
		// Wait for initial render
		await page.waitForTimeout(500);

		// Get initial longitude rotation value
		const longitudeValue = page.locator('text=Longitude').locator('..').locator('.value');
		const initialLongitude = await longitudeValue.textContent();

		// Move longitude slider
		const longitudeSlider = page.locator('#rotation-longitude');
		await longitudeSlider.fill('10');

		// Wait for update
		await page.waitForTimeout(200);

		// Verify rotation changed
		const newLongitude = await longitudeValue.textContent();
		expect(newLongitude).not.toBe(initialLongitude);
		expect(newLongitude).toContain('10°');
	});

	test('should reset rotation when reset button clicked', async ({ page }) => {
		// Wait for initial render
		await page.waitForTimeout(500);

		// Rotate the globe first using slider
		const longitudeSlider = page.locator('#rotation-longitude');
		await longitudeSlider.fill('45');

		// Wait for rotation
		await page.waitForTimeout(200);

		// Click reset button
		const resetButton = page.locator('text=Reset Rotation');
		await resetButton.click();

		// Wait for reset
		await page.waitForTimeout(200);

		// Verify rotation is back to default (-20°)
		const longitudeValue = page.locator('text=Longitude').locator('..').locator('.value');
		const longitude = await longitudeValue.textContent();
		expect(longitude).toContain('-20°');
	});

	test('should toggle boundary visibility when checkbox clicked', async ({ page }) => {
		// Wait for initial render
		await page.waitForTimeout(500);

		// Click checkbox to hide boundary
		const checkbox = page.locator('input[type="checkbox"]');
		await checkbox.click();

		// Wait for update
		await page.waitForTimeout(200);

		// Verify checkbox is unchecked
		await expect(checkbox).not.toBeChecked();

		// Click again to show boundary
		await checkbox.click();

		// Wait for update
		await page.waitForTimeout(200);

		// Verify checkbox is checked
		await expect(checkbox).toBeChecked();
	});

	test('should have responsive layout', async ({ page }) => {
		// Desktop layout: control panel should be on the right
		const controlPanel = page.locator('.control-panel');
		await expect(controlPanel).toBeVisible();

		// Get viewport size
		const viewport = page.viewportSize();
		expect(viewport?.width).toBeGreaterThan(1024); // Default is 1280x720

		// Control panel should have fixed width on desktop (approximately 360px, allowing for borders)
		const panelWidth = await controlPanel.evaluate((el) => {
			if (el instanceof HTMLElement) {
				return el.offsetWidth;
			}
			return 0;
		});
		expect(panelWidth).toBeGreaterThanOrEqual(360);
		expect(panelWidth).toBeLessThanOrEqual(365);
	});

	test('should display map with migration paths', async ({ page }) => {
		// Wait for map to render
		await page.waitForTimeout(500);

		// Check for migration paths in SVG
		const pathsGroup = page.locator('.migration-paths');
		await expect(pathsGroup).toBeVisible();

		// Check for path elements (should have paths for Alice and Bob)
		const paths = pathsGroup.locator('path');
		const pathCount = await paths.count();
		expect(pathCount).toBeGreaterThan(0);

		// Check for location markers (circles)
		const markers = pathsGroup.locator('circle');
		const markerCount = await markers.count();
		expect(markerCount).toBeGreaterThan(0);
	});

	test('should handle zoom slider interaction', async ({ page }) => {
		// Wait for initial render
		await page.waitForTimeout(500);

		// Find zoom slider
		const zoomSlider = page.locator('input[type="range"][aria-label="Zoom level"]');
		await expect(zoomSlider).toBeVisible();

		// Get initial value
		const initialValue = await zoomSlider.getAttribute('value');

		// Move slider to a different position (150%)
		await zoomSlider.fill('150');

		// Wait for update
		await page.waitForTimeout(200);

		// Verify zoom display updated
		const zoomDisplay = page.locator('.zoom-value');
		await expect(zoomDisplay).toContainText('150%');
	});

	test('should disable zoom buttons at limits', async ({ page }) => {
		// Wait for initial render
		await page.waitForTimeout(500);

		// Set zoom to minimum (10%)
		const zoomSlider = page.locator('input[type="range"][aria-label="Zoom level"]');
		await zoomSlider.fill('10');
		await page.waitForTimeout(200);

		// Zoom out button should be disabled
		const zoomOutButton = page.locator('[aria-label="Zoom out"]');
		await expect(zoomOutButton).toBeDisabled();

		// Set zoom to maximum (1000%)
		await zoomSlider.fill('1000');
		await page.waitForTimeout(200);

		// Zoom in button should be disabled
		const zoomInButton = page.locator('[aria-label="Zoom in"]');
		await expect(zoomInButton).toBeDisabled();
	});

	test('should maintain state across control interactions', async ({ page }) => {
		// Wait for initial render
		await page.waitForTimeout(500);

		// Change page size to A3
		const sizeDropdown = page.locator('#paper-size');
		await sizeDropdown.selectOption('A3');
		await page.waitForTimeout(200);

		// Zoom in
		const zoomInButton = page.locator('[aria-label="Zoom in"]');
		await zoomInButton.click();
		await page.waitForTimeout(200);

		// Rotate using slider
		const longitudeSlider = page.locator('#rotation-longitude');
		await longitudeSlider.fill('30');
		await page.waitForTimeout(200);

		// Verify all states are maintained
		const selectedSize = await sizeDropdown.inputValue();
		expect(selectedSize).toBe('A3');

		const zoomDisplay = page.locator('.zoom-value');
		const zoom = await zoomDisplay.textContent();
		expect(zoom).not.toContain('100%'); // Should be zoomed

		const longitudeValue = page.locator('text=Longitude').locator('..').locator('.value');
		const longitude = await longitudeValue.textContent();
		expect(longitude).toContain('30°'); // Should be rotated to 30°
	});

	test('should display projection switcher', async ({ page }) => {
		await expect(page.locator('text=Map View')).toBeVisible();
		await expect(page.locator('button:has-text("Globe")')).toBeVisible();
		await expect(page.locator('button:has-text("Flat Map")')).toBeVisible();
		// After clicking Flat Map, dropdown should appear
		await page.click('button:has-text("Flat Map")');
		await page.waitForTimeout(200);
		await expect(page.locator('#flat-projection')).toBeVisible();
	});

	test('should switch between projections', async ({ page }) => {
		// Wait for initial render
		await page.waitForTimeout(500);

		// Globe should be active initially
		const globeButton = page.locator('button:has-text("Globe")');
		await expect(globeButton).toHaveClass(/active/);

		// Switch to Flat Map
		const flatMapButton = page.locator('button:has-text("Flat Map")');
		await flatMapButton.click();
		await page.waitForTimeout(300);

		// Flat Map should now be active
		await expect(flatMapButton).toHaveClass(/active/);
		await expect(globeButton).not.toHaveClass(/active/);

		// Rotation controls should be hidden, Pan controls should be visible
		await expect(page.locator('text=Globe Rotation')).not.toBeVisible();
		await expect(page.locator('text=Pan Map')).toBeVisible();
	});

	test.skip('should show pan controls for non-orthographic projections', async ({ page }) => {
		// Wait for initial render
		await page.waitForTimeout(500);

		// Switch to Mercator
		const mercatorButton = page.locator('button:has-text("Mercator")');
		await mercatorButton.click();
		await page.waitForTimeout(300);

		// Pan controls should be visible
		await expect(page.locator('text=Pan Map')).toBeVisible();
		await expect(page.locator('#pan-x')).toBeVisible();
		await expect(page.locator('#pan-y')).toBeVisible();
		await expect(page.locator('text=Horizontal')).toBeVisible();
		await expect(page.locator('text=Vertical')).toBeVisible();
	});

	test('should update pan position when sliders used', async ({ page }) => {
		// Wait for initial render
		await page.waitForTimeout(500);

		// Switch to Flat Map
		const flatMapButton = page.locator('button:has-text("Flat Map")');
		await flatMapButton.click();
		await page.waitForTimeout(300);

		// Get initial pan value
		const horizontalValue = page.locator('text=Horizontal').locator('..').locator('.value');
		const initialPan = await horizontalValue.textContent();

		// Move horizontal slider
		const panXSlider = page.locator('#pan-x');
		await panXSlider.fill('100');
		await page.waitForTimeout(200);

		// Verify pan changed
		const newPan = await horizontalValue.textContent();
		expect(newPan).not.toBe(initialPan);
		expect(newPan).toContain('100px');
	});

	test.skip('should reset pan when reset button clicked', async ({ page }) => {
		// Wait for initial render
		await page.waitForTimeout(500);

		// Switch to Mercator
		const mercatorButton = page.locator('button:has-text("Mercator")');
		await mercatorButton.click();
		await page.waitForTimeout(300);

		// Pan the map
		const panXSlider = page.locator('#pan-x');
		await panXSlider.fill('200');
		await page.waitForTimeout(200);

		// Reset pan
		const resetButton = page.locator('text=Reset Pan');
		await resetButton.click();
		await page.waitForTimeout(200);

		// Verify pan is back to 0
		const horizontalValue = page.locator('text=Horizontal').locator('..').locator('.value');
		const pan = await horizontalValue.textContent();
		expect(pan).toContain('0px');
	});
});
