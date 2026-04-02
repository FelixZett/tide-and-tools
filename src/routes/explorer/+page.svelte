<script lang="ts">
	import { page } from '$app/stores';

	type Resource = {
		type: 'resource';
		id: string;
		name: string;
		description: string | null;
		state: string | null;
	};

	type Building = {
		type: 'building';
		id: string;
		name: string;
		description: string | null;
		stats?: {
			workers?: number;
			electricity_kw?: number;
			computing_tflops?: number;
			maintenance_cost?: {
				item_id: string;
				amount: number;
				period: number;
			};
			footprint?: string;
			required_research?: string[];
			variants?: string[];
		};
		construction?: Array<{
			item_id: string;
			amount: number;
		}>;
	};

	type RecipeIO = {
		item_id: string;
		amount: number;
	};

	type Recipe = {
		machine_id: string;
		base?: {
			duration?: number;
			inputs?: RecipeIO[];
			outputs?: RecipeIO[];
		};
		scaled?: {
			duration?: number;
			inputs?: RecipeIO[];
			outputs?: RecipeIO[];
		};
	};

	type Contract = {
		village: string;
		reputation_required: string;
		export: {
			id: string | null;
			amount: number;
		};
		import: {
			id: string | null;
			amount: number;
		};
		unity: {
			per_month: number;
			per_ship: number;
			at_establish: number;
		};
	};

	type Database = {
		metadata?: {
			generated_at?: string;
			counts?: Record<string, number>;
		};
		resources: Resource[];
		buildings: Building[];
		recipes: Recipe[];
		contracts: Contract[];
	};

	type ExplorerType = 'resources' | 'buildings' | 'recipes' | 'contracts';

	type ListItem = {
		id: string;
		label: string;
		subtitle?: string;
		searchText: string;
	};

	type RecipeItem = ListItem & {
		recipe: Recipe;
		index: number;
	};

	type ContractItem = ListItem & {
		contract: Contract;
		index: number;
	};

	type LinkedRecipe = {
		id: string;
		label: string;
	};

	type IndexedContract = {
		contract: Contract;
		index: number;
	};

	let { data } = $props<{ data: { database: Database } }>();

	const database = $derived(data.database);
	const resources = $derived(database.resources ?? ([] as Resource[]));
	const buildings = $derived(database.buildings ?? ([] as Building[]));
	const recipes = $derived(database.recipes ?? ([] as Recipe[]));
	const contracts = $derived(database.contracts ?? ([] as Contract[]));

	const resourcesById = $derived.by(
		() => new Map<string, Resource>(resources.map((resource: Resource) => [resource.id, resource]))
	);
	const buildingsById = $derived.by(
		() => new Map<string, Building>(buildings.map((building: Building) => [building.id, building]))
	);

	const recipeItems = $derived.by((): RecipeItem[] =>
		recipes.map((recipe: Recipe, index: number) => {
			const id = `recipe:${recipe.machine_id}:${index}`;
			const building = buildingsById.get(recipe.machine_id);
			const outputNames =
				recipe.base?.outputs?.map((entry: RecipeIO) => getResourceName(entry.item_id)) ?? [];

			return {
				id,
				label: outputNames.length
					? `${building?.name ?? recipe.machine_id} -> ${outputNames.join(', ')}`
					: (building?.name ?? recipe.machine_id),
				subtitle: `Recipe ${index + 1}`,
				searchText: [
					building?.name ?? recipe.machine_id,
					recipe.machine_id,
					outputNames.join(' '),
					recipe.base?.inputs?.map((entry: RecipeIO) => entry.item_id).join(' ') ?? ''
				]
					.join(' ')
					.toLowerCase(),
				recipe,
				index
			};
		})
	);

	const contractItems = $derived.by((): ContractItem[] =>
		contracts.map((contract: Contract, index: number) => {
			const id = `contract:${index}`;
			const exportName = contract.export.id ? getResourceName(contract.export.id) : 'Nothing';
			const importName = contract.import.id ? getResourceName(contract.import.id) : 'Nothing';

			return {
				id,
				label: `Village ${contract.village}: ${exportName} for ${importName}`,
				subtitle: `Contract ${index + 1}`,
				searchText:
					`${contract.village} ${contract.reputation_required} ${exportName} ${importName}`.toLowerCase(),
				contract,
				index
			};
		})
	);

	const listItems = $derived.by(
		(): Record<ExplorerType, ListItem[]> => ({
			resources: resources.map((resource: Resource) => ({
				id: resource.id,
				label: getResourceName(resource.id),
				subtitle: resource.state ?? undefined,
				searchText:
					`${getResourceName(resource.id)} ${resource.id} ${resource.state ?? ''} ${resource.description ?? ''}`.toLowerCase()
			})),
			buildings: buildings.map((building: Building) => ({
				id: building.id,
				label: building.name,
				subtitle: building.stats?.footprint ? `Footprint ${building.stats.footprint}` : undefined,
				searchText: `${building.name} ${building.id} ${building.description ?? ''}`.toLowerCase()
			})),
			recipes: recipeItems,
			contracts: contractItems
		})
	);

	const typeCounts = $derived.by(
		(): Record<ExplorerType, number> => ({
			resources: resources.length,
			buildings: buildings.length,
			recipes: recipes.length,
			contracts: contracts.length
		})
	);

	const orderedTypes: ExplorerType[] = ['resources', 'buildings', 'recipes', 'contracts'];

	let search = $state('');

	function parseType(rawType: string | null): ExplorerType {
		return rawType === 'resources' ||
			rawType === 'buildings' ||
			rawType === 'recipes' ||
			rawType === 'contracts'
			? rawType
			: 'resources';
	}

	function buildHref(type: ExplorerType, id?: string) {
		const params = new URLSearchParams();
		params.set('type', type);
		if (id) params.set('id', id);
		return `/explorer/?${params.toString()}`;
	}

	function humanizeLabel(value: string) {
		return value
			.replace(/_/g, ' ')
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function getResourceIcon(id: string) {
		return `/www/assets/images/resources/${id}.png`;
	}

	function getResourceName(id: string) {
		const resource = resourcesById.get(id);
		return humanizeLabel(resource?.name ?? id);
	}

	function getFilteredItems(type: ExplorerType, query: string): ListItem[] {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) return listItems[type];
		return listItems[type].filter((item: ListItem) => item.searchText.includes(normalizedQuery));
	}

	function formatResourceAmount(entry: RecipeIO) {
		return `${entry.amount} ${getResourceName(entry.item_id)}`;
	}

	function getRecipeId(recipe: Recipe, index: number) {
		return `recipe:${recipe.machine_id}:${index}`;
	}

	function getRecipeLabel(recipe: Recipe, index: number) {
		return (
			recipeItems[index]?.label ??
			`${buildingsById.get(recipe.machine_id)?.name ?? recipe.machine_id} (${index + 1})`
		);
	}

	function linkedRecipesForResource(resourceId: string, mode: 'input' | 'output'): LinkedRecipe[] {
		return recipes
			.map((recipe: Recipe, index: number) => ({ recipe, index }))
			.filter(({ recipe }: { recipe: Recipe; index: number }) =>
				(mode === 'input' ? recipe.base?.inputs : recipe.base?.outputs)?.some(
					(entry: RecipeIO) => entry.item_id === resourceId
				)
			)
			.map(({ recipe, index }: { recipe: Recipe; index: number }) => ({
				id: getRecipeId(recipe, index),
				label: getRecipeLabel(recipe, index)
			}));
	}

	function linkedRecipesForBuilding(buildingId: string): LinkedRecipe[] {
		return recipes
			.map((recipe: Recipe, index: number) => ({ recipe, index }))
			.filter(({ recipe }: { recipe: Recipe; index: number }) => recipe.machine_id === buildingId)
			.map(({ recipe, index }: { recipe: Recipe; index: number }) => ({
				id: getRecipeId(recipe, index),
				label: getRecipeLabel(recipe, index)
			}));
	}

	function selectedItemId(requestedId: string | null, filteredItems: ListItem[]) {
		if (requestedId && filteredItems.some((item: ListItem) => item.id === requestedId)) {
			return requestedId;
		}
		return filteredItems[0]?.id ?? null;
	}

	function contractLabel(index: number) {
		return contractItems[index]?.label ?? `Contract ${index + 1}`;
	}

	function resourceContractMatches(
		resourceId: string,
		mode: 'export' | 'import'
	): IndexedContract[] {
		return contracts
			.map((contract: Contract, index: number) => ({ contract, index }))
			.filter(
				({ contract }: IndexedContract) =>
					(mode === 'export' ? contract.export.id : contract.import.id) === resourceId
			);
	}

	const currentType = $derived(parseType($page.url.searchParams.get('type')));
	const filteredItems = $derived(getFilteredItems(currentType, search));
	const currentId = $derived(selectedItemId($page.url.searchParams.get('id'), filteredItems));

	const currentResource = $derived(
		currentType === 'resources' && currentId ? (resourcesById.get(currentId) ?? null) : null
	);
	const currentBuilding = $derived(
		currentType === 'buildings' && currentId ? (buildingsById.get(currentId) ?? null) : null
	);
	const currentRecipeIndex = $derived(
		currentType === 'recipes' && currentId ? Number(currentId.split(':').at(-1)) : null
	);
	const currentRecipe = $derived(
		currentType === 'recipes' && currentRecipeIndex !== null
			? (recipeItems[currentRecipeIndex]?.recipe ?? null)
			: null
	);
	const currentContractIndex = $derived(
		currentType === 'contracts' && currentId ? Number(currentId.split(':').at(-1)) : null
	);
	const currentContract = $derived(
		currentType === 'contracts' && currentContractIndex !== null
			? (contractItems[currentContractIndex]?.contract ?? null)
			: null
	);

	const producedBy = $derived(
		currentResource
			? linkedRecipesForResource(currentResource.id, 'output')
			: ([] as LinkedRecipe[])
	);
	const consumedBy = $derived(
		currentResource ? linkedRecipesForResource(currentResource.id, 'input') : ([] as LinkedRecipe[])
	);
	const buildingConstruction = $derived(
		currentResource
			? buildings.filter((building: Building) =>
					building.construction?.some((entry: RecipeIO) => entry.item_id === currentResource.id)
				)
			: ([] as Building[])
	);
	const buildingMaintenance = $derived(
		currentResource
			? buildings.filter(
					(building: Building) => building.stats?.maintenance_cost?.item_id === currentResource.id
				)
			: ([] as Building[])
	);
	const contractExports = $derived(
		currentResource
			? resourceContractMatches(currentResource.id, 'export')
			: ([] as IndexedContract[])
	);
	const contractImports = $derived(
		currentResource
			? resourceContractMatches(currentResource.id, 'import')
			: ([] as IndexedContract[])
	);
	const buildingRecipes = $derived(
		currentBuilding ? linkedRecipesForBuilding(currentBuilding.id) : ([] as LinkedRecipe[])
	);
