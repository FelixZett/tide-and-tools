<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import TopMenu from '$lib/TopMenu.svelte';

	let { children } = $props();

	onMount(() => {
		const html = document.documentElement;
		html.classList.add('dark');
		html.setAttribute('data-theme', 'dark');
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col bg-base-200 text-base-content">
	<TopMenu />
	<main class="flex-1">
		{@render children()}
	</main>
</div>
