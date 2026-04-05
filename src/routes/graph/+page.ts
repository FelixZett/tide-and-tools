import type { PageLoad } from './$types';
import { loadDatabase } from '$lib/coi-data';

export const load: PageLoad = async ({ fetch }) => {
	return {
		database: await loadDatabase(fetch)
	};
};
