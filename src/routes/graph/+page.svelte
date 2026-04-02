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
		searchText: string;
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

	type GraphEdge = {
		id: string;
		sourceId: string;
		targetId: string;
	};

	type GraphLink = GraphEdge & {
		source: string | GraphNode;
		target: string | GraphNode;
	};

	type FullGraph = {
		nodes: GraphNode[];
		edges: GraphEdge[];
		nodeMap: Map<string, GraphNode>;
		outgoing: Map<string, string[]>;
		incoming: Map<string, string[]>;
		undirected: Map<string, string[]>;
	};

	type VisibleGraph = {
		nodes: GraphNode[];
		links: GraphLink[];
		distanceById: Map<string, number>;
	};

	let svgElement = $state<SVGSVGElement | undefined>(undefined);
	let database = $state<{ resources: Resource[]; buildings: Building[]; recipes: Recipe[] } | null>(
		null
	);
	let errorMessage = $state('');
	let search = $state('');
	let selectedNodeId = $state<string | null>(null);
	let hopDepth = $state(2);
	let upstreamExtraDepth = $state(0);
	let downstreamExtraDepth = $state(0);

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
	): FullGraph {
		const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
		const buildingsById = new Map(buildings.map((building) => [building.id, building]));

		const nodes: GraphNode[] = resources.map((resource) => ({
			id: resource.id,
			label: resource.name,
			searchText: `${resource.name} ${resource.id} ${resource.state ?? ''}`.toLowerCase(),
			kind: 'resource',
			state: resource.state ?? null,
			radius: NODE_RADIUS.resource,
			title: `${resource.name}${resource.state ? ` (${resource.state})` : ''}`,
			iconHref: `/www/assets/images/resources/${resource.id}.png`
		}));

		const edges: GraphEdge[] = [];

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
			const label = primaryOutput ? `${buildingName} -> ${primaryOutput}` : buildingName;
			const recipeNodeId = `recipe:${recipe.machine_id}:${index}`;

			nodes.push({
				id: recipeNodeId,
				label,
				searchText: `${label} ${recipe.machine_id} ${buildingName}`.toLowerCase(),
				kind: 'recipe',
				radius: NODE_RADIUS.recipe,
				title: [
					buildingName,
					`Inputs: ${describeRecipeAmounts(inputs, resourcesById)}`,
					`Outputs: ${describeRecipeAmounts(outputs, resourcesById)}`
				].join('\n')
			});

			inputs.forEach((input) => {
				edges.push({
					id: `${input.item_id}->${recipeNodeId}`,
					sourceId: input.item_id,
					targetId: recipeNodeId
				});
			});

			outputs.forEach((output) => {
				edges.push({
					id: `${recipeNodeId}->${output.item_id}`,
					sourceId: recipeNodeId,
					targetId: output.item_id
				});
			});
		});

		const nodeMap = new Map(nodes.map((node) => [node.id, node]));
		const outgoing = new Map<string, string[]>();
		const incoming = new Map<string, string[]>();
		const undirected = new Map<string, string[]>();

		function connect(map: Map<string, string[]>, from: string, to: string) {
			const existing = map.get(from) ?? [];
			existing.push(to);
			map.set(from, existing);
		}

		edges.forEach((edge) => {
			connect(outgoing, edge.sourceId, edge.targetId);
			connect(incoming, edge.targetId, edge.sourceId);
			connect(undirected, edge.sourceId, edge.targetId);
			connect(undirected, edge.targetId, edge.sourceId);
		});

		return { nodes, edges, nodeMap, outgoing, incoming, undirected };
	}

	function traverseNeighborhood(
		startId: string,
		adjacency: Map<string, string[]>,
		maxDepth: number
	): Set<string> {
		const visited = new Set<string>([startId]);
		const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

		while (queue.length) {
			const current = queue.shift();
			if (!current || current.depth >= maxDepth) continue;

			for (const nextId of adjacency.get(current.id) ?? []) {
				if (visited.has(nextId)) continue;
				visited.add(nextId);
				queue.push({ id: nextId, depth: current.depth + 1 });
			}
		}

		return visited;
	}

	function computeUndirectedDistances(
		startId: string,
		adjacency: Map<string, string[]>,
		visibleIds: Set<string>
	): Map<string, number> {
		const distances = new Map<string, number>([[startId, 0]]);
		const queue: string[] = [startId];

		while (queue.length) {
			const currentId = queue.shift();
			if (!currentId) continue;
			const currentDistance = distances.get(currentId) ?? 0;

			for (const nextId of adjacency.get(currentId) ?? []) {
				if (!visibleIds.has(nextId) || distances.has(nextId)) continue;
				distances.set(nextId, currentDistance + 1);
				queue.push(nextId);
			}
		}

		return distances;
	}

	function createVisibleGraph(
		fullGraph: FullGraph | null,
		rootId: string | null,
		baseDepth: number,
		upstreamDepth: number,
		downstreamDepth: number
	): VisibleGraph | null {
		if (!fullGraph || !rootId || !fullGraph.nodeMap.has(rootId)) return null;

		const visibleIds = new Set<string>([rootId]);
		const upstreamIds = traverseNeighborhood(rootId, fullGraph.incoming, baseDepth + upstreamDepth);
		const downstreamIds = traverseNeighborhood(
			rootId,
			fullGraph.outgoing,
			baseDepth + downstreamDepth
		);

		for (const id of upstreamIds) visibleIds.add(id);
		for (const id of downstreamIds) visibleIds.add(id);

		const nodes = fullGraph.nodes.filter((node) => visibleIds.has(node.id));
		const links = fullGraph.edges
			.filter((edge) => visibleIds.has(edge.sourceId) && visibleIds.has(edge.targetId))
			.map((edge) => ({
				...edge,
				source: edge.sourceId,
				target: edge.targetId
			}));

		return {
			nodes,
			links,
			distanceById: computeUndirectedDistances(rootId, fullGraph.undirected, visibleIds)
		};
	}

	function nodeOpacity(distance: number | undefined) {
		if (distance === undefined) return 0.2;
		if (distance === 0) return 1;
		if (distance === 1) return 0.95;
		if (distance === 2) return 0.78;
		return 0.5;
	}

	function linkOpacity(sourceDistance: number | undefined, targetDistance: number | undefined) {
		const closestDistance = Math.min(sourceDistance ?? 99, targetDistance ?? 99);
		if (closestDistance === 0) return 0.9;
		if (closestDistance === 1) return 0.55;
		if (closestDistance === 2) return 0.32;
		return 0.16;
	}

	function edgeEndpoint(source: GraphNode, target: GraphNode) {
		const dx = (target.x ?? 0) - (source.x ?? 0);
		const dy = (target.y ?? 0) - (source.y ?? 0);
		const length = Math.hypot(dx, dy) || 1;
		const targetOffset = target.radius + 8;

		return {
			x1: source.x ?? 0,
			y1: source.y ?? 0,
			x2: (target.x ?? 0) - (dx / length) * targetOffset,
			y2: (target.y ?? 0) - (dy / length) * targetOffset
		};
	}

	const fullGraph = $derived.by(() =>
		database
			? createGraphData(database.resources ?? [], database.buildings ?? [], database.recipes ?? [])
			: null
	);

	const selectedNode = $derived(
		selectedNodeId && fullGraph ? (fullGraph.nodeMap.get(selectedNodeId) ?? null) : null
	);
	const searchResults = $derived.by(() => {
		if (!fullGraph) return [] as GraphNode[];
		const query = search.trim().toLowerCase();
		const nodes = fullGraph.nodes;
		if (!query) {
			return nodes.filter((node) => node.kind === 'resource').slice(0, 12);
		}

		return nodes
			.filter((node) => node.searchText.includes(query))
			.sort((a, b) => {
				if (a.kind !== b.kind) return a.kind === 'resource' ? -1 : 1;
				return a.label.localeCompare(b.label);
			})
			.slice(0, 12);
	});

	const visibleGraph = $derived(
		createVisibleGraph(
			fullGraph,
			selectedNodeId,
			hopDepth,
			upstreamExtraDepth,
			downstreamExtraDepth
		)
	);

	function selectNode(id: string) {
		selectedNodeId = id;
		upstreamExtraDepth = 0;
		downstreamExtraDepth = 0;
	}

	function clearSelection() {
		selectedNodeId = null;
		search = '';
		upstreamExtraDepth = 0;
		downstreamExtraDepth = 0;
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

	async function loadDatabase() {
		try {
			const response = await fetch('/coi_master_db.json');
			if (!response.ok) {
				throw new Error(`Failed to load graph data: ${response.status}`);
			}

			database = await response.json();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to render graph.';
		}
	}

	onMount(() => {
		void loadDatabase();
	});

	$effect(() => {
		if (!svgElement) return;

		const svg = d3.select(svgElement);
		svg.selectAll('*').remove();

		if (!visibleGraph || !selectedNodeId) return;

		const width = svgElement.clientWidth || 1200;
		const height = svgElement.clientHeight || 800;

		const defs = svg.append('defs');
		defs
			.append('marker')
			.attr('id', 'graph-arrowhead')
			.attr('viewBox', '0 -5 10 10')
			.attr('refX', 8)
			.attr('refY', 0)
			.attr('markerWidth', 7)
			.attr('markerHeight', 7)
			.attr('orient', 'auto')
			.append('path')
			.attr('d', 'M0,-5L10,0L0,5')
			.attr('fill', '#64748b');

		const g = svg.append('g');
		const zoom = d3
			.zoom()
			.scaleExtent([0.2, 5])
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

		const simulation = d3
			.forceSimulation(visibleGraph.nodes)
			.force(
				'link',
				d3
					.forceLink(visibleGraph.links)
					.id((d: GraphNode) => d.id)
					.distance((link: GraphLink) => {
						const sourceKind =
							typeof link.source === 'string'
								? fullGraph?.nodeMap.get(link.source)?.kind
								: link.source.kind;
						const targetKind =
							typeof link.target === 'string'
								? fullGraph?.nodeMap.get(link.target)?.kind
								: link.target.kind;
						return sourceKind === 'recipe' || targetKind === 'recipe' ? 65 : 125;
					})
					.strength(0.9)
			)
			.force(
				'charge',
				d3.forceManyBody().strength((d: GraphNode) => (d.kind === 'recipe' ? -130 : -260))
			)
			.force(
				'collision',
				d3.forceCollide().radius((d: GraphNode) => d.radius + 8)
			)
			.force('center', d3.forceCenter(width / 2, height / 2));

		const link = g
			.selectAll('line')
			.data(visibleGraph.links)
			.join('line')
			.attr('stroke', '#64748b')
			.attr('stroke-width', 1.6)
			.attr('marker-end', 'url(#graph-arrowhead)')
			.attr('stroke-opacity', (d: GraphLink) =>
				linkOpacity(
					visibleGraph.distanceById.get(d.sourceId),
					visibleGraph.distanceById.get(d.targetId)
				)
			);

		const node = g
			.selectAll('g.node')
			.data(visibleGraph.nodes)
			.join('g')
			.attr('class', 'node')
			.attr('opacity', (d: GraphNode) => nodeOpacity(visibleGraph.distanceById.get(d.id)))
			.style('cursor', 'pointer')
			.on('click', (_event: MouseEvent, d: GraphNode) => {
				selectNode(d.id);
			})
			.call(drag(simulation));

		node.append('title').text((d: GraphNode) => d.title);

		node
			.append('circle')
			.attr('r', (d: GraphNode) => d.radius)
			.attr('fill', (d: GraphNode) => (d.kind === 'resource' ? RESOURCE_FILL : RECIPE_FILL))
			.attr('stroke', (d: GraphNode) => (d.id === selectedNodeId ? '#0f172a' : '#f8fafc'))
			.attr('stroke-width', (d: GraphNode) => (d.id === selectedNodeId ? 3 : 1.5));

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

		node
			.filter((d: GraphNode) => d.kind === 'recipe')
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')
			.attr('pointer-events', 'none')
			.attr('font-size', 8)
			.attr('font-weight', 700)
			.attr('fill', '#fff')
			.text('R');

		simulation.on('tick', () => {
			link
				.attr('x1', (d: GraphLink) => edgeEndpoint(d.source as GraphNode, d.target as GraphNode).x1)
				.attr('y1', (d: GraphLink) => edgeEndpoint(d.source as GraphNode, d.target as GraphNode).y1)
				.attr('x2', (d: GraphLink) => edgeEndpoint(d.source as GraphNode, d.target as GraphNode).x2)
				.attr(
					'y2',
					(d: GraphLink) => edgeEndpoint(d.source as GraphNode, d.target as GraphNode).y2
				);

			node.attr('transform', (d: GraphNode) => `translate(${d.x ?? 0},${d.y ?? 0})`);
		});

		return () => {
			simulation.stop();
		};
	});
</script>

<div class="flex h-full flex-col">
	<div class="border-b border-gray-200 bg-white px-4 py-6 sm:px-6 lg:px-8">
		<h1 class="text-3xl font-bold text-gray-900">Graph Explorer</h1>
		<p class="mt-2 max-w-3xl text-sm text-gray-600">
			Search for a resource or recipe, then explore only its local upstream and downstream
			neighborhood.
		</p>

		<div class="mt-5 grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
			<div>
				<label
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase"
					for="graph-search"
				>
					Search Nodes
				</label>
				<input
					id="graph-search"
					bind:value={search}
					placeholder="Search resources or recipes..."
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ring-0 outline-none placeholder:text-gray-400 focus:border-blue-500"
				/>

				<div class="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
					{#each searchResults as node}
						<button
							type="button"
							class={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
								selectedNodeId === node.id
									? 'border-blue-600 bg-blue-600 text-white'
									: 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900'
							}`}
							onclick={() => selectNode(node.id)}
						>
							{node.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="grid gap-4 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
				<div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
					<div class="text-xs font-semibold tracking-wide text-gray-500 uppercase">Selected</div>
					{#if selectedNode}
						<div class="mt-2 text-sm font-semibold text-gray-900">{selectedNode.label}</div>
						<div class="mt-1 font-mono text-xs text-gray-500">{selectedNode.id}</div>
						<div class="mt-2 text-xs text-gray-600">
							{selectedNode.kind === 'resource' ? (selectedNode.state ?? 'Resource') : 'Recipe'}
						</div>
					{:else}
						<div class="mt-2 text-sm text-gray-500">Choose a node to begin.</div>
					{/if}
				</div>

				<div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
					<div class="grid gap-4 md:grid-cols-3">
						<div>
							<label
								class="block text-xs font-semibold tracking-wide text-gray-500 uppercase"
								for="hop-depth"
							>
								Base Hop Depth
							</label>
							<input
								id="hop-depth"
								type="range"
								min="1"
								max="4"
								step="1"
								bind:value={hopDepth}
								class="mt-3 w-full"
							/>
							<div class="mt-1 text-sm text-gray-700">{hopDepth} hops</div>
						</div>

						<div>
							<div class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
								Expand Upstream
							</div>
							<div class="mt-3 flex items-center gap-2">
								<button
									type="button"
									class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400"
									onclick={() => (upstreamExtraDepth = Math.max(0, upstreamExtraDepth - 1))}
								>
									-
								</button>
								<div class="min-w-10 text-center text-sm text-gray-700">{upstreamExtraDepth}</div>
								<button
									type="button"
									class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400"
									onclick={() => (upstreamExtraDepth += 1)}
								>
									+
								</button>
							</div>
						</div>

						<div>
							<div class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
								Expand Downstream
							</div>
							<div class="mt-3 flex items-center gap-2">
								<button
									type="button"
									class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400"
									onclick={() => (downstreamExtraDepth = Math.max(0, downstreamExtraDepth - 1))}
								>
									-
								</button>
								<div class="min-w-10 text-center text-sm text-gray-700">{downstreamExtraDepth}</div>
								<button
									type="button"
									class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400"
									onclick={() => (downstreamExtraDepth += 1)}
								>
									+
								</button>
							</div>
						</div>
					</div>

					<div class="mt-4 flex flex-wrap gap-2">
						<button
							type="button"
							class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400"
							onclick={() => {
								upstreamExtraDepth = 0;
								downstreamExtraDepth = 0;
								hopDepth = 2;
							}}
						>
							Reset Depth
						</button>
						<button
							type="button"
							class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400"
							onclick={clearSelection}
						>
							Clear Selection
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="relative flex-1 overflow-hidden bg-gray-50">
		{#if errorMessage}
			<div class="flex h-full items-center justify-center px-6 text-sm text-red-700">
				{errorMessage}
			</div>
		{:else if !selectedNodeId}
			<div class="flex h-full items-center justify-center px-6">
				<div
					class="max-w-md rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-8 text-center shadow-sm"
				>
					<h2 class="text-lg font-semibold text-gray-900">Select a starting node</h2>
					<p class="mt-2 text-sm text-gray-600">
						Use search to pick a resource or recipe. The graph will render only the relevant
						neighbors around that node.
					</p>
				</div>
			</div>
		{:else}
			<div
				class="pointer-events-none absolute top-4 right-4 z-10 rounded-xl border border-gray-200 bg-white/90 px-4 py-3 text-xs text-gray-600 shadow-sm backdrop-blur"
			>
				<div>
					<span class="font-semibold text-gray-900">Visible nodes:</span>
					{visibleGraph?.nodes.length ?? 0}
				</div>
				<div>
					<span class="font-semibold text-gray-900">Visible links:</span>
					{visibleGraph?.links.length ?? 0}
				</div>
				<div class="mt-2">Click any node to refocus. Darker nodes are closer to the selection.</div>
			</div>
			<svg bind:this={svgElement} class="h-full w-full cursor-grab active:cursor-grabbing" />
		{/if}
	</div>
</div>
