import stores from './stores.json';
// import {geojson} from '@types/leaflet';

import type { GeoJsonObject } from 'geojson';

interface Stores {
	stores: GeoJsonObject;
}

export function load(): Stores {
	return { stores: stores as GeoJsonObject };
}
