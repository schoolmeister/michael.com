<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let name: string;
	export let image: string;

	const dispatch = createEventDispatcher();
</script>

<button class="icon" on:click={() => dispatch('open')}>
	<img src={image} alt={name} />
	<div class="title">{name}</div>
</button>

<style>
	.icon {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		margin: 10px;
		/* reset 98.css/native button chrome — desktop icons aren't beveled */
		background: none;
		border: none;
		box-shadow: none;
		padding: 0;
		min-width: 64px;
		cursor: pointer;
	}

	.icon:active,
	.icon:focus {
		background: none;
		box-shadow: none;
		outline: none;
	}

	.icon:focus img {
		outline: 2px solid blue;
	}

	.icon:focus .title {
		outline: 2px solid blue;
	}

	.icon img {
		width: 32px;
		height: 32px;
	}

	.icon .title {
		margin-top: 5px;
		font-family: 'MS Sans Serif', 'Segoe UI', sans-serif;
		font-size: 8pt;
		background: var(--Background);
		color: white;
		position: relative;
		box-sizing: border-box;
		display: flex;
		justify-content: center;
		text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
	}
</style>
