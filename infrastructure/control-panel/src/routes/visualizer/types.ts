import type { ReferenceEdge } from './+page.server';

export type NodeDetail = {
	id: string;
	label: string;
	outgoing: { ref: ReferenceEdge; targetLabel: string }[];
	incoming: { ref: ReferenceEdge; authorLabel: string }[];
};
