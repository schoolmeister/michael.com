<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import image_uienradar from '$lib/images/uienradar.png';
	export let data;

	let mapElement: HTMLElement;
	let map: import('leaflet').Map;
	let L: typeof import('leaflet');

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
				zoomOffset: -1,
				accessToken:
					'pk.eyJ1Ijoic2Nob29sbWVpc3RlciIsImEiOiJja3owY2F3d3kxYW85MzBteHN2aXZzOHl1In0.GdKYPEWxWqqsHornbQvUVg'
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
		return map;
	}

	onMount(async () => {
		if (browser) {
			await import('leaflet.locatecontrol');
			await import('leaflet.markercluster');
			L = await import('leaflet');
			createMap(mapElement);
		}
	});

	onDestroy(async () => {
		if (map) {
			console.log('Unloading Leaflet map.');
			map.remove();
		}
	});
</script>

<main bind:this={mapElement} class="map" />

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

	.map {
		height: 50vh;
		width: 50vw;
	}
</style>
