<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import TopMenu from '$lib/TopMenu.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex h-full flex-col bg-gray-50 text-gray-900">
	<TopMenu />
	<div class="flex-1 overflow-auto">
		{@render children()}
	</div>
</div>
