export type Product = {
	type: 'products';
	name: string;
	id: string;
	state?: string | null;
	is_storable?: boolean;
	radioactivity?: number;
	is_trash?: boolean;
	description?: string | null;
	[key: string]: unknown;
};

export type RecipeIO = {
	product_id: string;
	amount: number;
};

export type Recipe = {
	duration?: number;
	machine?: string[];
	inputs?: RecipeIO[];
	outputs?: RecipeIO[];
	[key: string]: unknown;
};

export type Building = {
	type: 'building';
	name: string;
	id: string;
	stats?: {
		workers?: number;
		electricity_kw?: number;
		computing_tflops?: number;
		maintenance_cost?: {
			product_id: string;
			amount: number;
		};
		footprint?: string;
		required_research?: string[];
		variants?: string[];
		[key: string]: unknown;
	};
	construction_cost?: Array<{
		product_id: string;
		amount: number;
	}>;
	[key: string]: unknown;
};

export type Contract = {
	type: 'contract';
	reputation_level: number;
	inputs: RecipeIO[];
	outputs: RecipeIO[];
	[key: string]: unknown;
};

export type Database = {
	game_version?: string;
	schema_version?: number;
	products: Product[];
	recipes: Recipe[];
	buildings: Building[];
	contracts: Contract[];
	game_settings?: Record<string, unknown>;
	[key: string]: unknown;
};

export function loadDatabase(fetch: typeof globalThis.fetch) {
	return fetch('/data/coi_database.json').then(async (response) => {
		if (!response.ok) {
			throw new Error(`Failed to load database: ${response.status}`);
		}

		return (await response.json()) as Database;
	});
}

export function humanizeLabel(value: string) {
	return value
		.replace(/_/g, ' ')
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export function getProductIconHref(productId: string) {
	return `/data/icons/products/${productId}.png`;
}

export function getBuildingIconHref(buildingId: string) {
	return `/data/icons/buildings/${buildingId}.png`;
}

export function getRecipeMachineId(recipe: Recipe) {
	return recipe.machine?.[0] ?? null;
}
