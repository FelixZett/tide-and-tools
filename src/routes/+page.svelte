<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<h1 class="mb-4 text-3xl font-bold text-gray-900">Welcome to TideAndTools</h1>
	<p class="mb-4 text-gray-600">
		This is the home page. Your current URL is: <span class="font-mono">{$page.url.pathname}</span>
	</p>
	<p class="text-gray-600">Use the top menu to navigate between pages.</p>
</div>

