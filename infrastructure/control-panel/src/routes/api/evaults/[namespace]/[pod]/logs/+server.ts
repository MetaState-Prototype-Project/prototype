import { exec } from 'child_process';
import { promisify } from 'util';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

export const GET: RequestHandler = async ({ params, url }) => {
	const { namespace, pod } = params;
	const tail = url.searchParams.get('tail') || '100';

	try {
		// First check if the namespace exists
		try {
			await execAsync(`kubectl get namespace ${namespace}`);
		} catch (namespaceError: any) {
			if (namespaceError.stderr?.includes('not found')) {
				return json({ 
					error: `Namespace '${namespace}' not found. The eVault may have been deleted or terminated.`, 
					logs: [] 
				}, { status: 404 });
			}
			throw namespaceError;
		}

		// Then check if the pod exists
		try {
			await execAsync(`kubectl get pod ${pod} -n ${namespace}`);
		} catch (podError: any) {
			if (podError.stderr?.includes('not found')) {
				return json({ 
					error: `Pod '${pod}' not found in namespace '${namespace}'. The pod may have been deleted or terminated.`, 
					logs: [] 
				}, { status: 404 });
			}
			throw podError;
		}

		// If both exist, fetch the logs
		const { stdout } = await execAsync(
			`kubectl logs -n ${namespace} ${pod} -c evault --tail=${tail}`
		);
		const logs = stdout
			.trim()
			.split('\n')
			.filter((line) => line.trim());

		return json({ logs });
	} catch (error: any) {
		console.error('Error fetching logs:', error);
		
		// Handle specific kubectl errors
		if (error.stderr?.includes('not found')) {
			return json({ 
				error: 'Resource not found. The eVault or pod may have been deleted.', 
				logs: [] 
			}, { status: 404 });
		}
		
		return json({ 
			error: 'Failed to fetch logs. Please check if the eVault is still running.', 
			logs: [] 
		}, { status: 500 });
	}
};
