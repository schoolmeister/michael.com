import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';

export default async (req: Request, context: Context) => {
	const toqua = getStore('toqua');
	const data = await req.text();

	if (typeof data !== 'string') {
		throw new Error('Invalid data: expected a string');
	}
	if (data.length > 100) {
		throw new Error('Invalid data: string exceeds maximum length of 100 characters');
	}
	const regex = /^[a-zA-Z0-9\s, ]+$/;
	if (!regex.test(data)) {
		throw new Error('Invalid data: expected a well-behaved string');
	}
	await toqua.set('status', data);

	return new Response('status set to ' + data, { status: 201 });
};
