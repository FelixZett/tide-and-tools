<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	type Theme = 'light' | 'dark';

	let theme = $state<Theme>('dark');

	function applyTheme(nextTheme: Theme) {
		theme = nextTheme;
		document.documentElement.classList.toggle('dark', nextTheme === 'dark');
		document.documentElement.classList.toggle('light', nextTheme === 'light');
		localStorage.setItem('theme', nextTheme);
	}

	function toggleTheme() {
		applyTheme(theme === 'dark' ? 'light' : 'dark');
	}

	onMount(() => {
		const storedTheme = localStorage.getItem('theme');
		if (storedTheme === 'light' || storedTheme === 'dark') {
			applyTheme(storedTheme);
			return;
		}

		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		applyTheme(prefersDark ? 'dark' : 'light');
	});
</script>

<nav class="border-b border-gray-200 bg-white">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<div class="flex items-center">
				<h1 class="text-xl font-bold text-gray-900">TideAndTools</h1>
			</div>
			<div class="flex items-center gap-6">
				<div class="flex space-x-8">
					<a
						href="/"
						class="inline-flex items-center px-1 pt-1 text-sm font-medium {$page.url.pathname ===
						'/'
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
				<button
					type="button"
					class="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold tracking-wide text-gray-700 uppercase hover:border-gray-400 hover:text-gray-900"
					onclick={toggleTheme}
					aria-label="Toggle dark mode"
				>
					{theme === 'dark' ? 'Light' : 'Dark'}
				</button>
			</div>
		</div>
	</div>
</nav>
