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
	href={null}
	on:click={(e) => {
		e.preventDefault();
	}}
	on:dblclick={(e) => {
		e.target.click(); //dispatchEvent(new MouseEvent('click', { bubbles: true }));
		// send click to child
		console.log(e);
	}}
>
	<svelte:element this="a" {href}>
		<!-- on:click={(e) => {
        console.log('click!');
        console.log(e.target);
        if (!override) {
            assign_href(null);
            e.preventDefault();
        } else {
            console.log('routing to ' + href);
        }
        override = false;
    }}
    on:dblclick={(e) => {
        console.log('double click!');
        assign_href(href);
        // e.preventDefault();
        // override = true;
        window.location.href = '/uienradar';
        // console.log(e.target.parentNode);
        // e.target?.parentNode?.click();
    }} -->
		<p>{assigned_href}</p>

		<slot />
	</svelte:element>
</a>
