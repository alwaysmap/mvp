/**
 * User Maps API
 *
 * POST /api/maps - Create a new user map
 * GET /api/maps - List all user maps
 */

import { json } from '@sveltejs/kit';
import { createUserMap, listUserMaps } from '$lib/db/repositories/user-maps';
import type { UserMapData } from '$lib/db/schema';
import type { RequestHandler } from './$types';

/**
 * Create a new user map
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = (await request.json()) as UserMapData;

		// Basic validation
		if (!data.title || !Array.isArray(data.people) || data.people.length === 0) {
			return json({ error: 'Invalid map data: title and people required' }, { status: 400 });
		}

		const userMap = await createUserMap(data);

		return json({ userMap }, { status: 201 });
	} catch (error) {
		console.error('Error creating user map:', error);
		return json({ error: 'Failed to create user map' }, { status: 500 });
	}
};

/**
 * List all user maps
 */
export const GET: RequestHandler = async () => {
	try {
		const userMaps = await listUserMaps();

		return json({ userMaps });
	} catch (error) {
		console.error('Error listing user maps:', error);
		return json({ error: 'Failed to list user maps' }, { status: 500 });
	}
};
