<script lang="ts">
	import { page } from '$app/stores';
	import {
		getBuildingIconHref,
		getProductIconHref,
		getRecipeMachineId,
		humanizeLabel,
		type Building,
		type Contract,
		type Database,
		type Product,
		type Recipe,
		type RecipeIO
	} from '$lib/coi-data';

	type ExplorerType = 'products' | 'buildings' | 'recipes' | 'contracts';

	type ListItem = {
		id: string;
		label: string;
		subtitle?: string;
		searchText: string;
		iconHref?: string;
	};

	type RecipeItem = ListItem & {
		recipe: Recipe;
		index: number;
	};

	type ContractItem = ListItem & {
		contract: Contract;
		index: number;
	};

	let { data } = $props<{ data: { database: Database } }>();

	const database = $derived(data.database);
	const products = $derived(database.products ?? ([] as Product[]));
	const buildings = $derived(database.buildings ?? ([] as Building[]));
	const recipes = $derived(database.recipes ?? ([] as Recipe[]));
	const contracts = $derived(database.contracts ?? ([] as Contract[]));

	const productsById = $derived.by(
		() => new Map<string, Product>(products.map((product: Product) => [product.id, product]))
	);
	const buildingsById = $derived.by(
		() => new Map<string, Building>(buildings.map((building: Building) => [building.id, building]))
	);

	function getProductName(productId: string) {
		const product = productsById.get(productId);
		return product ? humanizeLabel(product.name) : humanizeLabel(productId.replace(/^product_/, ''));
	}

	function getBuildingName(buildingId: string) {
		const building = buildingsById.get(buildingId);
		return building ? humanizeLabel(building.name) : humanizeLabel(buildingId);
	}

	function formatRecipeEntry(entry: RecipeIO) {
		return `${entry.amount} ${getProductName(entry.product_id)}`;
	}

	const recipeItems = $derived.by((): RecipeItem[] =>
		recipes.map((recipe: Recipe, index: number) => {
			const machineId = getRecipeMachineId(recipe);
			const machineName = machineId ? getBuildingName(machineId) : 'Unassigned recipe';
			const outputNames = recipe.outputs?.map((entry: RecipeIO) => getProductName(entry.product_id)) ?? [];
			const inputNames = recipe.inputs?.map((entry: RecipeIO) => getProductName(entry.product_id)) ?? [];
			const id = `recipe:${machineId ?? 'unassigned'}:${index}`;

			return {
				id,
				label: outputNames.length
					? `${machineName} -> ${outputNames.join(', ')}`
					: machineName,
				subtitle: `Recipe ${index + 1}`,
				searchText: [
					machineName,
					machineId ?? '',
					outputNames.join(' '),
					inputNames.join(' '),
					recipe.duration ?? ''
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
			const inputNames = contract.inputs.map((entry: RecipeIO) => getProductName(entry.product_id));
			const outputNames = contract.outputs.map((entry: RecipeIO) => getProductName(entry.product_id));
			const id = `contract:${index}`;

			return {
				id,
				label: `Reputation ${contract.reputation_level}: ${inputNames.join(', ')} for ${outputNames.join(', ')}`,
				subtitle: `Contract ${index + 1}`,
				searchText: [
					String(contract.reputation_level),
					inputNames.join(' '),
					outputNames.join(' '),
					contract.inputs.map((entry: RecipeIO) => entry.product_id).join(' '),
					contract.outputs.map((entry: RecipeIO) => entry.product_id).join(' ')
				]
					.join(' ')
					.toLowerCase(),
				contract,
				index
			};
		})
	);

	const listItems = $derived.by(
		(): Record<ExplorerType, ListItem[]> => ({
			products: products.map((product: Product) => ({
				id: product.id,
				label: getProductName(product.id),
				subtitle: product.state ?? undefined,
				searchText: [
					getProductName(product.id),
					product.id,
					product.state ?? '',
					product.description ?? '',
					product.is_trash ? 'trash' : '',
					product.is_storable ? 'storable' : 'unstorable'
				]
					.join(' ')
					.toLowerCase(),
				iconHref: getProductIconHref(product.id)
			})),
			buildings: buildings.map((building: Building) => ({
				id: building.id,
				label: getBuildingName(building.id),
				subtitle: building.stats?.footprint ? `Footprint ${building.stats.footprint}` : undefined,
				searchText: [
					getBuildingName(building.id),
					building.id,
					building.name,
					building.stats?.variants?.join(' ') ?? '',
					building.description ?? ''
				]
					.join(' ')
					.toLowerCase(),
				iconHref: getBuildingIconHref(building.id)
			})),
			recipes: recipeItems,
			contracts: contractItems
		})
	);

	const typeCounts = $derived.by(
		(): Record<ExplorerType, number> => ({
			products: products.length,
			buildings: buildings.length,
			recipes: recipes.length,
			contracts: contracts.length
		})
	);

	const orderedTypes: ExplorerType[] = ['products', 'buildings', 'recipes', 'contracts'];

	let search = $state('');

	function parseType(rawType: string | null): ExplorerType {
		return rawType === 'products' ||
			rawType === 'buildings' ||
			rawType === 'recipes' ||
			rawType === 'contracts'
			? rawType
			: 'products';
	}

	function buildHref(type: ExplorerType, id?: string) {
		const params = new URLSearchParams();
		params.set('type', type);
		if (id) params.set('id', id);
		return `/explorer/?${params.toString()}`;
	}

	function getFilteredItems(type: ExplorerType, query: string): ListItem[] {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) return listItems[type];
		return listItems[type].filter((item: ListItem) => item.searchText.includes(normalizedQuery));
	}

	function selectedItemId(requestedId: string | null, filteredItems: ListItem[]) {
		if (requestedId && filteredItems.some((item: ListItem) => item.id === requestedId)) {
			return requestedId;
		}
		return filteredItems[0]?.id ?? null;
	}

	function getRecipeLabel(recipe: Recipe, index: number) {
		return recipeItems[index]?.label ?? `Recipe ${index + 1}`;
	}

	function linkedRecipesForProduct(productId: string, mode: 'input' | 'output') {
		return recipes
			.map((recipe: Recipe, index: number) => ({ recipe, index }))
			.filter(({ recipe }: { recipe: Recipe; index: number }) =>
				(mode === 'input' ? recipe.inputs : recipe.outputs)?.some(
					(entry: RecipeIO) => entry.product_id === productId
				)
			)
			.map(({ recipe, index }: { recipe: Recipe; index: number }) => ({
				id: `recipe:${getRecipeMachineId(recipe) ?? 'unassigned'}:${index}`,
				label: getRecipeLabel(recipe, index)
			}));
	}

	function linkedRecipesForBuilding(buildingId: string) {
		return recipes
			.map((recipe: Recipe, index: number) => ({ recipe, index }))
			.filter(({ recipe }: { recipe: Recipe; index: number }) => getRecipeMachineId(recipe) === buildingId)
			.map(({ recipe, index }: { recipe: Recipe; index: number }) => ({
				id: `recipe:${getRecipeMachineId(recipe) ?? 'unassigned'}:${index}`,
				label: getRecipeLabel(recipe, index)
			}));
	}

	function contractMatches(productId: string, mode: 'input' | 'output') {
		return contracts
			.map((contract: Contract, index: number) => ({ contract, index }))
			.filter(({ contract }: { contract: Contract; index: number }) =>
				(mode === 'input' ? contract.inputs : contract.outputs).some(
					(entry: RecipeIO) => entry.product_id === productId
				)
			);
	}

	const currentType = $derived(parseType($page.url.searchParams.get('type')));
	const filteredItems = $derived(getFilteredItems(currentType, search));
	const currentId = $derived(selectedItemId($page.url.searchParams.get('id'), filteredItems));

	const currentProduct = $derived(
		currentType === 'products' && currentId ? (productsById.get(currentId) ?? null) : null
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
		currentProduct ? linkedRecipesForProduct(currentProduct.id, 'output') : []
	);
	const consumedBy = $derived(
		currentProduct ? linkedRecipesForProduct(currentProduct.id, 'input') : []
	);
	const buildingConstruction = $derived(
		currentProduct
			? buildings.filter((building: Building) =>
					building.construction_cost?.some(
						(entry: { product_id: string; amount: number }) => entry.product_id === currentProduct.id
					)
				)
			: []
	);
	const buildingMaintenance = $derived(
		currentProduct
			? buildings.filter(
					(building: Building) => building.stats?.maintenance_cost?.product_id === currentProduct.id
				)
			: []
	);
	const contractInputs = $derived(
		currentProduct ? contractMatches(currentProduct.id, 'input') : []
	);
	const contractOutputs = $derived(
		currentProduct ? contractMatches(currentProduct.id, 'output') : []
	);
	const buildingRecipes = $derived(currentBuilding ? linkedRecipesForBuilding(currentBuilding.id) : []);
	const recipeMachineId = $derived(currentRecipe ? getRecipeMachineId(currentRecipe) : null);
	const recipeMachine = $derived(recipeMachineId ? (buildingsById.get(recipeMachineId) ?? null) : null);
	const recipeOutputs = $derived(currentRecipe?.outputs ?? []);
	const recipeInputs = $derived(currentRecipe?.inputs ?? []);
</script>

<div class="mx-auto flex h-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900">Explorer</h1>
		<p class="mt-2 max-w-3xl text-sm text-gray-600">
			Browse the Captain of Industry database and follow links between products, buildings,
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
										{#if item.iconHref}
											<img
												src={item.iconHref}
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
			{:else if currentType === 'products' && currentProduct}
				<div class="p-6">
					<div class="mb-6 flex items-start justify-between gap-4">
						<div class="flex items-start gap-4">
							<img
								src={getProductIconHref(currentProduct.id)}
								alt=""
								class="h-14 w-14 rounded-xl border border-gray-200 bg-white p-2"
							/>
							<div>
								<h2 class="text-2xl font-semibold text-gray-900">
									{getProductName(currentProduct.id)}
								</h2>
								<div class="mt-1 font-mono text-sm text-gray-500">{currentProduct.id}</div>
							</div>
						</div>
						{#if currentProduct.state}
							<div
								class="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold tracking-wide text-teal-700 uppercase"
							>
								{currentProduct.state}
							</div>
						{/if}
					</div>

					{#if currentProduct.description}
						<p class="mb-6 text-sm leading-6 text-gray-700">{currentProduct.description}</p>
					{/if}

					<div class="grid gap-6 xl:grid-cols-2">
						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Produced By Recipes</h3>
							{#if producedBy.length}
								<ul class="mt-3 space-y-2">
									{#each producedBy as entry}
										<li>
											<a class="text-sm text-blue-700 hover:underline" href={buildHref('recipes', entry.id)}>
												{entry.label}
											</a>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No recipe outputs reference this product.</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Consumed By Recipes</h3>
							{#if consumedBy.length}
								<ul class="mt-3 space-y-2">
									{#each consumedBy as entry}
										<li>
											<a class="text-sm text-blue-700 hover:underline" href={buildHref('recipes', entry.id)}>
												{entry.label}
											</a>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No recipe inputs reference this product.</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Construction Cost</h3>
							{#if buildingConstruction.length}
								<ul class="mt-3 space-y-2">
									{#each buildingConstruction as building}
										<li>
											<a class="text-sm text-blue-700 hover:underline" href={buildHref('buildings', building.id)}>
												{getBuildingName(building.id)}
											</a>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No buildings reference this product in construction.</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Maintenance Cost</h3>
							{#if buildingMaintenance.length}
								<ul class="mt-3 space-y-2">
									{#each buildingMaintenance as building}
										<li>
											<a class="text-sm text-blue-700 hover:underline" href={buildHref('buildings', building.id)}>
												{getBuildingName(building.id)}
											</a>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No buildings reference this product for maintenance.</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Contract Inputs</h3>
							{#if contractInputs.length}
								<ul class="mt-3 space-y-2">
									{#each contractInputs as { index }}
										<li>
											<a class="text-sm text-blue-700 hover:underline" href={buildHref('contracts', `contract:${index}`)}>
												{contractItems[index]?.label ?? `Contract ${index + 1}`}
											</a>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No contracts import this product.</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Contract Outputs</h3>
							{#if contractOutputs.length}
								<ul class="mt-3 space-y-2">
									{#each contractOutputs as { index }}
										<li>
											<a class="text-sm text-blue-700 hover:underline" href={buildHref('contracts', `contract:${index}`)}>
												{contractItems[index]?.label ?? `Contract ${index + 1}`}
											</a>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No contracts export this product.</p>
							{/if}
						</div>
					</div>
				</div>
			{:else if currentType === 'buildings' && currentBuilding}
				<div class="p-6">
					<div class="mb-6 flex items-start gap-4">
						<img
							src={getBuildingIconHref(currentBuilding.id)}
							alt=""
							class="h-14 w-14 rounded-xl border border-gray-200 bg-white p-2"
						/>
						<div>
							<h2 class="text-2xl font-semibold text-gray-900">{getBuildingName(currentBuilding.id)}</h2>
							<div class="mt-1 font-mono text-sm text-gray-500">{currentBuilding.id}</div>
						</div>
					</div>

					{#if currentBuilding.description}
						<p class="mb-6 text-sm leading-6 text-gray-700">{currentBuilding.description}</p>
					{/if}

					<div class="grid gap-6 xl:grid-cols-2">
						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Stats</h3>
							<div class="mt-3 space-y-2 text-sm text-gray-700">
								<div>Workers: {currentBuilding.stats?.workers ?? 'Unknown'}</div>
								<div>Electricity: {currentBuilding.stats?.electricity_kw ?? 'Unknown'} kW</div>
								<div>Computing: {currentBuilding.stats?.computing_tflops ?? 'Unknown'} TFLOPS</div>
								<div>Footprint: {currentBuilding.stats?.footprint ?? 'Unknown'}</div>
								<div>Variants: {currentBuilding.stats?.variants?.join(', ') ?? 'None'}</div>
							</div>
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Construction Cost</h3>
							{#if currentBuilding.construction_cost?.length}
								<ul class="mt-3 space-y-2 text-sm text-gray-700">
									{#each currentBuilding.construction_cost as entry}
										<li>{formatRecipeEntry(entry)}</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No construction cost data.</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4 xl:col-span-2">
							<h3 class="text-sm font-semibold text-gray-900">Recipes</h3>
							{#if buildingRecipes.length}
								<ul class="mt-3 space-y-2">
									{#each buildingRecipes as entry}
										<li>
											<a class="text-sm text-blue-700 hover:underline" href={buildHref('recipes', entry.id)}>
												{entry.label}
											</a>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No recipes reference this building.</p>
							{/if}
						</div>
					</div>
				</div>
			{:else if currentType === 'recipes' && currentRecipe}
				<div class="p-6">
					<div class="mb-6 flex items-start gap-4">
						<img
							src={recipeMachine ? getBuildingIconHref(recipeMachine.id) : getProductIconHref(recipeOutputs[0]?.product_id ?? 'product_waste')}
							alt=""
							class="h-14 w-14 rounded-xl border border-gray-200 bg-white p-2"
						/>
						<div>
							<h2 class="text-2xl font-semibold text-gray-900">
								{recipeMachine ? getBuildingName(recipeMachine.id) : 'Unassigned recipe'}
							</h2>
							<div class="mt-1 font-mono text-sm text-gray-500">{currentId}</div>
						</div>
					</div>

					<div class="grid gap-6 xl:grid-cols-2">
						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Recipe Details</h3>
							<div class="mt-3 space-y-2 text-sm text-gray-700">
								<div>Duration: {currentRecipe.duration ?? 'Unknown'}</div>
								<div>Machine: {recipeMachine ? getBuildingName(recipeMachine.id) : 'Unassigned'}</div>
								<div>Inputs: {recipeInputs.length}</div>
								<div>Outputs: {recipeOutputs.length}</div>
							</div>
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Inputs</h3>
							{#if recipeInputs.length}
								<ul class="mt-3 space-y-2 text-sm text-gray-700">
									{#each recipeInputs as entry}
										<li>{formatRecipeEntry(entry)}</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No inputs listed.</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4 xl:col-span-2">
							<h3 class="text-sm font-semibold text-gray-900">Outputs</h3>
							{#if recipeOutputs.length}
								<ul class="mt-3 space-y-2">
									{#each recipeOutputs as entry}
										<li class="flex items-center gap-3 text-sm text-gray-700">
											<img
												src={getProductIconHref(entry.product_id)}
												alt=""
												class="h-8 w-8 rounded-md border border-gray-200 bg-white p-1"
											/>
											<span>{formatRecipeEntry(entry)}</span>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No outputs listed.</p>
							{/if}
						</div>
					</div>
				</div>
			{:else if currentType === 'contracts' && currentContract}
				<div class="p-6">
					<div class="mb-6 flex items-start gap-4">
						<div class="flex h-14 w-14 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-lg font-bold text-gray-700">
							{currentContract.reputation_level}
						</div>
						<div>
							<h2 class="text-2xl font-semibold text-gray-900">
								Contract {(currentContractIndex ?? 0) + 1}
							</h2>
							<div class="mt-1 font-mono text-sm text-gray-500">{currentId}</div>
						</div>
					</div>

					<div class="grid gap-6 xl:grid-cols-2">
						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Inputs</h3>
							{#if currentContract.inputs.length}
								<ul class="mt-3 space-y-2 text-sm text-gray-700">
									{#each currentContract.inputs as entry}
										<li class="flex items-center gap-3">
											<img
												src={getProductIconHref(entry.product_id)}
												alt=""
												class="h-8 w-8 rounded-md border border-gray-200 bg-white p-1"
											/>
											<span>{formatRecipeEntry(entry)}</span>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No inputs listed.</p>
							{/if}
						</div>

						<div class="rounded-xl border border-gray-200 p-4">
							<h3 class="text-sm font-semibold text-gray-900">Outputs</h3>
							{#if currentContract.outputs.length}
								<ul class="mt-3 space-y-2 text-sm text-gray-700">
									{#each currentContract.outputs as entry}
										<li class="flex items-center gap-3">
											<img
												src={getProductIconHref(entry.product_id)}
												alt=""
												class="h-8 w-8 rounded-md border border-gray-200 bg-white p-1"
											/>
											<span>{formatRecipeEntry(entry)}</span>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-gray-500">No outputs listed.</p>
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<div class="p-6 text-sm text-gray-500">Nothing to show.</div>
			{/if}
		</section>
	</div>
</div>
