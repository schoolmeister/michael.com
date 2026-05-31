<script lang="ts">
	export let href: string;

	let assigned_href: string | null = href;
	let override: boolean = false;

	function assign_href(href: string | null) {
		console.log(href);
		assigned_href = href;
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<a
	{href}
	on:click={(e) => {
		// single click just prevents navigation (simulate desktop icon)
		e.preventDefault();
	}}
	on:dblclick={(e) => {
		// Navigate on double click
		e.preventDefault();
		window.location.href = href;
	}}
>
	<p>{assigned_href}</p>
	<slot />
</a>
