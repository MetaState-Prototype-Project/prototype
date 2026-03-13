import type { PageServerLoad } from './$types';

export interface ReferenceEdge {
	id: string;
	content: string;
	numericScore: number | null;
	referenceType: string;
	status: string;
	targetType: string; // "user" | "group" | "platform"
	targetId: string;
	targetName: string;
	author: {
		id: string;
		ename: string;
		name: string;
	};
	createdAt: string;
}


export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch('/api/references');
		const data = await response.json();
		return { references: (data.references ?? []) as ReferenceEdge[] };
	} catch (error) {
		console.error('Error loading references for visualizer:', error);
		return { references: [] as ReferenceEdge[] };
	}
};
