/**
 * Complete map definition for database storage.
 *
 * This module defines the complete, self-contained map definition that includes:
 * - Map style (how it looks)
 * - User data (what's on the map)
 * - Page layout (how it's positioned)
 * - Metadata (ownership, timestamps, etc.)
 *
 * This structure is designed to be stored in a database (e.g., Postgres/Supabase)
 * and contains everything needed to render a map identically every time.
 */

import type { MapStyle, UserMapData, PageLayout } from './types.js';

/**
 * Complete map definition for database storage.
 *
 * This is the top-level document that gets stored in the database.
 * It contains all three layers plus metadata.
 */
export interface CompleteMapDefinition {
	/** Unique identifier */
	id: string;

	/** User who owns this map */
	userId: string;

	/** Map metadata */
	metadata: MapMetadata;

	/** Layer 1: Map style (how it looks) */
	style: MapStyle;

	/** Layer 2: User data (what's on the map) */
	data: UserMapData;

	/** Layer 3: Page layout (how it's positioned) */
	layout: PageLayout;

	/** Timestamps */
	createdAt: Date;
	updatedAt: Date;

	/** Soft delete flag */
	deleted?: boolean;
	deletedAt?: Date;
}

/**
 * Map metadata (title, description, etc.)
 */
export interface MapMetadata {
	/** User-friendly map name (for their library) */
	name: string;

	/** Optional description */
	description?: string;

	/** Tags for organization */
	tags?: string[];

	/** Whether this map is published/shared */
	published: boolean;

	/** Share URL slug (if published) */
	shareSlug?: string;
}

/**
 * Map definition optimized for JSON storage in Postgres/Supabase.
 *
 * This is the serializable version that gets stored in JSONB columns.
 * Dates are stored as ISO 8601 strings.
 */
export interface StoredMapDefinition {
	id: string;
	userId: string;
	metadata: MapMetadata;
	style: MapStyle;
	data: UserMapData;
	layout: PageLayout;
	createdAt: string; // ISO 8601
	updatedAt: string; // ISO 8601
	deleted?: boolean;
	deletedAt?: string; // ISO 8601
}

/**
 * Converts CompleteMapDefinition to StoredMapDefinition (for database insert).
 */
export function toStoredDefinition(def: CompleteMapDefinition): StoredMapDefinition {
	return {
		...def,
		createdAt: def.createdAt.toISOString(),
		updatedAt: def.updatedAt.toISOString(),
		deletedAt: def.deletedAt?.toISOString()
	};
}

/**
 * Converts StoredMapDefinition to CompleteMapDefinition (from database query).
 */
export function fromStoredDefinition(stored: StoredMapDefinition): CompleteMapDefinition {
	return {
		...stored,
		createdAt: new Date(stored.createdAt),
		updatedAt: new Date(stored.updatedAt),
		deletedAt: stored.deletedAt ? new Date(stored.deletedAt) : undefined
	};
}

/**
 * Creates a new map definition with default values.
 */
export function createNewMapDefinition(
	userId: string,
	name: string,
	options?: {
		style?: Partial<MapStyle>;
		data?: Partial<UserMapData>;
		layout?: Partial<PageLayout>;
	}
): CompleteMapDefinition {
	const now = new Date();

	return {
		id: generateId(),
		userId,
		metadata: {
			name,
			published: false,
			tags: []
		},
		style: {
			ocean: { color: '#d4e7f5', visible: true },
			land: { color: '#e8dcc8', visible: true },
			countries: {
				stroke: '#c9b896',
				strokeWidth: 0.5,
				fill: 'none',
				visible: true
			},
			graticule: {
				stroke: '#d0d0d0',
				strokeWidth: 0.25,
				visible: true
			},
			paths: {
				stroke: '#FF5733',
				strokeWidth: 2,
				opacity: 0.8
			},
			background: {
				color: '#f4ebe1'
			},
			...options?.style
		},
		data: {
			people: [],
			view: {
				projection: 'orthographic',
				rotation: [0, 0, 0]
			},
			...options?.data
		},
		layout: {
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
					text: name,
					subtitle: '',
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
			},
			...options?.layout
		},
		createdAt: now,
		updatedAt: now
	};
}

