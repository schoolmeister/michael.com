<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { projectsById } from './projects';
	import { focusedId, toggleMinimize, windows } from './windowManager';

	let time = '';
	let interval: ReturnType<typeof setInterval> | undefined;

	function updateTime() {
		time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	onMount(() => {
		updateTime();
		interval = setInterval(updateTime, 10_000);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});
</script>

<div class="taskbar">
	<div class="task-buttons">
		{#each $windows as w (w.id)}
			{@const def = projectsById[w.id]}
			<button
				class="task-button"
				class:active={$focusedId === w.id && !w.minimized}
				on:click={() => toggleMinimize(w.id)}
			>
				<img src={def.icon} alt="" />
				<span class="label">{def.title}</span>
			</button>
		{/each}
	</div>
	{#if time}
		<div class="clock status-bar-field">{time}</div>
	{/if}
</div>

<style>
	.taskbar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--taskbar-h, 30px);
		z-index: 10000;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 4px;
		box-sizing: border-box;
		background: silver;
		box-shadow:
			inset 0 1px #fff,
			inset 0 2px #dfdfdf;
	}

	.task-buttons {
		display: flex;
		flex: 1;
		gap: 3px;
		min-width: 0;
		overflow: hidden;
	}

	.task-button {
		display: flex;
		align-items: center;
		gap: 5px;
		min-width: 0;
		max-width: 160px;
		flex: 1 1 0;
		height: 24px;
		padding: 0 6px;
	}

	.task-button img {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	.task-button .label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* 98.css pressed look for the focused window's button */
	.task-button.active {
		box-shadow:
			inset -1px -1px #ffffff,
			inset 1px 1px #0a0a0a,
			inset -2px -2px #dfdfdf,
			inset 2px 2px #808080;
		font-weight: bold;
	}

	.clock {
		height: 22px;
		display: flex;
		align-items: center;
		padding: 0 8px;
		margin: 0;
	}
</style>
