import stores from '$lib/data/stores.json';

import type { GeoJsonObject } from 'geojson';

interface Stores {
	stores: GeoJsonObject;
}

export function load(): Stores {
	return { stores: stores as GeoJsonObject };
}
