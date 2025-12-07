/**
 * Printable Maps Repository
 *
 * Data access layer for printable_maps table.
 * Stores print configurations linked to user maps (1:M relationship).
 */

import { query } from '../client';
import type { PrintableMap, PrintableMapData, MapWithConfig } from '../schema';
import { getUserMap } from './user-maps';
import { randomUUID } from 'crypto';

/**
 * Create a new printable map configuration
 */
export async function createPrintableMap(
	userMapId: string,
	data: PrintableMapData
): Promise<PrintableMap> {
	const id = randomUUID();
	const now = new Date();

	const result = await query<PrintableMap>(
		`INSERT INTO printable_maps (id, user_map_id, data, created_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
		[id, userMapId, JSON.stringify(data), now]
	);

	return result.rows[0];
}

/**
 * Get a printable map by ID
 */
export async function getPrintableMap(id: string): Promise<PrintableMap | null> {
	const result = await query<PrintableMap>(`SELECT * FROM printable_maps WHERE id = $1`, [id]);

	return result.rows[0] || null;
}

/**
 * Get printable map with its user map data
 */
export async function getPrintableMapWithUserMap(id: string): Promise<MapWithConfig | null> {
	const printableMap = await getPrintableMap(id);
	if (!printableMap) return null;

	const userMap = await getUserMap(printableMap.user_map_id);
	if (!userMap) return null;

	return { userMap, printableMap };
}

/**
 * Get all printable maps for a user map
 */
export async function getPrintableMapsForUserMap(userMapId: string): Promise<PrintableMap[]> {
	const result = await query<PrintableMap>(
		`SELECT * FROM printable_maps WHERE user_map_id = $1 ORDER BY created_at DESC`,
		[userMapId]
	);

	return result.rows;
}

/**
 * Update a printable map configuration
 */
export async function updatePrintableMap(
	id: string,
	data: PrintableMapData
): Promise<PrintableMap | null> {
	const result = await query<PrintableMap>(
		`UPDATE printable_maps
     SET data = $1
     WHERE id = $2
     RETURNING *`,
		[JSON.stringify(data), id]
	);

	return result.rows[0] || null;
}

/**
 * Delete a printable map configuration
 */
export async function deletePrintableMap(id: string): Promise<boolean> {
	const result = await query(`DELETE FROM printable_maps WHERE id = $1`, [id]);

	return (result.rowCount || 0) > 0;
}

/**
 * List all printable maps (for testing/admin)
 */
export async function listPrintableMaps(): Promise<PrintableMap[]> {
	const result = await query<PrintableMap>(
		`SELECT * FROM printable_maps ORDER BY created_at DESC`
	);

	return result.rows;
}
