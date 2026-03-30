<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	let svgElement: SVGSVGElement;

	onMount(() => {
		const NODE_RADIUS = 20;
		const LABEL_MAX_CHARS_PER_LINE = 7;
		const LABEL_MAX_LINES = 2;

		function buildLabelLines(label: string, maxCharsPerLine: number, maxLines: number): string[] {
			const words = label.trim().split(/\s+/).filter(Boolean);
			const lines: string[] = [];
			let currentLine = '';

			const pushWord = (word: string) => {
				while (word.length > maxCharsPerLine) {
					if (lines.length >= maxLines) return false;
					lines.push(word.slice(0, maxCharsPerLine - 1) + '-');
					word = word.slice(maxCharsPerLine - 1);
				}
				const candidate = currentLine ? `${currentLine} ${word}` : word;
				if (candidate.length <= maxCharsPerLine) {
					currentLine = candidate;
				} else {
					if (lines.length >= maxLines) return false;
					lines.push(currentLine);
					currentLine = word;
				}
				return true;
			};

			for (const word of words) {
				if (!pushWord(word)) break;
			}

			if (currentLine && lines.length < maxLines) {
				lines.push(currentLine);
			}

			if (lines.length === 0) {
				return [''];
			}

			const sourceWords = words.join(' ');
			const shownWords = lines.join(' ');
			if (sourceWords.length > shownWords.length) {
				const lastIndex = lines.length - 1;
				const lastLine = lines[lastIndex];
				lines[lastIndex] =
					lastLine.length >= maxCharsPerLine
						? `${lastLine.slice(0, maxCharsPerLine - 1)}…`
						: `${lastLine}…`;
			}

			return lines.slice(0, maxLines);
		}

		// Define nodes
		const nodes = [
			{ id: 'Node 1', x: 100, y: 100 },
			{ id: 'Node 2', x: 300, y: 100 },
			{ id: 'Node 3', x: 200, y: 250 },
			{ id: 'Node 4', x: 400, y: 250 },
			{ id: 'Node 5', x: 150, y: 350 },
			{ id: 'Node 6', x: 350, y: 350 },
			{ id: 'Node 7', x: 250, y: 450 },
			{ id: 'Node 8', x: 100, y: 450 },
			{ id: 'Node 9', x: 450, y: 450 },
			{ id: 'Node 10', x: 50, y: 200 },
			{ id: 'Node 11', x: 500, y: 150 },
			{ id: 'Node 12', x: 300, y: 50 }
		].map((node, _) => ({
			...node,
			labelLines: buildLabelLines(node.id, LABEL_MAX_CHARS_PER_LINE, LABEL_MAX_LINES)
		}));

		// Define links between nodes - create a well-connected network
		const links = [
			{ source: 'Node 1', target: 'Node 2' },
			{ source: 'Node 1', target: 'Node 3' },
			{ source: 'Node 1', target: 'Node 10' },
			{ source: 'Node 2', target: 'Node 4' },
			{ source: 'Node 2', target: 'Node 12' },
			{ source: 'Node 2', target: 'Node 11' },
			{ source: 'Node 3', target: 'Node 4' },
			{ source: 'Node 3', target: 'Node 5' },
			{ source: 'Node 3', target: 'Node 7' },
			{ source: 'Node 4', target: 'Node 6' },
			{ source: 'Node 4', target: 'Node 9' },
			{ source: 'Node 5', target: 'Node 6' },
			{ source: 'Node 5', target: 'Node 7' },
			{ source: 'Node 6', target: 'Node 7' },
			{ source: 'Node 6', target: 'Node 9' },
			{ source: 'Node 7', target: 'Node 8' },
			{ source: 'Node 8', target: 'Node 10' },
			{ source: 'Node 9', target: 'Node 11' },
			{ source: 'Node 10', target: 'Node 12' },
			{ source: 'Node 11', target: 'Node 12' }
		];

		const width = svgElement.clientWidth;
		const height = svgElement.clientHeight;

		// Create simulation
		const simulation = d3
			.forceSimulation(nodes)
			.force(
				'link',
				d3.forceLink(links).id((d: any) => d.id)
			)
			.force('charge', d3.forceManyBody().strength(-300))
			.force('center', d3.forceCenter(width / 2, height / 2));

		// Select svg and clear it
		const svg = d3.select(svgElement);
		svg.selectAll('*').remove();

		// Create a group for transforming
		const g = svg.append('g');
		// Create links
		const link = g
			.selectAll('line')
			.data(links)
			.join('line')
			.attr('stroke', '#999')
			.attr('stroke-opacity', 0.6)
			.attr('stroke-width', 2);

		// Create nodes
		const node = g
			.selectAll('circle')
			.data(nodes)
			.join('circle')
			.attr('r', NODE_RADIUS)
			.attr('fill', '#4f46e5')
			.attr('stroke', '#fff')
			.attr('stroke-width', 2)
			.call(drag(simulation));

		// Create labels
		const label = g
			.selectAll('text')
			.data(nodes)
			.join('text')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')
			.attr('fill', '#fff')
			.attr('font-weight', 'bold')
			.attr('font-size', 10)
			.attr('pointer-events', 'none')
			.each(function (this: SVGTextElement, d: any) {
				const text = d3.select(this);
				const lines = d.labelLines;
				const lineHeightEm = 1.1;
				const startDy = -((lines.length - 1) * lineHeightEm) / 2;

				text
					.selectAll('tspan')
					.data(lines)
					.join('tspan')
					.attr('dy', (_line: string, i: number) =>
						i === 0 ? `${startDy}em` : `${lineHeightEm}em`
					)
					.text((line: string) => line);
			});

		label.append('title').text((d: any) => d.id);

		// Update positions on each tick
		simulation.on('tick', () => {
			link
				.attr('x1', (d: any) => d.source.x)
				.attr('y1', (d: any) => d.source.y)
				.attr('x2', (d: any) => d.target.x)
				.attr('y2', (d: any) => d.target.y);

			node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);

			label.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y);
		});

		// Drag function
		function drag(simulation: d3.Simulation<any, any>) {
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
	});
</script>

<div class="flex h-full flex-col">
	<div class="px-4 py-8 sm:px-6 lg:px-8">
		<h1 class="text-3xl font-bold text-gray-900">Force Directed Graph</h1>
	</div>
	<div class="flex-1 overflow-hidden border-t border-gray-300 bg-gray-50">
		<svg bind:this={svgElement} class="h-full w-full" />
	</div>
</div>
