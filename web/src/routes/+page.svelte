<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Icon from '$lib/Icon.svelte';
	import Window from '$lib/Window.svelte';
	import Taskbar from '$lib/Taskbar.svelte';
	import { projects, projectsById } from '$lib/projects';
	import { openWindow, windows } from '$lib/windowManager';

	onMount(() => {
		// Deep links: /uienradar etc. redirect here with ?open=<id>
		const open = $page.url.searchParams.get('open');
		if (open && projectsById[open]) {
			openWindow(open);
		}
	});
</script>

<svelte:head>
	<title>michaël.com</title>
</svelte:head>

<div class="desktop">
	<div class="icon-space">
		{#each projects as project (project.id)}
			<Icon image={project.icon} name={project.title} on:open={() => openWindow(project.id)} />
		{/each}
	</div>

	{#each $windows as win (win.id)}
		{@const def = projectsById[win.id]}
		<Window {def} {win}>
			<svelte:component this={def.component} />
		</Window>
	{/each}

	<Taskbar />
</div>

<style>
	.desktop {
		height: 100vh;
		width: 100vw;
		position: fixed;
		overflow: hidden;
		background: url($lib/images/windows-xp.jpg) no-repeat center center fixed;
		background-size: cover;
	}

	.icon-space {
		margin: 10px;
		margin-bottom: calc(var(--taskbar-h, 30px) + 10px);
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 10px 20px;
	}

	@media (max-width: 768px) {
		.icon-space {
			gap: 6px 10px;
		}
	}
</style>
