import { exec } from 'child_process';
import { promisify } from 'util';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

export const GET: RequestHandler = async ({ params, url }) => {
	const { namespace, pod } = params;
	const tail = url.searchParams.get('tail') || '100';

	try {
		const { stdout } = await execAsync(`kubectl logs -n ${namespace} ${pod} -c evault --tail=${tail}`);
		const logs = stdout.trim().split('\n').filter(line => line.trim());
		
		return json({ logs });
	} catch (error) {
		console.error('Error fetching logs:', error);
		return json({ error: 'Failed to fetch logs', logs: [] }, { status: 500 });
	}
}; 