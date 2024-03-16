import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';

export default async (req: Request, context: Context) => {
	const toqua = getStore('toqua');
	const status = await toqua.get('status');

	return new Response(status);
};
