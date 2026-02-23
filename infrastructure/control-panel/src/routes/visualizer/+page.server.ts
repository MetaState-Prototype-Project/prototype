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

// ── Mock data generator ────────────────────────────────────────────────

const MOCK_USERS = [
	{ id: 'u1', ename: 'alice.w3ds', name: 'Alice Dupont' },
	{ id: 'u2', ename: 'bob.w3ds', name: 'Bob Martin' },
	{ id: 'u3', ename: 'charlie.w3ds', name: 'Charlie Roux' },
	{ id: 'u4', ename: 'diana.w3ds', name: 'Diana Chen' },
	{ id: 'u5', ename: 'emile.w3ds', name: 'Emile Voss' },
	{ id: 'u6', ename: 'fatima.w3ds', name: 'Fatima Nouri' },
	{ id: 'u7', ename: 'gabriel.w3ds', name: 'Gabriel Leroy' },
	{ id: 'u8', ename: 'hana.w3ds', name: 'Hana Takahashi' },
	{ id: 'u9', ename: 'ivan.w3ds', name: 'Ivan Petrov' },
	{ id: 'u10', ename: 'julia.w3ds', name: 'Julia Moreau' }
];

const MOCK_GROUPS = [
	{ id: 'g1', name: 'MetaState Core Team' },
	{ id: 'g2', name: 'W3DS Working Group' },
	{ id: 'g3', name: 'DAO Governance Board' },
	{ id: 'g4', name: 'Open Data Collective' }
];

const MOCK_PLATFORMS = [
	{ id: 'p1', name: 'Blabsy' },
	{ id: 'p2', name: 'Pictique' },
	{ id: 'p3', name: 'eVoting' },
	{ id: 'p4', name: 'eCurrency' },
	{ id: 'p5', name: 'Marketplace' }
];

const REFERENCE_TYPES = ['professional', 'academic', 'character', 'skill', 'leadership'];

const REFERENCE_TEXTS: Record<string, string[]> = {
	professional: [
		'Outstanding work ethic and delivery quality. Consistently exceeded expectations.',
		'A reliable professional who brings deep technical expertise to every project.',
		'Excellent collaborator — always willing to help and share knowledge with the team.'
	],
	academic: [
		'Exceptional research capabilities and a talent for synthesizing complex information.',
		'Contributed groundbreaking insights during our joint research project.'
	],
	character: [
		'Trustworthy and principled. A person of integrity in all interactions.',
		'Genuinely kind and supportive, making every team better by being in it.'
	],
	skill: [
		'Expert-level proficiency in distributed systems and cryptographic protocols.',
		'Remarkable problem-solving skills and attention to detail.',
		'Strong leadership in driving technical architecture decisions.'
	],
	leadership: [
		'Led our team through a challenging transition with empathy and clarity.',
		'Inspires others through vision and by example. A natural leader.'
	]
};

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockReferences(): ReferenceEdge[] {
	const references: ReferenceEdge[] = [];
	let refIndex = 0;

	// Each user gives 2-4 references to other users, groups, or platforms
	for (const author of MOCK_USERS) {
		const numRefs = 2 + Math.floor(Math.random() * 3); // 2-4

		for (let i = 0; i < numRefs; i++) {
			const roll = Math.random();
			let targetType: string;
			let targetId: string;
			let targetName: string;

			if (roll < 0.55) {
				// 55% chance: reference another user (not self)
				const candidates = MOCK_USERS.filter((u) => u.id !== author.id);
				const target = pick(candidates);
				targetType = 'user';
				targetId = target.id;
				targetName = target.name;
			} else if (roll < 0.80) {
				// 25% chance: reference a group
				const target = pick(MOCK_GROUPS);
				targetType = 'group';
				targetId = target.id;
				targetName = target.name;
			} else {
				// 20% chance: reference a platform
				const target = pick(MOCK_PLATFORMS);
				targetType = 'platform';
				targetId = target.id;
				targetName = target.name;
			}

			const refType = pick(REFERENCE_TYPES);
			const content = pick(REFERENCE_TEXTS[refType]);
			const hasScore = Math.random() > 0.3;
			const daysAgo = Math.floor(Math.random() * 365);

			references.push({
				id: `ref-${++refIndex}`,
				content,
				numericScore: hasScore ? Math.floor(Math.random() * 3) + 3 : null, // 3-5
				referenceType: refType,
				status: 'signed',
				targetType,
				targetId,
				targetName,
				author: { id: author.id, ename: author.ename, name: author.name },
				createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString()
			});
		}
	}

	return references;
}

// ── Data loader ─────────────────────────────────────────────────────────

const USE_MOCK = true;

export const load: PageServerLoad = async ({ fetch }) => {
	if (USE_MOCK) {
		return { references: generateMockReferences() };
	}

	try {
		const response = await fetch('/api/references');
		const data = await response.json();
		return { references: (data.references ?? []) as ReferenceEdge[] };
	} catch (error) {
		console.error('Error loading references for visualizer:', error);
		return { references: [] as ReferenceEdge[] };
	}
};
