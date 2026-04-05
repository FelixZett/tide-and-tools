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

<div class="mx-auto flex min-h-[70vh] max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
	<header class="space-y-3">
		<h1 class="text-3xl font-semibold tracking-tight text-base-content">Explorer</h1>
		<p class="max-w-3xl text-sm text-base-content/70">
			Browse the Captain of Industry database and follow links between products, buildings, recipes, and
			contracts.
		</p>
		<div class="tabs flex-wrap gap-2">
			{#each orderedTypes as type}
				<a
					href={buildHref(type)}
					class={`tab tab-lg ${
						currentType === type ? 'tab-active text-base-100 shadow-lg shadow-primary/40' : ''
					}`}
				>
					{type[0].toUpperCase() + type.slice(1)} ({typeCounts[type]})
				</a>
			{/each}
		</div>
	</header>

	<div class="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
		<section class="card bg-base-100/80 shadow-2xl shadow-black/50 backdrop-blur">
			<div class="card-body space-y-4">
				<label class="label" for="explorer-search">
					<span class="label-text text-xs uppercase tracking-[0.35em] text-base-content/60">Search</span>
				</label>
				<input
					id="explorer-search"
					class="input input-bordered input-primary w-full"
					bind:value={search}
					placeholder={`Search ${currentType}...`}
				/>

				<div class="max-h-[65vh] overflow-y-auto">
					{#if filteredItems.length === 0}
						<div class="rounded-2xl border border-base-200/70 bg-base-200/40 p-4 text-sm text-base-content/60">
							No matches.
						</div>
					{:else}
						<ul class="menu menu-vertical gap-2">
							{#each filteredItems as item}
								<li>
									<a
										href={buildHref(currentType, item.id)}
										class={`group flex items-start gap-3 rounded-2xl px-3 py-3 transition ${
											item.id === currentId
												? 'bg-primary/25 text-primary-content shadow-inner shadow-primary/30'
												: 'text-base-content hover:bg-base-200/60'
										}`}
									>
										{#if item.iconHref}
											<div class="avatar">
												<div class="mask mask-squircle h-10 w-10 bg-base-200/50 p-1">
													<img src={item.iconHref} alt="" class="h-full w-full object-contain" />
												</div>
											</div>
										{/if}
										<div class="flex-1">
											<div class="text-sm font-semibold">{item.label}</div>
											{#if item.subtitle}
												<div class="text-xs text-base-content/60">{item.subtitle}</div>
											{/if}
											<div class="mt-1 font-mono text-[11px] text-base-content/50">{item.id}</div>
										</div>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</section>

		<section class="card bg-base-100/80 shadow-2xl shadow-black/60 backdrop-blur">
			<div class="card-body space-y-4">
				{#if !currentId}
					<div class="text-sm text-base-content/60">Select an item to show its details.</div>
				{:else if currentType === 'products' && currentProduct}
					<div class="space-y-6">
						<div class="flex flex-wrap items-start justify-between gap-4">
							<div class="flex items-center gap-4">
								<div class="avatar">
									<div class="mask mask-squircle h-16 w-16 bg-base-200/60 p-2">
										<img src={getProductIconHref(currentProduct.id)} alt="" />
									</div>
								</div>
								<div>
									<h2 class="text-2xl font-semibold text-base-content">{getProductName(currentProduct.id)}</h2>
									<div class="text-sm font-mono text-base-content/60">{currentProduct.id}</div>
								</div>
							</div>
							{#if currentProduct.state}
								<span class="badge badge-primary badge-outline text-xs font-semibold tracking-[0.35em]">
									{currentProduct.state}
								</span>
							{/if}
						</div>
						{#if currentProduct.description}
							<p class="text-sm leading-6 text-base-content/70">{currentProduct.description}</p>
						{/if}
						<div class="grid gap-4 md:grid-cols-2">
							{#if producedBy.length > 0}
								<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
									<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Produced by</h3>
									<ul class="mt-3 space-y-2 text-sm">
										{#each producedBy as recipe}
											<li>
												<a class="text-primary hover:underline" href={buildHref('recipes', recipe.id)}>
													{recipe.label}
												</a>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
							{#if consumedBy.length > 0}
								<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
									<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Consumed by</h3>
									<ul class="mt-3 space-y-2 text-sm">
										{#each consumedBy as recipe}
											<li>
												<a class="text-primary hover:underline" href={buildHref('recipes', recipe.id)}>
													{recipe.label}
												</a>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
						{#if buildingConstruction.length > 0}
							<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
								<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Construction cost</h3>
								<ul class="mt-3 space-y-2 text-sm">
									{#each buildingConstruction as building}
										<li>
											<a class="text-primary hover:underline" href={buildHref('buildings', building.id)}>
												{getBuildingName(building.id)}
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
						{#if buildingMaintenance.length > 0}
							<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
								<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Maintenance cost</h3>
								<ul class="mt-3 space-y-2 text-sm">
									{#each buildingMaintenance as building}
										<li>
											<a class="text-primary hover:underline" href={buildHref('buildings', building.id)}>
												{getBuildingName(building.id)}
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
						{#if contractInputs.length > 0}
							<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
								<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Contract inputs</h3>
								<ul class="mt-3 space-y-2 text-sm">
									{#each contractInputs as { index }}
										<li>
											<a class="text-primary hover:underline" href={buildHref('contracts', `contract:${index}`)}>
												{contractItems[index]?.label ?? `Contract ${index + 1}`}
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
						{#if contractOutputs.length > 0}
							<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
								<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Contract outputs</h3>
								<ul class="mt-3 space-y-2 text-sm">
									{#each contractOutputs as { index }}
										<li>
											<a class="text-primary hover:underline" href={buildHref('contracts', `contract:${index}`)}>
												{contractItems[index]?.label ?? `Contract ${index + 1}`}
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				{:else if currentType === 'buildings' && currentBuilding}
					<div class="space-y-6">
						<div class="flex items-center gap-4">
							<div class="avatar">
								<div class="mask mask-squircle h-16 w-16 bg-base-200/60 p-2">
									<img src={getBuildingIconHref(currentBuilding.id)} alt="" />
								</div>
							</div>
							<div>
								<h2 class="text-2xl font-semibold text-base-content">{getBuildingName(currentBuilding.id)}</h2>
								<div class="text-sm font-mono text-base-content/60">{currentBuilding.id}</div>
							</div>
						</div>
						{#if currentBuilding.description}
							<p class="text-sm leading-6 text-base-content/70">{currentBuilding.description}</p>
						{/if}
						<div class="grid gap-4 md:grid-cols-2">
							<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
								<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Stats</h3>
								<div class="mt-3 space-y-2 text-sm text-base-content/70">
									<div>Workers: {currentBuilding.stats?.workers ?? 'Unknown'}</div>
									<div>Electricity: {currentBuilding.stats?.electricity_kw ?? 'Unknown'} kW</div>
									<div>Computing: {currentBuilding.stats?.computing_tflops ?? 'Unknown'} TFLOPS</div>
									<div>Footprint: {currentBuilding.stats?.footprint ?? 'Unknown'}</div>
									<div>Variants: {currentBuilding.stats?.variants?.join(', ') ?? 'None'}</div>
								</div>
							</div>
							<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
								<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Construction cost</h3>
								{#if currentBuilding.construction_cost?.length}
									<ul class="mt-3 space-y-2 text-sm text-base-content/70">
										{#each currentBuilding.construction_cost as entry}
											<li>{formatRecipeEntry(entry)}</li>
										{/each}
									</ul>
								{:else}
									<p class="mt-3 text-sm text-base-content/60">No construction cost data.</p>
								{/if}
							</div>
						</div>
						<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
							<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Recipes</h3>
							{#if buildingRecipes.length}
								<ul class="mt-3 space-y-2 text-sm">
									{#each buildingRecipes as entry}
										<li>
											<a class="text-primary hover:underline" href={buildHref('recipes', entry.id)}>
												{entry.label}
											</a>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-base-content/60">No recipes reference this building.</p>
							{/if}
						</div>
					</div>
				{:else if currentType === 'recipes' && currentRecipe}
					<div class="space-y-6">
						<div class="flex flex-wrap items-start gap-4">
							<div class="avatar">
								<div class="mask mask-squircle h-16 w-16 bg-base-200/60 p-2">
									<img
										src={
											recipeMachine
												? getBuildingIconHref(recipeMachine.id)
												: getProductIconHref(recipeOutputs[0]?.product_id ?? 'product_waste')
										}
										alt=""
									/>
								</div>
							</div>
							<div>
								<h2 class="text-2xl font-semibold text-base-content">
									{recipeMachine ? getBuildingName(recipeMachine.id) : 'Unassigned recipe'}
								</h2>
								<div class="text-sm font-mono text-base-content/60">{currentId}</div>
							</div>
						</div>
						<div class="grid gap-4 md:grid-cols-2">
							<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
								<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Recipe details</h3>
								<div class="mt-3 space-y-2 text-sm text-base-content/70">
									<div>Duration: {currentRecipe.duration ?? 'Unknown'}</div>
									<div>Machine: {recipeMachine ? getBuildingName(recipeMachine.id) : 'Unassigned'}</div>
									<div>Inputs: {recipeInputs.length}</div>
									<div>Outputs: {recipeOutputs.length}</div>
								</div>
							</div>
							<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
								<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Inputs</h3>
								{#if recipeInputs.length}
									<ul class="mt-3 space-y-2 text-sm text-base-content/70">
										{#each recipeInputs as entry}
											<li>{formatRecipeEntry(entry)}</li>
										{/each}
									</ul>
								{:else}
									<p class="mt-3 text-sm text-base-content/60">No inputs listed.</p>
								{/if}
							</div>
						</div>
						<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
							<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Outputs</h3>
							{#if recipeOutputs.length}
								<ul class="mt-3 space-y-3">
									{#each recipeOutputs as entry}
										<li class="flex items-center gap-3 text-sm text-base-content/70">
											<div class="avatar">
												<div class="mask mask-squircle h-9 w-9 bg-base-200/50 p-1">
													<img src={getProductIconHref(entry.product_id)} alt="" />
												</div>
											</div>
											<span>{formatRecipeEntry(entry)}</span>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-3 text-sm text-base-content/60">No outputs listed.</p>
							{/if}
						</div>
						{#if recipeMachine}
							<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
								<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Machine</h3>
								<div class="mt-2 text-sm text-base-content/70">{getBuildingName(recipeMachine.id)}</div>
							</div>
						{/if}
					</div>
				{:else if currentType === 'contracts' && currentContract}
					<div class="space-y-6">
						<div class="flex flex-wrap items-start gap-4">
							<div class="flex h-14 w-14 items-center justify-center rounded-xl border border-base-200 bg-base-200/60 text-lg font-bold text-base-content">
								{currentContract.reputation_level}
							</div>
							<div>
								<h2 class="text-2xl font-semibold text-base-content">Contract {(currentContractIndex ?? 0) + 1}</h2>
								<div class="text-sm font-mono text-base-content/60">{currentId}</div>
							</div>
						</div>
						<div class="grid gap-4 md:grid-cols-2">
							<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
								<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Inputs</h3>
								{#if currentContract.inputs.length}
									<ul class="mt-3 space-y-2 text-sm text-base-content/70">
										{#each currentContract.inputs as entry}
											<li class="flex items-center gap-3">
												<div class="avatar">
													<div class="mask mask-squircle h-9 w-9 bg-base-200/50 p-1">
														<img src={getProductIconHref(entry.product_id)} alt="" />
													</div>
												</div>
												<span>{formatRecipeEntry(entry)}</span>
											</li>
										{/each}
									</ul>
								{:else}
									<p class="mt-3 text-sm text-base-content/60">No inputs listed.</p>
								{/if}
							</div>
							<div class="rounded-2xl border border-base-200/80 bg-base-200/40 p-4">
								<h3 class="text-xs uppercase tracking-[0.28em] text-base-content/60">Outputs</h3>
								{#if currentContract.outputs.length}
									<ul class="mt-3 space-y-2 text-sm text-base-content/70">
										{#each currentContract.outputs as entry}
											<li class="flex items-center gap-3">
												<div class="avatar">
													<div class="mask mask-squircle h-9 w-9 bg-base-200/50 p-1">
														<img src={getProductIconHref(entry.product_id)} alt="" />
													</div>
												</div>
												<span>{formatRecipeEntry(entry)}</span>
											</li>
										{/each}
									</ul>
								{:else}
									<p class="mt-3 text-sm text-base-content/60">No outputs listed.</p>
								{/if}
							</div>
						</div>
					</div>
				{:else}
					<div class="text-sm text-base-content/60">Nothing to show.</div>
				{/if}
			</div>
		</section>
	</div>
</div>
