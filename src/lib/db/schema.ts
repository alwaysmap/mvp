/**
 * Database schema types
 *
 * TypeScript interfaces matching the PostgreSQL schema defined in
 * migrations/001_initial_schema.sql
 */

import type { MapDefinition } from '$lib/map-renderer/types';

/**
 * User map data (core map configuration)
 * Stored in user_maps table with JSONB data field
 */
export interface UserMapData {
	title: string;
	subtitle?: string;
	people: Array<{
		id: string;
		name: string;
		color?: string;
		locations: Array<{
			countryCode: string;
			longitude: number;
			latitude: number;
			date: string;
		}>;
	}>;
	projection?: 'orthographic' | 'equirectangular' | 'mercator' | 'naturalEarth1' | 'robinson';
	rotation?: [number, number, number];
	style?: 'vintage' | 'modern';
}

/**
 * User map record (database row)
 */
export interface UserMap {
	id: string;
	data: UserMapData;
	created_at: Date;
	updated_at: Date;
}

/**
 * Printable map configuration data
 * Stored in printable_maps table with JSONB data field
 */
export interface PrintableMapData {
	pageSize: '12x16' | '18x24' | '24x36' | 'A3' | 'A4';
	orientation: 'portrait' | 'landscape';
	style?: 'vintage' | 'modern';
	showBoundary?: boolean;
	projection?: 'orthographic' | 'equirectangular' | 'mercator' | 'naturalEarth1' | 'robinson';
	rotation?: [number, number, number];
	zoom?: number;
	pan?: [number, number];
}

/**
 * Printable map record (database row)
 */
export interface PrintableMap {
	id: string;
	user_map_id: string;
	data: PrintableMapData;
	created_at: Date;
}

/**
 * Combined map with printable configuration
 * Used when generating exports
 */
export interface MapWithConfig {
	userMap: UserMap;
	printableMap: PrintableMap;
}
