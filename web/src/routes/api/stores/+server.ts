import stores from '$lib/data/stores.json';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	return new Response(JSON.stringify(stores), {
		headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' }
	});
};
