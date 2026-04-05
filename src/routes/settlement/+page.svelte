<svelte:options runes={false} />

<script lang="ts">
	import { getProductIconHref } from '$lib/coi-data';

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
		food: getProductIconHref('product_food_pack'),
		electricity: getProductIconHref('product_virtual_electricity'),
		water: getProductIconHref('product_water'),
		wasteWater: getProductIconHref('product_waste_water'),
		householdGoods: getProductIconHref('product_household_goods'),
		waste: getProductIconHref('product_waste'),
		biomass: getProductIconHref('product_biomass'),
		recyclables: getProductIconHref('product_recyclables'),
		computing: getProductIconHref('product_virtual_computing'),
		consumerElectronics: getProductIconHref('product_consumer_electronics'),
		householdAppliances: getProductIconHref('product_household_appliances'),
		luxuryGoods: getProductIconHref('product_luxury_goods'),
		medical1: getProductIconHref('product_medical_supplies'),
		medical2: getProductIconHref('product_medical_supplies2'),
		medical3: getProductIconHref('product_medical_supplies3')
	} as const;

	const foods: FoodDef[] = [
		{
			key: 'potato',
			name: 'Potato',
			category: 'Carbs',
			baseDemandA: 4.2,
			icon: getProductIconHref('product_potato')
		},
		{ key: 'corn', name: 'Corn', category: 'Carbs', baseDemandA: 3.0, icon: getProductIconHref('product_corn') },
		{
			key: 'bread',
			name: 'Bread',
			category: 'Carbs',
			baseDemandA: 2.0,
			icon: getProductIconHref('product_bread')
		},
		{ key: 'meat', name: 'Meat', category: 'Protein', baseDemandA: 2.7, icon: getProductIconHref('product_meat') },
		{ key: 'eggs', name: 'Eggs', category: 'Protein', baseDemandA: 3.0, icon: getProductIconHref('product_eggs') },
		{ key: 'tofu', name: 'Tofu', category: 'Protein', baseDemandA: 1.8, icon: getProductIconHref('product_tofu') },
		{
			key: 'sausage',
			name: 'Sausage',
			category: 'Protein',
			baseDemandA: 3.35,
			icon: getProductIconHref('product_sausage')
		},
		{
			key: 'vegetables',
			name: 'Vegetables',
			category: 'Vitamins',
			baseDemandA: 4.2,
			icon: getProductIconHref('product_vegetables')
		},
		{
			key: 'fruit',
			name: 'Fruit',
			category: 'Vitamins',
			baseDemandA: 3.15,
			icon: getProductIconHref('product_fruit')
		},
		{
			key: 'snack',
			name: 'Snack',
			category: 'Treats',
			baseDemandA: 2.6,
			icon: getProductIconHref('product_snack')
		},
		{ key: 'cake', name: 'Cake', category: 'Treats', baseDemandA: 2.5, icon: getProductIconHref('product_cake') }
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

	const housingCapacityByTier: Record<HousingTier, number> = {
		I: 80,
		II: 140,
		III: 240,
		IV: 400
	};

	let housingUnits = 42;
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

	$: housingCapacity = housingCapacityByTier[housingTier];
	$: estimatedPopulation = Math.max(0, housingUnits) * housingCapacity;
	$: popScale = estimatedPopulation / 1000;
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

<div class="settlement-page mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
	<div class="settlement-hero">
		<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.28),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.14),transparent_35%)]"></div>
		<div class="pointer-events-none absolute -right-6 -top-8 hidden lg:block">
			<div class="grid gap-3 rounded-3xl border border-white/40 bg-white/65 p-4 shadow-xl backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-950/55">
				<img src={getProductIconHref('product_food_pack')} alt="" class="h-12 w-12 rounded-2xl bg-white p-2 shadow-sm dark:bg-slate-900" />
				<img
					src={getProductIconHref('product_virtual_electricity')}
					alt=""
					class="h-12 w-12 rounded-2xl bg-white p-2 shadow-sm dark:bg-slate-900"
				/>
				<img src={getProductIconHref('product_waste_water')} alt="" class="h-12 w-12 rounded-2xl bg-white p-2 shadow-sm dark:bg-slate-900" />
			</div>
		</div>

		<div class="relative grid gap-6 p-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.9fr)] lg:p-8">
			<div class="space-y-4">
				<div class="inline-flex items-center gap-2 rounded-full border border-[color:var(--settlement-border)] bg-[color:var(--settlement-pill)] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--settlement-muted)]">
					Settlement planner
				</div>
				<div class="space-y-3">
					<h1 class="max-w-2xl text-3xl font-bold tracking-tight text-[color:var(--settlement-text)] sm:text-4xl">
						Settlement Calculator
					</h1>
					<p class="max-w-2xl text-sm leading-6 text-[color:var(--settlement-muted)] sm:text-base">
						Calculate service demand, food demand, and waste products for Captain of Industry settlements.
						Population is derived from housing units and housing tier.
					</p>
				</div>
			</div>

			<div class="settlement-panel grid gap-3 p-4">
				<div class="flex items-baseline justify-between gap-3">
					<span class="text-sm font-medium text-[color:var(--settlement-muted)]">Estimated population</span>
					<span class="text-xs uppercase tracking-[0.18em] text-[color:var(--settlement-muted)]">From housing</span>
				</div>
				<div class="text-4xl font-semibold tracking-tight text-[color:var(--settlement-text)]">
					{roundTo(estimatedPopulation, 0)}
				</div>
				<div class="flex flex-wrap gap-2 text-sm text-[color:var(--settlement-muted)]">
					<span class="rounded-full border border-[color:var(--settlement-border)] bg-[color:var(--settlement-chip)] px-3 py-1">
						{roundTo(housingUnits, 0)} housing units
					</span>
					<span class="rounded-full border border-[color:var(--settlement-border)] bg-[color:var(--settlement-chip)] px-3 py-1">
						Tier {housingTier} x {housingCapacity} people
					</span>
				</div>
			</div>
		</div>
	</div>

	<section class="settlement-panel p-5 sm:p-6">
		<h2 class="text-xl font-semibold text-[color:var(--settlement-text)]">Inputs</h2>
		<p class="mt-1 text-sm text-[color:var(--settlement-muted)]">
			Set housing units first, then choose the housing tier used for the capacity and demand multipliers.
		</p>
		<div class="mt-5 grid gap-4 md:grid-cols-3">
			<label class="flex flex-col gap-2 text-sm text-[color:var(--settlement-muted)]">
				<span>Housing units</span>
				<input
					type="number"
					min="0"
					step="1"
					class="settlement-input"
					bind:value={housingUnits}
				/>
			</label>

			<label class="flex flex-col gap-2 text-sm text-[color:var(--settlement-muted)]">
				<span>Housing Tier</span>
				<select class="settlement-input" bind:value={housingTier}>
					<option value="I">I</option>
					<option value="II">II</option>
					<option value="III">III</option>
					<option value="IV">IV</option>
				</select>
			</label>

			<label class="flex flex-col gap-2 text-sm text-[color:var(--settlement-muted)]">
				<span>Food consumption multiplier</span>
				<input
					type="number"
					min="0"
					step="0.05"
					class="settlement-input"
					bind:value={consumptionMultiplier}
				/>
			</label>
		</div>

		<div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			<div class="settlement-kpi">
				<div class="text-xs uppercase tracking-[0.18em] text-[color:var(--settlement-muted)]">Housing I</div>
				<div class="mt-2 text-lg font-semibold text-[color:var(--settlement-text)]">80 people / unit</div>
			</div>
			<div class="settlement-kpi">
				<div class="text-xs uppercase tracking-[0.18em] text-[color:var(--settlement-muted)]">Housing II</div>
				<div class="mt-2 text-lg font-semibold text-[color:var(--settlement-text)]">140 people / unit</div>
			</div>
			<div class="settlement-kpi">
				<div class="text-xs uppercase tracking-[0.18em] text-[color:var(--settlement-muted)]">Housing III</div>
				<div class="mt-2 text-lg font-semibold text-[color:var(--settlement-text)]">240 people / unit</div>
			</div>
			<div class="settlement-kpi">
				<div class="text-xs uppercase tracking-[0.18em] text-[color:var(--settlement-muted)]">Housing IV</div>
				<div class="mt-2 text-lg font-semibold text-[color:var(--settlement-text)]">400 people / unit</div>
			</div>
		</div>

		<div class="mt-6 grid gap-6 lg:grid-cols-3">
			<div class="settlement-panel-strong p-4">
				<div class="flex items-center justify-between gap-4">
					<h3 class="font-medium text-[color:var(--settlement-text)]">Provided services</h3>
					<div class="flex gap-3 text-xs">
						<button
							type="button"
							class="settlement-action"
							onclick={() => setAllServices(true)}>all on</button
						>
						<button
							type="button"
							class="settlement-action"
							onclick={() => setAllServices(false)}>all off</button
						>
					</div>
				</div>
				<div class="mt-3 space-y-2 text-sm text-[color:var(--settlement-text)]">
					<label class="settlement-check">
						<input type="checkbox" bind:checked={provideElectricity} />
						<img src={icon.electricity} alt="" class="h-4 w-4" />Electricity
					</label>
					<label class="settlement-check">
						<input type="checkbox" bind:checked={provideWater} />
						<img src={icon.water} alt="" class="h-4 w-4" />Water
					</label>
					<label class="settlement-check">
						<input type="checkbox" bind:checked={provideWasteWaterRemoval} />
						<img src={icon.wasteWater} alt="" class="h-4 w-4" />Waste Water removal
					</label>
					<label class="settlement-check">
						<input type="checkbox" bind:checked={provideHouseholdGoods} />
						<img src={icon.householdGoods} alt="" class="h-4 w-4" />Household Goods
					</label>
					<label class="settlement-check">
						<input type="checkbox" bind:checked={provideHouseholdAppliances} />
						<img src={icon.householdAppliances} alt="" class="h-4 w-4" />Household Appliances
					</label>
					<label class="settlement-check">
						<input type="checkbox" bind:checked={provideLuxuryGoods} />
						<img src={icon.luxuryGoods} alt="" class="h-4 w-4" />Luxury Goods
					</label>
					<label class="settlement-check">
						<input
							type="checkbox"
							bind:checked={provideConsumerElectronics}
						/>
						<img src={icon.consumerElectronics} alt="" class="h-4 w-4" />Consumer Electronics
					</label>
					<label class="settlement-check">
						<input type="checkbox" bind:checked={provideComputing} />
						<img src={icon.computing} alt="" class="h-4 w-4" />Computing
					</label>
					<label class="settlement-select-row">
						<span>Medical</span>
						<select class="settlement-input settlement-select" bind:value={medicalLevel}>
							<option value="none">None</option>
							<option value="medical1">Medical Supplies I</option>
							<option value="medical2">Medical Supplies II</option>
							<option value="medical3">Medical Supplies III</option>
						</select>
					</label>
				</div>
			</div>

			<div class="settlement-panel-strong p-4">
				<h3 class="font-medium text-[color:var(--settlement-text)]">Connected collection</h3>
				<div class="mt-3 space-y-2 text-sm text-[color:var(--settlement-text)]">
					<label class="settlement-check">
						<input type="checkbox" bind:checked={collectBiomass} />
						<img src={icon.biomass} alt="" class="h-4 w-4" />Biomass Collection
					</label>
					<label class="settlement-check">
						<input type="checkbox" bind:checked={collectRecyclables} />
						<img src={icon.recyclables} alt="" class="h-4 w-4" />Recyclables Collection
					</label>
				</div>
			</div>

			<div class="settlement-panel-strong p-4">
				<div class="flex items-center justify-between gap-4">
					<h3 class="font-medium text-[color:var(--settlement-text)]">Provided food types</h3>
					<div class="flex gap-3 text-xs">
						<button
							type="button"
							class="settlement-action"
							onclick={() => setAllFoods(true)}>all on</button
						>
						<button
							type="button"
							class="settlement-action"
							onclick={() => setAllFoods(false)}>all off</button
						>
					</div>
				</div>
				<div class="mt-3 grid grid-cols-2 gap-2 text-sm text-[color:var(--settlement-text)]">
					{#each foods as food}
						<label class="settlement-check">
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
		<div class="settlement-panel-strong p-5 sm:p-6">
			<h2 class="flex items-center gap-2 text-xl font-semibold text-[color:var(--settlement-text)]">
				<img src={icon.food} alt="" class="h-5 w-5" />Needs
			</h2>
			<p class="mt-1 text-sm text-[color:var(--settlement-muted)]">
				Demand values are per 60s for the estimated population.
			</p>
			<div class="mt-4 overflow-x-auto">
				<table class="settlement-table text-sm">
					<thead>
						<tr>
							<th class="py-2 pr-4">Service</th>
							<th class="py-2 pr-4">Per 1000</th>
							<th class="py-2">Total</th>
						</tr>
					</thead>
					<tbody>
						{#each serviceNeeds.filter((s) => s.enabled) as s}
							<tr>
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

		<div class="settlement-panel-strong p-5 sm:p-6">
			<h2 class="flex items-center gap-2 text-xl font-semibold text-[color:var(--settlement-text)]">
				<img src={icon.food} alt="" class="h-5 w-5" />Food demand
			</h2>
			<p class="mt-1 text-sm text-[color:var(--settlement-muted)]">
				Computed from the wiki formula: <span class="font-mono">A / (Nc * N)</span>, shown per month.
			</p>
			<div class="mt-3 overflow-x-auto">
				<table class="settlement-table text-sm">
					<thead>
						<tr>
							<th class="py-2 pr-4">Food</th>
							<th class="py-2 pr-4">Category</th>
							<th class="py-2">Total / month</th>
						</tr>
					</thead>
					<tbody>
						{#each foodNeedsPer1000PerMonth as f}
							<tr>
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
		<div class="settlement-panel-strong p-5 sm:p-6">
			<h2 class="flex items-center gap-2 text-xl font-semibold text-[color:var(--settlement-text)]">
				<img src={icon.waste} alt="" class="h-5 w-5" />Waste-Products
			</h2>
			<p class="mt-1 text-sm text-[color:var(--settlement-muted)]">
				Outputs are per 60s for the estimated population.
				{#if selectedFoods.length > 0 && selectedFoods.length < foods.length}
					Food-derived biomass is shown as a range because the wiki provides 1.3-6.4 for partial food sets.
				{/if}
			</p>

			<div class="mt-4 overflow-x-auto">
				<table class="settlement-table text-sm">
					<thead>
						<tr>
							<th class="py-2 pr-4">Product</th>
							<th class="py-2 pr-4">Per 1000</th>
							<th class="py-2">Total</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="py-2 pr-4">
								<div class="flex items-center gap-2">
									<img src={icon.waste} alt="" class="h-4 w-4" />
									<span>Waste</span>
								</div>
							</td>
							<td class="py-2 pr-4">{formatRange(effectiveWastePer1000, 3)}</td>
							<td class="py-2">{formatRange(totalWaste, 3)}</td>
						</tr>
						<tr>
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

<style>
	.settlement-page {
		--settlement-text: #0f172a;
		--settlement-muted: #475569;
		--settlement-border: rgb(148 163 184 / 0.32);
		--settlement-panel: rgb(255 255 255 / 0.78);
		--settlement-panel-strong: rgb(255 255 255 / 0.92);
		--settlement-pill: rgb(255 255 255 / 0.6);
		--settlement-chip: rgb(255 255 255 / 0.55);
		--settlement-input-bg: rgb(255 255 255 / 0.92);
	}

	:global(html.dark) .settlement-page {
		--settlement-text: #e2e8f0;
		--settlement-muted: #94a3b8;
		--settlement-border: rgb(71 85 105 / 0.9);
		--settlement-panel: rgb(15 23 42 / 0.72);
		--settlement-panel-strong: rgb(15 23 42 / 0.92);
		--settlement-pill: rgb(15 23 42 / 0.45);
		--settlement-chip: rgb(15 23 42 / 0.75);
		--settlement-input-bg: rgb(15 23 42 / 0.96);
	}

	.settlement-hero,
	.settlement-panel,
	.settlement-panel-strong,
	.settlement-kpi {
		border: 1px solid var(--settlement-border);
		background: var(--settlement-panel);
		color: var(--settlement-text);
		backdrop-filter: blur(18px);
		-webkit-backdrop-filter: blur(18px);
		box-shadow: 0 18px 45px rgb(15 23 42 / 0.08);
	}

	.settlement-panel-strong {
		background: var(--settlement-panel-strong);
	}

	.settlement-hero {
		position: relative;
		overflow: hidden;
		border-radius: 1.5rem;
		background:
			linear-gradient(135deg, rgb(255 255 255 / 0.85), rgb(255 248 235 / 0.8)),
			linear-gradient(135deg, rgb(248 250 252 / 0.95), rgb(255 255 255 / 0.86));
	}

	:global(html.dark) .settlement-hero {
		background:
			linear-gradient(135deg, rgb(15 23 42 / 0.96), rgb(2 6 23 / 0.92)),
			linear-gradient(135deg, rgb(30 41 59 / 0.9), rgb(15 23 42 / 0.82));
	}

	.settlement-kpi {
		border-radius: 1rem;
		padding: 1rem;
	}

	.settlement-input,
	.settlement-select {
		border: 1px solid var(--settlement-border);
		border-radius: 0.9rem;
		background: var(--settlement-input-bg);
		color: var(--settlement-text);
		padding: 0.75rem 0.95rem;
		outline: none;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease,
			transform 0.15s ease;
	}

	.settlement-input:focus,
	.settlement-select:focus {
		border-color: rgb(96 165 250 / 0.9);
		box-shadow: 0 0 0 3px rgb(96 165 250 / 0.18);
	}

	.settlement-action {
		color: rgb(59 130 246);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	:global(html.dark) .settlement-action {
		color: rgb(147 197 253);
	}

	.settlement-check,
	.settlement-select-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.settlement-check input {
		accent-color: rgb(245 158 11);
	}

	.settlement-select-row {
		justify-content: space-between;
		border-top: 1px solid var(--settlement-border);
		padding-top: 0.75rem;
		margin-top: 0.25rem;
	}

	.settlement-table {
		width: 100%;
		border-collapse: collapse;
	}

	.settlement-table th {
		text-align: left;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--settlement-muted);
		border-bottom: 1px solid var(--settlement-border);
	}

	.settlement-table td {
		color: var(--settlement-text);
		border-bottom: 1px solid rgb(148 163 184 / 0.16);
		vertical-align: top;
	}

	.settlement-table tr:last-child td {
		border-bottom: 0;
	}
</style>
