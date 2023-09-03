<script lang="ts">
	export let name: string;
	export let image: string;
	export let href: string;
</script>

<a href={null} on:dblclick|preventDefault={(e) => (window.location.href = href)}>
	<div class="icon" tabIndex="0">
		<img src={image} alt="uienradar" />
		<div class="title">{name}</div>
	</div>
</a>

<style>
	.icon {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		margin: 10px;
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
		font-family: sans-serif;
		font-family: 'MS Sans Serif', 'Segoe UI', sans-serif;
		font-size: 8pt;
		background: var(--Background);
		color: white;
		position: relative;
		box-sizing: border-box;
		display: flex;
		justify-content: center;
	}
</style>
