<script lang="ts">
	import { page } from '$app/stores';
	import Window from '$lib/Window.svelte';
</script>

<Window title="Critical Error">
	<h1>{$page.status}: {$page.error?.message}</h1>
</Window>
