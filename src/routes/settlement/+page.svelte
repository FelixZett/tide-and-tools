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

<div class="mx-auto flex min-h-[80vh] max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
	<header class="relative overflow-hidden rounded-[2rem] border border-base-200 bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/10 p-6 shadow-xl shadow-primary/40">
		<div class="space-y-2">
			<p class="text-xs uppercase tracking-[0.42em] text-primary/70">Settlement planner</p>
			<h1 class="text-3xl font-semibold text-base-content">Settlement Calculator</h1>
			<p class="text-base-content/70">
				Estimate service, food, and waste requirements from housing units and tier multipliers. Housing
				capacity determines the population behind every calculation.
			</p>
		</div>
		<div class="mt-6 grid gap-3 sm:grid-cols-3">
			<div class="rounded-2xl border border-base-200/70 bg-base-100/60 p-4 shadow-sm">
				<p class="text-xs uppercase tracking-[0.32em] text-base-content/60">Population</p>
				<p class="text-2xl font-semibold text-base-content">{roundTo(estimatedPopulation, 0)}</p>
				<p class="text-xs text-base-content/60">Based on {roundTo(housingUnits, 0)} units</p>
			</div>
			<div class="rounded-2xl border border-base-200/70 bg-base-100/60 p-4 shadow-sm">
				<p class="text-xs uppercase tracking-[0.32em] text-base-content/60">Tier capacity</p>
				<p class="text-lg font-semibold text-base-content">{housingCapacity} people / unit</p>
				<p class="text-xs text-base-content/60">Tier {housingTier}</p>
			</div>
			<div class="rounded-2xl border border-base-200/70 bg-base-100/60 p-4 shadow-sm">
				<p class="text-xs uppercase tracking-[0.32em] text-base-content/60">Food multiplier</p>
				<p class="text-lg font-semibold text-base-content">{roundTo(consumptionMultiplier, 2)}×</p>
				<p class="text-xs text-base-content/60">Affects biomass calculations</p>
			</div>
		</div>
	</header>

	<section class="card bg-base-100/70 shadow-xl">
		<div class="card-body space-y-6">
			<div class="grid gap-4 md:grid-cols-3">
				<label class="flex flex-col gap-2 text-sm text-base-content/60">
					<span>Housing units</span>
					<input
						type="number"
						min="0"
						step="1"
						class="input input-bordered input-primary bg-base-100"
						bind:value={housingUnits}
					/>
				</label>
				<label class="flex flex-col gap-2 text-sm text-base-content/60">
					<span>Housing tier</span>
					<select class="select select-bordered bg-base-100 text-base-content" bind:value={housingTier}>
						<option value="I">I</option>
						<option value="II">II</option>
						<option value="III">III</option>
						<option value="IV">IV</option>
					</select>
				</label>
				<label class="flex flex-col gap-2 text-sm text-base-content/60">
					<span>Food consumption multiplier</span>
					<input
						type="number"
						min="0"
						step="0.05"
						class="input input-bordered input-primary bg-base-100"
						bind:value={consumptionMultiplier}
					/>
				</label>
			</div>
			<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<div class="stat rounded-2xl border border-base-200/70 bg-base-200/40 p-4">
					<div class="stat-title text-xs uppercase tracking-[0.32em] text-base-content/60">Housing I</div>
					<div class="stat-value text-lg font-semibold text-base-content">80 people / unit</div>
				</div>
				<div class="stat rounded-2xl border border-base-200/70 bg-base-200/40 p-4">
					<div class="stat-title text-xs uppercase tracking-[0.32em] text-base-content/60">Housing II</div>
					<div class="stat-value text-lg font-semibold text-base-content">140 people / unit</div>
				</div>
				<div class="stat rounded-2xl border border-base-200/70 bg-base-200/40 p-4">
					<div class="stat-title text-xs uppercase tracking-[0.32em] text-base-content/60">Housing III</div>
					<div class="stat-value text-lg font-semibold text-base-content">240 people / unit</div>
				</div>
				<div class="stat rounded-2xl border border-base-200/70 bg-base-200/40 p-4">
					<div class="stat-title text-xs uppercase tracking-[0.32em] text-base-content/60">Housing IV</div>
					<div class="stat-value text-lg font-semibold text-base-content">400 people / unit</div>
				</div>
			</div>
		</div>
	</section>

	<div class="grid gap-6 lg:grid-cols-3">
		<section class="card bg-base-100/80 shadow-xl">
			<div class="card-body space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold text-base-content">Provided services</h3>
					<div class="flex gap-2 text-xs uppercase tracking-[0.36em] text-base-content/60">
						<button class="btn btn-ghost btn-xs" type="button" onclick={() => setAllServices(true)}>All On</button>
						<button class="btn btn-ghost btn-xs" type="button" onclick={() => setAllServices(false)}>All Off</button>
					</div>
				</div>
				<div class="space-y-2 text-sm text-base-content">
					<label class="flex items-center gap-3 rounded-xl border border-base-200/50 bg-base-200/40 px-3 py-2">
						<input type="checkbox" class="checkbox checkbox-primary" bind:checked={provideElectricity} />
						<img src={icon.electricity} alt="" class="h-4 w-4" />
						<span>Electricity</span>
					</label>
					<label class="flex items-center gap-3 rounded-xl border border-base-200/50 bg-base-200/40 px-3 py-2">
						<input type="checkbox" class="checkbox checkbox-primary" bind:checked={provideWater} />
						<img src={icon.water} alt="" class="h-4 w-4" />
						<span>Water</span>
					</label>
					<label class="flex items-center gap-3 rounded-xl border border-base-200/50 bg-base-200/40 px-3 py-2">
						<input type="checkbox" class="checkbox checkbox-primary" bind:checked={provideWasteWaterRemoval} />
						<img src={icon.wasteWater} alt="" class="h-4 w-4" />
						<span>Waste Water removal</span>
					</label>
					<label class="flex items-center gap-3 rounded-xl border border-base-200/50 bg-base-200/40 px-3 py-2">
						<input type="checkbox" class="checkbox checkbox-primary" bind:checked={provideHouseholdGoods} />
						<img src={icon.householdGoods} alt="" class="h-4 w-4" />
						<span>Household Goods</span>
					</label>
					<label class="flex items-center gap-3 rounded-xl border border-base-200/50 bg-base-200/40 px-3 py-2">
						<input type="checkbox" class="checkbox checkbox-primary" bind:checked={provideHouseholdAppliances} />
						<img src={icon.householdAppliances} alt="" class="h-4 w-4" />
						<span>Household Appliances</span>
					</label>
					<label class="flex items-center gap-3 rounded-xl border border-base-200/50 bg-base-200/40 px-3 py-2">
						<input type="checkbox" class="checkbox checkbox-primary" bind:checked={provideLuxuryGoods} />
						<img src={icon.luxuryGoods} alt="" class="h-4 w-4" />
						<span>Luxury Goods</span>
					</label>
					<label class="flex items-center gap-3 rounded-xl border border-base-200/50 bg-base-200/40 px-3 py-2">
						<input type="checkbox" class="checkbox checkbox-primary" bind:checked={provideConsumerElectronics} />
						<img src={icon.consumerElectronics} alt="" class="h-4 w-4" />
						<span>Consumer Electronics</span>
					</label>
					<label class="flex items-center gap-3 rounded-xl border border-base-200/50 bg-base-200/40 px-3 py-2">
						<input type="checkbox" class="checkbox checkbox-primary" bind:checked={provideComputing} />
						<img src={icon.computing} alt="" class="h-4 w-4" />
						<span>Computing</span>
					</label>
					<label class="flex flex-col gap-2 rounded-xl border border-base-200/50 bg-base-200/40 px-3 py-2">
						<span class="text-sm font-medium">Medical</span>
						<select class="select select-bordered" bind:value={medicalLevel}>
							<option value="none">None</option>
							<option value="medical1">Medical Supplies I</option>
							<option value="medical2">Medical Supplies II</option>
							<option value="medical3">Medical Supplies III</option>
						</select>
					</label>
				</div>
			</div>
		</section>

		<section class="card bg-base-100/80 shadow-xl">
			<div class="card-body space-y-4">
				<h3 class="text-lg font-semibold text-base-content">Connected collection</h3>
				<label class="flex items-center gap-3 rounded-xl border border-base-200/50 bg-base-200/40 px-3 py-2">
					<input type="checkbox" class="checkbox checkbox-primary" bind:checked={collectBiomass} />
					<img src={icon.biomass} alt="" class="h-4 w-4" />
					<span>Collect biomass</span>
				</label>
				<label class="flex items-center gap-3 rounded-xl border border-base-200/50 bg-base-200/40 px-3 py-2">
					<input type="checkbox" class="checkbox checkbox-primary" bind:checked={collectRecyclables} />
					<img src={icon.recyclables} alt="" class="h-4 w-4" />
					<span>Collect recyclables</span>
				</label>
			</div>
		</section>

		<section class="card bg-base-100/80 shadow-xl">
			<div class="card-body space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold text-base-content">Provided food types</h3>
					<div class="flex gap-2 text-xs uppercase tracking-[0.35em] text-base-content/60">
						<button class="btn btn-ghost btn-xs" type="button" onclick={() => setAllFoods(true)}>All On</button>
						<button class="btn btn-ghost btn-xs" type="button" onclick={() => setAllFoods(false)}>All Off</button>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-2 text-sm text-base-content">
					{#each foods as food}
						<label class="flex items-center gap-2 rounded-xl border border-base-200/50 bg-base-200/40 px-3 py-2">
							<input
								type="checkbox"
								checked={selectedFoodKeys.has(food.key)}
								onchange={() => toggleFood(food.key)}
								class="checkbox checkbox-secondary"
							/>
							<img src={food.icon} alt="" class="h-4 w-4" />
							<span>{food.name}</span>
						</label>
					{/each}
				</div>
			</div>
		</section>
	</div>

	<section class="grid gap-6 lg:grid-cols-2">
		<section class="card bg-base-100/80 shadow-xl">
			<div class="card-body">
				<div class="flex items-center gap-3">
					<img src={icon.food} alt="" class="h-5 w-5" />
					<h2 class="text-xl font-semibold text-base-content">Needs</h2>
				</div>
				<p class="text-sm text-base-content/60">Demand values are per 60s for the estimated population.</p>
				<div class="mt-4 overflow-x-auto">
					<table class="table table-compact w-full text-sm">
						<thead>
							<tr>
								<th>Service</th>
								<th>Per 1000</th>
								<th>Total</th>
							</tr>
						</thead>
						<tbody>
							{#each serviceNeeds.filter((s) => s.enabled) as s}
								<tr>
									<td>
										<div class="flex items-center gap-2">
											{#if s.icon}
												<img src={s.icon} alt="" class="h-4 w-4" />
											{/if}
											<span>{s.name}</span>
										</div>
									</td>
									<td>{roundTo(s.per1000, 3)} {s.unit}</td>
									<td>{roundTo(s.per1000 * popScale, 3)} {s.unit}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>

		<section class="card bg-base-100/80 shadow-xl">
			<div class="card-body">
				<div class="flex items-center gap-3">
					<img src={icon.food} alt="" class="h-5 w-5" />
					<h2 class="text-xl font-semibold text-base-content">Food demand</h2>
				</div>
				<p class="text-sm text-base-content/60">
					Computed from the wiki formula: <span class="font-mono">A / (Nc * N)</span>, shown per month.
				</p>
				<div class="mt-3 overflow-x-auto">
					<table class="table table-compact w-full text-sm">
						<thead>
							<tr>
								<th>Food</th>
								<th>Category</th>
								<th>Total / month</th>
							</tr>
						</thead>
						<tbody>
							{#each foodNeedsPer1000PerMonth as f}
								<tr>
									<td>
										<div class="flex items-center gap-2">
											<img src={f.icon} alt="" class="h-4 w-4" />
											<span>{f.name}</span>
										</div>
									</td>
									<td>{f.category}</td>
									<td>{roundTo(f.value * popScale, 2)}</td>
								</tr>
							{/each}
							<tr class="font-semibold">
								<td>Total Food</td>
								<td>-</td>
								<td>{roundTo(foodNeedsTotalPer1000PerMonth * popScale, 2)}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</section>
	</section>

	<section class="card bg-base-100/80 shadow-xl">
		<div class="card-body">
			<div class="flex items-center gap-3">
				<img src={icon.waste} alt="" class="h-5 w-5" />
				<h2 class="text-xl font-semibold text-base-content">Waste-Products</h2>
			</div>
			<p class="text-sm text-base-content/60">
				Outputs are per 60s for the estimated population.
				{#if selectedFoods.length > 0 && selectedFoods.length < foods.length}
					Food-derived biomass is shown as a range because the wiki provides 1.3-6.4 for partial food sets.
				{/if}
			</p>
			<div class="mt-4 overflow-x-auto">
				<table class="table table-compact w-full text-sm">
					<thead>
						<tr>
							<th>Product</th>
							<th>Per 1000</th>
							<th>Total</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<div class="flex items-center gap-2">
									<img src={icon.waste} alt="" class="h-4 w-4" />
									<span>Waste</span>
								</div>
							</td>
							<td>{formatRange(effectiveWastePer1000, 3)}</td>
							<td>{formatRange(totalWaste, 3)}</td>
						</tr>
						<tr>
							<td>
								<div class="flex items-center gap-2">
									<img src={icon.biomass} alt="" class="h-4 w-4" />
									<span>Biomass</span>
								</div>
							</td>
							<td>{formatRange(effectiveBiomassPer1000, 3)}</td>
							<td>{formatRange(totalBiomass, 3)}</td>
						</tr>
						<tr>
							<td>
								<div class="flex items-center gap-2">
									<img src={icon.recyclables} alt="" class="h-4 w-4" />
									<span>Recyclables</span>
								</div>
							</td>
							<td>{roundTo(effectiveRecyclablesPer1000, 3)}</td>
							<td>{roundTo(totalRecyclables.min, 3)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</section>
</div>