</script>

<div class="mx-auto flex h-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900">Explorer</h1>
		<p class="mt-2 max-w-3xl text-sm text-gray-600">
			Browse the Captain of Industry master database and follow links between resources, buildings,
			recipes, and contracts.
		</p>
	</div>

	<div class="mb-4 flex flex-wrap gap-2">
		{#each orderedTypes as type}
			<a
				href={buildHref(type)}
				class={`rounded-full border px-4 py-2 text-sm font-medium transition ${
					currentType === type
						? 'border-blue-600 bg-blue-600 text-white'
						: 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900'
				}`}
			>
				{type[0].toUpperCase() + type.slice(1)} ({typeCounts[type]})
			</a>
		{/each}
	</div>

	<div class="grid min-h-0 flex-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
		<section class="min-h-0 rounded-2xl border border-gray-200 bg-white shadow-sm">
			<div class="border-b border-gray-200 p-4">
				<label
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase"
					for="explorer-search"
				>
					Search
				</label>
				<input
					id="explorer-search"
					bind:value={search}
					placeholder={`Search ${currentType}...`}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ring-0 outline-none placeholder:text-gray-400 focus:border-blue-500"
				/>
			</div>

			<div class="max-h-[65vh] overflow-y-auto">
				{#if filteredItems.length === 0}
					<div class="p-4 text-sm text-gray-500">No matches.</div>
				{:else}
					<ul class="divide-y divide-gray-100">
						{#each filteredItems as item}
							<li>
								<a
									href={buildHref(currentType, item.id)}
									class={`block px-4 py-3 transition ${
										item.id === currentId ? 'bg-blue-50' : 'hover:bg-gray-50'
									}`}
								>
									<div class="flex items-center gap-3">
										{#if currentType === 'resources'}
											<img
												src={getResourceIcon(item.id)}
												alt=""
												class="h-8 w-8 rounded-md border border-gray-200 bg-white p-1"
											/>
										{/if}
										<div>
											<div class="text-sm font-medium text-gray-900">{item.label}</div>
											{#if item.subtitle}
												<div class="mt-1 text-xs text-gray-500">{item.subtitle}</div>
											{/if}
											<div class="mt-1 font-mono text-[11px] text-gray-400">{item.id}</div>
										</div>
									</div>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>

		<section class="min-h-0 rounded-2xl border border-gray-200 bg-white shadow-sm">
			{#if !currentId}
				<div class="p-6 text-sm text-gray-500">Nothing to show.</div>
			{:else if currentType === 'resources' && currentResource}
				<div class="p-6">
					<div class="mb-6 flex items-start justify-between gap-4">
						<div class="flex items-start gap-4">
							<img
								src={getResourceIcon(currentResource.id)}
								alt=""
								class="h-14 w-14 rounded-xl border border-gray-200 bg-white p-2"
							/>
							<div>
								<h2 class="text-2xl font-semibold text-gray-900">
									{getResourceName(currentResource.id)}
								</h2>
								<div class="mt-1 font-mono text-sm text-gray-500">{currentResource.id}</div>
							</div>
						</div>
						{#if currentResource.state}
							<div
								class="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold tracking-wide text-teal-700 uppercase"
							>
								{currentResource.state}
							</div>
						{/if}
					</div>

					{#if currentResource.description}
						<p class="mb-6 text-sm leading-6 text-gray-700">{currentResource.description}</p>
					{/if}

					<div class="grid gap-6 xl:grid-cols-2">
						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Produced By Recipes</h3>
							{#if producedBy.length}
								<ul class="mt-3 space-y-2">
									{#each producedBy as entry}
										<li>
											<a
												class="text-sm text-blue-700 hover:underline"
												href={buildHref('recipes', entry.id)}>{entry.label}</a
											>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No recipe outputs reference this resource.</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Consumed By Recipes</h3>
							{#if consumedBy.length}
								<ul class="mt-3 space-y-2">
									{#each consumedBy as entry}
										<li>
											<a
												class="text-sm text-blue-700 hover:underline"
												href={buildHref('recipes', entry.id)}>{entry.label}</a
											>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No recipe inputs reference this resource.</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Construction Usage</h3>
							{#if buildingConstruction.length}
								<ul class="mt-3 space-y-2">
									{#each buildingConstruction as building}
										<li>
											<a
												class="text-sm text-blue-700 hover:underline"
												href={buildHref('buildings', building.id)}>{building.name}</a
											>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">
									This resource is not used in building construction.
								</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Maintenance Usage</h3>
							{#if buildingMaintenance.length}
								<ul class="mt-3 space-y-2">
									{#each buildingMaintenance as building}
										<li>
											<a
												class="text-sm text-blue-700 hover:underline"
												href={buildHref('buildings', building.id)}>{building.name}</a
											>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">
									This resource is not used as a maintenance item.
								</p>
							{/if}
						</div>
					</div>

					<div class="mt-6 grid gap-6 xl:grid-cols-2">
						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Exported In Contracts</h3>
							{#if contractExports.length}
								<ul class="mt-3 space-y-2">
									{#each contractExports as entry}
										<li>
											<a
												class="text-sm text-blue-700 hover:underline"
												href={buildHref('contracts', `contract:${entry.index}`)}
												>{contractLabel(entry.index)}</a
											>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No contract exports this resource.</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Imported In Contracts</h3>
							{#if contractImports.length}
								<ul class="mt-3 space-y-2">
									{#each contractImports as entry}
										<li>
											<a
												class="text-sm text-blue-700 hover:underline"
												href={buildHref('contracts', `contract:${entry.index}`)}
												>{contractLabel(entry.index)}</a
											>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No contract imports this resource.</p>
							{/if}
						</div>
					</div>
				</div>
			{:else if currentType === 'buildings' && currentBuilding}
				<div class="p-6">
					<div class="mb-6">
						<h2 class="text-2xl font-semibold text-gray-900">{currentBuilding.name}</h2>
						<div class="mt-1 font-mono text-sm text-gray-500">{currentBuilding.id}</div>
					</div>

					{#if currentBuilding.description}
						<p class="mb-6 text-sm leading-6 text-gray-700">{currentBuilding.description}</p>
					{/if}

					<div class="grid gap-6 xl:grid-cols-2">
						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Stats</h3>
							<dl class="mt-3 space-y-2 text-sm text-gray-700">
								<div class="flex justify-between gap-4">
									<dt>Workers</dt>
									<dd>{currentBuilding.stats?.workers ?? '-'}</dd>
								</div>
								<div class="flex justify-between gap-4">
									<dt>Electricity</dt>
									<dd>{currentBuilding.stats?.electricity_kw ?? '-'} kW</dd>
								</div>
								<div class="flex justify-between gap-4">
									<dt>Computing</dt>
									<dd>{currentBuilding.stats?.computing_tflops ?? '-'} TFLOPS</dd>
								</div>
								<div class="flex justify-between gap-4">
									<dt>Footprint</dt>
									<dd>{currentBuilding.stats?.footprint ?? '-'}</dd>
								</div>
							</dl>
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Maintenance</h3>
							{#if currentBuilding.stats?.maintenance_cost}
								<p class="mt-3 text-sm text-gray-700">
									<a
										class="inline-flex items-center gap-2 text-blue-700 hover:underline"
										href={buildHref('resources', currentBuilding.stats.maintenance_cost.item_id)}
									>
										<img
											src={getResourceIcon(currentBuilding.stats.maintenance_cost.item_id)}
											alt=""
											class="h-5 w-5 rounded border border-gray-200 bg-white p-0.5"
										/>
										<span>{getResourceName(currentBuilding.stats.maintenance_cost.item_id)}</span>
									</a>
									{' '}• {currentBuilding.stats.maintenance_cost.amount} every {currentBuilding
										.stats.maintenance_cost.period}s
								</p>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No maintenance cost recorded.</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Construction</h3>
							{#if currentBuilding.construction?.length}
								<ul class="mt-3 space-y-2">
									{#each currentBuilding.construction as entry}
										<li class="text-sm text-gray-700">
											<a
												class="inline-flex items-center gap-2 text-blue-700 hover:underline"
												href={buildHref('resources', entry.item_id)}
											>
												<img
													src={getResourceIcon(entry.item_id)}
													alt=""
													class="h-5 w-5 rounded border border-gray-200 bg-white p-0.5"
												/>
												<span>{getResourceName(entry.item_id)}</span>
											</a>
											{' '}• {entry.amount}
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No construction requirements recorded.</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Research And Variants</h3>
							<div class="mt-3 text-sm text-gray-700">
								<div>
									<span class="font-medium">Research:</span>
									{#if currentBuilding.stats?.required_research?.length}
										{currentBuilding.stats.required_research.join(', ')}
									{:else}
										None
									{/if}
								</div>
								<div class="mt-2">
									<span class="font-medium">Variants:</span>
									{#if currentBuilding.stats?.variants?.length}
										{currentBuilding.stats.variants.join(', ')}
									{:else}
										None
									{/if}
								</div>
							</div>
						</div>
					</div>

					<div class="mt-6 rounded-xl border border-gray-200 p-4">
						<h3 class="text-sm font-semibold text-gray-900">Recipes</h3>
						{#if buildingRecipes.length}
							<ul class="mt-3 space-y-2">
								{#each buildingRecipes as entry}
									<li>
										<a
											class="text-sm text-blue-700 hover:underline"
											href={buildHref('recipes', entry.id)}>{entry.label}</a
										>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="mt-3 text-sm text-gray-500">No recipes recorded for this building.</p>
						{/if}
					</div>
				</div>
			{:else if currentType === 'recipes' && currentRecipe && currentRecipeIndex !== null}
				<div class="p-6">
					<div class="mb-6">
						<h2 class="text-2xl font-semibold text-gray-900">
							{getRecipeLabel(currentRecipe, currentRecipeIndex)}
						</h2>
						<div class="mt-1 font-mono text-sm text-gray-500">{currentId}</div>
					</div>

					<div class="mb-6 rounded-xl border border-gray-200 p-4">
						<h3 class="text-sm font-semibold text-gray-900">Machine</h3>
						<p class="mt-3 text-sm text-gray-700">
							<a
								class="text-blue-700 hover:underline"
								href={buildHref('buildings', currentRecipe.machine_id)}
							>
								{buildingsById.get(currentRecipe.machine_id)?.name ?? currentRecipe.machine_id}
							</a>
						</p>
					</div>

					<div class="grid gap-6 xl:grid-cols-2">
						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Base Recipe</h3>
							<p class="mt-3 text-sm text-gray-700">
								Duration: {currentRecipe.base?.duration ?? '-'}s
							</p>
							<div class="mt-4">
								<div class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
									Inputs
								</div>
								{#if currentRecipe.base?.inputs?.length}
									<ul class="mt-2 space-y-2">
										{#each currentRecipe.base.inputs as entry}
											<li class="text-sm text-gray-700">
												<a
													class="inline-flex items-center gap-2 text-blue-700 hover:underline"
													href={buildHref('resources', entry.item_id)}
												>
													<img
														src={getResourceIcon(entry.item_id)}
														alt=""
														class="h-5 w-5 rounded border border-gray-200 bg-white p-0.5"
													/>
													<span>{getResourceName(entry.item_id)}</span>
												</a>
												{' '}• {entry.amount}
											</li>
										{/each}
									</ul>
								{:else}
									<p class="mt-2 text-sm text-gray-500">None</p>
								{/if}
							</div>
							<div class="mt-4">
								<div class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
									Outputs
								</div>
								{#if currentRecipe.base?.outputs?.length}
									<ul class="mt-2 space-y-2">
										{#each currentRecipe.base.outputs as entry}
											<li class="text-sm text-gray-700">
												<a
													class="inline-flex items-center gap-2 text-blue-700 hover:underline"
													href={buildHref('resources', entry.item_id)}
												>
													<img
														src={getResourceIcon(entry.item_id)}
														alt=""
														class="h-5 w-5 rounded border border-gray-200 bg-white p-0.5"
													/>
													<span>{getResourceName(entry.item_id)}</span>
												</a>
												{' '}• {entry.amount}
											</li>
										{/each}
									</ul>
								{:else}
									<p class="mt-2 text-sm text-gray-500">None</p>
								{/if}
							</div>
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Scaled Recipe</h3>
							<p class="mt-3 text-sm text-gray-700">
								Duration: {currentRecipe.scaled?.duration ?? '-'}s
							</p>
							<div class="mt-4">
								<div class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
									Inputs
								</div>
								{#if currentRecipe.scaled?.inputs?.length}
									<ul class="mt-2 space-y-2">
										{#each currentRecipe.scaled.inputs as entry}
											<li class="text-sm text-gray-700">{formatResourceAmount(entry)}</li>
										{/each}
									</ul>
								{:else}
									<p class="mt-2 text-sm text-gray-500">None</p>
								{/if}
							</div>
							<div class="mt-4">
								<div class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
									Outputs
								</div>
								{#if currentRecipe.scaled?.outputs?.length}
									<ul class="mt-2 space-y-2">
										{#each currentRecipe.scaled.outputs as entry}
											<li class="text-sm text-gray-700">{formatResourceAmount(entry)}</li>
										{/each}
									</ul>
								{:else}
									<p class="mt-2 text-sm text-gray-500">None</p>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{:else if currentType === 'contracts' && currentContract && currentContractIndex !== null}
				<div class="p-6">
					<div class="mb-6">
						<h2 class="text-2xl font-semibold text-gray-900">
							{contractLabel(currentContractIndex)}
						</h2>
						<div class="mt-1 font-mono text-sm text-gray-500">{currentId}</div>
					</div>

					<div class="grid gap-6 xl:grid-cols-2">
						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Trade</h3>
							<div class="mt-3 space-y-3 text-sm text-gray-700">
								<div>
									<div class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
										Export
									</div>
									{#if currentContract.export.id}
										<a
											class="inline-flex items-center gap-2 text-blue-700 hover:underline"
											href={buildHref('resources', currentContract.export.id)}
										>
											<img
												src={getResourceIcon(currentContract.export.id)}
												alt=""
												class="h-5 w-5 rounded border border-gray-200 bg-white p-0.5"
											/>
											<span>{getResourceName(currentContract.export.id)}</span>
										</a>
										{' '}• {currentContract.export.amount}
									{:else}
										Nothing
									{/if}
								</div>
								<div>
									<div class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
										Import
									</div>
									{#if currentContract.import.id}
										<a
											class="inline-flex items-center gap-2 text-blue-700 hover:underline"
											href={buildHref('resources', currentContract.import.id)}
										>
											<img
												src={getResourceIcon(currentContract.import.id)}
												alt=""
												class="h-5 w-5 rounded border border-gray-200 bg-white p-0.5"
											/>
											<span>{getResourceName(currentContract.import.id)}</span>
										</a>
										{' '}• {currentContract.import.amount}
									{:else}
										Nothing
									{/if}
								</div>
							</div>
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Requirements</h3>
							<dl class="mt-3 space-y-2 text-sm text-gray-700">
								<div class="flex justify-between gap-4">
									<dt>Village</dt>
									<dd>{currentContract.village}</dd>
								</div>
								<div class="flex justify-between gap-4">
									<dt>Reputation</dt>
									<dd>{currentContract.reputation_required}</dd>
								</div>
								<div class="flex justify-between gap-4">
									<dt>Unity / month</dt>
									<dd>{currentContract.unity.per_month}</dd>
								</div>
								<div class="flex justify-between gap-4">
									<dt>Unity / ship</dt>
									<dd>{currentContract.unity.per_ship}</dd>
								</div>
								<div class="flex justify-between gap-4">
									<dt>Unity at establish</dt>
									<dd>{currentContract.unity.at_establish}</dd>
								</div>
							</dl>
						</div>
					</div>
				</div>
			{:else}
				<div class="p-6 text-sm text-gray-500">The selected entry could not be resolved.</div>
			{/if}
		</section>
	</div>
</div>
