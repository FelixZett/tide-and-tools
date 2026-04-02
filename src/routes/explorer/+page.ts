import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const response = await fetch('/coi_master_db.json');

	if (!response.ok) {
		throw new Error(`Failed to load explorer data: ${response.status}`);
	}

	const database = await response.json();

	return {
		database
	};
};
