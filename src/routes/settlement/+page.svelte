<svelte:options runes={false} />

<script lang="ts">
	type FoodCategory = 'Carbs' | 'Protein' | 'Vitamins' | 'Treats';
	type MedicalLevel = 'none' | 'medical1' | 'medical2' | 'medical3';
	type HousingTier = 'I' | 'II' | 'III' | 'IV';
	type ValueRange = { min: number; max: number };

	type FoodDef = {
		key: string;
		name: string;
		category: FoodCategory;
		baseDemandA: number;
		icon: string;
	};

	type ServiceNeed = {
		key: string;
		name: string;
		unit: string;
		per1000: number;
		enabled: boolean;
		icon?: string;
	};

	const icon = {
		food: '/settlement-icons/24px-FoodProduction.png',
		electricity: '/settlement-icons/electricity.svg',
		water: '/settlement-icons/water.svg',
		wasteWater: '/settlement-icons/wastewater.svg',
		householdGoods: '/settlement-icons/household-goods.svg',
		waste: '/settlement-icons/24px-Waste.png',
		biomass: '/settlement-icons/24px-Biomass.png',
		recyclables: '/settlement-icons/24px-Recyclables.png',
		computing: '/settlement-icons/24px-Computing.png',
		consumerElectronics: '/settlement-icons/24px-ConsumerElectronics.png',
		householdAppliances: '/settlement-icons/24px-HouseholdAppliances.png',
		luxuryGoods: '/settlement-icons/24px-LuxuryGoods.png',
		medical1: '/settlement-icons/24px-MedicalSupplies.png',
		medical2: '/settlement-icons/24px-MedicalSupplies2.png',
		medical3: '/settlement-icons/24px-MedicalSupplies3.png'
	} as const;

	const foods: FoodDef[] = [
		{
			key: 'potato',
			name: 'Potato',
			category: 'Carbs',
			baseDemandA: 4.2,
			icon: '/settlement-icons/24px-Potato.png'
		},
		{ key: 'corn', name: 'Corn', category: 'Carbs', baseDemandA: 3.0, icon: '/settlement-icons/24px-Corn.png' },
		{
			key: 'bread',
			name: 'Bread',
			category: 'Carbs',
			baseDemandA: 2.0,
			icon: '/settlement-icons/24px-Bread.png'
		},
		{ key: 'meat', name: 'Meat', category: 'Protein', baseDemandA: 2.7, icon: '/settlement-icons/24px-Meat.png' },
		{ key: 'eggs', name: 'Eggs', category: 'Protein', baseDemandA: 3.0, icon: '/settlement-icons/24px-Eggs.png' },
		{ key: 'tofu', name: 'Tofu', category: 'Protein', baseDemandA: 1.8, icon: '/settlement-icons/24px-Tofu.png' },
		{
			key: 'sausage',
			name: 'Sausage',
			category: 'Protein',
			baseDemandA: 3.35,
			icon: '/settlement-icons/24px-Sausage.png'
		},
		{
			key: 'vegetables',
			name: 'Vegetables',
			category: 'Vitamins',
			baseDemandA: 4.2,
			icon: '/settlement-icons/24px-Vegetables.png'
		},
		{
			key: 'fruit',
			name: 'Fruit',
			category: 'Vitamins',
			baseDemandA: 3.15,
			icon: '/settlement-icons/24px-Fruit.png'
		},
		{
			key: 'snack',
			name: 'Snack',
			category: 'Treats',
			baseDemandA: 2.6,
			icon: '/settlement-icons/24px-Snack.png'
		},
		{ key: 'cake', name: 'Cake', category: 'Treats', baseDemandA: 2.5, icon: '/settlement-icons/24px-Cake.png' }
	];

	const tierDemandMultipliers: Record<
		HousingTier,
		{
			electricity: number;
			water: number;
			wasteWater: number;
			householdGoods: number;
			householdAppliances: number;
			luxuryGoods: number;
			consumerElectronics: number;
		}
	> = {
		I: {
			electricity: 1,
			water: 1,
			wasteWater: 1,
			householdGoods: 1,
			householdAppliances: 1,
			luxuryGoods: 1,
			consumerElectronics: 1
		},
		II: {
			electricity: 1.1,
			water: 1.05,
			wasteWater: 1.05,
			householdGoods: 1,
			householdAppliances: 1,
			luxuryGoods: 1,
			consumerElectronics: 1
		},
		III: {
			electricity: 1.2,
			water: 1.1,
			wasteWater: 1.1,
			householdGoods: 1.05,
			householdAppliances: 1,
			luxuryGoods: 1,
			consumerElectronics: 1
		},
		IV: {
			electricity: 1.4,
			water: 1.2,
			wasteWater: 1.2,
			householdGoods: 1.1,
			householdAppliances: 1.1,
			luxuryGoods: 1.1,
			consumerElectronics: 1
		}
	};

	let population = 10000;
	let housingTier: HousingTier = 'III';
	let collectBiomass = true;
	let collectRecyclables = true;

	let provideElectricity = true;
	let provideWater = true;
	let provideWasteWaterRemoval = true;
	let provideHouseholdGoods = true;
	let provideHouseholdAppliances = true;
	let provideLuxuryGoods = false;
	let provideConsumerElectronics = false;
	let provideComputing = false;
	let medicalLevel: MedicalLevel = 'medical2';

	let selectedFoodKeys = new Set<string>(['potato', 'vegetables']);
	let consumptionMultiplier = 1;

	function roundTo(value: number, digits = 2): number {
		const p = 10 ** digits;
		return Math.round(value * p) / p;
	}

	function addRange(a: ValueRange, b: ValueRange): ValueRange {
		return { min: a.min + b.min, max: a.max + b.max };
	}

	function scaleRange(r: ValueRange, factor: number): ValueRange {
		return { min: r.min * factor, max: r.max * factor };
	}

	function formatRange(r: ValueRange, digits = 2): string {
		if (Math.abs(r.min - r.max) < 1e-9) return `${roundTo(r.min, digits)}`;
		return `${roundTo(r.min, digits)} - ${roundTo(r.max, digits)}`;
	}

	function toggleFood(key: string): void {
		if (selectedFoodKeys.has(key)) selectedFoodKeys.delete(key);
		else selectedFoodKeys.add(key);
		selectedFoodKeys = new Set(selectedFoodKeys);
	}

	function setAllFoods(enabled: boolean): void {
		selectedFoodKeys = enabled ? new Set(foods.map((f) => f.key)) : new Set<string>();
	}

	function setAllServices(enabled: boolean): void {
		provideElectricity = enabled;
		provideWater = enabled;
		provideWasteWaterRemoval = enabled;
		provideHouseholdGoods = enabled;
		provideHouseholdAppliances = enabled;
		provideLuxuryGoods = enabled;
		provideConsumerElectronics = enabled;
		provideComputing = enabled;
		medicalLevel = enabled ? 'medical3' : 'none';
	}

	function foodDemandPer1000PerMonth(
		food: FoodDef,
		selectedFoods: FoodDef[],
		foodMultiplier: number
	): number {
		const categoryCounts = new Map<FoodCategory, number>();
		for (const f of selectedFoods) {
			categoryCounts.set(f.category, (categoryCounts.get(f.category) ?? 0) + 1);
		}

		const activeCategories = categoryCounts.size;
		const inCategory = categoryCounts.get(food.category) ?? 1;
		const per100PerMonth = (food.baseDemandA / (activeCategories * inCategory)) * foodMultiplier;
		return per100PerMonth * 10;
	}

	$: popScale = Math.max(0, population) / 1000;
	$: multipliers = tierDemandMultipliers[housingTier];

	$: selectedFoods = foods.filter((f) => selectedFoodKeys.has(f.key));

	$: foodNeedsPer1000PerMonth = selectedFoods.map((f) => ({
		key: f.key,
		name: f.name,
		category: f.category,
		icon: f.icon,
		value: foodDemandPer1000PerMonth(f, selectedFoods, consumptionMultiplier)
	}));

	$: foodNeedsTotalPer1000PerMonth = foodNeedsPer1000PerMonth.reduce((sum, f) => sum + f.value, 0);

	let serviceNeeds: ServiceNeed[] = [];
	$: serviceNeeds = [
		{
			key: 'electricity',
			name: 'Electricity',
			unit: 'MW',
			per1000: 1.1 * multipliers.electricity,
			enabled: provideElectricity,
			icon: icon.electricity
		},
		{
			key: 'water',
			name: 'Water',
			unit: '',
			per1000: 47 * multipliers.water,
			enabled: provideWater,
			icon: icon.water
		},
		{
			key: 'wasteWater',
			name: 'Waste Water removal',
			unit: '',
			per1000: 39.2 * multipliers.wasteWater,
			enabled: provideWasteWaterRemoval,
			icon: icon.wasteWater
		},
		{
			key: 'householdGoods',
			name: 'Household Goods',
			unit: '',
			per1000: 10 * multipliers.householdGoods,
			enabled: provideHouseholdGoods,
			icon: icon.householdGoods
		},
		{
			key: 'householdAppliances',
			name: 'Household Appliances',
			unit: '',
			per1000: 7 * multipliers.householdAppliances,
			enabled: provideHouseholdAppliances,
			icon: icon.householdAppliances
		},
		{
			key: 'luxuryGoods',
			name: 'Luxury Goods',
			unit: '',
			per1000: 3.6 * multipliers.luxuryGoods,
			enabled: provideLuxuryGoods,
			icon: icon.luxuryGoods
		},
		{
			key: 'consumerElectronics',
			name: 'Consumer Electronics',
			unit: '',
			per1000: 3.6 * multipliers.consumerElectronics,
			enabled: provideConsumerElectronics,
			icon: icon.consumerElectronics
		},
		{
			key: 'medical',
			name: 'Medical Supplies',
			unit: '',
			per1000: 5.0,
			enabled: medicalLevel !== 'none',
			icon:
				medicalLevel === 'medical1'
					? icon.medical1
					: medicalLevel === 'medical2'
						? icon.medical2
						: medicalLevel === 'medical3'
							? icon.medical3
							: undefined
		},
		{
			key: 'computing',
			name: 'Computing',
			unit: 'TF',
			per1000: 57.6,
			enabled: provideComputing,
			icon: icon.computing
		}
	];

	let wasteBasePer1000: ValueRange = { min: 29.3, max: 29.3 };
	let foodBiomassPer1000: ValueRange = { min: 0, max: 0 };
	$: foodBiomassPer1000 =
		selectedFoods.length === 0
			? { min: 0, max: 0 }
			: selectedFoods.length === foods.length
				? { min: 4.1, max: 4.1 }
				: { min: 1.3, max: 6.4 };
	$: foodBiomassPer1000 = scaleRange(foodBiomassPer1000, consumptionMultiplier);

	$: householdGoodsBiomassPer1000 = provideHouseholdGoods ? 4.3 : 0;
	$: householdGoodsRecyclablesPer1000 = provideHouseholdGoods ? 6.8 : 0;
	$: householdAppliancesRecyclablesPer1000 = provideHouseholdAppliances ? 9.4 : 0;
	$: consumerElectronicsRecyclablesPer1000 = provideConsumerElectronics ? 6.1 : 0;
	$: medicalRecyclablesPer1000 =
		medicalLevel === 'medical1' || medicalLevel === 'medical2'
			? 2.7
			: medicalLevel === 'medical3'
				? 3.4
				: 0;

	$: biomassPer1000 = addRange(foodBiomassPer1000, {
		min: householdGoodsBiomassPer1000,
		max: householdGoodsBiomassPer1000
	});

	$: recyclablesPer1000 =
		householdGoodsRecyclablesPer1000 +
		householdAppliancesRecyclablesPer1000 +
		consumerElectronicsRecyclablesPer1000 +
		medicalRecyclablesPer1000;

	$: extraWasteFromNoRecyclablesPer1000 = !collectRecyclables
		? householdGoodsRecyclablesPer1000 * (3.6 / 6.8) +
			householdAppliancesRecyclablesPer1000 * (2.9 / 9.4) +
			consumerElectronicsRecyclablesPer1000 * (0.7 / 6.1)
		: 0;

	$: effectiveWastePreBiomassPer1000 = addRange(wasteBasePer1000, {
		min: extraWasteFromNoRecyclablesPer1000,
		max: extraWasteFromNoRecyclablesPer1000
	});

	$: effectiveWastePer1000 = collectBiomass
		? effectiveWastePreBiomassPer1000
		: addRange(effectiveWastePreBiomassPer1000, biomassPer1000);

	$: effectiveBiomassPer1000 = collectBiomass ? biomassPer1000 : { min: 0, max: 0 };
	$: effectiveRecyclablesPer1000 = collectRecyclables ? recyclablesPer1000 : 0;

	$: totalWaste = scaleRange(effectiveWastePer1000, popScale);
	$: totalBiomass = scaleRange(effectiveBiomassPer1000, popScale);
	$: totalRecyclables = scaleRange(
		{ min: effectiveRecyclablesPer1000, max: effectiveRecyclablesPer1000 },
		popScale
	);
