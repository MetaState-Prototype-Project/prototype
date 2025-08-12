import { exec } from 'child_process';
import { promisify } from 'util';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

export const GET: RequestHandler = async ({ params }) => {
	const { namespace, pod } = params;
	
	console.log('Metrics API called with namespace:', namespace, 'pod:', pod);

	try {
		// Get pod resource usage (this might fail if metrics server not enabled)
		console.log('Running kubectl top pod...');
		let topOutput = '';
		try {
			const { stdout } = await execAsync(`kubectl top pod ${pod} -n ${namespace}`);
			topOutput = stdout;
		} catch (topError) {
			console.log('kubectl top pod failed (metrics server not available):', topError);
			topOutput = 'No metrics available';
		}
		console.log('kubectl top pod output:', topOutput);
		
		// Get pod status details
		console.log('Running kubectl describe pod...');
		const { stdout: describeOutput } = await execAsync(`kubectl describe pod ${pod} -n ${namespace} 2>/dev/null || echo "No pod details available"`);
		console.log('kubectl describe pod output length:', describeOutput?.length || 0);
		
		// Get container logs count (last 100 lines)
		console.log('Running kubectl logs...');
		const { stdout: logsOutput } = await execAsync(`kubectl logs -n ${namespace} ${pod} -c evault --tail=100 2>/dev/null || echo ""`);
		console.log('kubectl logs output length:', logsOutput?.length || 0);
		
		const logLines = logsOutput.trim().split('\n').filter(line => line.trim());
		
		// Parse top output for CPU and Memory
		let cpu = 'N/A';
		let memory = 'N/A';
		if (topOutput && !topOutput.includes('No metrics available') && !topOutput.includes('Metrics API not available')) {
			console.log('Parsing top output...');
			const lines = topOutput.trim().split('\n');
			console.log('Top output lines:', lines);
			if (lines.length > 1) {
				const podLine = lines[1]; // First line after header
				console.log('Pod line:', podLine);
				const parts = podLine.split(/\s+/);
				console.log('Pod line parts:', parts);
				if (parts.length >= 4) {
					cpu = parts[2] || 'N/A';
					memory = parts[3] || 'N/A';
					console.log('Extracted CPU:', cpu, 'Memory:', memory);
				}
			}
		}
		
		console.log('Final CPU:', cpu, 'Memory:', memory);
		
		// Parse describe output for events and conditions
		const events: string[] = [];
		const conditions: string[] = [];
		
		if (describeOutput && !describeOutput.includes('No pod details available')) {
			const lines = describeOutput.split('\n');
			let inEvents = false;
			let inConditions = false;
			
			for (const line of lines) {
				if (line.includes('Events:')) {
					inEvents = true;
					inConditions = false;
					continue;
				}
				if (line.includes('Conditions:')) {
					inConditions = true;
					inEvents = false;
					continue;
				}
				if (line.includes('Volumes:') || line.includes('QoS Class:')) {
					inEvents = false;
					inConditions = false;
					continue;
				}
				
				if (inEvents && line.trim() && !line.startsWith('  ')) {
					// Handle case where Events shows "<none>"
					if (line.trim() === '<none>') {
						events.push('No recent events');
					} else {
						events.push(line.trim());
					}
				}
				if (inConditions && line.trim() && !line.startsWith('  ')) {
					conditions.push(line.trim());
				}
			}
		}
		
		// Calculate basic stats
		const totalLogLines = logLines.length;
		const errorLogs = logLines.filter(line => 
			line.toLowerCase().includes('error') || 
			line.toLowerCase().includes('fail') ||
			line.toLowerCase().includes('exception')
		).length;
		const warningLogs = logLines.filter(line => 
			line.toLowerCase().includes('warn') || 
			line.toLowerCase().includes('warning')
		).length;
		
		// Get additional pod info for alternative metrics
		let podAge = 'N/A';
		let podStatus = 'Unknown';
		try {
			const { stdout: getPodOutput } = await execAsync(`kubectl get pod ${pod} -n ${namespace} -o json`);
			const podInfo = JSON.parse(getPodOutput);
			podAge = podInfo.metadata?.creationTimestamp ? 
				Math.floor((Date.now() - new Date(podInfo.metadata.creationTimestamp).getTime()) / (1000 * 60 * 60 * 24)) + 'd' : 'N/A';
			podStatus = podInfo.status?.phase || 'Unknown';
		} catch (podError) {
			console.log('Failed to get pod info:', podError);
		}
		
		const metrics = {
			resources: {
				cpu,
				memory,
				note: topOutput.includes('Metrics API not available') ? 'Metrics server not enabled' : undefined
			},
			logs: {
				totalLines: totalLogLines,
				errorCount: errorLogs,
				warningCount: warningLogs,
				lastUpdate: new Date().toISOString()
			},
			status: {
				events: events.length > 0 ? events : ['No recent events'],
				conditions: conditions.length > 0 ? conditions : ['No conditions available'],
				podAge,
				podStatus
			}
		};
		
		return json(metrics);
	} catch (error) {
		console.error('Error fetching metrics:', error);
		return json({ 
			error: 'Failed to fetch metrics',
			resources: { cpu: 'N/A', memory: 'N/A' },
			logs: { totalLines: 0, errorCount: 0, warningCount: 0, lastUpdate: new Date().toISOString() },
			status: { events: [], conditions: [] }
		}, { status: 500 });
	}
}; 