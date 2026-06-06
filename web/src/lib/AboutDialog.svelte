<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let title: string;
	export let description: string;
	export let icon: string | undefined = undefined;

	const dispatch = createEventDispatcher();
	const close = () => dispatch('close');
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="backdrop" on:pointerdown|self={close} on:keydown={(e) => e.key === 'Escape' && close()}>
	<div class="window about" role="dialog" aria-modal="true" aria-label={`About ${title}`}>
		<div class="title-bar">
			<div class="title-bar-text">About {title}</div>
			<div class="title-bar-controls">
				<button aria-label="Close" on:click={close}></button>
			</div>
		</div>
		<div class="window-body">
			<div class="content">
				{#if icon}
					<img src={icon} alt="" />
				{/if}
				<p>{description}</p>
			</div>
			<div class="buttons">
				<button on:click={close}>OK</button>
			</div>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.2);
	}

	.about {
		width: 320px;
		max-width: calc(100vw - 20px);
	}

	.content {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 4px;
	}

	.content img {
		width: 32px;
		height: 32px;
		flex-shrink: 0;
	}

	.content p {
		margin: 0;
	}

	.buttons {
		display: flex;
		justify-content: center;
		padding: 6px 0 2px;
	}

	.buttons button {
		min-width: 80px;
	}
</style>
