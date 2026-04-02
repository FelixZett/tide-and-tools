<script lang="ts">
	import { page } from '$app/stores';
</script>

<nav class="border-b border-gray-200 bg-white">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<div class="flex items-center">
				<h1 class="text-xl font-bold text-gray-900">TideAndTools</h1>
			</div>
			<div class="flex space-x-8">
				<a
					href="/"
					class="inline-flex items-center px-1 pt-1 text-sm font-medium {$page.url.pathname === '/'
						? 'border-b-2 border-blue-500 text-gray-900'
						: 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
				>
					Home
				</a>
				<a
					href="/explorer"
					class="inline-flex items-center px-1 pt-1 text-sm font-medium {$page.url.pathname.startsWith(
						'/explorer'
					)
						? 'border-b-2 border-blue-500 text-gray-900'
						: 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
				>
					Explorer
				</a>
				<a
					href="/graph"
					class="inline-flex items-center px-1 pt-1 text-sm font-medium {$page.url.pathname.startsWith(
						'/graph'
					)
						? 'border-b-2 border-blue-500 text-gray-900'
						: 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
				>
					Graph
				</a>
				<a
					href="/settlement"
					class="inline-flex items-center px-1 pt-1 text-sm font-medium {$page.url.pathname.startsWith(
						'/settlement'
					)
						? 'border-b-2 border-blue-500 text-gray-900'
						: 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
				>
					Settlement
				</a>
			</div>
		</div>
	</div>
</nav>
