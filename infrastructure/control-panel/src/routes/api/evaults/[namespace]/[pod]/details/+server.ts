import { exec } from 'child_process';
import { promisify } from 'util';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

export const GET: RequestHandler = async ({ params }) => {
	const { namespace, pod } = params;

	try {
		// Get detailed pod information
		const { stdout: podInfo } = await execAsync(`kubectl describe pod -n ${namespace} ${pod}`);
		
		// Get pod YAML
		const { stdout: podYaml } = await execAsync(`kubectl get pod -n ${namespace} ${pod} -o yaml`);
		
		// Get pod metrics if available
		let metrics = null;
		try {
			const { stdout: metricsOutput } = await execAsync(`kubectl top pod -n ${namespace} ${pod}`);
			metrics = metricsOutput.trim();
		} catch (metricsError) {
			// Metrics might not be available
			console.log('Metrics not available:', metricsError);
		}

		return json({
			podInfo: podInfo.trim(),
			podYaml: podYaml.trim(),
			metrics
		});
	} catch (error) {
		console.error('Error fetching pod details:', error);
		return json({ error: 'Failed to fetch pod details' }, { status: 500 });
	}
}; 