</script>

<div class="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
	<div
		class="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-amber-50 p-6 shadow-sm"
	>
		<img
			src="/settlement-icons/360px-Population_Overview.png"
			alt=""
			class="pointer-events-none absolute -right-8 -top-16 hidden w-56 opacity-25 lg:block"
		/>
		<div class="relative">
			<h1 class="text-3xl font-bold text-gray-900">Settlement Calculator</h1>
			<p class="mt-2 max-w-2xl text-gray-600">
				Calculates service needs and waste-products for Captain of Industry settlements based on the
				reference wiki data.
			</p>
		</div>
	</div>

	<section class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
		<h2 class="text-xl font-semibold text-gray-900">Inputs</h2>
		<div class="mt-4 grid gap-4 md:grid-cols-3">
			<label class="flex flex-col gap-1 text-sm text-gray-700">
				<span>Population</span>
				<input
					type="number"
					min="0"
					step="100"
					class="rounded border border-gray-300 px-3 py-2"
					bind:value={population}
				/>
			</label>

			<label class="flex flex-col gap-1 text-sm text-gray-700">
				<span>Housing Tier</span>
				<select class="rounded border border-gray-300 px-3 py-2" bind:value={housingTier}>
					<option value="I">I</option>
					<option value="II">II</option>
					<option value="III">III</option>
					<option value="IV">IV</option>
				</select>
			</label>

			<label class="flex flex-col gap-1 text-sm text-gray-700">
				<span>Food consumption multiplier</span>
				<input
					type="number"
					min="0"
					step="0.05"
					class="rounded border border-gray-300 px-3 py-2"
					bind:value={consumptionMultiplier}
				/>
			</label>
		</div>

		<div class="mt-6 grid gap-6 lg:grid-cols-3">
			<div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
				<div class="flex items-center justify-between">
					<h3 class="font-medium text-gray-900">Provided services</h3>
					<div class="flex gap-3 text-xs">
						<button
							type="button"
							class="text-blue-600 underline-offset-2 hover:underline"
							onclick={() => setAllServices(true)}>all on</button
						>
						<button
							type="button"
							class="text-blue-600 underline-offset-2 hover:underline"
							onclick={() => setAllServices(false)}>all off</button
						>
					</div>
				</div>
				<div class="mt-3 space-y-2 text-sm">
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideElectricity} /><img
							src={icon.electricity}
							alt=""
							class="h-4 w-4"
						/>Electricity</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideWater} /><img
							src={icon.water}
							alt=""
							class="h-4 w-4"
						/>Water</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideWasteWaterRemoval} /><img
							src={icon.wasteWater}
							alt=""
							class="h-4 w-4"
						/>Waste Water removal</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideHouseholdGoods} /><img
							src={icon.householdGoods}
							alt=""
							class="h-4 w-4"
						/>Household Goods</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideHouseholdAppliances} /><img
							src={icon.householdAppliances}
							alt=""
							class="h-4 w-4"
						/>Household Appliances</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideLuxuryGoods} /><img
							src={icon.luxuryGoods}
							alt=""
							class="h-4 w-4"
						/>Luxury Goods</label
					>
					<label class="flex items-center gap-2"
						><input
							type="checkbox"
							bind:checked={provideConsumerElectronics}
						/><img src={icon.consumerElectronics} alt="" class="h-4 w-4" />Consumer Electronics</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideComputing} /><img
							src={icon.computing}
							alt=""
							class="h-4 w-4"
						/>Computing</label
					>
					<label class="flex items-center gap-2">
						<span>Medical</span>
						<select class="rounded border border-gray-300 px-2 py-1" bind:value={medicalLevel}>
							<option value="none">None</option>
							<option value="medical1">Medical Supplies I</option>
							<option value="medical2">Medical Supplies II</option>
							<option value="medical3">Medical Supplies III</option>
						</select>
					</label>
				</div>
			</div>

			<div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
				<h3 class="font-medium text-gray-900">Connected collection</h3>
				<div class="mt-3 space-y-2 text-sm">
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={collectBiomass} /><img
							src={icon.biomass}
							alt=""
							class="h-4 w-4"
						/>Biomass Collection</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={collectRecyclables} /><img
							src={icon.recyclables}
							alt=""
							class="h-4 w-4"
						/>Recyclables Collection</label
					>
				</div>
			</div>

			<div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
				<div class="flex items-center justify-between">
					<h3 class="font-medium text-gray-900">Provided food types</h3>
					<div class="flex gap-3 text-xs">
						<button
							type="button"
							class="text-blue-600 underline-offset-2 hover:underline"
							onclick={() => setAllFoods(true)}>all on</button
						>
						<button
							type="button"
							class="text-blue-600 underline-offset-2 hover:underline"
							onclick={() => setAllFoods(false)}>all off</button
						>
					</div>
				</div>
				<div class="mt-3 grid grid-cols-2 gap-2 text-sm">
					{#each foods as food}
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								checked={selectedFoodKeys.has(food.key)}
								onchange={() => toggleFood(food.key)}
							/>
							<img src={food.icon} alt="" class="h-4 w-4" />
							<span>{food.name}</span>
						</label>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section class="grid gap-6 lg:grid-cols-2">
		<div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
			<h2 class="flex items-center gap-2 text-xl font-semibold text-gray-900">
				<img src={icon.food} alt="" class="h-5 w-5" />Needs
			</h2>
			<p class="mt-1 text-sm text-gray-600">Demand values are per 60s for the configured population.</p>
			<div class="mt-4 overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b text-left text-gray-600">
							<th class="py-2 pr-4">Service</th>
							<th class="py-2 pr-4">Per 1000</th>
							<th class="py-2">Total</th>
						</tr>
					</thead>
					<tbody>
						{#each serviceNeeds.filter((s) => s.enabled) as s}
							<tr class="border-b border-gray-100">
								<td class="py-2 pr-4">
									<div class="flex items-center gap-2">
										{#if s.icon}
											<img src={s.icon} alt="" class="h-4 w-4" />
										{:else}
											<span class="h-2 w-2 rounded-full bg-slate-400"></span>
										{/if}
										<span>{s.name}</span>
									</div>
								</td>
								<td class="py-2 pr-4">{roundTo(s.per1000, 3)} {s.unit}</td>
								<td class="py-2">{roundTo(s.per1000 * popScale, 3)} {s.unit}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
			<h2 class="flex items-center gap-2 text-xl font-semibold text-gray-900">
				<img src={icon.food} alt="" class="h-5 w-5" />Food demand
			</h2>
			<p class="mt-1 text-sm text-gray-600">
				Computed from the wiki formula: <span class="font-mono">A / (Nc * N)</span>, shown per month.
			</p>
			<div class="mt-3 overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b text-left text-gray-600">
							<th class="py-2 pr-4">Food</th>
							<th class="py-2 pr-4">Category</th>
							<th class="py-2">Total / month</th>
						</tr>
					</thead>
					<tbody>
						{#each foodNeedsPer1000PerMonth as f}
							<tr class="border-b border-gray-100">
								<td class="py-2 pr-4">
									<div class="flex items-center gap-2">
										<img src={f.icon} alt="" class="h-4 w-4" />
										<span>{f.name}</span>
									</div>
								</td>
								<td class="py-2 pr-4">{f.category}</td>
								<td class="py-2">{roundTo(f.value * popScale, 2)}</td>
							</tr>
						{/each}
						<tr class="font-semibold">
							<td class="py-2 pr-4">Total Food</td>
							<td class="py-2 pr-4">-</td>
							<td class="py-2">{roundTo(foodNeedsTotalPer1000PerMonth * popScale, 2)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</section>

	<section>
		<div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
			<h2 class="flex items-center gap-2 text-xl font-semibold text-gray-900">
				<img src={icon.waste} alt="" class="h-5 w-5" />Waste-Products
			</h2>
			<p class="mt-1 text-sm text-gray-600">
				Outputs are per 60s for the configured population.
				{#if selectedFoods.length > 0 && selectedFoods.length < foods.length}
					Food-derived biomass is shown as a range because the wiki provides 1.3-6.4 for partial food sets.
				{/if}
			</p>

			<div class="mt-4 overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b text-left text-gray-600">
							<th class="py-2 pr-4">Product</th>
							<th class="py-2 pr-4">Per 1000</th>
							<th class="py-2">Total</th>
						</tr>
					</thead>
					<tbody>
						<tr class="border-b border-gray-100">
							<td class="py-2 pr-4">
								<div class="flex items-center gap-2">
									<img src={icon.waste} alt="" class="h-4 w-4" />
									<span>Waste</span>
								</div>
							</td>
							<td class="py-2 pr-4">{formatRange(effectiveWastePer1000, 3)}</td>
							<td class="py-2">{formatRange(totalWaste, 3)}</td>
						</tr>
						<tr class="border-b border-gray-100">
							<td class="py-2 pr-4">
								<div class="flex items-center gap-2">
									<img src={icon.biomass} alt="" class="h-4 w-4" />
									<span>Biomass</span>
								</div>
							</td>
							<td class="py-2 pr-4">{formatRange(effectiveBiomassPer1000, 3)}</td>
							<td class="py-2">{formatRange(totalBiomass, 3)}</td>
						</tr>
						<tr>
							<td class="py-2 pr-4">
								<div class="flex items-center gap-2">
									<img src={icon.recyclables} alt="" class="h-4 w-4" />
									<span>Recyclables</span>
								</div>
							</td>
							<td class="py-2 pr-4">{roundTo(effectiveRecyclablesPer1000, 3)}</td>
							<td class="py-2">{roundTo(totalRecyclables.min, 3)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</section>
</div>
