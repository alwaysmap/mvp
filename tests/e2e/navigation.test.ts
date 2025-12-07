import { test, expect } from '@playwright/test';

test.describe('Navigation and Page Structure', () => {
	test('landing page loads with correct content', async ({ page }) => {
		await page.goto('/');

		// Check title
		await expect(page).toHaveTitle(/AlwaysMap - Turn Your Family's Journey Into Art/);

		// Check hero section
		const h1 = page.locator('h1');
		await expect(h1).toHaveText('AlwaysMap');

		const tagline = page.locator('.tagline');
		await expect(tagline).toContainText('Turn your family\'s journey into beautiful wall art');

		// Check CTA button exists and has correct href
		const ctaButton = page.locator('.cta-button');
		await expect(ctaButton).toBeVisible();
		await expect(ctaButton).toHaveText('Create Your Map');
		await expect(ctaButton).toHaveAttribute('href', '/create-map');

		// Check features section exists
		const featuresHeading = page.locator('.features h2');
		await expect(featuresHeading).toHaveText('How It Works');

		// Check all three feature cards
		const featureCards = page.locator('.feature');
		await expect(featureCards).toHaveCount(3);

		// Verify feature titles
		await expect(featureCards.nth(0).locator('h3')).toHaveText('Add Locations');
		await expect(featureCards.nth(1).locator('h3')).toHaveText('Customize Design');
		await expect(featureCards.nth(2).locator('h3')).toHaveText('Print & Frame');

		// Check tech specs section
		const techHeading = page.locator('.tech-specs h2');
		await expect(techHeading).toHaveText('Museum-Quality Prints');

		const techItems = page.locator('.tech-specs li');
		await expect(techItems).toHaveCount(4);
		await expect(techItems.nth(0)).toContainText('300 DPI');
		await expect(techItems.nth(1)).toContainText('Multiple sizes');
		await expect(techItems.nth(2)).toContainText('sRGB color profile');
		await expect(techItems.nth(3)).toContainText('Premium paper');

		// Check footer
		const footer = page.locator('footer');
		await expect(footer).toContainText('AlwaysMap POC - Phase 1 Complete');
	});

	test('clicking CTA button navigates to create-map page', async ({ page }) => {
		await page.goto('/');

		// Click the CTA button
		await page.click('.cta-button');

		// Wait for navigation
		await page.waitForURL('/create-map');

		// Verify we're on the create-map page
		await expect(page).toHaveTitle(/Create Your Map - AlwaysMap/);
	});
});

test.describe('Create Map Page', () => {
	test('create-map page loads with correct structure', async ({ page }) => {
		await page.goto('/create-map');

		// Check title
		await expect(page).toHaveTitle(/Create Your Map - AlwaysMap/);

		// Check header
		const h1 = page.locator('h1');
		await expect(h1).toHaveText('Map Editor');

		// Check back link
		const backLink = page.locator('.back-link');
		await expect(backLink).toBeVisible();
		await expect(backLink).toHaveText('← Back to Home');
		await expect(backLink).toHaveAttribute('href', '/');

		// Check map canvas exists
		const canvasArea = page.locator('.canvas-area');
		await expect(canvasArea).toBeVisible();

		// Check SVG element exists
		const svg = page.locator('.map-canvas');
		await expect(svg).toBeVisible();

		// Check control panel exists
		const controlPanel = page.locator('.control-panel');
		await expect(controlPanel).toBeVisible();

		// Check panel title
		const panelTitle = page.locator('.panel-title');
		await expect(panelTitle).toHaveText('Controls');

		// Check info section exists
		const infoSection = page.locator('.info-section');
		await expect(infoSection).toBeVisible();

		// Verify sample data is shown
		const infoSectionHeading = page.locator('.info-section h3');
		await expect(infoSectionHeading).toHaveText('Sample Data');
	});

	test('back link navigates to home page', async ({ page }) => {
		await page.goto('/create-map');

		// Click back link
		await page.click('.back-link');

		// Wait for navigation
		await page.waitForURL('/');

		// Verify we're back on home page
		await expect(page).toHaveTitle(/AlwaysMap - Turn Your Family's Journey Into Art/);
	});

	test.skip('map renderer completes successfully', async ({ page }) => {
		await page.goto('/create-map');

		// Wait for SVG to be rendered
		const svg = page.locator('.map-canvas');
		await expect(svg).toBeVisible({ timeout: 10000 });

		// Check SVG has width and height attributes
		const width = await svg.getAttribute('width');
		const height = await svg.getAttribute('height');
		expect(width).toBeTruthy();
		expect(height).toBeTruthy();
		expect(parseFloat(width!)).toBeGreaterThan(0);
		expect(parseFloat(height!)).toBeGreaterThan(0);

		// Check for ocean circle (background)
		const ocean = svg.locator('.ocean');
		await expect(ocean).toBeVisible();

		// Check for land paths
		const land = svg.locator('.land');
		await expect(land).toBeVisible();

		// Check for title box
		const titleBox = svg.locator('.title-box');
		await expect(titleBox).toBeVisible();

		// Check for QR code
		const qrCode = svg.locator('.qr-code');
		await expect(qrCode).toBeVisible();

		// Check for migration paths group
		const migrationPaths = svg.locator('.migration-paths');
		await expect(migrationPaths).toBeVisible();

		// Check that there are path elements for the migration routes
		const paths = svg.locator('path.path');
		const pathCount = await paths.count();
		expect(pathCount).toBeGreaterThan(0);

		// Check that there are marker circles for locations
		const markers = svg.locator('circle.marker');
		const markerCount = await markers.count();
		expect(markerCount).toBeGreaterThan(0);
	});

	test.skip('fonts are loaded before rendering', async ({ page }) => {
		await page.goto('/create-map');

		// Wait for map to be visible
		const svg = page.locator('.map-canvas');
		await expect(svg).toBeVisible({ timeout: 10000 });

		// Check console for font loading confirmation
		// We'll verify fonts are available by checking document.fonts
		const fontsLoaded = await page.evaluate(() => {
			const requiredFonts = [
				{ family: 'Cormorant Garamond', weight: 400, style: 'normal' },
				{ family: 'Cormorant Garamond', weight: 600, style: 'normal' },
				{ family: 'Cormorant Garamond', weight: 700, style: 'normal' },
				{ family: 'Cormorant Garamond', weight: 400, style: 'italic' },
				{ family: 'DM Sans', weight: 400, style: 'normal' },
				{ family: 'DM Sans', weight: 500, style: 'normal' },
				{ family: 'DM Sans', weight: 600, style: 'normal' }
			];

			return requiredFonts.every((font) => {
				const fontString = `${font.style} ${font.weight} 16px "${font.family}"`;
				return document.fonts.check(fontString);
			});
		});

		expect(fontsLoaded).toBe(true);
	});

	test.skip('render includes correct title and subtitle', async ({ page }) => {
		await page.goto('/create-map');

		// Wait for map to be visible
		const svg = page.locator('.map-canvas');
		await expect(svg).toBeVisible({ timeout: 10000 });

		// Check that title box contains the correct text
		const titleTexts = svg.locator('.title-box text');

		// Should have at least 2 text elements (title and subtitle)
		const textCount = await titleTexts.count();
		expect(textCount).toBeGreaterThanOrEqual(2);

		// Get all text content
		const allText = await svg.locator('.title-box').textContent();

		// Verify title and subtitle are present
		expect(allText).toContain('Our Family Journey');
		expect(allText).toContain('2010-2024');
	});

	test('handles geographic data loading', async ({ page }) => {
		await page.goto('/create-map');

		// Wait for map to be visible
		const svg = page.locator('.map-canvas');
		await expect(svg).toBeVisible({ timeout: 10000 });

		// Verify graticule (lat/lon grid) is rendered
		const graticule = svg.locator('.graticule');
		await expect(graticule).toBeVisible();

		// Verify countries layer is rendered
		const countries = svg.locator('.countries');
		await expect(countries).toBeVisible();
	});

	test.skip('QR code renders with correct structure', async ({ page }) => {
		await page.goto('/create-map');

		// Wait for map to be visible
		const svg = page.locator('.map-canvas');
		await expect(svg).toBeVisible({ timeout: 10000 });
		const qrCode = svg.locator('.qr-code');
		await expect(qrCode).toBeVisible();

		// QR code should have a background rect
		const bgRect = qrCode.locator('rect').first();
		await expect(bgRect).toBeVisible();

		// Should have white background
		const fill = await bgRect.getAttribute('fill');
		expect(fill).toBe('#FFFFFF');

		// QR code should have multiple path elements (the QR pattern)
		const paths = qrCode.locator('path');
		const pathCount = await paths.count();

		// A QR code should have at least 2 paths (background + pattern)
		expect(pathCount).toBeGreaterThanOrEqual(2);

		// First path should be white background fill
		const firstPath = paths.first();
		const firstFill = await firstPath.getAttribute('fill');
		expect(firstFill).toBe('#FFFFFF');

		// Second path should have black stroke (QR pattern uses strokes)
		const secondPath = paths.nth(1);
		const stroke = await secondPath.getAttribute('stroke');
		expect(stroke).toBe('#000000');

		// Should have a text label
		const label = qrCode.locator('text');
		await expect(label).toBeVisible();
		await expect(label).toHaveText('Scan to visit AlwaysMap');

		// Verify the QR code has proper scaling (nested group with transform)
		const qrGroups = qrCode.locator('g');
		const groupCount = await qrGroups.count();
		expect(groupCount).toBeGreaterThan(0);

		// Check that at least one group has a scale transform
		let hasScaleTransform = false;
		for (let i = 0; i < groupCount; i++) {
			const transform = await qrGroups.nth(i).getAttribute('transform');
			if (transform && transform.includes('scale')) {
				hasScaleTransform = true;
				break;
			}
		}
		expect(hasScaleTransform).toBe(true);
	});

	test.skip('QR code has correct stroke attributes and path data', async ({ page }) => {
		await page.goto('/create-map');

		// Wait for map to be visible
		const svg = page.locator('.map-canvas');
		await expect(svg).toBeVisible({ timeout: 10000 });
		const qrCode = svg.locator('.qr-code');

		// Get path information
		const paths = qrCode.locator('path');
		const pathCount = await paths.count();
		expect(pathCount).toBe(2);

		// First path: white background
		const path0 = await paths.nth(0).evaluate((el) => ({
			fill: el.getAttribute('fill'),
			stroke: el.getAttribute('stroke'),
			hasPathData: (el.getAttribute('d')?.length || 0) > 0
		}));

		expect(path0.fill).toBe('#FFFFFF');
		expect(path0.stroke).toBeNull();
		expect(path0.hasPathData).toBe(true);

		// Second path: QR pattern with stroke
		const path1 = await paths.nth(1).evaluate((el) => ({
			fill: el.getAttribute('fill'),
			stroke: el.getAttribute('stroke'),
			strokeWidth: el.getAttribute('stroke-width'),
			pathDataLength: el.getAttribute('d')?.length || 0
		}));

		expect(path1.fill).toBeNull();
		expect(path1.stroke).toBe('#000000');
		expect(path1.strokeWidth).toBe('1');
		// QR code path should be long (contains all the pattern data)
		expect(path1.pathDataLength).toBeGreaterThan(100);

		// Verify the scale transform exists
		const groups = qrCode.locator('g');
		const groupCount = await groups.count();
		expect(groupCount).toBeGreaterThan(0);

		const transform = await groups.first().getAttribute('transform');
		expect(transform).toContain('scale');
	});

	test.skip('map uses antique parchment background color', async ({ page }) => {
		await page.goto('/create-map');

		// Wait for map to be visible
		const svg = page.locator('.map-canvas');
		await expect(svg).toBeVisible({ timeout: 10000 });

		// Method 1: Check the inline style attribute (set by D3)
		const styleAttr = await svg.getAttribute('style');
		expect(styleAttr).toBeTruthy();
		expect(styleAttr).toContain('background-color');
		expect(styleAttr).toMatch(/#f4ebe1|rgb\(244,\s*235,\s*225\)/i);

		// Method 2: Check computed style (what actually renders)
		const bgColor = await svg.evaluate((el) => {
			return window.getComputedStyle(el).backgroundColor;
		});

		// Should be rgb(244, 235, 225) - antique parchment
		expect(bgColor).toMatch(/rgb\(244,\s*235,\s*225\)|#f4ebe1/i);

		console.log('Background color verified:', bgColor);
	});
});