/**
 * Generates a unique ID for a map.
 * In production, this would use a UUID generator or database sequence.
 */
function generateId(): string {
	return `map_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Database schema definition for Postgres/Supabase.
 *
 * This is documentation/reference for creating the database table.
 * Not executable code - just TypeScript as documentation.
 */
export const DATABASE_SCHEMA = `
-- Maps table
CREATE TABLE maps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Three layers (stored as JSONB for flexibility)
  style JSONB NOT NULL,
  data JSONB NOT NULL,
  layout JSONB NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,

  -- Indexes
  INDEX idx_maps_user_id (user_id),
  INDEX idx_maps_created_at (created_at),
  INDEX idx_maps_metadata_name ((metadata->>'name')),
  INDEX idx_maps_metadata_tags ((metadata->>'tags'))
);

-- Row-level security (Supabase)
ALTER TABLE maps ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own maps
CREATE POLICY maps_select_own
  ON maps FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy: Users can insert their own maps
CREATE POLICY maps_insert_own
  ON maps FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can update their own maps
CREATE POLICY maps_update_own
  ON maps FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Policy: Users can delete their own maps (soft delete)
CREATE POLICY maps_delete_own
  ON maps FOR DELETE
  USING (auth.uid()::text = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_maps_updated_at
  BEFORE UPDATE ON maps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;

/**
 * Validation rules for map definitions.
 */
export function validateMapDefinition(
	def: CompleteMapDefinition
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Validate ID
	if (!def.id || def.id.length === 0) {
		errors.push('Map ID is required');
	}

	// Validate user ID
	if (!def.userId || def.userId.length === 0) {
		errors.push('User ID is required');
	}

	// Validate metadata
	if (!def.metadata.name || def.metadata.name.trim().length === 0) {
		errors.push('Map name is required');
	}

	if (def.metadata.name.length > 200) {
		errors.push('Map name must be 200 characters or less');
	}

	// Validate data
	if (!Array.isArray(def.data.people)) {
		errors.push('People must be an array');
	}

	// Validate each person has required fields
	def.data.people.forEach((person, index) => {
		if (!person.id) {
			errors.push(`Person ${index} missing ID`);
		}
		if (!person.name) {
			errors.push(`Person ${index} missing name`);
		}
		if (!Array.isArray(person.locations)) {
			errors.push(`Person ${index} locations must be an array`);
		}

		// Validate each location
		person.locations.forEach((loc, locIndex) => {
			if (loc.longitude < -180 || loc.longitude > 180) {
				errors.push(
					`Person ${index} location ${locIndex} has invalid longitude: ${loc.longitude}`
				);
			}
			if (loc.latitude < -90 || loc.latitude > 90) {
				errors.push(`Person ${index} location ${locIndex} has invalid latitude: ${loc.latitude}`);
			}
		});
	});

	// Validate layout
	if (!['12x16', '18x24', '24x36'].includes(def.layout.page.size)) {
		errors.push(`Invalid page size: ${def.layout.page.size}`);
	}

	if (!['portrait', 'landscape'].includes(def.layout.page.orientation)) {
		errors.push(`Invalid orientation: ${def.layout.page.orientation}`);
	}

	if (def.layout.page.dpi < 150 || def.layout.page.dpi > 600) {
		errors.push(`Invalid DPI: ${def.layout.page.dpi} (must be 150-600)`);
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

/**
 * Example usage and test data.
 */
export const EXAMPLE_MAP: CompleteMapDefinition = createNewMapDefinition(
	'user_123',
	'Our Family Journey',
	{
		data: {
			people: [
				{
					id: 'person_1',
					name: 'Alice',
					color: '#FF5733',
					locations: [
						{
							countryCode: 'US',
							longitude: -74.006,
							latitude: 40.7128,
							date: '2010-01-01'
						},
						{
							countryCode: 'GB',
							longitude: -0.1276,
							latitude: 51.5074,
							date: '2015-06-15'
						}
					]
				}
			]
		},
		layout: {
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
					url: 'https://alwaysmap.com/maps/our-journey',
					position: 'bottom-right',
					size: 72
				}
			}
		}
	}
);
