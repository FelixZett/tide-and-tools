<script lang="ts">
	import { page } from '$app/stores';

	type NavItem = {
		href: string;
		label: string;
		isActive: (path: string) => boolean;
	};

	const navItems: NavItem[] = [
		{ href: '/', label: 'Home', isActive: (path) => path === '/' },
		{ href: '/explorer', label: 'Explorer', isActive: (path) => path.startsWith('/explorer') },
		{ href: '/graph', label: 'Graph', isActive: (path) => path.startsWith('/graph') },
		{ href: '/settlement', label: 'Settlement', isActive: (path) => path.startsWith('/settlement') }
	];
</script>

<nav class="navbar rounded-b-2xl bg-base-300/80 px-6 py-3 shadow-lg shadow-black/40 backdrop-blur">
	<div class="flex-1">
		<a href="/" class="btn btn-ghost text-xl font-semibold normal-case tracking-tight">TideAndTools</a>
	</div>
	<div class="flex-none space-x-2">
		{#each navItems as item}
			<a
				href={item.href}
				class={`btn btn-sm rounded-full normal-case tracking-wide transition-all duration-150 ${
					item.isActive($page.url.pathname)
						? 'btn-primary text-base-100 shadow'
						: 'btn-ghost text-base-content hover:text-primary'
				}`}
			>
				{item.label}
			</a>
		{/each}
	</div>
</nav>
