<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="error-screen">
	<div class="window error-window">
		<div class="title-bar">
			<div class="title-bar-text">Critical Error</div>
			<div class="title-bar-controls">
				<button aria-label="Close" on:click={() => (window.location.href = '/')}></button>
			</div>
		</div>
		<div class="window-body">
			<div class="error-message">
				<h3>{$page.status}: {$page.error?.message}</h3>
			</div>
			<div class="buttons">
				<a href="/"><button>Back to desktop</button></a>
			</div>
		</div>
	</div>
</div>

<style>
	.error-screen {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: url($lib/images/windows-xp.jpg) no-repeat center center fixed;
		background-size: cover;
	}

	.error-window {
		width: 400px;
		max-width: calc(100vw - 20px);
	}

	h3 {
		margin: 0;
	}

	.error-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 12px 0;
	}

	.buttons {
		display: flex;
		justify-content: center;
		padding-bottom: 6px;
	}
</style>
