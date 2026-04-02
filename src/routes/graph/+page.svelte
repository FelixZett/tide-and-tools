<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	type Resource = {
		id: string;
		name: string;
		state?: string | null;
	};

	type Building = {
		id: string;
		name: string;
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
	};

	type GraphNode = {
		id: string;
		label: string;
		kind: 'resource' | 'recipe';
		state?: string | null;
		radius: number;
		title: string;
		iconHref?: string;
		x?: number;
		y?: number;
		fx?: number | null;
		fy?: number | null;
	};

	type GraphLink = {
		source: string | GraphNode;
		target: string | GraphNode;
	};

	let svgElement = $state<SVGSVGElement | undefined>(undefined);
	let errorMessage = $state('');

	onMount(() => {
		const NODE_RADIUS = {
			resource: 22,
			recipe: 12
		} as const;
		const RESOURCE_FILL = '#0f766e';
		const RECIPE_FILL = '#b45309';

		function describeRecipeAmounts(
			entries: RecipeIO[] | undefined,
			resourcesById: Map<string, Resource>
		) {
			const validEntries = (entries ?? []).filter(({ item_id }) => resourcesById.has(item_id));
			if (!validEntries.length) return 'none';

			return validEntries
				.map(({ item_id, amount }) => `${amount} ${resourcesById.get(item_id)?.name ?? item_id}`)
				.join(', ');
		}

		function createGraphData(
			resources: Resource[],
			buildings: Building[],
			recipes: Recipe[]
		): { nodes: GraphNode[]; links: GraphLink[] } {
			const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
			const buildingsById = new Map(buildings.map((building) => [building.id, building]));

			const nodes: GraphNode[] = resources.map((resource) => ({
				id: resource.id,
				label: resource.name,
				kind: 'resource',
				state: resource.state ?? null,
				radius: NODE_RADIUS.resource,
				title: `${resource.name}${resource.state ? ` (${resource.state})` : ''}`,
				iconHref: `/www/assets/images/resources/${resource.id}.png`
			}));

			const links: GraphLink[] = [];

			recipes.forEach((recipe, index) => {
				const inputs = (recipe.base?.inputs ?? []).filter(({ item_id }) =>
					resourcesById.has(item_id)
				);
				const outputs = (recipe.base?.outputs ?? []).filter(({ item_id }) =>
					resourcesById.has(item_id)
				);

				if (!inputs.length && !outputs.length) return;

				const buildingName = buildingsById.get(recipe.machine_id)?.name ?? recipe.machine_id;
				const primaryOutput = outputs[0]?.item_id
					? resourcesById.get(outputs[0].item_id)?.name
					: null;
				const label = primaryOutput ? `${buildingName} ${primaryOutput}` : buildingName;
				const recipeNodeId = `recipe:${recipe.machine_id}:${index}`;

				nodes.push({
					id: recipeNodeId,
					label,
					kind: 'recipe',
					radius: NODE_RADIUS.recipe,
					title: [
						buildingName,
						`Inputs: ${describeRecipeAmounts(inputs, resourcesById)}`,
						`Outputs: ${describeRecipeAmounts(outputs, resourcesById)}`
					].join('\n')
				});

				inputs.forEach((input) => {
					links.push({
						source: input.item_id,
						target: recipeNodeId
					});
				});

				outputs.forEach((output) => {
					links.push({
						source: recipeNodeId,
						target: output.item_id
					});
				});
			});

			return { nodes, links };
		}

		function drag(simulation: any) {
			function dragstarted(event: any) {
				if (!event.active) simulation.alphaTarget(0.3).restart();
				event.subject.fx = event.subject.x;
				event.subject.fy = event.subject.y;
			}

			function dragged(event: any) {
				event.subject.fx = event.x;
				event.subject.fy = event.y;
			}

			function dragended(event: any) {
				if (!event.active) simulation.alphaTarget(0);
				event.subject.fx = null;
				event.subject.fy = null;
			}

			return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
		}

		async function renderGraph() {
			try {
				if (!svgElement) {
					throw new Error('Graph canvas is not available.');
				}

				const response = await fetch('/coi_master_db.json');
				if (!response.ok) {
					throw new Error(`Failed to load graph data: ${response.status}`);
				}

				const database = (await response.json()) as {
					resources: Resource[];
					buildings: Building[];
					recipes: Recipe[];
				};

				const { nodes, links } = createGraphData(
					database.resources ?? [],
					database.buildings ?? [],
					database.recipes ?? []
				);

				const width = svgElement.clientWidth || 1200;
				const height = svgElement.clientHeight || 800;

				const simulation = d3
					.forceSimulation(nodes)
					.force(
						'link',
						d3
							.forceLink(links)
							.id((d: GraphNode) => d.id)
							.distance((link: GraphLink) =>
								(typeof link.source === 'string' ? link.source : link.source.kind) === 'recipe' ||
								(typeof link.target === 'string' ? link.target : link.target.kind) === 'recipe'
									? 55
									: 120
							)
							.strength(0.8)
					)
					.force(
						'charge',
						d3.forceManyBody().strength((d: GraphNode) => (d.kind === 'recipe' ? -120 : -220))
					)
					.force(
						'collision',
						d3.forceCollide().radius((d: GraphNode) => d.radius + 6)
					)
					.force('center', d3.forceCenter(width / 2, height / 2));

				const svg = d3.select(svgElement);
				svg.selectAll('*').remove();

				const g = svg.append('g');

				const zoom = d3
					.zoom()
					.scaleExtent([0.1, 5])
					.filter((event: MouseEvent | WheelEvent) => {
						if (event.type === 'wheel') return true;
						if (event.type === 'mousedown') {
							return (event as MouseEvent).button === 0 && event.target === svgElement;
						}
						return !('button' in event) || event.button === 0;
					})
					.on('zoom', (event: any) => {
						g.attr('transform', event.transform.toString());
					});

				svg.call(zoom).on('dblclick.zoom', null);

				const link = g
					.selectAll('line')
					.data(links)
					.join('line')
					.attr('stroke', '#94a3b8')
					.attr('stroke-opacity', 0.45)
					.attr('stroke-width', 1.4);

				const node = g
					.selectAll('g.node')
					.data(nodes)
					.join('g')
					.attr('class', 'node')
					.call(drag(simulation));

				node.append('title').text((d: GraphNode) => d.title);

				node
					.append('circle')
					.attr('r', (d: GraphNode) => d.radius)
					.attr('fill', (d: GraphNode) => (d.kind === 'resource' ? RESOURCE_FILL : RECIPE_FILL))
					.attr('stroke', '#f8fafc')
					.attr('stroke-width', 1.5);

				node
					.filter((d: GraphNode) => d.kind === 'resource')
					.append('image')
					.attr('href', (d: GraphNode) => d.iconHref ?? '')
					.attr('x', (d: GraphNode) => -d.radius + 4)
					.attr('y', (d: GraphNode) => -d.radius + 4)
					.attr('width', (d: GraphNode) => d.radius * 2 - 8)
					.attr('height', (d: GraphNode) => d.radius * 2 - 8)
					.attr('pointer-events', 'none')
					.attr('preserveAspectRatio', 'xMidYMid meet');

				simulation.on('tick', () => {
					link
						.attr('x1', (d: GraphLink) => (d.source as GraphNode).x ?? 0)
						.attr('y1', (d: GraphLink) => (d.source as GraphNode).y ?? 0)
						.attr('x2', (d: GraphLink) => (d.target as GraphNode).x ?? 0)
						.attr('y2', (d: GraphLink) => (d.target as GraphNode).y ?? 0);

					node.attr('transform', (d: GraphNode) => `translate(${d.x ?? 0},${d.y ?? 0})`);
				});

				return () => {
					simulation.stop();
				};
			} catch (error) {
				errorMessage = error instanceof Error ? error.message : 'Failed to render graph.';
				return () => {};
			}
		}

		let cleanup = () => {};
		void renderGraph().then((dispose) => {
			cleanup = dispose;
		});

		return () => {
			cleanup();
		};
	});
</script>

<div class="flex h-full flex-col">
	<div class="px-4 py-8 sm:px-6 lg:px-8">
		<h1 class="text-3xl font-bold text-gray-900">Force Directed Graph</h1>
		<p class="mt-2 max-w-3xl text-sm text-gray-600">
			Resources are graph nodes. Each recipe is rendered as an intermediate production step between
			input and output resources.
		</p>
	</div>
	<div class="flex-1 overflow-hidden border-t border-gray-300 bg-gray-50">
		{#if errorMessage}
			<div class="flex h-full items-center justify-center px-6 text-sm text-red-700">
				{errorMessage}
			</div>
		{:else}
			<svg bind:this={svgElement} class="h-full w-full cursor-grab active:cursor-grabbing" />
		{/if}
	</div>
</div>
