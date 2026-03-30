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
	};

	type ServiceNeed = {
		name: string;
		unit: string;
		per1000: number;
		enabled: boolean;
	};

	const foods: FoodDef[] = [
		{ key: 'potato', name: 'Potato', category: 'Carbs', baseDemandA: 4.2 },
		{ key: 'corn', name: 'Corn', category: 'Carbs', baseDemandA: 3.0 },
		{ key: 'bread', name: 'Bread', category: 'Carbs', baseDemandA: 2.0 },
		{ key: 'meat', name: 'Meat', category: 'Protein', baseDemandA: 2.7 },
		{ key: 'eggs', name: 'Eggs', category: 'Protein', baseDemandA: 3.0 },
		{ key: 'tofu', name: 'Tofu', category: 'Protein', baseDemandA: 1.8 },
		{ key: 'sausage', name: 'Sausage', category: 'Protein', baseDemandA: 3.35 },
		{ key: 'vegetables', name: 'Vegetables', category: 'Vitamins', baseDemandA: 4.2 },
		{ key: 'fruit', name: 'Fruit', category: 'Vitamins', baseDemandA: 3.15 },
		{ key: 'snack', name: 'Snack', category: 'Treats', baseDemandA: 2.6 },
		{ key: 'cake', name: 'Cake', category: 'Treats', baseDemandA: 2.5 }
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

	function foodDemandPer1000Per60(food: FoodDef, selectedFoods: FoodDef[]): number {
		const categoryCounts = new Map<FoodCategory, number>();
		for (const f of selectedFoods) {
			categoryCounts.set(f.category, (categoryCounts.get(f.category) ?? 0) + 1);
		}

		const activeCategories = categoryCounts.size;
		const inCategory = categoryCounts.get(food.category) ?? 1;
		const per100PerMonth = (food.baseDemandA / (activeCategories * inCategory)) * consumptionMultiplier;
		const per1000PerMonth = per100PerMonth * 10;

		// COI month is 30 days -> 30 * 24 = 720 in-game 60-second ticks.
		return per1000PerMonth / 720;
	}

	$: popScale = Math.max(0, population) / 1000;
	$: multipliers = tierDemandMultipliers[housingTier];

	$: selectedFoods = foods.filter((f) => selectedFoodKeys.has(f.key));

	$: foodNeedsPer1000Per60 = selectedFoods.map((f) => ({
		name: f.name,
		category: f.category,
		value: foodDemandPer1000Per60(f, selectedFoods)
	}));

	$: foodNeedsTotalPer1000Per60 = foodNeedsPer1000Per60.reduce((sum, f) => sum + f.value, 0);

	let serviceNeeds: ServiceNeed[] = [];
	$: serviceNeeds = [
		{
			name: 'Electricity',
			unit: 'MW',
			per1000: 1.1 * multipliers.electricity,
			enabled: provideElectricity
		},
		{
			name: 'Water',
			unit: '',
			per1000: 47 * multipliers.water,
			enabled: provideWater
		},
		{
			name: 'Waste Water removal',
			unit: '',
			per1000: 39.2 * multipliers.wasteWater,
			enabled: provideWasteWaterRemoval
		},
		{
			name: 'Household Goods',
			unit: '',
			per1000: 10 * multipliers.householdGoods,
			enabled: provideHouseholdGoods
		},
		{
			name: 'Household Appliances',
			unit: '',
			per1000: 7 * multipliers.householdAppliances,
			enabled: provideHouseholdAppliances
		},
		{
			name: 'Luxury Goods',
			unit: '',
			per1000: 3.6 * multipliers.luxuryGoods,
			enabled: provideLuxuryGoods
		},
		{
			name: 'Consumer Electronics',
			unit: '',
			per1000: 3.6 * multipliers.consumerElectronics,
			enabled: provideConsumerElectronics
		},
		{
			name: 'Medical Supplies',
			unit: '',
			per1000: 5.0,
			enabled: medicalLevel !== 'none'
		},
		{
			name: 'Computing',
			unit: '',
			per1000: 57.6,
			enabled: provideComputing
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
	<div>
		<h1 class="text-3xl font-bold text-gray-900">Settlement Calculator</h1>
		<p class="mt-2 text-gray-600">
			Calculates service needs and waste-products for Captain of Industry settlements based on the
			reference wiki data.
		</p>
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
			<div>
				<h3 class="font-medium text-gray-900">Provided services</h3>
				<div class="mt-3 space-y-2 text-sm">
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideElectricity} />Electricity</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideWater} />Water</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideWasteWaterRemoval} />Waste Water removal</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideHouseholdGoods} />Household Goods</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideHouseholdAppliances} />Household Appliances</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideLuxuryGoods} />Luxury Goods</label
					>
					<label class="flex items-center gap-2"
						><input
							type="checkbox"
							bind:checked={provideConsumerElectronics}
						/>Consumer Electronics</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={provideComputing} />Computing</label
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

			<div>
				<h3 class="font-medium text-gray-900">Connected collection</h3>
				<div class="mt-3 space-y-2 text-sm">
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={collectBiomass} />Biomass Collection</label
					>
					<label class="flex items-center gap-2"
						><input type="checkbox" bind:checked={collectRecyclables} />Recyclables Collection</label
					>
				</div>
			</div>

			<div>
				<h3 class="font-medium text-gray-900">Provided food types</h3>
				<div class="mt-3 grid grid-cols-2 gap-2 text-sm">
					{#each foods as food}
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								checked={selectedFoodKeys.has(food.key)}
								onchange={() => toggleFood(food.key)}
							/>
							<span>{food.name}</span>
						</label>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section class="grid gap-6 lg:grid-cols-2">
		<div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
			<h2 class="text-xl font-semibold text-gray-900">Needs</h2>
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
								<td class="py-2 pr-4">{s.name}</td>
								<td class="py-2 pr-4">{roundTo(s.per1000, 3)} {s.unit}</td>
								<td class="py-2">{roundTo(s.per1000 * popScale, 3)} {s.unit}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
			<h2 class="text-xl font-semibold text-gray-900">Food demand</h2>
			<p class="mt-1 text-sm text-gray-600">
				Computed from the wiki formula: <span class="font-mono">A / (Nc * N)</span>, converted to per 60s.
			</p>
			<div class="mt-3 overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b text-left text-gray-600">
							<th class="py-2 pr-4">Food</th>
							<th class="py-2 pr-4">Category</th>
							<th class="py-2">Total / 60s</th>
						</tr>
					</thead>
					<tbody>
						{#each foodNeedsPer1000Per60 as f}
							<tr class="border-b border-gray-100">
								<td class="py-2 pr-4">{f.name}</td>
								<td class="py-2 pr-4">{f.category}</td>
								<td class="py-2">{roundTo(f.value * popScale, 4)}</td>
							</tr>
						{/each}
						<tr class="font-semibold">
							<td class="py-2 pr-4">Total Food</td>
							<td class="py-2 pr-4">-</td>
							<td class="py-2">{roundTo(foodNeedsTotalPer1000Per60 * popScale, 4)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</section>

	<section>
		<div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
			<h2 class="text-xl font-semibold text-gray-900">Waste-Products</h2>
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
							<td class="py-2 pr-4">Waste</td>
							<td class="py-2 pr-4">{formatRange(effectiveWastePer1000, 3)}</td>
							<td class="py-2">{formatRange(totalWaste, 3)}</td>
						</tr>
						<tr class="border-b border-gray-100">
							<td class="py-2 pr-4">Biomass</td>
							<td class="py-2 pr-4">{formatRange(effectiveBiomassPer1000, 3)}</td>
							<td class="py-2">{formatRange(totalBiomass, 3)}</td>
						</tr>
						<tr>
							<td class="py-2 pr-4">Recyclables</td>
							<td class="py-2 pr-4">{roundTo(effectiveRecyclablesPer1000, 3)}</td>
							<td class="py-2">{roundTo(totalRecyclables.min, 3)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</section>
</div>
