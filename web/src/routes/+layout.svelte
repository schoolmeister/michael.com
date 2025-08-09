<script lang="ts">
	import './styles.css';
	import '98.css/dist/98.css';
	import Icon from '$lib/Icon.svelte';
	import image_uienradar from '$lib/images/uienradar.png';
	import image_tree from '$lib/images/tree-icon.png';
	import image_notepad from '$lib/images/notepad.png';
	import image_connected_world from '$lib/images/connected-world.png';
	import Window from '$lib/Window.svelte';
</script>

<div class="app">
	<main>
		<div class="desktop">
			<div class="icon-space">
				<Icon image={image_uienradar} name="Uienradar" href="uienradar" />
				<Icon image={image_tree} name="Raytracer" href="raytracer" />
				<Icon image={image_notepad} name="Blog" href="blog" />
				<Icon image={image_notepad} name="Ping Pong Tracker" href="pingpong" />
				<Icon image={image_connected_world} name="michaël.com" href="logo" />
				<Icon image={image_connected_world} name="michaël.com" href="logo3d" />
			</div>
			<div id="window-space">
				<slot />
			</div>
		</div>
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		height: 100vh;
		overflow: hidden;
	}

	main {
		height: 100%;
	}

	.desktop {
		height: 100vh;
		width: 100vw;
		position: fixed;
		background: url($lib/images/windows-xp.jpg) no-repeat center center fixed;
		background-size: cover;
	}

	.icon-space {
		margin: 10px;
		display: flex;
		gap: 20px;
	}
</style>
