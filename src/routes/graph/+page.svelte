<script lang="ts">
	import * as d3 from 'd3';
	import {
		getProductIconHref,
		humanizeLabel,
		type Building,
		type Database,
		type Product,
		type Recipe,
		type RecipeIO
	} from '$lib/coi-data';

	type GraphNode = {
		id: string;
		label: string;
		searchText: string;
		kind: 'product' | 'recipe';
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

	let { data } = $props<{ data: { database: Database } }>();

	let svgElement = $state<SVGSVGElement | undefined>(undefined);
	let search = $state('');
	let selectedNodeId = $state<string | null>(null);
	let hopDepth = $state(2);
	let upstreamExtraDepth = $state(0);
	let downstreamExtraDepth = $state(0);

	const database = $derived(data.database);
	const products = $derived(database.products ?? ([] as Product[]));
	const buildings = $derived(database.buildings ?? ([] as Building[]));
	const recipes = $derived(database.recipes ?? ([] as Recipe[]));

	const NODE_RADIUS = {
		product: 22,
		recipe: 12
	} as const;

	const PRODUCT_FILL = '#0f766e';
	const RECIPE_FILL = '#b45309';

	function describeRecipeAmounts(entries: RecipeIO[] | undefined, productsById: Map<string, Product>) {
		const validEntries = (entries ?? []).filter(({ product_id }) => productsById.has(product_id));
		if (!validEntries.length) return 'none';

		return validEntries
			.map(({ product_id, amount }) => `${amount} ${productsById.get(product_id)?.name ?? humanizeLabel(product_id)}`)
			.join(', ');
	}

	function normalizeBuildingReference(value: string) {
		return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
	}

	function recipeIoSignature(entries: RecipeIO[] | undefined) {
		return JSON.stringify(
			(entries ?? [])
				.map(({ product_id, amount }) => [product_id, amount] as [string, number])
				.sort(([leftId, leftAmount], [rightId, rightAmount]) =>
					leftId === rightId ? leftAmount - rightAmount : leftId.localeCompare(rightId)
				)
		);
	}

	function createBuildingFamilies(items: Building[]) {
		const aliasToIds = new Map<string, Set<string>>();
		const neighbors = new Map<string, Set<string>>();

		function addAlias(alias: string, id: string) {
			if (!alias) return;
			const existing = aliasToIds.get(alias) ?? new Set<string>();
			existing.add(id);
			aliasToIds.set(alias, existing);
		}

		function connect(leftId: string, rightId: string) {
			if (leftId === rightId) return;
			const left = neighbors.get(leftId) ?? new Set<string>();
			left.add(rightId);
			neighbors.set(leftId, left);
			const right = neighbors.get(rightId) ?? new Set<string>();
			right.add(leftId);
			neighbors.set(rightId, right);
		}

		items.forEach((building) => {
			addAlias(normalizeBuildingReference(building.id), building.id);
			addAlias(normalizeBuildingReference(building.name), building.id);
			neighbors.set(building.id, neighbors.get(building.id) ?? new Set<string>());
		});

		items.forEach((building) => {
			for (const variant of building.stats?.variants ?? []) {
				for (const variantId of aliasToIds.get(normalizeBuildingReference(variant)) ?? []) {
					connect(building.id, variantId);
				}
			}
		});

		const familiesByBuildingId = new Map<
			string,
			{ familyId: string; buildingIds: string[]; buildingNames: string[] }
		>();
		const visited = new Set<string>();

		for (const building of items) {
			if (visited.has(building.id)) continue;

			const queue = [building.id];
			const component = new Set<string>();

			while (queue.length) {
				const currentId = queue.shift();
				if (!currentId || visited.has(currentId)) continue;
				visited.add(currentId);
				component.add(currentId);

				for (const neighborId of neighbors.get(currentId) ?? []) {
					if (!visited.has(neighborId)) queue.push(neighborId);
				}
			}

			const buildingIds = [...component].sort((left, right) => left.localeCompare(right));
			const buildingNames = [...new Set(
				buildingIds.map((id) => items.find((candidate) => candidate.id === id)?.name ?? id)
			)].sort((left, right) => left.localeCompare(right));
			const family = {
				familyId: buildingIds[0] ?? building.id,
				buildingIds,
				buildingNames
			};

			buildingIds.forEach((id) => {
				familiesByBuildingId.set(id, family);
			});
		}

		return familiesByBuildingId;
	}

	function createGraphData(
		productsList: Product[],
		buildingsList: Building[],
		recipesList: Recipe[]
	): FullGraph {
		const productsById = new Map(productsList.map((product) => [product.id, product]));
		const buildingsById = new Map(buildingsList.map((building) => [building.id, building]));
		const buildingFamiliesById = createBuildingFamilies(buildingsList);

		const nodes: GraphNode[] = productsList.map((product) => ({
			id: product.id,
			label: humanizeLabel(product.name),
			searchText: `${product.name} ${product.id} ${product.state ?? ''}`.toLowerCase(),
			kind: 'product',
			state: product.state ?? null,
			radius: NODE_RADIUS.product,
			title: `${humanizeLabel(product.name)}${product.state ? ` (${product.state})` : ''}`,
			iconHref: getProductIconHref(product.id)
		}));

		const edges: GraphEdge[] = [];
		const recipeGroups = new Map<
			string,
			{
				nodeId: string;
				inputs: RecipeIO[];
				outputs: RecipeIO[];
				buildingIds: Set<string>;
				buildingNames: Set<string>;
			}
		>();

		recipesList.forEach((recipe) => {
			const inputs = (recipe.inputs ?? []).filter(({ product_id }) => productsById.has(product_id));
			const outputs = (recipe.outputs ?? []).filter(({ product_id }) => productsById.has(product_id));

			if (!inputs.length && !outputs.length) return;

			const machineId = recipe.machine?.[0] ?? 'unassigned';
			const family = buildingFamiliesById.get(machineId);
			const familyId = family?.familyId ?? machineId;
			const groupKey = `${familyId}|${recipeIoSignature(inputs)}|${recipeIoSignature(outputs)}`;
			const existing = recipeGroups.get(groupKey);

			if (existing) {
				existing.buildingIds.add(machineId);
				existing.buildingNames.add(buildingsById.get(machineId)?.name ?? machineId);
				return;
			}

			recipeGroups.set(groupKey, {
				nodeId: `recipe:${familyId}:${recipeGroups.size}`,
				inputs,
				outputs,
				buildingIds: new Set([machineId]),
				buildingNames: new Set([buildingsById.get(machineId)?.name ?? machineId])
			});
		});

		for (const group of recipeGroups.values()) {
			const buildingNames = [...group.buildingNames].sort((left, right) => left.localeCompare(right));
			const buildingIds = [...group.buildingIds].sort((left, right) => left.localeCompare(right));
			const primaryOutput = group.outputs[0]?.product_id
				? productsById.get(group.outputs[0].product_id)?.name
				: null;
			const buildingLabel =
				buildingNames.length > 1
					? `${buildingNames[0]} +${buildingNames.length - 1}`
					: buildingNames[0] ?? buildingIds[0];
			const label = primaryOutput ? `${buildingLabel} -> ${humanizeLabel(primaryOutput)}` : buildingLabel;

			nodes.push({
				id: group.nodeId,
				label,
				searchText: `${label} ${buildingIds.join(' ')} ${buildingNames.join(' ')}`.toLowerCase(),
				kind: 'recipe',
				radius: NODE_RADIUS.recipe,
				title: [
					`Buildings: ${buildingNames.join(', ')}`,
					`Inputs: ${describeRecipeAmounts(group.inputs, productsById)}`,
					`Outputs: ${describeRecipeAmounts(group.outputs, productsById)}`
				].join('\n')
			});

			group.inputs.forEach((input) => {
				edges.push({
					id: `${input.product_id}->${group.nodeId}`,
					sourceId: input.product_id,
					targetId: group.nodeId
				});
			});

			group.outputs.forEach((output) => {
				edges.push({
					id: `${group.nodeId}->${output.product_id}`,
					sourceId: group.nodeId,
					targetId: output.product_id
				});
			});
		}

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
		const downstreamIds = traverseNeighborhood(rootId, fullGraph.outgoing, baseDepth + downstreamDepth);

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
		createGraphData(products, buildings, recipes)
	);

	const selectedNode = $derived(
		selectedNodeId && fullGraph ? (fullGraph.nodeMap.get(selectedNodeId) ?? null) : null
	);
	const searchResults = $derived.by(() => {
		const query = search.trim().toLowerCase();
		const nodes = fullGraph.nodes;
		if (!query) {
			return nodes.filter((node) => node.kind === 'product').slice(0, 12);
		}

		return nodes
			.filter((node) => node.searchText.includes(query))
			.sort((a, b) => {
				if (a.kind !== b.kind) return a.kind === 'product' ? -1 : 1;
				return a.label.localeCompare(b.label);
			})
			.slice(0, 12);
	});

	const visibleGraph = $derived(
		createVisibleGraph(fullGraph, selectedNodeId, hopDepth, upstreamExtraDepth, downstreamExtraDepth)
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
			.force('collision', d3.forceCollide().radius((d: GraphNode) => d.radius + 8))
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
			.attr('fill', (d: GraphNode) => (d.kind === 'product' ? PRODUCT_FILL : RECIPE_FILL))
			.attr('stroke', (d: GraphNode) => (d.id === selectedNodeId ? '#0f172a' : '#f8fafc'))
			.attr('stroke-width', (d: GraphNode) => (d.id === selectedNodeId ? 3 : 1.5));

		node
			.filter((d: GraphNode) => d.kind === 'product')
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
				.attr('y2', (d: GraphLink) => edgeEndpoint(d.source as GraphNode, d.target as GraphNode).y2);

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
			Search for a product or recipe, then explore only its local upstream and downstream
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
					placeholder="Search products or recipes..."
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
							{selectedNode.kind === 'product' ? (selectedNode.state ?? 'Product') : 'Recipe'}
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
		{#if !selectedNodeId}
			<div class="flex h-full items-center justify-center px-6">
				<div
					class="max-w-md rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-8 text-center shadow-sm"
				>
					<h2 class="text-lg font-semibold text-gray-900">Select a starting node</h2>
					<p class="mt-2 text-sm text-gray-600">
						Use search to pick a product or recipe. The graph will render only the relevant
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
