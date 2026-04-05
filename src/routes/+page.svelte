<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
	<div class="card bg-base-100 shadow-2xl">
		<div class="card-body space-y-4">
			<div class="flex flex-col gap-1">
				<h1 class="card-title text-4xl font-semibold">Welcome to TideAndTools</h1>
				<p class="text-sm uppercase tracking-[0.4em] text-primary">Data-driven planning for Captain of Industry</p>
			</div>
			<p class="leading-relaxed text-base-content/80">
				This project aggregates the Captain of Industry database into responsive explorers, calculators, and
				visualizations. Use the menu above to switch between modules that help plan services, recipes,
				and neighborhood layouts.
			</p>
			<div class="flex flex-wrap items-center gap-3 text-sm text-base-content/60">
				<span>Current route:</span>
				<span class="badge badge-outline badge-primary font-semibold">
					{$page.url.pathname}
				</span>
			</div>
		</div>
	</div>

	<div class="grid gap-4 rounded-2xl border border-base-200 bg-base-300/60 p-4 shadow-inner shadow-black/20 sm:grid-cols-3">
		<div class="stat rounded-xl bg-base-100/80 shadow">
			<div class="stat-title text-xs uppercase text-base-content/60">Explorer</div>
			<div class="stat-value text-2xl">Database</div>
			<div class="stat-desc text-xs text-base-content/70">Browse products, buildings, and recipes.</div>
		</div>
		<div class="stat rounded-xl bg-base-100/80 shadow">
			<div class="stat-title text-xs uppercase text-base-content/60">Graph</div>
			<div class="stat-value text-2xl">Blueprint</div>
			<div class="stat-desc text-xs text-base-content/70">Layered visualizations for planning.</div>
		</div>
		<div class="stat rounded-xl bg-base-100/80 shadow">
			<div class="stat-title text-xs uppercase text-base-content/60">Settlement</div>
			<div class="stat-value text-2xl">Utilities</div>
			<div class="stat-desc text-xs text-base-content/70">Estimate demand from housing tiers.</div>
		</div>
	</div>
</div>
