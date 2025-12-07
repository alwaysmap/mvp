/**
 * User Maps Repository
 *
 * Data access layer for user_maps table.
 * All map data stored in JSONB for flexibility.
 */

import { query } from '../client';
import type { UserMap, UserMapData } from '../schema';
import { randomUUID } from 'crypto';

/**
 * Create a new user map
 */
export async function createUserMap(data: UserMapData): Promise<UserMap> {
	const id = randomUUID();
	const now = new Date();

	const result = await query<UserMap>(
		`INSERT INTO user_maps (id, data, created_at, updated_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
		[id, JSON.stringify(data), now, now]
	);

	return result.rows[0];
}

/**
 * Get a user map by ID
 */
export async function getUserMap(id: string): Promise<UserMap | null> {
	const result = await query<UserMap>(`SELECT * FROM user_maps WHERE id = $1`, [id]);

	return result.rows[0] || null;
}

/**
 * Update a user map
 */
export async function updateUserMap(id: string, data: UserMapData): Promise<UserMap | null> {
	const now = new Date();

	const result = await query<UserMap>(
		`UPDATE user_maps
     SET data = $1, updated_at = $2
     WHERE id = $3
     RETURNING *`,
		[JSON.stringify(data), now, id]
	);

	return result.rows[0] || null;
}

/**
 * Delete a user map (cascades to printable_maps)
 */
export async function deleteUserMap(id: string): Promise<boolean> {
	const result = await query(`DELETE FROM user_maps WHERE id = $1`, [id]);

	return (result.rowCount || 0) > 0;
}

/**
 * List all user maps (for testing/admin)
 */
export async function listUserMaps(): Promise<UserMap[]> {
	const result = await query<UserMap>(`SELECT * FROM user_maps ORDER BY created_at DESC`);

	return result.rows;
}
