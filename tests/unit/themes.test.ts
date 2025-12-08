/**
 * Theme System Tests
 *
 * Validates the theme system's type safety, completeness, and runtime behavior.
 */

import { describe, it, expect } from 'vitest';
import {
	THEMES,
	DEFAULT_THEME_ID,
	getTheme,
	getAllThemes,
	isValidTheme,
	type MapTheme
} from '$lib/map-renderer/themes';

describe('Theme System', () => {
	describe('THEMES constant', () => {
		it('should contain all required themes', () => {
			const themeIds = Object.keys(THEMES);
			expect(themeIds).toContain('antique-parchment');
			expect(themeIds).toContain('cool-blue');
			expect(themeIds).toContain('modern-gray');
			expect(themeIds).toContain('warm-earth');
		});

		it('should have at least 4 themes', () => {
			const themeIds = Object.keys(THEMES);
			expect(themeIds.length).toBeGreaterThanOrEqual(4);
		});
	});

	describe('MapTheme interface compliance', () => {
		it('should have all themes implement MapTheme interface', () => {
			Object.values(THEMES).forEach((theme) => {
				// Basic properties
				expect(theme).toHaveProperty('id');
				expect(theme).toHaveProperty('name');
				expect(theme).toHaveProperty('description');
				expect(theme).toHaveProperty('colors');

				expect(typeof theme.id).toBe('string');
				expect(typeof theme.name).toBe('string');
				expect(typeof theme.description).toBe('string');
				expect(typeof theme.colors).toBe('object');
			});
		});

		it('should have all themes define complete color palettes', () => {
			const requiredColors = [
				'canvasBackground',
				'ocean',
				'land',
				'landStroke',
				'countryBorder',
				'graticule',
				'titleText',
				'subtitleText',
				'labelText',
				'attributionText',
				'defaultPaths'
			];

			Object.values(THEMES).forEach((theme) => {
				requiredColors.forEach((colorKey) => {
					expect(theme.colors).toHaveProperty(colorKey);
				});
			});
		});

		it('should have all color values as valid hex strings (except defaultPaths)', () => {
			const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

			Object.values(THEMES).forEach((theme) => {
				// Check single colors
				expect(theme.colors.canvasBackground).toMatch(hexColorRegex);
				expect(theme.colors.ocean).toMatch(hexColorRegex);
				expect(theme.colors.land).toMatch(hexColorRegex);
				expect(theme.colors.landStroke).toMatch(hexColorRegex);
				expect(theme.colors.countryBorder).toMatch(hexColorRegex);
				expect(theme.colors.graticule).toMatch(hexColorRegex);
				expect(theme.colors.titleText).toMatch(hexColorRegex);
				expect(theme.colors.subtitleText).toMatch(hexColorRegex);
				expect(theme.colors.labelText).toMatch(hexColorRegex);
				expect(theme.colors.attributionText).toMatch(hexColorRegex);
			});
		});

		it('should have defaultPaths as array of hex color strings', () => {
			const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

			Object.values(THEMES).forEach((theme) => {
				expect(Array.isArray(theme.colors.defaultPaths)).toBe(true);
				expect(theme.colors.defaultPaths.length).toBeGreaterThan(0);

				theme.colors.defaultPaths.forEach((color) => {
					expect(color).toMatch(hexColorRegex);
				});
			});
		});

		it('should have at least 5 default path colors per theme', () => {
			Object.values(THEMES).forEach((theme) => {
				expect(theme.colors.defaultPaths.length).toBeGreaterThanOrEqual(5);
			});
		});
	});

	describe('getTheme()', () => {
		it('should return default theme when no ID provided', () => {
			const theme = getTheme();
			expect(theme.id).toBe(DEFAULT_THEME_ID);
		});

		it('should return default theme when undefined provided', () => {
			const theme = getTheme(undefined);
			expect(theme.id).toBe(DEFAULT_THEME_ID);
		});

		it('should return correct theme for valid ID', () => {
			const theme = getTheme('cool-blue');
			expect(theme.id).toBe('cool-blue');
			expect(theme.name).toBe('Cool Blue');
		});

		it('should return default theme for invalid ID', () => {
			const theme = getTheme('nonexistent-theme');
			expect(theme.id).toBe(DEFAULT_THEME_ID);
		});

		it('should return default theme for empty string', () => {
			const theme = getTheme('');
			expect(theme.id).toBe(DEFAULT_THEME_ID);
		});

		it('should return complete theme objects', () => {
			const theme = getTheme('modern-gray');
			expect(theme).toHaveProperty('id');
			expect(theme).toHaveProperty('name');
			expect(theme).toHaveProperty('description');
			expect(theme).toHaveProperty('colors');
			expect(theme.colors).toHaveProperty('canvasBackground');
			expect(theme.colors).toHaveProperty('defaultPaths');
		});

		it('should work for all defined themes', () => {
			const themeIds = Object.keys(THEMES);
			themeIds.forEach((id) => {
				const theme = getTheme(id);
				expect(theme.id).toBe(id);
			});
		});
	});

	describe('getAllThemes()', () => {
		it('should return an array', () => {
			const themes = getAllThemes();
			expect(Array.isArray(themes)).toBe(true);
		});

		it('should return at least 4 themes', () => {
			const themes = getAllThemes();
			expect(themes.length).toBeGreaterThanOrEqual(4);
		});

		it('should return complete theme objects', () => {
			const themes = getAllThemes();
			themes.forEach((theme) => {
				expect(theme).toHaveProperty('id');
				expect(theme).toHaveProperty('name');
				expect(theme).toHaveProperty('description');
				expect(theme).toHaveProperty('colors');
			});
		});

		it('should contain all expected themes', () => {
			const themes = getAllThemes();
			const themeIds = themes.map((t) => t.id);
			expect(themeIds).toContain('antique-parchment');
			expect(themeIds).toContain('cool-blue');
			expect(themeIds).toContain('modern-gray');
			expect(themeIds).toContain('warm-earth');
		});

		it('should have unique theme IDs', () => {
			const themes = getAllThemes();
			const themeIds = themes.map((t) => t.id);
			const uniqueIds = new Set(themeIds);
			expect(uniqueIds.size).toBe(themeIds.length);
		});

		it('should have unique theme names', () => {
			const themes = getAllThemes();
			const themeNames = themes.map((t) => t.name);
			const uniqueNames = new Set(themeNames);
			expect(uniqueNames.size).toBe(themeNames.length);
		});
	});

	describe('isValidTheme()', () => {
		it('should return true for valid theme IDs', () => {
			expect(isValidTheme('antique-parchment')).toBe(true);
			expect(isValidTheme('cool-blue')).toBe(true);
			expect(isValidTheme('modern-gray')).toBe(true);
			expect(isValidTheme('warm-earth')).toBe(true);
		});

		it('should return false for invalid theme IDs', () => {
			expect(isValidTheme('nonexistent')).toBe(false);
			expect(isValidTheme('invalid-theme')).toBe(false);
			expect(isValidTheme('')).toBe(false);
		});

		it('should return false for undefined', () => {
			expect(isValidTheme(undefined as any)).toBe(false);
		});

		it('should return false for null', () => {
			expect(isValidTheme(null as any)).toBe(false);
		});

		it('should be case-sensitive', () => {
			expect(isValidTheme('ANTIQUE-PARCHMENT')).toBe(false);
			expect(isValidTheme('Cool-Blue')).toBe(false);
		});

		it('should work for all defined themes', () => {
			const themeIds = Object.keys(THEMES);
			themeIds.forEach((id) => {
				expect(isValidTheme(id)).toBe(true);
			});
		});
	});

	describe('DEFAULT_THEME_ID', () => {
		it('should be a valid theme ID', () => {
			expect(isValidTheme(DEFAULT_THEME_ID)).toBe(true);
		});

		it('should exist in THEMES', () => {
			const themeIds = Object.keys(THEMES);
			expect(themeIds).toContain(DEFAULT_THEME_ID);
		});

		it('should be retrievable via getTheme()', () => {
			const theme = getTheme(DEFAULT_THEME_ID);
			expect(theme.id).toBe(DEFAULT_THEME_ID);
		});
	});

	describe('Theme content validation', () => {
		it('should have meaningful theme names', () => {
			Object.values(THEMES).forEach((theme) => {
				expect(theme.name.length).toBeGreaterThan(0);
				expect(theme.name.trim()).toBe(theme.name); // No leading/trailing whitespace
			});
		});

		it('should have meaningful descriptions', () => {
			Object.values(THEMES).forEach((theme) => {
				expect(theme.description.length).toBeGreaterThan(10);
				expect(theme.description.trim()).toBe(theme.description);
			});
		});

		it('should have ID matching object key', () => {
			Object.entries(THEMES).forEach(([key, theme]) => {
				expect(theme.id).toBe(key);
			});
		});
	});

	describe('Color palette validation', () => {
		it('should have distinct colors for land and ocean', () => {
			Object.values(THEMES).forEach((theme) => {
				expect(theme.colors.land).not.toBe(theme.colors.ocean);
			});
		});

		it('should have distinct colors for land and canvas background', () => {
			Object.values(THEMES).forEach((theme) => {
				expect(theme.colors.land).not.toBe(theme.colors.canvasBackground);
			});
		});

		it('should have distinct title and subtitle text colors or same color', () => {
			// This is a soft constraint - they can be the same or different
			Object.values(THEMES).forEach((theme) => {
				expect(typeof theme.colors.titleText).toBe('string');
				expect(typeof theme.colors.subtitleText).toBe('string');
			});
		});

		it('should have no duplicate colors in defaultPaths', () => {
			Object.values(THEMES).forEach((theme) => {
				const uniqueColors = new Set(theme.colors.defaultPaths);
				expect(uniqueColors.size).toBe(theme.colors.defaultPaths.length);
			});
		});
	});

	describe('Type safety (compile-time guarantees)', () => {
		it('should enforce MapTheme structure at compile time', () => {
			// This test verifies that the satisfies operator is working
			// If we add a new property to MapTheme, this will fail to compile
			// until all themes define that property

			const testTheme: MapTheme = THEMES['antique-parchment'];
			expect(testTheme).toBeDefined();
		});

		it('should allow assignment to Record<string, MapTheme>', () => {
			// Verify that THEMES can be treated as a Record
			const themesRecord: Record<string, MapTheme> = THEMES;
			expect(Object.keys(themesRecord).length).toBeGreaterThan(0);
		});
	});

	describe('Integration scenarios', () => {
		it('should support theme lookup from database ID', () => {
			// Simulate database returning theme ID
			const dbThemeId = 'cool-blue';
			const theme = getTheme(dbThemeId);
			expect(theme.id).toBe('cool-blue');
		});

		it('should gracefully handle missing theme ID from database', () => {
			// Simulate database returning null/undefined
			const theme = getTheme(undefined);
			expect(theme.id).toBe(DEFAULT_THEME_ID);
		});

		it('should support UI dropdown population', () => {
			// Simulate populating a dropdown
			const themes = getAllThemes();
			const dropdownOptions = themes.map((t) => ({ value: t.id, label: t.name }));

			expect(dropdownOptions.length).toBeGreaterThan(0);
			dropdownOptions.forEach((opt) => {
				expect(opt.value).toBeTruthy();
				expect(opt.label).toBeTruthy();
			});
		});

		it('should support theme validation before saving', () => {
			// Simulate form validation
			const validThemeId = 'warm-earth';
			const invalidThemeId = 'nonexistent';

			expect(isValidTheme(validThemeId)).toBe(true);
			expect(isValidTheme(invalidThemeId)).toBe(false);
		});

		it('should provide consistent theme objects across multiple calls', () => {
			// Verify that getTheme returns same structure each time
			const theme1 = getTheme('modern-gray');
			const theme2 = getTheme('modern-gray');

			expect(theme1).toEqual(theme2);
		});
	});
});
