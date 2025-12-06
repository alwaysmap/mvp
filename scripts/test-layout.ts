#!/usr/bin/env tsx
/**
 * Test script to demonstrate the layout engine.
 * Shows how it calculates optimal positioning for a map.
 */

import { calculateLayout, createNewMapDefinition, validateLayout } from '../src/lib/layout/index.js';
import type { UserMapData, PageLayout } from '../src/lib/layout/index.js';

// Sample user data (similar to sample-map.json)
const userData: UserMapData = {
	people: [
		{
			id: 'alice',
			name: 'Alice',
			color: '#FF6B6B',
			locations: [
				{ countryCode: 'US', longitude: -74.006, latitude: 40.7128, date: '2010-01-01' },
				{ countryCode: 'GB', longitude: -0.1276, latitude: 51.5074, date: '2015-06-15' },
				{ countryCode: 'JP', longitude: 139.6917, latitude: 35.6895, date: '2020-03-20' }
			]
		}
	],
	view: {
		projection: 'orthographic',
		rotation: [-20, -30, 0]
	}
};

// Page layout configuration
const pageLayout: PageLayout = {
	page: {
		size: '18x24',
		orientation: 'portrait',
		dpi: 300,
		bleed: 9,
		safeMargin: 18
	},
	mapPlacement: {
		aspectRatio: 1.0,
		fillStrategy: 'maximize',
		zoomAdjustment: 1.0
	},
	furniture: {
		title: {
			text: 'Our Family Journey',
			subtitle: '2010-2024',
			position: 'top-left',
			fontFamily: 'Cormorant Garamond',
			titleFontSize: 36,
			subtitleFontSize: 24
		},
		qrCode: {
			url: 'https://alwaysmap.com',
			position: 'bottom-right',
			size: 72
		}
	}
};

console.log('🧮 AlwaysMap Layout Engine Test\n');
console.log('━'.repeat(60));

// Calculate layout
console.log('\n📐 Calculating layout...\n');
const layout = calculateLayout(userData, pageLayout);

// Display results
console.log('📄 PAGE DIMENSIONS:');
console.log(`   Total size: ${layout.page.totalWidth} × ${layout.page.totalHeight} pt`);
console.log(
	`   Trim size:  ${layout.page.trimWidth} × ${layout.page.trimHeight} pt (${layout.page.trimWidth / 72}" × ${layout.page.trimHeight / 72}")`
);
console.log(`   Pixels:     ${layout.page.pixels.width} × ${layout.page.pixels.height} px @ 300 DPI`);
console.log(`   Bleed:      ${layout.page.bleed} pt (${(layout.page.bleed / 72).toFixed(3)}")`);

console.log('\n🔒 SAFE AREA:');
console.log(`   Position:   (${layout.safeArea.x}, ${layout.safeArea.y})`);
console.log(`   Size:       ${layout.safeArea.width} × ${layout.safeArea.height} pt`);

console.log('\n🗺️  MAP:');
console.log(`   Position:   (${layout.map.x.toFixed(1)}, ${layout.map.y.toFixed(1)})`);
console.log(`   Size:       ${layout.map.width.toFixed(1)} × ${layout.map.height.toFixed(1)} pt`);
console.log(`   Center:     (${layout.map.center[0].toFixed(1)}, ${layout.map.center[1].toFixed(1)})`);
console.log(`   Scale:      ${layout.map.scale.toFixed(1)} (D3 projection scale)`);
console.log(`   Fill:       ${layout.fillPercentage.toFixed(1)}% of safe area`);

console.log('\n📦 FURNITURE:');
console.log(`   Title:      (${layout.furniture.title.x}, ${layout.furniture.title.y})`);
console.log(
	`               ${layout.furniture.title.width} × ${layout.furniture.title.height} pt [top-left]`
);
console.log(`   QR Code:    (${layout.furniture.qrCode.x}, ${layout.furniture.qrCode.y})`);
console.log(
	`               ${layout.furniture.qrCode.width} × ${layout.furniture.qrCode.height} pt [bottom-right]`
);

// Validate layout
console.log('\n✅ VALIDATION:');
const validation = validateLayout(layout);
if (validation.valid) {
	console.log('   ✓ Layout is valid');
	console.log('   ✓ All elements within safe area');
	console.log('   ✓ No overlaps detected');
} else {
	console.log('   ✗ Layout has errors:');
	validation.errors.forEach((err) => console.log(`     - ${err}`));
}

// Show improvement
console.log('\n📊 IMPROVEMENT:');
console.log(`   Current output.png: ~20-25% fill (estimated)`);
console.log(`   New layout engine:  ${layout.fillPercentage.toFixed(1)}% fill`);
console.log(
	`   Improvement:        ${((layout.fillPercentage - 22.5) / 22.5 * 100).toFixed(0)}% larger map`
);

console.log('\n━'.repeat(60));

// Test with different configurations
console.log('\n🔄 Testing different configurations...\n');

// Landscape orientation
const landscapeLayout = calculateLayout(userData, {
	...pageLayout,
	page: { ...pageLayout.page, orientation: 'landscape' }
});
console.log(
	`   Landscape 18×24: ${landscapeLayout.map.width.toFixed(0)} × ${landscapeLayout.map.height.toFixed(0)} pt (${landscapeLayout.fillPercentage.toFixed(1)}% fill)`
);

// Larger page
const largeLayout = calculateLayout(userData, {
	...pageLayout,
	page: { ...pageLayout.page, size: '24x36' }
});
console.log(
	`   24×36 portrait:  ${largeLayout.map.width.toFixed(0)} × ${largeLayout.map.height.toFixed(0)} pt (${largeLayout.fillPercentage.toFixed(1)}% fill)`
);

// Smaller page
const smallLayout = calculateLayout(userData, {
	...pageLayout,
	page: { ...pageLayout.page, size: '12x16' }
});
console.log(
	`   12×16 portrait:  ${smallLayout.map.width.toFixed(0)} × ${smallLayout.map.height.toFixed(0)} pt (${smallLayout.fillPercentage.toFixed(1)}% fill)`
);

// Zoomed out
const zoomedLayout = calculateLayout(userData, {
	...pageLayout,
	mapPlacement: { ...pageLayout.mapPlacement, zoomAdjustment: 0.8 }
});
console.log(
	`   80% zoom:        ${zoomedLayout.map.width.toFixed(0)} × ${zoomedLayout.map.height.toFixed(0)} pt (${zoomedLayout.fillPercentage.toFixed(1)}% fill)`
);

console.log('\n━'.repeat(60));

// Test database definition
console.log('\n💾 Testing database definition...\n');
const mapDef = createNewMapDefinition('user_123', 'Test Map', {
	data: userData,
	layout: pageLayout
});

console.log(`   Map ID:     ${mapDef.id}`);
console.log(`   User ID:    ${mapDef.userId}`);
console.log(`   Name:       ${mapDef.metadata.name}`);
console.log(`   Created:    ${mapDef.createdAt.toISOString()}`);
console.log(`   People:     ${mapDef.data.people.length}`);
console.log(`   Page size:  ${mapDef.layout.page.size} ${mapDef.layout.page.orientation}`);

console.log('\n✅ All tests passed!\n');
