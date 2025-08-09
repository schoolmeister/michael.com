<script lang="ts">
	import 'leaflet/dist/leaflet.css';
	import 'leaflet.markercluster/dist/MarkerCluster.css';
	import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

	import { onMount, onDestroy } from 'svelte';
	import Window from '$lib/Window.svelte';
	import { browser } from '$app/environment';
	import image_uienradar from '$lib/images/uienradar.png';
	export let data;

	let mapElement: HTMLElement;
	let map: import('leaflet').Map;
	let L: typeof import('leaflet');
	let ro: ResizeObserver | null = null;

	function createMap(container: HTMLElement) {
		console.log(image_uienradar);
		let ICON = L.icon({
			iconUrl: image_uienradar,
			iconSize: [40, 40]
		});

		map = L.map(container).setView([51.049999, 3.733333], 19);
		L.tileLayer(
			'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1Ijoic2Nob29sbWVpc3RlciIsImEiOiJja3owY2F3d3kxYW85MzBteHN2aXZzOHl1In0.GdKYPEWxWqqsHornbQvUVg',
			{
				attribution:
					'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
				maxZoom: 18,
				id: 'mapbox/streets-v11',
				tileSize: 512,
				zoomOffset: -1
			}
		).addTo(map);

		let storesLayer = L.geoJSON(data.stores, {
			pointToLayer: function (feature, latlng) {
				return L.marker(latlng, { icon: ICON });
			}
		});

		L.markerClusterGroup({
			disableClusteringAtZoom: 13,
			spiderfyOnMaxZoom: false
		})
			.addLayer(storesLayer)
			.addTo(map);

		let lc = L.control.locate().addTo(map);
		// Keep a small pan after ready to trigger loading of tiles in new visible area
		map.whenReady(() => {
			map.invalidateSize();
			// slight nudge to force tile load bottom-right
			setTimeout(() => {
				if (!map) return;
				const c = map.getCenter();
				map.panTo(c, { animate: false });
				map.invalidateSize();
			}, 30);
		});
		return map;
	}

	onMount(async () => {
		if (browser) {
			await import('leaflet.locatecontrol');
			await import('leaflet.markercluster');
			L = await import('leaflet');
			createMap(mapElement);
			// Observe element size changes (drag-resize of custom Window does NOT trigger window.resize)
			ro = new ResizeObserver(() => {
				if (!map) return;
				map.invalidateSize();
			});
			ro.observe(mapElement);
			window.addEventListener('resize', handleWindowResize);
		}
	});

	onDestroy(async () => {
		if (browser) {
			window.removeEventListener('resize', handleWindowResize);
		}
		if (ro) {
			ro.disconnect();
		}
		if (map) {
			console.log('Unloading Leaflet map.');
			map.remove();
		}
	});

	function handleWindowResize() {
		if (!map) return;
		map.invalidateSize();
	}
</script>

<Window
	title="Uienradar"
	on:resize={() => {
		map && map.invalidateSize();
	}}
	on:resizeend={() => {
		if (map) {
			const c = map.getCenter();
			map.invalidateSize();
			// Force a re-center after size change to load tiles on newly exposed edges
			map.setView(c, map.getZoom(), { animate: false });
		}
	}}
>
	<div class="map-wrapper">
		<div bind:this={mapElement} class="map"></div>
	</div>
</Window>

<style>
	.map-wrapper {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
	}
	.map {
		flex: 1;
		/* Let it fill the window body */
		width: 100%;
		height: 100%;
	}
</style>
